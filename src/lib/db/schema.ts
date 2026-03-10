export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS metadata (
  full_name TEXT PRIMARY KEY,
  repository_url TEXT NOT NULL,
  last_collected_at TEXT,
  commit_count INTEGER DEFAULT 0,
  pull_request_count INTEGER DEFAULT 0,
  release_count INTEGER DEFAULT 0,
  issue_count INTEGER DEFAULT 0,
  token_id TEXT
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
  labels_json TEXT DEFAULT '[]'
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

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  pr_number INTEGER NOT NULL,
  user_login TEXT NOT NULL,
  user_type TEXT NOT NULL,
  state TEXT NOT NULL,
  submitted_at TEXT NOT NULL
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
