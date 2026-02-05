import type {
  Commit,
  PullRequest,
  Release,
  Issue,
  DeploymentFrequency,
  LeadTimeForChanges,
  ChangeFailureRate,
  TimeToRestore,
  DORAMetrics,
} from "@/types";

export function calculateDORAMetrics(
  commits: Commit[],
  pulls: PullRequest[],
  releases: Release[],
  issues: Issue[]
): DORAMetrics {
  return {
    deployment_frequency: calculateDeploymentFrequency(releases),
    lead_time_for_changes: calculateLeadTimeForChanges(pulls),
    change_failure_rate: calculateChangeFailureRate(releases, commits),
    time_to_restore: calculateTimeToRestore(issues),
  };
}

function calculateDeploymentFrequency(
  releases: Release[]
): DeploymentFrequency[] {
  const publishedReleases = releases.filter((r) => !r.draft && !r.prerelease);

  // 月別にグループ化
  const monthlyCount = new Map<string, number>();

  for (const release of publishedReleases) {
    const date = new Date(release.published_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyCount.set(monthKey, (monthlyCount.get(monthKey) || 0) + 1);
  }

  const result: DeploymentFrequency[] = [];
  for (const [period, count] of monthlyCount) {
    result.push({
      period,
      count,
      frequency: "monthly",
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}

function calculateLeadTimeForChanges(
  pulls: PullRequest[]
): LeadTimeForChanges[] {
  const mergedPRs = pulls.filter((pr) => pr.merged_at);

  return mergedPRs
    .map((pr) => {
      const createdAt = new Date(pr.created_at);
      const mergedAt = new Date(pr.merged_at!);
      const leadTimeMs = mergedAt.getTime() - createdAt.getTime();
      const leadTimeHours = leadTimeMs / (1000 * 60 * 60);

      return {
        pr_number: pr.number,
        title: pr.title,
        lead_time_hours: Math.round(leadTimeHours * 10) / 10,
        created_at: pr.created_at,
        merged_at: pr.merged_at!,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.merged_at).getTime() - new Date(a.merged_at).getTime()
    );
}

function calculateChangeFailureRate(
  releases: Release[],
  commits: Commit[]
): ChangeFailureRate[] {
  // revert や hotfix を含むコミットを失敗とみなす
  const failureKeywords = ["revert", "hotfix", "fix:", "bugfix"];

  const publishedReleases = releases.filter((r) => !r.draft && !r.prerelease);

  // 月別にグループ化
  const monthlyStats = new Map<
    string,
    { total: number; failures: number }
  >();

  for (const release of publishedReleases) {
    const date = new Date(release.published_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const stats = monthlyStats.get(monthKey) || { total: 0, failures: 0 };
    stats.total++;

    // リリース名やタグ名に失敗キーワードが含まれているか
    const isFailure = failureKeywords.some(
      (keyword) =>
        release.name.toLowerCase().includes(keyword) ||
        release.tag_name.toLowerCase().includes(keyword)
    );
    if (isFailure) {
      stats.failures++;
    }

    monthlyStats.set(monthKey, stats);
  }

  // コミットメッセージからも失敗を検出
  for (const commit of commits) {
    const date = new Date(commit.author.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyStats.has(monthKey)) continue;

    const isFailure = failureKeywords.some((keyword) =>
      commit.message.toLowerCase().includes(keyword)
    );

    if (isFailure) {
      const stats = monthlyStats.get(monthKey)!;
      stats.failures++;
      monthlyStats.set(monthKey, stats);
    }
  }

  const result: ChangeFailureRate[] = [];
  for (const [period, stats] of monthlyStats) {
    result.push({
      period,
      total_deployments: stats.total,
      failed_deployments: stats.failures,
      failure_rate:
        stats.total > 0
          ? Math.round((stats.failures / stats.total) * 100 * 10) / 10
          : 0,
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}

function calculateTimeToRestore(issues: Issue[]): TimeToRestore[] {
  // bug, incident, hotfix ラベルがついた Issue のみ対象
  const incidentLabels = ["bug", "incident", "hotfix", "critical"];

  const incidentIssues = issues.filter(
    (issue) =>
      issue.state === "closed" &&
      issue.closed_at &&
      issue.labels.some((label) =>
        incidentLabels.some((il) => label.name.toLowerCase().includes(il))
      )
  );

  return incidentIssues
    .map((issue) => {
      const createdAt = new Date(issue.created_at);
      const closedAt = new Date(issue.closed_at!);
      const restoreTimeMs = closedAt.getTime() - createdAt.getTime();
      const restoreTimeHours = restoreTimeMs / (1000 * 60 * 60);

      return {
        issue_number: issue.number,
        title: issue.title,
        time_to_restore_hours: Math.round(restoreTimeHours * 10) / 10,
        created_at: issue.created_at,
        closed_at: issue.closed_at!,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime()
    );
}

// 統計サマリー計算
export function calculateSummary(metrics: DORAMetrics) {
  const avgLeadTime =
    metrics.lead_time_for_changes.length > 0
      ? metrics.lead_time_for_changes.reduce(
          (sum, item) => sum + item.lead_time_hours,
          0
        ) / metrics.lead_time_for_changes.length
      : 0;

  const avgRestoreTime =
    metrics.time_to_restore.length > 0
      ? metrics.time_to_restore.reduce(
          (sum, item) => sum + item.time_to_restore_hours,
          0
        ) / metrics.time_to_restore.length
      : 0;

  const totalDeployments = metrics.deployment_frequency.reduce(
    (sum, item) => sum + item.count,
    0
  );

  const avgFailureRate =
    metrics.change_failure_rate.length > 0
      ? metrics.change_failure_rate.reduce(
          (sum, item) => sum + item.failure_rate,
          0
        ) / metrics.change_failure_rate.length
      : 0;

  return {
    total_deployments: totalDeployments,
    avg_lead_time_hours: Math.round(avgLeadTime * 10) / 10,
    avg_failure_rate: Math.round(avgFailureRate * 10) / 10,
    avg_restore_time_hours: Math.round(avgRestoreTime * 10) / 10,
  };
}
