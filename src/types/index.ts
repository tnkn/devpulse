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

export interface ChangeFailureRate {
  period: string;
  total_deployments: number;
  failed_deployments: number;
  failure_rate: number;
}

export interface TimeToRestore {
  issue_number: number;
  title: string;
  time_to_restore_hours: number;
  created_at: string;
  closed_at: string;
}

export interface DORAMetrics {
  deployment_frequency: DeploymentFrequency[];
  lead_time_for_changes: LeadTimeForChanges[];
  change_failure_rate: ChangeFailureRate[];
  time_to_restore: TimeToRestore[];
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
  dumps: DumpInfo[];
}

export interface DumpInfo {
  id: string;
  timestamp: string;
  path: string;
}
