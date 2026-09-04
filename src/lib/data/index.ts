import type { DuckDBConnection } from "@duckdb/node-api";
import { getConnection, getRepositoryKeys } from "@/lib/db";
import {
  getIssuesProjectFieldsError,
  getIssuesProjectFieldsSyncedAt,
  listIssueDependencies,
  listIssueSubIssues,
  listProjectFields,
} from "@/lib/db/upsert";
import type {
  Commit,
  DumpMetadata,
  Issue,
  IssueDependencyEdge,
  IssueSubIssueEdge,
  ProjectFieldDefinition,
  PullRequest,
  Release,
  Repository,
  Review,
} from "@/types";

export async function getRepositories(): Promise<Repository[]> {
  const keys = await getRepositoryKeys();
  const repositories: Repository[] = [];

  for (const key of keys) {
    try {
      const conn = await getConnection(key);
      const reader = await conn.runAndReadAll(
        "SELECT full_name, last_collected_at, token_id FROM metadata LIMIT 1",
      );
      const rows = reader.getRows();
      conn.closeSync();

      const displayName =
        rows.length > 0 && rows[0][0]
          ? String(rows[0][0])
          : key.includes("__")
            ? key.replace("__", "/")
            : key;
      const lastCollected =
        rows.length > 0 && rows[0][1] ? String(rows[0][1]) : null;
      const tokenId = rows.length > 0 && rows[0][2] ? String(rows[0][2]) : null;

      repositories.push({
        name: key,
        displayName,
        lastCollected,
        token_id: tokenId,
      });
    } catch {
      // If DB access fails, still show the repo with minimal info
      repositories.push({
        name: key,
        displayName: key.includes("__") ? key.replace("__", "/") : key,
        lastCollected: null,
      });
    }
  }

  return repositories;
}

