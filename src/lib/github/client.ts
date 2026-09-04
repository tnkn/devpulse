import { getAllDecryptedTokens, getDecryptedDefaultToken } from "@/lib/tokens";
import type {
  Commit,
  GitHubRepository,
  Issue,
  IssueRef,
  PullRequest,
  Release,
  Review,
} from "@/types";

// Overridable so the app can point at GitHub Enterprise Server, and so
// tests can run against a stub instead of the real API.
const GITHUB_API = process.env.GITHUB_API_URL || "https://api.github.com";
const MAX_PAGES = 100;

/** Carries the HTTP status so callers can map it to a useful message. */
export class GitHubApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

export interface FetchOptions {
  since?: string; // ISO 8601 timestamp
  token?: string; // explicit token to use
}

/**
 * Exported so the GraphQL side resolves a token the same way: an
 * explicit one, then the DB default, then GITHUB_TOKEN.
 */
export async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;

  // 1. DB default token
  try {
    const dbToken = await getDecryptedDefaultToken();
    if (dbToken) return dbToken;
  } catch (err) {
    console.warn(
      "[github] Failed to read token from DB, falling back to env var:",
      err instanceof Error ? err.message : err,
    );
  }

  // 2. Environment variable fallback
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not set. Add a token via Settings or set the GITHUB_TOKEN env var.",
    );
  }
  return token;
}

function makeAuthHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

