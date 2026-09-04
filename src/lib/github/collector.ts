import type { DuckDBConnection } from "@duckdb/node-api";
import { checkpoint, getConnection } from "@/lib/db";
import {
  getIssueRelationsSyncedAt,
  getIssuesAssigneesSyncedAt,
  replaceIssueRelations,
  updatePRSize,
  upsertCommits,
  upsertIssues,
  upsertMetadata,
  upsertPullRequests,
  upsertReleases,
  upsertReviews,
} from "@/lib/db/upsert";
import { getDecryptedToken } from "@/lib/tokens";
import type {
  CollectionJob,
  IssueDependencyEdge,
  IssueSubIssueEdge,
} from "@/types";
import {
  getCommitCheckFailed,
  getCommits,
  getIssueBlockedBy,
  getIssues,
  getPullRequestDetail,
  getPullRequestReviews,
  getPullRequests,
  getReleases,
  getSubIssues,
} from "./client";

const globalJobs = globalThis as unknown as {
  __dev_vis_jobs?: Map<string, CollectionJob>;
};
if (!globalJobs.__dev_vis_jobs) {
  globalJobs.__dev_vis_jobs = new Map();
}
const jobs = globalJobs.__dev_vis_jobs;

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function startCollection(
  owner: string,
  repo: string,
  tokenId?: string,
): CollectionJob {
  const id = generateJobId();
  const job: CollectionJob = {
    id,
    owner,
    repo,
    status: "pending",
    progress: "Starting...",
    started_at: new Date().toISOString(),
    completed_at: null,
    error: null,
    dump_path: null,
    token_id: tokenId || null,
  };

  jobs.set(id, job);

  // Fire-and-forget
  runCollection(job).catch(() => {
    // Error is captured in job state
  });

  return job;
}

export function getJob(id: string): CollectionJob | undefined {
  return jobs.get(id);
}

const ENV_TOKEN_ID = "env";

async function resolveJobToken(
  tokenId?: string | null,
): Promise<string | undefined> {
  if (!tokenId) return undefined; // will use default resolution in client

  // Explicit env var token
  if (tokenId === ENV_TOKEN_ID) {
    const envToken = process.env.GITHUB_TOKEN;
    if (!envToken)
      throw new Error("GITHUB_TOKEN environment variable is not set");
    return envToken;
  }

  try {
    const token = await getDecryptedToken(tokenId);
    return token || undefined;
  } catch {
    return undefined;
  }
}

async function getLatestTimestamps(repoKey: string): Promise<{
  commitSince: string | null;
  prSince: string | null;
  issueSince: string | null;
  assigneesSyncedAt: string | null;
  relationsSyncedAt: string | null;
}> {
  const conn = await getConnection(repoKey);
  try {
    const [commitReader, prReader, issueReader] = await Promise.all([
      conn.runAndReadAll("SELECT MAX(author_date) FROM commits"),
      conn.runAndReadAll("SELECT MAX(updated_at) FROM pull_requests"),
      conn.runAndReadAll("SELECT MAX(updated_at) FROM issues"),
    ]);
    const assigneesSyncedAt = await getIssuesAssigneesSyncedAt(conn);

    const commitRows = commitReader.getRows();
    const prRows = prReader.getRows();
    const issueRows = issueReader.getRows();

    return {
      commitSince: commitRows[0]?.[0] != null ? String(commitRows[0][0]) : null,
      prSince: prRows[0]?.[0] != null ? String(prRows[0][0]) : null,
      issueSince: issueRows[0]?.[0] != null ? String(issueRows[0][0]) : null,
      assigneesSyncedAt,
      relationsSyncedAt: await getIssueRelationsSyncedAt(conn),
    };
  } finally {
    conn.closeSync();
  }
}

/**
 * Syncs "blocked by" dependencies and sub-issue hierarchy from GitHub,
 * which owns both relationships. There is no bulk or GraphQL access to
 * them, so this costs one request per issue per relationship; the caller
 * limits which issues are visited.
 */
