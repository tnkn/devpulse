import type {
  PullRequest,
  Commit,
  Review,
  DeploymentFrequency,
  LeadTimeForChanges,
  LeadTimePeriodStats,
  ChangeFailureRate,
  RevertRate,
  PRSize,
  PickupTime,
  DORAMetrics,
  PeriodGranularity,
  PeriodMetrics,
} from "@/types";

function getPeriodKey(date: Date, granularity: PeriodGranularity): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  switch (granularity) {
    case "day": {
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    case "week": {
      // ISO week number
      const d = new Date(Date.UTC(year, date.getMonth(), date.getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(
        ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
      );
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    }
    case "month":
      return `${year}-${month}`;
  }
}

function getFrequencyLabel(granularity: PeriodGranularity): DeploymentFrequency["frequency"] {
  switch (granularity) {
    case "day": return "daily";
    case "week": return "weekly";
    case "month": return "monthly";
  }
}

export function calculateDORAMetrics(
  pulls: PullRequest[],
  commits: Commit[],
  reviews: Review[],
  granularity: PeriodGranularity = "week"
): DORAMetrics {
  return {
    deployment_frequency: calculateDeploymentFrequency(pulls, granularity),
    lead_time_for_changes: calculateLeadTimeForChanges(pulls),
    lead_time_stats: calculateLeadTimeStats(pulls, granularity),
    change_failure_rate: calculateChangeFailureRate(pulls, granularity),
    revert_rate: calculateRevertRate(commits, granularity),
    pr_size: calculatePRSize(pulls),
    pickup_time: calculatePickupTime(pulls, reviews),
  };
}

export function calculateAllPeriodMetrics(
  pulls: PullRequest[],
  commits: Commit[]
): Record<PeriodGranularity, PeriodMetrics> {
  const granularities: PeriodGranularity[] = ["day", "week", "month"];
  const result = {} as Record<PeriodGranularity, PeriodMetrics>;

  for (const g of granularities) {
    result[g] = {
      deployment_frequency: calculateDeploymentFrequency(pulls, g),
      lead_time_stats: calculateLeadTimeStats(pulls, g),
      change_failure_rate: calculateChangeFailureRate(pulls, g),
      revert_rate: calculateRevertRate(commits, g),
    };
  }

  return result;
}

function calculateDeploymentFrequency(
  pulls: PullRequest[],
  granularity: PeriodGranularity = "week"
): DeploymentFrequency[] {
  const mergedPRs = pulls.filter((pr) => pr.merged_at);

  const periodCount = new Map<string, number>();

  for (const pr of mergedPRs) {
    const date = new Date(pr.merged_at!);
    const key = getPeriodKey(date, granularity);
    periodCount.set(key, (periodCount.get(key) || 0) + 1);
  }

  const frequency = getFrequencyLabel(granularity);
  const result: DeploymentFrequency[] = [];
  for (const [period, count] of periodCount) {
    result.push({ period, count, frequency });
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

function calculateLeadTimeStats(
  pulls: PullRequest[],
  granularity: PeriodGranularity = "week"
): LeadTimePeriodStats[] {
  const mergedPRs = pulls.filter((pr) => pr.merged_at);

  // Group lead times by period
  const periodHours = new Map<string, number[]>();

  for (const pr of mergedPRs) {
    const mergedAt = new Date(pr.merged_at!);
    const key = getPeriodKey(mergedAt, granularity);
    const createdAt = new Date(pr.created_at);
    const hours = (mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    const arr = periodHours.get(key) || [];
    arr.push(hours);
    periodHours.set(key, arr);
  }

  const result: LeadTimePeriodStats[] = [];
  for (const [period, hours] of periodHours) {
    const count = hours.length;
    const avg = hours.reduce((s, h) => s + h, 0) / count;
    const variance =
      count > 1
        ? hours.reduce((s, h) => s + (h - avg) ** 2, 0) / (count - 1)
        : 0;
    const stddev = Math.sqrt(variance);

    result.push({
      period,
      avg_hours: Math.round(avg * 10) / 10,
      stddev_hours: Math.round(stddev * 10) / 10,
      plus_sigma: Math.round((avg + stddev) * 10) / 10,
      minus_sigma: Math.round(Math.max(0, avg - stddev) * 10) / 10,
      count,
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}

function calculateChangeFailureRate(
  pulls: PullRequest[],
  granularity: PeriodGranularity = "week"
): ChangeFailureRate[] {
  const mergedPRs = pulls.filter((pr) => pr.merged_at);

  const periodStats = new Map<
    string,
    { total: number; failures: number }
  >();

  for (const pr of mergedPRs) {
    const date = new Date(pr.merged_at!);
    const key = getPeriodKey(date, granularity);

    const stats = periodStats.get(key) || { total: 0, failures: 0 };
    stats.total++;

    if (pr.ci_failed) {
      stats.failures++;
    }

    periodStats.set(key, stats);
  }

  const result: ChangeFailureRate[] = [];
  for (const [period, stats] of periodStats) {
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

function calculateRevertRate(
  commits: Commit[],
  granularity: PeriodGranularity = "week"
): RevertRate[] {
  const revertPattern = /^revert\b/i;

  const periodStats = new Map<
    string,
    { total: number; reverts: number }
  >();

  for (const commit of commits) {
    const date = new Date(commit.author.date);
    const key = getPeriodKey(date, granularity);

    const stats = periodStats.get(key) || { total: 0, reverts: 0 };
    stats.total++;

    if (revertPattern.test(commit.message)) {
      stats.reverts++;
    }

    periodStats.set(key, stats);
  }

  const result: RevertRate[] = [];
  for (const [period, stats] of periodStats) {
    result.push({
      period,
      total_commits: stats.total,
      revert_commits: stats.reverts,
      revert_rate:
        stats.total > 0
          ? Math.round((stats.reverts / stats.total) * 100 * 10) / 10
          : 0,
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}

function calculatePRSize(pulls: PullRequest[]): PRSize[] {
  const mergedPRs = pulls.filter(
    (pr) => pr.merged_at && pr.additions !== undefined && pr.deletions !== undefined
  );

  return mergedPRs
    .map((pr) => ({
      pr_number: pr.number,
      title: pr.title,
      additions: pr.additions!,
      deletions: pr.deletions!,
      total_lines: pr.additions! + pr.deletions!,
      merged_at: pr.merged_at!,
    }))
    .sort(
      (a, b) =>
        new Date(b.merged_at).getTime() - new Date(a.merged_at).getTime()
    );
}

function calculatePickupTime(pulls: PullRequest[], reviews: Review[]): PickupTime[] {
  const mergedPRs = pulls.filter((pr) => pr.merged_at);

  // Build a map of pr_number → first human review
  const firstReviewMap = new Map<number, string>();
  for (const review of reviews) {
    // Skip bot reviews
    if (review.user_type === "Bot") continue;
    const existing = firstReviewMap.get(review.pr_number);
    if (!existing || new Date(review.submitted_at) < new Date(existing)) {
      firstReviewMap.set(review.pr_number, review.submitted_at);
    }
  }

  return mergedPRs
    .filter((pr) => firstReviewMap.has(pr.number))
    .map((pr) => {
      const firstReviewAt = firstReviewMap.get(pr.number)!;
      const createdAt = new Date(pr.created_at);
      const reviewAt = new Date(firstReviewAt);
      const pickupMs = reviewAt.getTime() - createdAt.getTime();
      const pickupHours = pickupMs / (1000 * 60 * 60);

      return {
        pr_number: pr.number,
        title: pr.title,
        pickup_time_hours: Math.round(Math.max(0, pickupHours) * 10) / 10,
        created_at: pr.created_at,
        first_review_at: firstReviewAt,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.first_review_at).getTime() - new Date(a.first_review_at).getTime()
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

  const avgRevertRate =
    metrics.revert_rate.length > 0
      ? metrics.revert_rate.reduce(
          (sum, item) => sum + item.revert_rate,
          0
        ) / metrics.revert_rate.length
      : 0;

  const avgPRSize =
    metrics.pr_size.length > 0
      ? metrics.pr_size.reduce(
          (sum, item) => sum + item.total_lines,
          0
        ) / metrics.pr_size.length
      : 0;

  const avgPickupTime =
    metrics.pickup_time.length > 0
      ? metrics.pickup_time.reduce(
          (sum, item) => sum + item.pickup_time_hours,
          0
        ) / metrics.pickup_time.length
      : 0;

  return {
    total_deployments: totalDeployments,
    avg_lead_time_hours: Math.round(avgLeadTime * 10) / 10,
    avg_failure_rate: Math.round(avgFailureRate * 10) / 10,
    avg_revert_rate: Math.round(avgRevertRate * 10) / 10,
    avg_pr_size: Math.round(avgPRSize),
    avg_pickup_time_hours: Math.round(avgPickupTime * 10) / 10,
  };
}