async function fetchAllPages<T>(
  url: string,
  token?: string,
  maxPages = MAX_PAGES,
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;
  let page = 0;
  const h = makeAuthHeaders(await resolveToken(token));

  while (nextUrl && page < maxPages) {
    const res = await fetch(nextUrl, { headers: h });
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
  token?: string,
  maxPages = MAX_PAGES,
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;
  let page = 0;
  const h = makeAuthHeaders(await resolveToken(token));

  while (nextUrl && page < maxPages) {
    const res = await fetch(nextUrl, { headers: h });
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

async function listReposWithToken(
  token: string,
  perPage: number,
  query?: string,
  affiliation?: string,
): Promise<{ repositories: GitHubRepository[]; total_count?: number }> {
  const h = makeAuthHeaders(token);

  // When no affiliation filter and searching, use GitHub Search API for speed
  if (query && !affiliation) {
    const qualifiers = [encodeURIComponent(query), "in:name"];
    const res = await fetch(
      `${GITHUB_API}/search/repositories?q=${qualifiers.join("+")}&per_page=${perPage}&sort=updated`,
      { headers: h },
    );
    if (!res.ok) return { repositories: [], total_count: 0 };
    const data = await res.json();
    return {
      repositories: data.items.map(mapRepository),
      total_count: data.total_count,
    };
  }

  // Use /user/repos which natively supports the affiliation parameter
  const aff = affiliation || "owner,collaborator,organization_member";
  const allRepos: GitHubRepository[] = [];
  const MAX_PAGES = 5; // up to 500 repos per token
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `${GITHUB_API}/user/repos?per_page=100&page=${page}&sort=updated&affiliation=${aff}`,
      { headers: h },
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    allRepos.push(...data.map(mapRepository));
    if (data.length < 100) break; // last page
  }

  // When there's a query + affiliation, filter by name client-side
  if (query) {
    const lowerQuery = query.toLowerCase();
    const filtered = allRepos.filter(
      (r) =>
        r.name.toLowerCase().includes(lowerQuery) ||
        r.full_name.toLowerCase().includes(lowerQuery),
    );
    return { repositories: filtered };
  }

  return { repositories: allRepos };
}

export async function listRepositories(
  page = 1,
  perPage = 20,
  query?: string,
  affiliation?: string,
  tokenId?: string,
): Promise<{ repositories: GitHubRepository[]; total_count?: number }> {
  let tokens: string[];

  if (tokenId) {
    // Specific token requested
    const token = await resolveToken(
      tokenId === "env" ? process.env.GITHUB_TOKEN : undefined,
    );
    if (tokenId !== "env") {
      // DB token - decrypt it
      const { getDecryptedToken } = await import("@/lib/tokens");
      const dbToken = await getDecryptedToken(tokenId);
      if (!dbToken) throw new Error("Token not found");
      tokens = [dbToken];
    } else {
      tokens = [token];
    }
  } else {
    // No specific token - use all
    tokens = await getAllDecryptedTokens();
    if (tokens.length === 0) {
      throw new Error(
        "GITHUB_TOKEN is not set. Add a token via Settings or set the GITHUB_TOKEN env var.",
      );
    }
  }

  // Fetch from selected token(s) in parallel
  const results = await Promise.all(
    tokens.map((t) => listReposWithToken(t, perPage, query, affiliation)),
  );

  // Merge & deduplicate by repo id
  const seen = new Set<number>();
  const merged: GitHubRepository[] = [];
  let totalCount = 0;

  for (const result of results) {
    if (result.total_count) totalCount += result.total_count;
    for (const repo of result.repositories) {
      if (!seen.has(repo.id)) {
        seen.add(repo.id);
        merged.push(repo);
      }
    }
  }

  // Sort by updated_at descending
  merged.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  // Server-side pagination for the merged results
  const start = (page - 1) * perPage;
  const paged = merged.slice(start, start + perPage);

  return {
    repositories: paged,
    total_count: query ? totalCount : merged.length,
  };
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
  const user = pr.user as Record<string, unknown> | null;
  const assigneesRaw =
    (pr.assignees as Array<Record<string, unknown>> | null) ?? [];
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
    ...(user?.login ? { user_login: user.login as string } : {}),
    assignees: assigneesRaw.map((a) => a.login as string).filter(Boolean),
  };
}

function mapIssue(i: Record<string, unknown>): Issue {
  const labels = i.labels as Array<Record<string, unknown>>;
  const assigneesRaw =
    (i.assignees as Array<Record<string, unknown>> | null) ?? [];
  return {
    number: i.number as number,
    id: i.id as number,
    title: i.title as string,
    state: i.state as Issue["state"],
    created_at: i.created_at as string,
    updated_at: i.updated_at as string,
    closed_at: i.closed_at as string | null,
    labels: labels.map((l) => ({ name: l.name as string })),
    assignees: assigneesRaw.map((a) => a.login as string).filter(Boolean),
  };
}

export async function getCommits(
  owner: string,
  repo: string,
  opts?: FetchOptions,
): Promise<Commit[]> {
  let url = `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=100`;
  if (opts?.since) {
    url += `&since=${encodeURIComponent(opts.since)}`;
  }
  const raw = await fetchAllPages<Record<string, unknown>>(url, opts?.token);
  return raw.map(mapCommit);
}

export async function getPullRequests(
  owner: string,
  repo: string,
  opts?: FetchOptions,
): Promise<PullRequest[]> {
  if (opts?.since) {
    const sinceDate = new Date(opts.since).getTime();
    const raw = await fetchPagesUntil<Record<string, unknown>>(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=updated&direction=desc`,
      (item) => new Date(item.updated_at as string).getTime() >= sinceDate,
      opts?.token,
    );
    console.log(
      `[pulls] Fetched ${raw.length} updated PRs (since ${opts.since})`,
    );
    return raw.map(mapPullRequest);
  }
  const raw = await fetchAllPages<Record<string, unknown>>(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=all&per_page=100`,
    opts?.token,
  );
  return raw.map(mapPullRequest);
}

export async function getReleases(
  owner: string,
  repo: string,
  token?: string,
): Promise<Release[]> {
  const raw = await fetchAllPages<Record<string, unknown>>(
    `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=100`,
    token,
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
  ref: string,
  token?: string,
): Promise<boolean> {
  const h = makeAuthHeaders(await resolveToken(token));
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits/${ref}/check-runs`,
    { headers: h },
  );
  if (res.status === 403) {
    throw new Error(
      "Token lacks 'Checks: Read' permission. Update your fine-grained PAT to include Checks (read) and Commit statuses (read).",
    );
  }
  if (!res.ok) return false;
  const data = await res.json();
  const checkRuns = data.check_runs as Array<Record<string, unknown>>;
  if (checkRuns.length === 0) return false;
  return checkRuns.some(
    (cr) => cr.conclusion === "failure" || cr.conclusion === "timed_out",
  );
}

export async function getPullRequestDetail(
  owner: string,
  repo: string,
  number: number,
  token?: string,
): Promise<{ additions: number; deletions: number; user_login?: string }> {
  const h = makeAuthHeaders(await resolveToken(token));
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}`,
    { headers: h },
  );
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const user = data.user as Record<string, unknown> | null;
  return {
    additions: data.additions as number,
    deletions: data.deletions as number,
    ...(user?.login ? { user_login: user.login as string } : {}),
  };
}

export async function getPullRequestReviews(
  owner: string,
  repo: string,
  number: number,
  token?: string,
): Promise<Review[]> {
  const raw = await fetchAllPages<Record<string, unknown>>(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}/reviews?per_page=100`,
    token,
  );
  return raw.map((r) => {
    const user = r.user as Record<string, unknown>;
    return {
      id: r.id as number,
      pr_number: number,
      user_login: (user?.login as string) || "unknown",
      user_type: (user?.type as string) || "User",
      state: r.state as string,
      submitted_at: r.submitted_at as string,
    };
  });
}

function mapIssueRef(i: Record<string, unknown>): IssueRef {
  // "https://api.github.com/repos/octocat/hello-world" -> "octocat/hello-world"
  const repositoryUrl = (i.repository_url as string) ?? "";
  const repository = repositoryUrl.split("/repos/")[1] ?? "";
  return {
    id: i.id as number,
    number: i.number as number,
    repository,
  };
}

async function getIssueRelation(
  owner: string,
  repo: string,
  issueNumber: number,
  relation: "dependencies/blocked_by" | "dependencies/blocking" | "sub_issues",
  token?: string,
): Promise<IssueRef[]> {
  const h = makeAuthHeaders(await resolveToken(token));
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}/${relation}?per_page=100`,
    { headers: h },
  );
  if (!res.ok) {
    throw new GitHubApiError(
      res.status,
      `GitHub API error: ${res.status} ${res.statusText}`,
    );
  }
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(mapIssueRef);
}

/** Issues that must be completed before `issueNumber` can proceed. */
export async function getIssueBlockedBy(
  owner: string,
  repo: string,
  issueNumber: number,
  token?: string,
): Promise<IssueRef[]> {
  return getIssueRelation(
    owner,
    repo,
    issueNumber,
    "dependencies/blocked_by",
    token,
  );
}

/** Children of `issueNumber` in GitHub's sub-issue hierarchy. */
export async function getSubIssues(
  owner: string,
  repo: string,
  issueNumber: number,
  token?: string,
): Promise<IssueRef[]> {
  return getIssueRelation(owner, repo, issueNumber, "sub_issues", token);
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.message === "string") return body.message;
  } catch {
    // Fall through to the status text
  }
  return `${res.status} ${res.statusText}`;
}

