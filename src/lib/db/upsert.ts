import type { DuckDBConnection } from "@duckdb/node-api";
import type {
  Commit,
  Issue,
  IssueDependencyEdge,
  IssueProjectFields,
  IssueSubIssueEdge,
  ProjectFieldDefinition,
  PullRequest,
  Release,
  Review,
} from "@/types";

export async function upsertCommits(
  conn: DuckDBConnection,
  commits: Commit[],
): Promise<void> {
  if (commits.length === 0) return;
  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO commits (sha, message, author_name, author_email, author_date, committer_name, committer_email, committer_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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

export async function upsertPullRequests(
  conn: DuckDBConnection,
  prs: PullRequest[],
): Promise<void> {
  if (prs.length === 0) return;
  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO pull_requests (number, title, state, created_at, updated_at, closed_at, merged_at, merge_commit_sha, head_ref, head_sha, base_ref, base_sha, labels_json, ci_failed, additions, deletions, user_login, assignees_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
  );
  for (const pr of prs) {
    stmt.bindInteger(1, pr.number);
    stmt.bindVarchar(2, pr.title);
    stmt.bindVarchar(3, pr.state);
    stmt.bindVarchar(4, pr.created_at);
    stmt.bindVarchar(5, pr.updated_at);
    if (pr.closed_at) stmt.bindVarchar(6, pr.closed_at);
    else stmt.bindNull(6);
    if (pr.merged_at) stmt.bindVarchar(7, pr.merged_at);
    else stmt.bindNull(7);
    if (pr.merge_commit_sha) stmt.bindVarchar(8, pr.merge_commit_sha);
    else stmt.bindNull(8);
    stmt.bindVarchar(9, pr.head.ref);
    stmt.bindVarchar(10, pr.head.sha);
    stmt.bindVarchar(11, pr.base.ref);
    stmt.bindVarchar(12, pr.base.sha);
    stmt.bindVarchar(13, JSON.stringify(pr.labels));
    if (pr.ci_failed !== undefined) stmt.bindBoolean(14, pr.ci_failed);
    else stmt.bindNull(14);
    if (pr.additions !== undefined) stmt.bindInteger(15, pr.additions);
    else stmt.bindNull(15);
    if (pr.deletions !== undefined) stmt.bindInteger(16, pr.deletions);
    else stmt.bindNull(16);
    if (pr.user_login) stmt.bindVarchar(17, pr.user_login);
    else stmt.bindNull(17);
    stmt.bindVarchar(18, JSON.stringify(pr.assignees ?? []));
    await stmt.run();
  }
  stmt.destroySync();
}

export async function upsertReleases(
  conn: DuckDBConnection,
  releases: Release[],
): Promise<void> {
  if (releases.length === 0) return;
  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO releases (id, tag_name, name, created_at, published_at, prerelease, draft)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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

export async function upsertIssues(
  conn: DuckDBConnection,
  issues: Issue[],
): Promise<void> {
  if (issues.length === 0) return;
  const stmt = await conn.prepare(
    // Project fields are listed here, not written by a later UPDATE:
    // INSERT OR REPLACE rewrites the whole row, so a column left out
    // would be blanked every time an issue is re-collected.
    `INSERT OR REPLACE INTO issues (number, title, state, created_at, updated_at, closed_at, labels_json, assignees_json, issue_id, priority, size, project_id, project_item_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
  );
  for (const i of issues) {
    stmt.bindInteger(1, i.number);
    stmt.bindVarchar(2, i.title);
    stmt.bindVarchar(3, i.state);
    stmt.bindVarchar(4, i.created_at);
    stmt.bindVarchar(5, i.updated_at);
    if (i.closed_at) stmt.bindVarchar(6, i.closed_at);
    else stmt.bindNull(6);
    stmt.bindVarchar(7, JSON.stringify(i.labels));
    stmt.bindVarchar(8, JSON.stringify(i.assignees ?? []));
    if (i.id != null) stmt.bindBigInt(9, BigInt(i.id));
    else stmt.bindNull(9);
    if (i.priority) stmt.bindVarchar(10, i.priority);
    else stmt.bindNull(10);
    if (i.size) stmt.bindVarchar(11, i.size);
    else stmt.bindNull(11);
    if (i.project_id) stmt.bindVarchar(12, i.project_id);
    else stmt.bindNull(12);
    if (i.project_item_id) stmt.bindVarchar(13, i.project_item_id);
    else stmt.bindNull(13);
    await stmt.run();
  }
  stmt.destroySync();
}

/**
 * Priority and Size already stored for the given issues.
 *
 * Used to carry them over when a collection run cannot reach Projects:
 * the issue upsert rewrites the whole row, so without this a run with no
 * project access would quietly blank fields it simply could not read.
 */
export async function getStoredProjectFields(
  conn: DuckDBConnection,
  issueNumbers: number[],
): Promise<Map<number, IssueProjectFields>> {
  const fields = new Map<number, IssueProjectFields>();
  if (issueNumbers.length === 0) return fields;

  const scope = issueNumbers.join(",");
  const reader = await conn.runAndReadAll(
    `SELECT number, priority, size, project_id, project_item_id FROM issues WHERE number IN (${scope})`,
  );
  for (const row of reader.getRows()) {
    fields.set(Number(row[0]), {
      priority: row[1] == null ? null : String(row[1]),
      size: row[2] == null ? null : String(row[2]),
      projectId: row[3] == null ? null : String(row[3]),
      projectItemId: row[4] == null ? null : String(row[4]),
    });
  }
  return fields;
}

/** Replaces the cached board field definitions for this repository. */
export async function replaceProjectFields(
  conn: DuckDBConnection,
  definitions: ProjectFieldDefinition[],
): Promise<void> {
  await conn.run("DELETE FROM project_fields");
  if (definitions.length === 0) return;

  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO project_fields (project_id, field_id, project_title, field_name, kind, data_type, options_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  );
  for (const d of definitions) {
    stmt.bindVarchar(1, d.projectId);
    stmt.bindVarchar(2, d.fieldId);
    stmt.bindVarchar(3, d.projectTitle);
    stmt.bindVarchar(4, d.fieldName);
    stmt.bindVarchar(5, d.kind);
    stmt.bindVarchar(6, d.dataType);
    stmt.bindVarchar(7, JSON.stringify(d.options));
    await stmt.run();
  }
  stmt.destroySync();
}

/** The cached board field definitions, for rendering and for writes. */
export async function listProjectFields(
  conn: DuckDBConnection,
): Promise<ProjectFieldDefinition[]> {
  const reader = await conn.runAndReadAll(
    "SELECT project_id, field_id, project_title, field_name, kind, data_type, options_json FROM project_fields ORDER BY project_id, kind",
  );
  return reader.getRows().map((row) => ({
    projectId: String(row[0]),
    fieldId: String(row[1]),
    projectTitle: row[2] == null ? "" : String(row[2]),
    fieldName: String(row[3]),
    kind: String(row[4]) as ProjectFieldDefinition["kind"],
    dataType: String(row[5]),
    options: row[6] == null ? [] : JSON.parse(String(row[6])),
  }));
}

/**
 * Writes an accepted edit into the local row.
 *
 * An UPDATE rather than the usual upsert: only the edited column may
 * move, and the issue's other columns are not ours to restate here.
 * Called only after GitHub has taken the change.
 */
export async function setIssueFieldsLocally(
  conn: DuckDBConnection,
  issueNumber: number,
  fields: {
    priority?: string | null;
    size?: string | null;
    assignees?: string[];
  },
): Promise<void> {
  const assignments: string[] = [];
  const values: (string | null)[] = [];

  if ("priority" in fields) {
    assignments.push(`priority = $${assignments.length + 2}`);
    values.push(fields.priority ?? null);
  }
  if ("size" in fields) {
    assignments.push(`size = $${assignments.length + 2}`);
    values.push(fields.size ?? null);
  }
  if ("assignees" in fields) {
    assignments.push(`assignees_json = $${assignments.length + 2}`);
    values.push(JSON.stringify(fields.assignees ?? []));
  }
  if (assignments.length === 0) return;

  const stmt = await conn.prepare(
    `UPDATE issues SET ${assignments.join(", ")} WHERE number = $1`,
  );
  stmt.bindInteger(1, issueNumber);
  values.forEach((value, index) => {
    if (value === null) stmt.bindNull(index + 2);
    else stmt.bindVarchar(index + 2, value);
  });
  await stmt.run();
  stmt.destroySync();
}

/** The board item one issue's project fields are edited through. */
export async function getIssueProjectItem(
  conn: DuckDBConnection,
  issueNumber: number,
): Promise<{ projectId: string; projectItemId: string } | null> {
  const stmt = await conn.prepare(
    "SELECT project_id, project_item_id FROM issues WHERE number = $1",
  );
  stmt.bindInteger(1, issueNumber);
  const reader = await stmt.runAndReadAll();
  stmt.destroySync();
  const row = reader.getRows()[0];
  if (!row || row[0] == null || row[1] == null) return null;
  return { projectId: String(row[0]), projectItemId: String(row[1]) };
}

/** When project fields were last fetched for every issue, or null. */
/** The reason the last run could not read Projects, or null if it could. */
export async function getIssuesProjectFieldsError(
  conn: DuckDBConnection,
): Promise<string | null> {
  const reader = await conn.runAndReadAll(
    "SELECT issues_project_fields_error FROM metadata LIMIT 1",
  );
  const rows = reader.getRows();
  return rows[0]?.[0] != null ? String(rows[0][0]) : null;
}

export async function getIssuesProjectFieldsSyncedAt(
  conn: DuckDBConnection,
): Promise<string | null> {
  const reader = await conn.runAndReadAll(
    "SELECT issues_project_fields_synced_at FROM metadata LIMIT 1",
  );
  const rows = reader.getRows();
  return rows[0]?.[0] != null ? String(rows[0][0]) : null;
}

/** GitHub's global issue id for an issue number, or null if unknown. */
export async function getIssueGlobalId(
  conn: DuckDBConnection,
  issueNumber: number,
): Promise<number | null> {
  const stmt = await conn.prepare(
    "SELECT issue_id FROM issues WHERE number = $1",
  );
  stmt.bindInteger(1, issueNumber);
  const reader = await stmt.runAndReadAll();
  stmt.destroySync();
  const rows = reader.getRows();
  return rows[0]?.[0] != null ? Number(rows[0][0]) : null;
}

export async function listIssueDependencies(
  conn: DuckDBConnection,
): Promise<IssueDependencyEdge[]> {
  const reader = await conn.runAndReadAll(
    "SELECT blocker_number, blocked_number FROM issue_dependencies ORDER BY blocker_number, blocked_number",
  );
  return reader.getRows().map((r) => ({
    blocker_number: Number(r[0]),
    blocked_number: Number(r[1]),
  }));
}

export async function listIssueSubIssues(
  conn: DuckDBConnection,
): Promise<IssueSubIssueEdge[]> {
  const reader = await conn.runAndReadAll(
    "SELECT parent_number, child_number FROM issue_sub_issues ORDER BY parent_number, child_number",
  );
  return reader.getRows().map((r) => ({
    parent_number: Number(r[0]),
    child_number: Number(r[1]),
  }));
}

/**
 * Mirrors a locally-known dependency. GitHub owns this relationship, so
 * callers must have written it there first; this only keeps the cache
 * in step until the next collection re-syncs it.
 */
export async function cacheIssueDependency(
  conn: DuckDBConnection,
  blockerNumber: number,
  blockedNumber: number,
): Promise<void> {
  const stmt = await conn.prepare(
    "INSERT OR REPLACE INTO issue_dependencies (blocker_number, blocked_number) VALUES ($1, $2)",
  );
  stmt.bindInteger(1, blockerNumber);
  stmt.bindInteger(2, blockedNumber);
  await stmt.run();
  stmt.destroySync();
}

export async function uncacheIssueDependency(
  conn: DuckDBConnection,
  blockerNumber: number,
  blockedNumber: number,
): Promise<void> {
  const stmt = await conn.prepare(
    "DELETE FROM issue_dependencies WHERE blocker_number = $1 AND blocked_number = $2",
  );
  stmt.bindInteger(1, blockerNumber);
  stmt.bindInteger(2, blockedNumber);
  await stmt.run();
  stmt.destroySync();
}

/**
 * Replaces the cached relationships for the given issues with what
 * GitHub reported. Scoped to `syncedIssueNumbers` so a differential
 * collection does not delete relationships of issues it did not look at.
 */
export async function replaceIssueRelations(
  conn: DuckDBConnection,
  syncedIssueNumbers: number[],
  dependencies: IssueDependencyEdge[],
  subIssues: IssueSubIssueEdge[],
): Promise<void> {
  if (syncedIssueNumbers.length === 0) return;
  const scope = syncedIssueNumbers.join(",");

  await conn.run(
    `DELETE FROM issue_dependencies WHERE blocked_number IN (${scope})`,
  );
  await conn.run(
    `DELETE FROM issue_sub_issues WHERE parent_number IN (${scope})`,
  );

  if (dependencies.length > 0) {
    const stmt = await conn.prepare(
      "INSERT OR REPLACE INTO issue_dependencies (blocker_number, blocked_number) VALUES ($1, $2)",
    );
    for (const edge of dependencies) {
      stmt.bindInteger(1, edge.blocker_number);
      stmt.bindInteger(2, edge.blocked_number);
      await stmt.run();
    }
    stmt.destroySync();
  }

  if (subIssues.length > 0) {
    const stmt = await conn.prepare(
      "INSERT OR REPLACE INTO issue_sub_issues (parent_number, child_number) VALUES ($1, $2)",
    );
    for (const edge of subIssues) {
      stmt.bindInteger(1, edge.parent_number);
      stmt.bindInteger(2, edge.child_number);
      await stmt.run();
    }
    stmt.destroySync();
  }
}

export async function upsertReviews(
  conn: DuckDBConnection,
  reviews: Review[],
): Promise<void> {
  if (reviews.length === 0) return;
  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO reviews (id, pr_number, user_login, user_type, state, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
  );
  for (const r of reviews) {
    stmt.bindInteger(1, r.id);
    stmt.bindInteger(2, r.pr_number);
    stmt.bindVarchar(3, r.user_login);
    stmt.bindVarchar(4, r.user_type);
    stmt.bindVarchar(5, r.state);
    stmt.bindVarchar(6, r.submitted_at);
    await stmt.run();
  }
  stmt.destroySync();
}

export async function updatePRSize(
  conn: DuckDBConnection,
  number: number,
  additions: number,
  deletions: number,
): Promise<void> {
  const stmt = await conn.prepare(
    "UPDATE pull_requests SET additions = $1, deletions = $2 WHERE number = $3",
  );
  stmt.bindInteger(1, additions);
  stmt.bindInteger(2, deletions);
  stmt.bindInteger(3, number);
  await stmt.run();
  stmt.destroySync();
}

/**
 * Reads the marker recording when issue assignees were last fully
 * collected. NULL means the repository predates assignee collection, so
 * the next run has to re-fetch every issue instead of only updated ones.
 */
export async function getIssuesAssigneesSyncedAt(
  conn: DuckDBConnection,
): Promise<string | null> {
  const reader = await conn.runAndReadAll(
    "SELECT issues_assignees_synced_at FROM metadata LIMIT 1",
  );
  const rows = reader.getRows();
  return rows[0]?.[0] != null ? String(rows[0][0]) : null;
}

/**
 * Reads the marker recording when issue relationships were last fully
 * synced from GitHub. NULL means no full pass has run yet.
 */
export async function getIssueRelationsSyncedAt(
  conn: DuckDBConnection,
): Promise<string | null> {
  const reader = await conn.runAndReadAll(
    "SELECT issue_relations_synced_at FROM metadata LIMIT 1",
  );
  const rows = reader.getRows();
  return rows[0]?.[0] != null ? String(rows[0][0]) : null;
}

export async function upsertMetadata(
  conn: DuckDBConnection,
  fullName: string,
  repositoryUrl: string,
  tokenId?: string | null,
  issuesAssigneesSyncedAt?: string | null,
  issueRelationsSyncedAt?: string | null,
  issuesProjectFieldsSyncedAt?: string | null,
  issuesProjectFieldsError?: string | null,
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

  // INSERT OR REPLACE rewrites the whole row, so every column that must
  // survive a collection run has to be listed here explicitly.
  const stmt = await conn.prepare(
    `INSERT OR REPLACE INTO metadata (full_name, repository_url, last_collected_at, commit_count, pull_request_count, release_count, issue_count, token_id, issues_assignees_synced_at, issue_relations_synced_at, issues_project_fields_synced_at, issues_project_fields_error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
  );
  stmt.bindVarchar(1, fullName);
  stmt.bindVarchar(2, repositoryUrl);
  stmt.bindVarchar(3, new Date().toISOString());
  stmt.bindInteger(4, cc);
  stmt.bindInteger(5, prc);
  stmt.bindInteger(6, rc);
  stmt.bindInteger(7, ic);
  if (tokenId) {
    stmt.bindVarchar(8, tokenId);
  } else {
    stmt.bindNull(8);
  }
  if (issuesAssigneesSyncedAt) {
    stmt.bindVarchar(9, issuesAssigneesSyncedAt);
  } else {
    stmt.bindNull(9);
  }
  if (issueRelationsSyncedAt) {
    stmt.bindVarchar(10, issueRelationsSyncedAt);
  } else {
    stmt.bindNull(10);
  }
  if (issuesProjectFieldsSyncedAt) {
    stmt.bindVarchar(11, issuesProjectFieldsSyncedAt);
  } else {
    stmt.bindNull(11);
  }
  if (issuesProjectFieldsError) {
    stmt.bindVarchar(12, issuesProjectFieldsError);
  } else {
    stmt.bindNull(12);
  }
  await stmt.run();
  stmt.destroySync();
}
