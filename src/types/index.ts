// GitHub データ型定義

export interface Commit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
}

export interface PullRequest {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  labels: { name: string }[];
  ci_failed?: boolean;
  additions?: number;
  deletions?: number;
  user_login?: string;
  assignees?: string[];
}

export interface Release {
  id: number;
  tag_name: string;
  name: string;
  created_at: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

export interface Issue {
  number: number;
  /** GitHub's global issue id. Required by the issue dependencies API. */
  id?: number;
  title: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: { name: string }[];
  assignees?: string[];
  /**
   * Priority and Size as they read on the issue's GitHub Projects v2
   * board. Absent when the issue is on no board, the board has neither
   * field, or the token could not see projects when it was collected.
   */
  priority?: string | null;
  size?: string | null;
  /** The board item Priority and Size are edited through, if any. */
  project_id?: string | null;
  project_item_id?: string | null;
}

/** The two project fields the graph shows, keyed off an issue. */
export interface IssueProjectFields {
  priority: string | null;
  size: string | null;
  /**
   * The board item the values were read from, which is also the one an
   * edit writes back to. Null when the issue is on no board — nothing
   * to edit, because the field only exists as part of an item.
   */
  projectId: string | null;
  projectItemId: string | null;
}

/**
 * One editable Priority or Size field on one board, with everything a
 * write needs: the ids to address it and the options it will accept.
 */
export interface ProjectFieldDefinition {
  projectId: string;
  projectTitle: string;
  fieldId: string;
  fieldName: string;
  /**
   * Which of the two the field name was recognised as, or "other" for a
   * field kept only so the reader can see what the board actually calls
   * things when nothing matched.
   */
  kind: "priority" | "size" | "other";
  /** GitHub's ProjectV2FieldType: SINGLE_SELECT, NUMBER, TEXT, ... */
  dataType: string;
  /**
   * Which API the definition came from. "issue-field" is one of GitHub's
   * native issue fields, which live on the issue rather than on a board.
   */
  source: "project" | "issue-field";
  /** Empty unless the field is a single select. */
  options: { id: string; name: string }[];
}

/** Minimal identity of an issue returned by the relationship endpoints. */
export interface IssueRef {
  id: number;
  number: number;
  /** "owner/repo" — relationships may point at another repository. */
  repository: string;
}

export interface Review {
  id: number;
  pr_number: number;
  user_login: string;
  user_type: string;
  state: string;
  submitted_at: string;
}

export interface DumpMetadata {
  repository: string;
  repository_url: string;
  dumped_at: string;
  commit_count: number;
  pull_request_count: number;
  release_count: number;
  issue_count: number;
  token_id?: string | null;
}

// DORA メトリクス型定義

export interface DeploymentFrequency {
  period: string;
  count: number;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
}

export interface LeadTimeForChanges {
  pr_number: number;
  title: string;
  lead_time_hours: number;
  created_at: string;
  merged_at: string;
}

export interface LeadTimePeriodStats {
  period: string;
  avg_hours: number;
  stddev_hours: number;
  plus_sigma: number;
  minus_sigma: number;
  count: number;
}

export interface ChangeFailureRate {
  period: string;
  total_deployments: number;
  failed_deployments: number;
  failure_rate: number;
}

export interface RevertRate {
  period: string;
  total_commits: number;
  revert_commits: number;
  revert_rate: number;
}

export interface PRSize {
  pr_number: number;
  title: string;
  additions: number;
  deletions: number;
  total_lines: number;
  merged_at: string;
}

export interface PickupTime {
  pr_number: number;
  title: string;
  pickup_time_hours: number;
  created_at: string;
  first_review_at: string;
}

export interface PeriodStats {
  period: string;
  avg: number;
  stddev: number;
  plus_sigma: number;
  minus_sigma: number;
  count: number;
}

export interface DORAMetrics {
  deployment_frequency: DeploymentFrequency[];
  lead_time_for_changes: LeadTimeForChanges[];
  lead_time_stats: LeadTimePeriodStats[];
  change_failure_rate: ChangeFailureRate[];
  revert_rate: RevertRate[];
  pr_size: PRSize[];
  pr_size_stats: PeriodStats[];
  pickup_time: PickupTime[];
  pickup_time_stats: PeriodStats[];
}

export type PeriodGranularity = "day" | "week" | "month";

export interface PeriodMetrics {
  deployment_frequency: DeploymentFrequency[];
  lead_time_stats: LeadTimePeriodStats[];
  change_failure_rate: ChangeFailureRate[];
  revert_rate: RevertRate[];
  pr_size_stats: PeriodStats[];
  pickup_time_stats: PeriodStats[];
}

// GitHub API 型定義

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  private: boolean;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
}

export interface CollectionJob {
  id: string;
  owner: string;
  repo: string;
  status: "pending" | "collecting" | "completed" | "failed";
  progress: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  dump_path: string | null;
  token_id?: string | null;
}

// 個人毎メトリクス型定義

export interface ContributorSummary {
  login: string;
  pr_count: number;
  commit_count: number;
  review_count: number;
}

export interface ContributorPeriodData {
  period: string;
  pr_counts: Record<string, number>;
  commit_counts: Record<string, number>;
  review_counts: Record<string, number>;
}

export interface ContributorMetrics {
  contributors: ContributorSummary[];
  period_data: ContributorPeriodData[];
  all_logins: string[];
}

// トークン管理型定義

export interface GitHubTokenMasked {
  id: string;
  label: string;
  token_suffix: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface GitHubTokenCreateRequest {
  label: string;
  token: string;
}

export interface TokenListResponse {
  tokens: GitHubTokenMasked[];
  allowTokenUI: boolean;
  hasEnvToken: boolean;
}

// Issue 依存関係グラフ型定義

export interface IssueDependencyEdge {
  blocker_number: number;
  blocked_number: number;
}

/** Parent/child relationship from GitHub's sub-issues API. */
export interface IssueSubIssueEdge {
  parent_number: number;
  child_number: number;
}

export type IssueProgressStatus = "notstarted" | "started" | "completed";

// アプリケーション型定義

export interface Repository {
  name: string;
  displayName: string;
  lastCollected: string | null;
  token_id?: string | null;
}