/**
 * Records that `blockedNumber` is blocked by the issue with the given
 * global id. GitHub itself rejects cycles and self-dependencies (422).
 */
export async function addIssueBlockedBy(
  owner: string,
  repo: string,
  blockedNumber: number,
  blockerIssueId: number,
  token?: string,
): Promise<void> {
  const h = makeAuthHeaders(await resolveToken(token));
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${blockedNumber}/dependencies/blocked_by`,
    {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ issue_id: blockerIssueId }),
    },
  );
  if (!res.ok) {
    throw new GitHubApiError(res.status, await readErrorMessage(res));
  }
}

export async function removeIssueBlockedBy(
  owner: string,
  repo: string,
  blockedNumber: number,
  blockerIssueId: number,
  token?: string,
): Promise<void> {
  const h = makeAuthHeaders(await resolveToken(token));
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${blockedNumber}/dependencies/blocked_by/${blockerIssueId}`,
    { method: "DELETE", headers: h },
  );
  if (!res.ok) {
    throw new GitHubApiError(res.status, await readErrorMessage(res));
  }
}

/**
 * Replaces an issue's assignees with exactly this set.
 *
 * GitHub documents a trap here: "Without push access to the repository,
 * assignee changes are silently dropped." The response still comes back
 * 200 with the unchanged issue, so the result is read back and compared
 * — a caller that trusted the status code would report success for a
 * change that never happened.
 *
 * Returns the assignees the issue actually ended up with.
 */
export async function setIssueAssignees(
  owner: string,
  repo: string,
  issueNumber: number,
  assignees: string[],
  token?: string,
): Promise<string[]> {
  const h = makeAuthHeaders(await resolveToken(token));
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}`,
    {
      method: "PATCH",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ assignees }),
    },
  );
  if (!res.ok) {
    throw new GitHubApiError(res.status, await readErrorMessage(res));
  }

  const body = (await res.json()) as { assignees?: { login?: string }[] };
  const applied = (body.assignees ?? [])
    .map((a) => a.login)
    .filter((login): login is string => Boolean(login));

  const wanted = [...assignees].sort().join(",");
  if (applied.slice().sort().join(",") !== wanted) {
    throw new GitHubApiError(
      403,
      "GitHub accepted the request but did not change the assignees. Setting assignees needs push access to the repository.",
    );
  }
  return applied;
}

/** Users who may be assigned to an issue in this repository. */
export async function getAssignableUsers(
  owner: string,
  repo: string,
  token?: string,
): Promise<string[]> {
  const raw = await fetchAllPages<{ login?: string }>(
    `${GITHUB_API}/repos/${owner}/${repo}/assignees?per_page=100`,
    token,
    3,
  );
  return raw
    .map((u) => u.login)
    .filter((login): login is string => Boolean(login));
}

export async function getIssues(
  owner: string,
  repo: string,
  opts?: FetchOptions,
): Promise<Issue[]> {
  let url = `${GITHUB_API}/repos/${owner}/${repo}/issues?state=all&per_page=100`;
  if (opts?.since) {
    url += `&since=${encodeURIComponent(opts.since)}`;
  }
  const raw = await fetchAllPages<Record<string, unknown>>(url, opts?.token);
  // Filter out pull requests (GitHub API returns PRs in issues endpoint)
  return raw.filter((i) => !i.pull_request).map(mapIssue);
}