export async function getRepoData(repoName: string): Promise<{
  metadata: DumpMetadata | null;
  commits: Commit[];
  pulls: PullRequest[];
  releases: Release[];
  issues: Issue[];
  reviews: Review[];
}> {
  let conn: DuckDBConnection;
  try {
    conn = await getConnection(repoName);
  } catch {
    return {
      metadata: null,
      commits: [],
      pulls: [],
      releases: [],
      issues: [],
      reviews: [],
    };
  }

  try {
    const [
      metaReader,
      commitReader,
      prReader,
      releaseReader,
      issueReader,
      reviewReader,
    ] = await Promise.all([
      conn.runAndReadAll(
        "SELECT full_name, repository_url, last_collected_at, commit_count, pull_request_count, release_count, issue_count, token_id FROM metadata LIMIT 1",
      ),
      conn.runAndReadAll(
        "SELECT sha, message, author_name, author_email, author_date, committer_name, committer_email, committer_date FROM commits ORDER BY author_date DESC",
      ),
      conn.runAndReadAll(
        "SELECT number, title, state, created_at, updated_at, closed_at, merged_at, merge_commit_sha, head_ref, head_sha, base_ref, base_sha, labels_json, ci_failed, additions, deletions, user_login, assignees_json FROM pull_requests ORDER BY number DESC",
      ),
      conn.runAndReadAll(
        "SELECT id, tag_name, name, created_at, published_at, prerelease, draft FROM releases ORDER BY published_at DESC",
      ),
      conn.runAndReadAll(
        "SELECT number, title, state, created_at, updated_at, closed_at, labels_json, assignees_json, priority, size, project_id, project_item_id FROM issues ORDER BY number DESC",
      ),
      conn.runAndReadAll(
        "SELECT id, pr_number, user_login, user_type, state, submitted_at FROM reviews ORDER BY submitted_at ASC",
      ),
    ]);

    conn.closeSync();

    // Parse metadata
    const metaRows = metaReader.getRows();
    const metadata: DumpMetadata | null =
      metaRows.length > 0
        ? {
            repository: String(metaRows[0][0]),
            repository_url: String(metaRows[0][1]),
            dumped_at: String(metaRows[0][2]),
            commit_count: Number(metaRows[0][3]),
            pull_request_count: Number(metaRows[0][4]),
            release_count: Number(metaRows[0][5]),
            issue_count: Number(metaRows[0][6]),
            token_id: metaRows[0][7] != null ? String(metaRows[0][7]) : null,
          }
        : null;

    // Parse commits
    const commits: Commit[] = commitReader.getRows().map((r) => ({
      sha: String(r[0]),
      message: String(r[1]),
      author: { name: String(r[2]), email: String(r[3]), date: String(r[4]) },
      committer: {
        name: String(r[5]),
        email: String(r[6]),
        date: String(r[7]),
      },
    }));

    // Parse pull requests
    const pulls: PullRequest[] = prReader.getRows().map((r) => ({
      number: Number(r[0]),
      title: String(r[1]),
      state: String(r[2]) as PullRequest["state"],
      created_at: String(r[3]),
      updated_at: String(r[4]),
      closed_at: r[5] != null ? String(r[5]) : null,
      merged_at: r[6] != null ? String(r[6]) : null,
      merge_commit_sha: r[7] != null ? String(r[7]) : null,
      head: { ref: String(r[8]), sha: String(r[9]) },
      base: { ref: String(r[10]), sha: String(r[11]) },
      labels: parseLabelsJson(r[12]),
      ...(r[13] != null ? { ci_failed: Boolean(r[13]) } : {}),
      ...(r[14] != null ? { additions: Number(r[14]) } : {}),
      ...(r[15] != null ? { deletions: Number(r[15]) } : {}),
      ...(r[16] != null ? { user_login: String(r[16]) } : {}),
      assignees:
        r[17] != null
          ? (() => {
              try {
                return JSON.parse(String(r[17]));
              } catch {
                return [];
              }
            })()
          : [],
    }));

    // Parse releases
    const releases: Release[] = releaseReader.getRows().map((r) => ({
      id: Number(r[0]),
      tag_name: String(r[1]),
      name: String(r[2]),
      created_at: String(r[3]),
      published_at: String(r[4]),
      prerelease: Boolean(r[5]),
      draft: Boolean(r[6]),
    }));

    // Parse issues
    const issues: Issue[] = issueReader.getRows().map((r) => ({
      number: Number(r[0]),
      title: String(r[1]),
      state: String(r[2]) as Issue["state"],
      created_at: String(r[3]),
      updated_at: String(r[4]),
      closed_at: r[5] != null ? String(r[5]) : null,
      labels: parseLabelsJson(r[6]),
      assignees: parseAssigneesJson(r[7]),
      priority: r[8] != null ? String(r[8]) : null,
      size: r[9] != null ? String(r[9]) : null,
      project_id: r[10] != null ? String(r[10]) : null,
      project_item_id: r[11] != null ? String(r[11]) : null,
    }));

    // Parse reviews
    const reviews: Review[] = reviewReader.getRows().map((r) => ({
      id: Number(r[0]),
      pr_number: Number(r[1]),
      user_login: String(r[2]),
      user_type: String(r[3]),
      state: String(r[4]),
      submitted_at: String(r[5]),
    }));

    return { metadata, commits, pulls, releases, issues, reviews };
  } catch {
    conn.closeSync();
    return {
      metadata: null,
      commits: [],
      pulls: [],
      releases: [],
      issues: [],
      reviews: [],
    };
  }
}

function parseLabelsJson(value: unknown): { name: string }[] {
  if (value == null) return [];
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function parseAssigneesJson(value: unknown): string[] {
  if (value == null) return [];
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

/** Issue relationships as last synced from GitHub. */
export async function getIssueRelations(repoName: string): Promise<{
  dependencies: IssueDependencyEdge[];
  subIssues: IssueSubIssueEdge[];
  /** The editable board fields, so a cell knows what it may offer. */
  projectFields: ProjectFieldDefinition[];
  /**
   * When Projects was last read successfully, or null if it never was.
   * Without this, "no board fields" cannot be told apart from "we have
   * never managed to look", and the two need opposite advice.
   */
  projectFieldsSyncedAt: string | null;
  /** Why the last run could not read Projects, or null if it could. */
  projectFieldsError: string | null;
}> {
  let conn: DuckDBConnection;
  try {
    conn = await getConnection(repoName);
  } catch {
    return {
      dependencies: [],
      subIssues: [],
      projectFields: [],
      projectFieldsSyncedAt: null,
      projectFieldsError: null,
    };
  }
  try {
    return {
      dependencies: await listIssueDependencies(conn),
      subIssues: await listIssueSubIssues(conn),
      projectFields: await listProjectFields(conn),
      projectFieldsSyncedAt: await getIssuesProjectFieldsSyncedAt(conn),
      projectFieldsError: await getIssuesProjectFieldsError(conn),
    };
  } finally {
    conn.closeSync();
  }
}
