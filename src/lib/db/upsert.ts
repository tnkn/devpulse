import type { DuckDBConnection } from "@duckdb/node-api";
import type { Commit, PullRequest, Release, Issue } from "@/types";

export async function upsertCommits(conn: DuckDBConnection, commits: Commit[]): Promise<void> {
  if (commits.length === 0) return;
  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO commits (sha, message, author_name, author_email, author_date, committer_name, committer_email, committer_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
  );
  for (const c of commits) {
    stmt.bindVarchar(1, c.sha);
    stmt.bindVarchar(2, c.message);
    stmt.bindVarchar(3, c.author.name);
    stmt.bindVarchar(4, c.author.email);
    stmt.bindVarchar(5, c.author.date);
    stmt.bindVarchar(6, c.committer.name);
    stmt.bindVarchar(7, c.committer.email);
    stmt.bindVarchar(8, c.committer.date);
    await stmt.run();
  }
  stmt.destroySync();
}

export async function upsertPullRequests(conn: DuckDBConnection, prs: PullRequest[]): Promise<void> {
  if (prs.length === 0) return;
  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO pull_requests (number, title, state, created_at, updated_at, closed_at, merged_at, merge_commit_sha, head_ref, head_sha, base_ref, base_sha, labels_json, ci_failed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
  );
  for (const pr of prs) {
    stmt.bindInteger(1, pr.number);
    stmt.bindVarchar(2, pr.title);
    stmt.bindVarchar(3, pr.state);
    stmt.bindVarchar(4, pr.created_at);
    stmt.bindVarchar(5, pr.updated_at);
    if (pr.closed_at) stmt.bindVarchar(6, pr.closed_at); else stmt.bindNull(6);
    if (pr.merged_at) stmt.bindVarchar(7, pr.merged_at); else stmt.bindNull(7);
    if (pr.merge_commit_sha) stmt.bindVarchar(8, pr.merge_commit_sha); else stmt.bindNull(8);
    stmt.bindVarchar(9, pr.head.ref);
    stmt.bindVarchar(10, pr.head.sha);
    stmt.bindVarchar(11, pr.base.ref);
    stmt.bindVarchar(12, pr.base.sha);
    stmt.bindVarchar(13, JSON.stringify(pr.labels));
    if (pr.ci_failed !== undefined) stmt.bindBoolean(14, pr.ci_failed); else stmt.bindNull(14);
    await stmt.run();
  }
  stmt.destroySync();
}

export async function upsertReleases(conn: DuckDBConnection, releases: Release[]): Promise<void> {
  if (releases.length === 0) return;
  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO releases (id, tag_name, name, created_at, published_at, prerelease, draft)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`
  );
  for (const r of releases) {
    stmt.bindInteger(1, r.id);
    stmt.bindVarchar(2, r.tag_name);
    stmt.bindVarchar(3, r.name);
    stmt.bindVarchar(4, r.created_at);
    stmt.bindVarchar(5, r.published_at);
    stmt.bindBoolean(6, r.prerelease);
    stmt.bindBoolean(7, r.draft);
    await stmt.run();
  }
  stmt.destroySync();
}

export async function upsertIssues(conn: DuckDBConnection, issues: Issue[]): Promise<void> {
  if (issues.length === 0) return;
  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO issues (number, title, state, created_at, updated_at, closed_at, labels_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`
  );
  for (const i of issues) {
    stmt.bindInteger(1, i.number);
    stmt.bindVarchar(2, i.title);
    stmt.bindVarchar(3, i.state);
    stmt.bindVarchar(4, i.created_at);
    stmt.bindVarchar(5, i.updated_at);
    if (i.closed_at) stmt.bindVarchar(6, i.closed_at); else stmt.bindNull(6);
    stmt.bindVarchar(7, JSON.stringify(i.labels));
    await stmt.run();
  }
  stmt.destroySync();
}

export async function upsertMetadata(
  conn: DuckDBConnection,
  fullName: string,
  repositoryUrl: string,
): Promise<void> {
  const reader = await conn.runAndReadAll(`
    SELECT
      (SELECT COUNT(*) FROM commits) AS commit_count,
      (SELECT COUNT(*) FROM pull_requests) AS pull_request_count,
      (SELECT COUNT(*) FROM releases) AS release_count,
      (SELECT COUNT(*) FROM issues) AS issue_count
  `);
  const rows = reader.getRows();
  const cc = Number(rows[0][0]);
  const prc = Number(rows[0][1]);
  const rc = Number(rows[0][2]);
  const ic = Number(rows[0][3]);

  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO metadata (full_name, repository_url, last_collected_at, commit_count, pull_request_count, release_count, issue_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`
  );
  stmt.bindVarchar(1, fullName);
  stmt.bindVarchar(2, repositoryUrl);
  stmt.bindVarchar(3, new Date().toISOString());
  stmt.bindInteger(4, cc);
  stmt.bindInteger(5, prc);
  stmt.bindInteger(6, rc);
  stmt.bindInteger(7, ic);
  await stmt.run();
  stmt.destroySync();
}
