/**
 * Splits a DDL script into statements.
 *
 * Line comments are stripped first: they may contain semicolons, and a
 * naive split on ";" would otherwise turn the rest of a comment into a
 * bogus statement.
 */
export function splitSqlStatements(ddl: string): string[] {
  return ddl
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS metadata (
  full_name TEXT PRIMARY KEY,
  repository_url TEXT NOT NULL,
  last_collected_at TEXT,
  commit_count INTEGER DEFAULT 0,
  pull_request_count INTEGER DEFAULT 0,
  release_count INTEGER DEFAULT 0,
  issue_count INTEGER DEFAULT 0,
  token_id TEXT,
  issues_assignees_synced_at TEXT,
  issue_relations_synced_at TEXT,
  issues_project_fields_synced_at TEXT,
  issues_project_fields_error TEXT
);

CREATE TABLE IF NOT EXISTS commits (
  sha TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_date TEXT NOT NULL,
  committer_name TEXT NOT NULL,
  committer_email TEXT NOT NULL,
  committer_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pull_requests (
  number INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  merged_at TEXT,
  merge_commit_sha TEXT,
  head_ref TEXT NOT NULL,
  head_sha TEXT NOT NULL,
  base_ref TEXT NOT NULL,
  base_sha TEXT NOT NULL,
  labels_json TEXT DEFAULT '[]',
  ci_failed BOOLEAN,
  additions INTEGER,
  deletions INTEGER,
  user_login TEXT,
  assignees_json TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY,
  tag_name TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT NOT NULL,
  prerelease BOOLEAN NOT NULL DEFAULT false,
  draft BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS issues (
  number INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  labels_json TEXT DEFAULT '[]',
  assignees_json TEXT DEFAULT '[]',
  issue_id BIGINT
);

-- Mirror of GitHub's "blocked by" issue dependencies. GitHub is the
-- source of truth; these rows are replaced on every collection.
CREATE TABLE IF NOT EXISTS issue_dependencies (
  blocker_number INTEGER NOT NULL,
  blocked_number INTEGER NOT NULL,
  created_at TEXT DEFAULT (strftime(now(), '%Y-%m-%dT%H:%M:%SZ')),
  PRIMARY KEY (blocker_number, blocked_number)
);

-- Mirror of GitHub's sub-issue hierarchy, same sync rules as above.
CREATE TABLE IF NOT EXISTS issue_sub_issues (
  parent_number INTEGER NOT NULL,
  child_number INTEGER NOT NULL,
  created_at TEXT DEFAULT (strftime(now(), '%Y-%m-%dT%H:%M:%SZ')),
  PRIMARY KEY (parent_number, child_number)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  pr_number INTEGER NOT NULL,
  user_login TEXT NOT NULL,
  user_type TEXT NOT NULL,
  state TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);
`;

export const MIGRATION_DDL = `
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS additions INTEGER;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS deletions INTEGER;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS user_login TEXT;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS assignees_json TEXT DEFAULT '[]';
ALTER TABLE metadata ADD COLUMN IF NOT EXISTS token_id TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS assignees_json TEXT DEFAULT '[]';

-- NULL until issues have been collected at least once with assignees.
-- The collector treats a NULL here as "re-fetch every issue this run",
-- because issues are otherwise only re-fetched when they are updated,
-- which would leave assignees empty forever on existing databases.
ALTER TABLE metadata ADD COLUMN IF NOT EXISTS issues_assignees_synced_at TEXT;

-- GitHub's global issue id, required by the issue dependencies API
-- (its POST body takes an id, not an issue number).
ALTER TABLE issues ADD COLUMN IF NOT EXISTS issue_id BIGINT;

-- Priority and Size as they read on the issue's Projects v2 board.
-- Stored as text because a board may hold them as single-select options
-- ("P1", "M"), as numbers (story points), or as free text.
ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS size TEXT;

-- The board item Priority and Size were read from, which is also where
-- an edit writes back. A project field only exists as part of an item,
-- so without these there is nothing to address a mutation to.
ALTER TABLE issues ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS project_item_id TEXT;

-- The editable fields on each board: their ids, and for a single select
-- the options it accepts. Cached because an issue with no Priority set
-- carries no value to learn the field's id from.
CREATE TABLE IF NOT EXISTS project_fields (
  project_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  project_title TEXT,
  field_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  data_type TEXT NOT NULL,
  options_json TEXT DEFAULT '[]',
  source TEXT DEFAULT 'project',
  PRIMARY KEY (project_id, field_id)
);

-- Same reasoning as issues_assignees_synced_at: project fields live
-- outside the issue payload, so a differential run would never fill them
-- in for issues collected before this existed.
ALTER TABLE metadata ADD COLUMN IF NOT EXISTS issues_project_fields_synced_at TEXT;
-- Why the last run could not read Projects, so the UI can say "the token
-- cannot see Projects" instead of "not collected yet" — which reads as
-- "you have not pressed Update" and sends people looking in the wrong place.
ALTER TABLE metadata ADD COLUMN IF NOT EXISTS issues_project_fields_error TEXT;
-- Where a field definition came from: a Projects v2 board, or one of
-- GitHub's native issue fields. They are read through different APIs and
-- only the board ones can be edited so far, so the two cannot be merged
-- into one undifferentiated list.
ALTER TABLE project_fields ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'project';

CREATE TABLE IF NOT EXISTS issue_sub_issues (
  parent_number INTEGER NOT NULL,
  child_number INTEGER NOT NULL,
  created_at TEXT DEFAULT (strftime(now(), '%Y-%m-%dT%H:%M:%SZ')),
  PRIMARY KEY (parent_number, child_number)
);

-- NULL until issue relationships have been synced from GitHub at least
-- once; the collector then knows it has to do a full relationship pass.
ALTER TABLE metadata ADD COLUMN IF NOT EXISTS issue_relations_synced_at TEXT;

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  pr_number INTEGER NOT NULL,
  user_login TEXT NOT NULL,
  user_type TEXT NOT NULL,
  state TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issue_dependencies (
  blocker_number INTEGER NOT NULL,
  blocked_number INTEGER NOT NULL,
  created_at TEXT DEFAULT (strftime(now(), '%Y-%m-%dT%H:%M:%SZ')),
  PRIMARY KEY (blocker_number, blocked_number)
);
`;

export const TOKEN_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS github_tokens (
  id              TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  encrypted_token TEXT NOT NULL,
  iv              TEXT NOT NULL,
  auth_tag        TEXT NOT NULL,
  token_suffix    TEXT NOT NULL,
  is_default      BOOLEAN DEFAULT FALSE,
  created_at      TEXT DEFAULT (strftime(now(), '%Y-%m-%dT%H:%M:%SZ')),
  updated_at      TEXT DEFAULT (strftime(now(), '%Y-%m-%dT%H:%M:%SZ'))
);
`;