async function syncIssueRelations(
  conn: DuckDBConnection,
  owner: string,
  repo: string,
  issueNumbers: number[],
  token: string | undefined,
  onProgress: (done: number, total: number) => void,
): Promise<{ skippedCrossRepo: number }> {
  const repoFullName = `${owner}/${repo}`;
  const dependencies: IssueDependencyEdge[] = [];
  const subIssues: IssueSubIssueEdge[] = [];
  let skippedCrossRepo = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < issueNumbers.length; i += BATCH_SIZE) {
    const batch = issueNumbers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (number) => ({
        number,
        blockedBy: await getIssueBlockedBy(owner, repo, number, token),
        children: await getSubIssues(owner, repo, number, token),
      })),
    );

    for (const { number, blockedBy, children } of results) {
      for (const ref of blockedBy) {
        // The graph is scoped to one repository; relationships pointing
        // elsewhere are counted and skipped rather than half-rendered.
        if (ref.repository && ref.repository !== repoFullName) {
          skippedCrossRepo++;
          continue;
        }
        dependencies.push({
          blocker_number: ref.number,
          blocked_number: number,
        });
      }
      for (const ref of children) {
        if (ref.repository && ref.repository !== repoFullName) {
          skippedCrossRepo++;
          continue;
        }
        subIssues.push({ parent_number: number, child_number: ref.number });
      }
    }

    onProgress(
      Math.min(i + BATCH_SIZE, issueNumbers.length),
      issueNumbers.length,
    );
  }

  await replaceIssueRelations(conn, issueNumbers, dependencies, subIssues);
  return { skippedCrossRepo };
}

