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
  title: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: { name: string }[];
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
}

// アプリケーション型定義

export interface Repository {
  name: string;
  displayName: string;
  lastCollected: string | null;
}
