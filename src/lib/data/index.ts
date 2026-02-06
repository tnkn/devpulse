import type {
  Repository,
  DumpMetadata,
  Commit,
  PullRequest,
  Release,
  Issue,
} from "@/types";
import { getConnection, getRepositoryKeys } from "@/lib/db";

export async function getRepositories(): Promise<Repository[]> {
  const keys = await getRepositoryKeys();
  const repositories: Repository[] = [];

  for (const key of keys) {
    try {
      const conn = await getConnection(key);
      const reader = await conn.runAndReadAll(
        "SELECT full_name, last_collected_at FROM metadata LIMIT 1"
      );
      const rows = reader.getRows();
      conn.closeSync();

      const displayName = rows.length > 0 && rows[0][0]
        ? String(rows[0][0])
        : key.includes("__") ? key.replace("__", "/") : key;
      const lastCollected = rows.length > 0 && rows[0][1]
        ? String(rows[0][1])
        : null;

      repositories.push({ name: key, displayName, lastCollected });
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
}> {
  let conn;
  try {
    conn = await getConnection(repoName);
  } catch {
    return { metadata: null, commits: [], pulls: [], releases: [], issues: [] };
  }

  try {
    const [metaReader, commitReader, prReader, releaseReader, issueReader] = await Promise.all([
      conn.runAndReadAll("SELECT full_name, repository_url, last_collected_at, commit_count, pull_request_count, release_count, issue_count FROM metadata LIMIT 1"),
      conn.runAndReadAll("SELECT sha, message, author_name, author_email, author_date, committer_name, committer_email, committer_date FROM commits ORDER BY author_date DESC"),
      conn.runAndReadAll("SELECT number, title, state, created_at, updated_at, closed_at, merged_at, merge_commit_sha, head_ref, head_sha, base_ref, base_sha, labels_json, ci_failed FROM pull_requests ORDER BY number DESC"),
      conn.runAndReadAll("SELECT id, tag_name, name, created_at, published_at, prerelease, draft FROM releases ORDER BY published_at DESC"),
      conn.runAndReadAll("SELECT number, title, state, created_at, updated_at, closed_at, labels_json FROM issues ORDER BY number DESC"),
    ]);

    conn.closeSync();

    // Parse metadata
    const metaRows = metaReader.getRows();
    const metadata: DumpMetadata | null = metaRows.length > 0
      ? {
          repository: String(metaRows[0][0]),
          repository_url: String(metaRows[0][1]),
          dumped_at: String(metaRows[0][2]),
          commit_count: Number(metaRows[0][3]),
          pull_request_count: Number(metaRows[0][4]),
          release_count: Number(metaRows[0][5]),
          issue_count: Number(metaRows[0][6]),
        }
      : null;

    // Parse commits
    const commits: Commit[] = commitReader.getRows().map((r) => ({
      sha: String(r[0]),
      message: String(r[1]),
      author: { name: String(r[2]), email: String(r[3]), date: String(r[4]) },
      committer: { name: String(r[5]), email: String(r[6]), date: String(r[7]) },
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
    }));

    return { metadata, commits, pulls, releases, issues };
  } catch {
    conn.closeSync();
    return { metadata: null, commits: [], pulls: [], releases: [], issues: [] };
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