async function runCollection(job: CollectionJob): Promise<void> {
  const { owner, repo } = job;
  const repoKey = `${owner}__${repo}`;

  try {
    job.status = "collecting";

    // Resolve the token for this job
    const token = await resolveJobToken(job.token_id);

    // Get latest timestamps for differential fetch
    job.progress = "Checking existing data...";
    const timestamps = await getLatestTimestamps(repoKey);

    // Issues stored before assignees were collected would keep an empty
    // assignee list forever, because `since` only returns issues updated
    // after the last run. Re-fetch them all once, then go back to
    // differential fetches.
    const needsAssigneeBackfill = !timestamps.assigneesSyncedAt;
    const issueSince = needsAssigneeBackfill ? null : timestamps.issueSince;

    const isDiff = !!(
      timestamps.commitSince ||
      timestamps.prSince ||
      issueSince
    );

    if (isDiff) {
      console.log(
        `[collector] Differential fetch for ${owner}/${repo} (commits since: ${timestamps.commitSince}, PRs since: ${timestamps.prSince}, issues since: ${issueSince})`,
      );
    } else {
      console.log(`[collector] Full fetch for ${owner}/${repo}`);
    }
    if (needsAssigneeBackfill && timestamps.issueSince) {
      console.log(
        `[collector] Re-fetching all issues for ${owner}/${repo} to backfill assignees`,
      );
    }

    // Collect commits (supports `since`)
    job.progress = "Collecting commits...";
    const newCommits = await getCommits(
      owner,
      repo,
      timestamps.commitSince
        ? { since: timestamps.commitSince, token }
        : { token },
    );
    console.log(`[collector] Fetched ${newCommits.length} commits`);

    // Collect pull requests (uses updated_at cutoff)
    job.progress = "Collecting pull requests...";
    const newPulls = await getPullRequests(
      owner,
      repo,
      timestamps.prSince ? { since: timestamps.prSince, token } : { token },
    );
    console.log(`[collector] Fetched ${newPulls.length} pull requests`);

    // Collect releases (always full fetch, typically small)
    job.progress = "Collecting releases...";
    const newReleases = await getReleases(owner, repo, token);
    console.log(`[collector] Fetched ${newReleases.length} releases`);

    // Collect issues (supports `since`, unless assignees need backfilling)
    job.progress = needsAssigneeBackfill
      ? "Collecting issues (backfilling assignees)..."
      : "Collecting issues...";
    const newIssues = await getIssues(
      owner,
      repo,
      issueSince ? { since: issueSince, token } : { token },
    );
    console.log(`[collector] Fetched ${newIssues.length} issues`);

    // Upsert into DuckDB
    job.progress = "Saving to database...";
    const conn = await getConnection(repoKey);
    try {
      await upsertCommits(conn, newCommits);
      await upsertPullRequests(conn, newPulls);
      await upsertReleases(conn, newReleases);
      await upsertIssues(conn, newIssues);

      // Collect CI status for merged PRs that don't have ci_failed yet
      try {
        const ciReader = await conn.runAndReadAll(
          "SELECT number, head_sha FROM pull_requests WHERE merged_at IS NOT NULL AND ci_failed IS NULL",
        );
        const prsNeedingCI = ciReader.getRows();
        if (prsNeedingCI.length > 0) {
          job.progress = `Checking CI status (0/${prsNeedingCI.length})...`;
          const BATCH_SIZE = 10;
          const ciResults: { number: number; ci_failed: boolean }[] = [];

          for (let i = 0; i < prsNeedingCI.length; i += BATCH_SIZE) {
            const batch = prsNeedingCI.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
              batch.map((row) =>
                getCommitCheckFailed(owner, repo, String(row[1]), token),
              ),
            );
            batch.forEach((row, idx) => {
              ciResults.push({
                number: Number(row[0]),
                ci_failed: results[idx],
              });
            });
            job.progress = `Checking CI status (${Math.min(i + BATCH_SIZE, prsNeedingCI.length)}/${prsNeedingCI.length})...`;
          }

          const stmt = await conn.prepare(
            "UPDATE pull_requests SET ci_failed = $1 WHERE number = $2",
          );
          for (const { number, ci_failed } of ciResults) {
            stmt.bindBoolean(1, ci_failed);
            stmt.bindInteger(2, number);
            await stmt.run();
          }
          stmt.destroySync();
        }
      } catch (ciErr) {
        console.warn(
          `[collector] Skipping CI status check: ${ciErr instanceof Error ? ciErr.message : ciErr}`,
        );
      }

      // Collect PR size (additions/deletions) for merged PRs that don't have it yet
      try {
        const sizeReader = await conn.runAndReadAll(
          "SELECT number FROM pull_requests WHERE merged_at IS NOT NULL AND additions IS NULL",
        );
        const prsNeedingSize = sizeReader.getRows();
        if (prsNeedingSize.length > 0) {
          job.progress = `Fetching PR sizes (0/${prsNeedingSize.length})...`;
          const BATCH_SIZE = 10;

          for (let i = 0; i < prsNeedingSize.length; i += BATCH_SIZE) {
            const batch = prsNeedingSize.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
              batch.map((row) =>
                getPullRequestDetail(owner, repo, Number(row[0]), token),
              ),
            );
            for (let j = 0; j < batch.length; j++) {
              await updatePRSize(
                conn,
                Number(batch[j][0]),
                results[j].additions,
                results[j].deletions,
              );
            }
            job.progress = `Fetching PR sizes (${Math.min(i + BATCH_SIZE, prsNeedingSize.length)}/${prsNeedingSize.length})...`;
          }
        }
      } catch (sizeErr) {
        console.warn(
          `[collector] Skipping PR size fetch: ${sizeErr instanceof Error ? sizeErr.message : sizeErr}`,
        );
      }

      // Backfill user_login for PRs that are missing it
      try {
        const loginReader = await conn.runAndReadAll(
          "SELECT number FROM pull_requests WHERE user_login IS NULL",
        );
        const prsNeedingLogin = loginReader.getRows();
        if (prsNeedingLogin.length > 0) {
          job.progress = `Backfilling PR authors (0/${prsNeedingLogin.length})...`;
          const BATCH_SIZE = 10;

          for (let i = 0; i < prsNeedingLogin.length; i += BATCH_SIZE) {
            const batch = prsNeedingLogin.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
              batch.map((row) =>
                getPullRequestDetail(owner, repo, Number(row[0]), token),
              ),
            );
            for (let j = 0; j < batch.length; j++) {
              const login = results[j].user_login;
              if (login) {
                const ustmt = await conn.prepare(
                  "UPDATE pull_requests SET user_login = $1 WHERE number = $2",
                );
                ustmt.bindVarchar(1, login);
                ustmt.bindInteger(2, Number(batch[j][0]));
                await ustmt.run();
                ustmt.destroySync();
              }
            }
            job.progress = `Backfilling PR authors (${Math.min(i + BATCH_SIZE, prsNeedingLogin.length)}/${prsNeedingLogin.length})...`;
          }
        }
      } catch (loginErr) {
        console.warn(
          `[collector] Skipping PR author backfill: ${loginErr instanceof Error ? loginErr.message : loginErr}`,
        );
      }

      // Collect reviews for merged PRs that don't have reviews yet
      try {
        const reviewReader = await conn.runAndReadAll(
          `SELECT DISTINCT p.number FROM pull_requests p
           LEFT JOIN reviews r ON p.number = r.pr_number
           WHERE p.merged_at IS NOT NULL AND r.id IS NULL`,
        );
        const prsNeedingReviews = reviewReader.getRows();
        if (prsNeedingReviews.length > 0) {
          job.progress = `Fetching reviews (0/${prsNeedingReviews.length})...`;
          const BATCH_SIZE = 10;

          for (let i = 0; i < prsNeedingReviews.length; i += BATCH_SIZE) {
            const batch = prsNeedingReviews.slice(i, i + BATCH_SIZE);
            const reviewBatches = await Promise.all(
              batch.map((row) =>
                getPullRequestReviews(owner, repo, Number(row[0]), token),
              ),
            );
            const allReviews = reviewBatches.flat();
            if (allReviews.length > 0) {
              await upsertReviews(conn, allReviews);
            }
            job.progress = `Fetching reviews (${Math.min(i + BATCH_SIZE, prsNeedingReviews.length)}/${prsNeedingReviews.length})...`;
          }
        }
      } catch (reviewErr) {
        console.warn(
          `[collector] Skipping reviews fetch: ${reviewErr instanceof Error ? reviewErr.message : reviewErr}`,
        );
      }

      // Sync issue relationships (GitHub owns them). A full pass on the
      // first run, then only the issues touched by this run.
      let relationsSyncedAt = timestamps.relationsSyncedAt;
      try {
        const relationScope = relationsSyncedAt
          ? newIssues.map((i) => i.number)
          : (
              await conn.runAndReadAll(
                "SELECT number FROM issues ORDER BY number",
              )
            )
              .getRows()
              .map((r) => Number(r[0]));

        if (relationScope.length > 0) {
          job.progress = `Syncing issue relationships (0/${relationScope.length})...`;
          const { skippedCrossRepo } = await syncIssueRelations(
            conn,
            owner,
            repo,
            relationScope,
            token,
            (done, total) => {
              job.progress = `Syncing issue relationships (${done}/${total})...`;
            },
          );
          console.log(
            `[collector] Synced relationships for ${relationScope.length} issues` +
              (skippedCrossRepo > 0
                ? ` (skipped ${skippedCrossRepo} cross-repository links)`
                : ""),
          );
        }
        relationsSyncedAt = relationsSyncedAt ?? new Date().toISOString();
      } catch (relErr) {
        // Leave the marker unset so the next run retries the full pass.
        console.warn(
          `[collector] Skipping issue relationship sync: ${relErr instanceof Error ? relErr.message : relErr}`,
        );
      }

      // Update metadata (with token_id). The assignee marker is stamped
      // once the run that fetched every issue has stored them.
      await upsertMetadata(
        conn,
        `${owner}/${repo}`,
        `https://github.com/${owner}/${repo}`,
        job.token_id,
        timestamps.assigneesSyncedAt ?? new Date().toISOString(),
        relationsSyncedAt,
      );
    } finally {
      conn.closeSync();
    }

    // Flush WAL to disk so data survives sudden container termination
    await checkpoint(repoKey);

    // Get final counts for progress message
    const countConn = await getConnection(repoKey);
    const countReader = await countConn.runAndReadAll(`
      SELECT
        (SELECT COUNT(*) FROM commits),
        (SELECT COUNT(*) FROM pull_requests),
        (SELECT COUNT(*) FROM releases),
        (SELECT COUNT(*) FROM issues)
    `);
    const counts = countReader.getRows()[0];
    countConn.closeSync();

    job.status = "completed";
    job.progress = `Done! ${counts[0]} commits, ${counts[1]} PRs, ${counts[2]} releases, ${counts[3]} issues`;
    job.completed_at = new Date().toISOString();
    job.dump_path = repoKey;
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Unknown error";
    job.progress = "Failed";
    job.completed_at = new Date().toISOString();
  }
}
