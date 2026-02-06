import type {
  GitHubRepository,
  Commit,
  PullRequest,
  Release,
  Issue,
} from "@/types";

const GITHUB_API = "https://api.github.com";
const MAX_PAGES = 100;

export interface FetchOptions {
  since?: string; // ISO 8601 timestamp
}

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set");
  }
  return token;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

async function fetchAllPages<T>(url: string, maxPages = MAX_PAGES): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;
  let page = 0;

  while (nextUrl && page < maxPages) {
    const res = await fetch(nextUrl, { headers: headers() });
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    results.push(...(Array.isArray(data) ? data : []));
    nextUrl = parseNextLink(res.headers.get("link"));
    page++;
  }

  return results;
}

/**
 * Fetch pages until a predicate returns false for an item.
 * Used for endpoints that don't support `since` (e.g., pulls sorted by updated_at desc).
 * Stops fetching when it finds an item older than the cutoff.
 */
async function fetchPagesUntil<T>(
  url: string,
  shouldContinue: (item: T) => boolean,
  maxPages = MAX_PAGES,
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;
  let page = 0;

  while (nextUrl && page < maxPages) {
    const res = await fetch(nextUrl, { headers: headers() });
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];

    let reachedCutoff = false;
    for (const item of items) {
      if (shouldContinue(item as T)) {
        results.push(item as T);
      } else {
        reachedCutoff = true;
        break;
      }
    }

    if (reachedCutoff) break;
    nextUrl = parseNextLink(res.headers.get("link"));
    page++;
  }

  return results;
}

export async function listRepositories(
  page = 1,
  perPage = 20,
  query?: string
): Promise<{ repositories: GitHubRepository[]; total_count?: number }> {
  if (query) {
    const res = await fetch(
      `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}+in:name&per_page=${perPage}&page=${page}&sort=updated`,
      { headers: headers() }
    );
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return {
      repositories: data.items.map(mapRepository),
      total_count: data.total_count,
    };
  }

  const res = await fetch(
    `${GITHUB_API}/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
    { headers: headers() }
  );
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return { repositories: data.map(mapRepository) };
}

function mapRepository(repo: Record<string, unknown>): GitHubRepository {
  const owner = repo.owner as Record<string, unknown>;
  return {
    id: repo.id as number,
    name: repo.name as string,
    full_name: repo.full_name as string,
    owner: {
      login: owner.login as string,
      avatar_url: owner.avatar_url as string,
    },
    description: repo.description as string | null,
    private: repo.private as boolean,
    html_url: repo.html_url as string,
    language: repo.language as string | null,
    stargazers_count: repo.stargazers_count as number,
    updated_at: repo.updated_at as string,
  };
}

function mapCommit(c: Record<string, unknown>): Commit {
  const commit = c.commit as Record<string, unknown>;
  const author = commit.author as Record<string, unknown>;
  const committer = commit.committer as Record<string, unknown>;
  return {
    sha: c.sha as string,
    message: commit.message as string,
    author: {
      name: author.name as string,
      email: author.email as string,
      date: author.date as string,
    },
    committer: {
      name: committer.name as string,
      email: committer.email as string,
      date: committer.date as string,
    },
  };
}

function mapPullRequest(pr: Record<string, unknown>): PullRequest {
  const head = pr.head as Record<string, unknown>;
  const base = pr.base as Record<string, unknown>;
  const labels = pr.labels as Array<Record<string, unknown>>;
  return {
    number: pr.number as number,
    title: pr.title as string,
    state: (pr.merged_at ? "merged" : pr.state) as PullRequest["state"],
    created_at: pr.created_at as string,
    updated_at: pr.updated_at as string,
    closed_at: pr.closed_at as string | null,
    merged_at: pr.merged_at as string | null,
    merge_commit_sha: pr.merge_commit_sha as string | null,
    head: {
      ref: head.ref as string,
      sha: head.sha as string,
    },
    base: {
      ref: base.ref as string,
      sha: base.sha as string,
    },
    labels: labels.map((l) => ({ name: l.name as string })),
  };
}

function mapIssue(i: Record<string, unknown>): Issue {
  const labels = i.labels as Array<Record<string, unknown>>;
  return {
    number: i.number as number,
    title: i.title as string,
    state: i.state as Issue["state"],
    created_at: i.created_at as string,
    updated_at: i.updated_at as string,
    closed_at: i.closed_at as string | null,
    labels: labels.map((l) => ({ name: l.name as string })),
  };
}

export async function getCommits(owner: string, repo: string, opts?: FetchOptions): Promise<Commit[]> {
  let url = `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=100`;
  if (opts?.since) {
    url += `&since=${encodeURIComponent(opts.since)}`;
  }
  const raw = await fetchAllPages<Record<string, unknown>>(url);
  return raw.map(mapCommit);
}

export async function getPullRequests(owner: string, repo: string, opts?: FetchOptions): Promise<PullRequest[]> {
  if (opts?.since) {
    // PRs API doesn't support `since`, so sort by updated desc and stop at cutoff
    const sinceDate = new Date(opts.since).getTime();
    const raw = await fetchPagesUntil<Record<string, unknown>>(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=updated&direction=desc`,
      (item) => new Date(item.updated_at as string).getTime() >= sinceDate,
    );
    console.log(`[pulls] Fetched ${raw.length} updated PRs (since ${opts.since})`);
    return raw.map(mapPullRequest);
  }
  const raw = await fetchAllPages<Record<string, unknown>>(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=all&per_page=100`
  );
  return raw.map(mapPullRequest);
}

export async function getReleases(owner: string, repo: string): Promise<Release[]> {
  const raw = await fetchAllPages<Record<string, unknown>>(
    `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=100`
  );
  return raw.map((r) => ({
    id: r.id as number,
    tag_name: r.tag_name as string,
    name: (r.name as string) || "",
    created_at: r.created_at as string,
    published_at: r.published_at as string,
    prerelease: r.prerelease as boolean,
    draft: r.draft as boolean,
  }));
}

export async function getCommitCheckFailed(
  owner: string,
  repo: string,
  ref: string
): Promise<boolean> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits/${ref}/check-runs`,
    { headers: headers() }
  );
  if (res.status === 403) {
    throw new Error(
      "Token lacks 'Checks: Read' permission. Update your fine-grained PAT to include Checks (read) and Commit statuses (read)."
    );
  }
  if (!res.ok) return false;
  const data = await res.json();
  const checkRuns = data.check_runs as Array<Record<string, unknown>>;
  if (checkRuns.length === 0) return false;
  return checkRuns.some(
    (cr) => cr.conclusion === "failure" || cr.conclusion === "timed_out"
  );
}

export async function getIssues(owner: string, repo: string, opts?: FetchOptions): Promise<Issue[]> {
  let url = `${GITHUB_API}/repos/${owner}/${repo}/issues?state=all&per_page=100`;
  if (opts?.since) {
    url += `&since=${encodeURIComponent(opts.since)}`;
  }
  const raw = await fetchAllPages<Record<string, unknown>>(url);
  // Filter out pull requests (GitHub API returns PRs in issues endpoint)
  return raw.filter((i) => !i.pull_request).map(mapIssue);
}
