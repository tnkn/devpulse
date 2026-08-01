"use client";

import { useMemo, useState } from "react";
import {
  ChangeFailureRateChart,
  DeploymentFrequencyChart,
  LeadTimeChart,
  PickupTimeChart,
  PRSizeChart,
  RevertRateChart,
} from "@/components/charts";
import { DateRangeFilter, ExportButtons } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { formatPeriod } from "@/lib/i18n/format";
import type {
  Commit,
  DeploymentFrequency,
  DORAMetrics,
  LeadTimePeriodStats,
  PeriodGranularity,
  PeriodMetrics,
  PullRequest,
  RevertRate,
  Review,
} from "@/types";

interface Props {
  metrics: DORAMetrics;
  allPeriodMetrics: Record<PeriodGranularity, PeriodMetrics>;
  repoName: string;
  repoFullName: string;
  pulls: PullRequest[];
  reviews: Review[];
  commits: Commit[];
}

function periodToDate(period: string): Date {
  // YYYY-MM-DD (day)
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return new Date(`${period}T00:00:00`);
  }
  // YYYY-Www (week)
  if (period.includes("-W")) {
    const [yearStr, weekStr] = period.split("-W");
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekStr, 10);
    const jan4 = new Date(year, 0, 4);
    const dow = jan4.getDay() || 7;
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - dow + 1);
    const target = new Date(firstMonday);
    target.setDate(firstMonday.getDate() + (week - 1) * 7);
    return target;
  }
  // YYYY-MM (month)
  const [year, month] = period.split("-");
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
}

const granularityKeys = ["day", "week", "month"] as const;

function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  while (d <= e) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(count, 1);
}

export function MetricsDashboard({
  metrics,
  allPeriodMetrics,
  repoName,
  repoFullName,
  pulls,
  reviews,
  commits,
}: Props) {
  const { t } = useI18n();
  const [dateRange, setDateRange] = useState<{
    start: string | null;
    end: string | null;
  }>({ start: null, end: null });
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const [granularity, setGranularity] = useState<PeriodGranularity>("week");

  const granularityLabels: Record<PeriodGranularity, string> = {
    day: t.metrics.day,
    week: t.metrics.week,
    month: t.metrics.month,
  };

  // Merge selected granularity period data with per-item metrics
  const activeMetrics = useMemo((): DORAMetrics => {
    const pm = allPeriodMetrics[granularity];
    return {
      ...metrics,
      deployment_frequency: pm.deployment_frequency,
      lead_time_stats: pm.lead_time_stats,
      change_failure_rate: pm.change_failure_rate,
      revert_rate: pm.revert_rate,
      pr_size_stats: pm.pr_size_stats,
      pickup_time_stats: pm.pickup_time_stats,
    };
  }, [metrics, allPeriodMetrics, granularity]);

  const filteredMetrics = useMemo(() => {
    if (!dateRange.start && !dateRange.end) {
      return activeMetrics;
    }

    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange.end ? new Date(dateRange.end) : null;

    const isInRange = (dateStr: string) => {
      const date = new Date(dateStr);
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    };

    const isPeriodInRange = (period: string) => {
      const date = periodToDate(period);
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    };

    return {
      deployment_frequency: activeMetrics.deployment_frequency.filter((item) =>
        isPeriodInRange(item.period),
      ),
      lead_time_for_changes: activeMetrics.lead_time_for_changes.filter(
        (item) => isInRange(item.merged_at),
      ),
      lead_time_stats: activeMetrics.lead_time_stats.filter((item) =>
        isPeriodInRange(item.period),
      ),
      change_failure_rate: activeMetrics.change_failure_rate.filter((item) =>
        isPeriodInRange(item.period),
      ),
      revert_rate: activeMetrics.revert_rate.filter((item) =>
        isPeriodInRange(item.period),
      ),
      pr_size: activeMetrics.pr_size.filter((item) =>
        isInRange(item.merged_at),
      ),
      pr_size_stats: activeMetrics.pr_size_stats.filter((item) =>
        isPeriodInRange(item.period),
      ),
      pickup_time: activeMetrics.pickup_time.filter((item) =>
        isInRange(item.first_review_at),
      ),
      pickup_time_stats: activeMetrics.pickup_time_stats.filter((item) =>
        isPeriodInRange(item.period),
      ),
    };
  }, [activeMetrics, dateRange]);

  // Per-person PR metrics
  const perPersonPR = useMemo(() => {
    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange.end ? new Date(dateRange.end) : null;

    const merged = pulls.filter((pr) => {
      if (!pr.merged_at) return false;
      if (!pr.assignees?.length && !pr.user_login) return false;
      const d = new Date(pr.merged_at);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });

    if (merged.length === 0) return [];

    // Business days for the period
    let rangeStart: Date;
    let rangeEnd: Date;
    if (startDate && endDate) {
      rangeStart = startDate;
      rangeEnd = endDate;
    } else {
      const dates = merged.map((pr) => new Date(pr.merged_at!));
      rangeStart =
        startDate ?? new Date(Math.min(...dates.map((d) => d.getTime())));
      rangeEnd =
        endDate ?? new Date(Math.max(...dates.map((d) => d.getTime())));
    }
    const bizDays = countBusinessDays(rangeStart, rangeEnd);

    const byUser = new Map<
      string,
      { count: number; additions: number; deletions: number }
    >();
    for (const pr of merged) {
      // Use assignees if available, otherwise fall back to user_login
      const logins = pr.assignees?.length
        ? pr.assignees
        : pr.user_login
          ? [pr.user_login]
          : [];
      for (const login of logins) {
        const cur = byUser.get(login) ?? {
          count: 0,
          additions: 0,
          deletions: 0,
        };
        cur.count++;
        cur.additions += pr.additions ?? 0;
        cur.deletions += pr.deletions ?? 0;
        byUser.set(login, cur);
      }
    }

    return [...byUser.entries()]
      .map(([login, data]) => ({
        login,
        count: data.count,
        avgPerDay: Math.round((data.count / bizDays) * 100) / 100,
        additions: data.additions,
        deletions: data.deletions,
      }))
      .sort((a, b) => b.count - a.count);
  }, [pulls, dateRange]);

  // Per-person review metrics
  const perPersonReview = useMemo(() => {
    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange.end ? new Date(dateRange.end) : null;

    const filtered = reviews.filter((r) => {
      if (r.user_type === "Bot") return false;
      const d = new Date(r.submitted_at);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });

    if (filtered.length === 0) return [];

    const byUser = new Map<
      string,
      { prNumbers: Set<number>; totalCount: number }
    >();
    for (const r of filtered) {
      const cur = byUser.get(r.user_login) ?? {
        prNumbers: new Set<number>(),
        totalCount: 0,
      };
      cur.prNumbers.add(r.pr_number);
      cur.totalCount++;
      byUser.set(r.user_login, cur);
    }

    return [...byUser.entries()]
      .map(([login, data]) => ({
        login,
        uniquePRs: data.prNumbers.size,
        totalCount: data.totalCount,
      }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [reviews, dateRange]);

  // Build login → Set<email> mapping via merge_commit_sha
  const loginToEmails = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const commitBysha = new Map<string, Commit>();
    for (const c of commits) {
      commitBysha.set(c.sha, c);
    }
    for (const pr of pulls) {
      if (pr.user_login && pr.merge_commit_sha) {
        const commit = commitBysha.get(pr.merge_commit_sha);
        if (commit) {
          const emails = map.get(pr.user_login) ?? new Set<string>();
          emails.add(commit.author.email);
          map.set(pr.user_login, emails);
        }
      }
    }
    return map;
  }, [pulls, commits]);

  const handleFilterChange = (start: string | null, end: string | null) => {
    setDateRange({ start, end });
  };

  return (
    <div>
      {/* Filter & Export */}
      <section className="sticky top-0 z-10 -mx-8 px-8 py-4 mb-6 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <DateRangeFilter onFilterChange={handleFilterChange} />
            <div className="flex items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">
                {t.metrics.period}:
              </span>
              {granularityKeys.map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    granularity === g
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {granularityLabels[g]}
                </button>
              ))}
            </div>
          </div>
          <ExportButtons metrics={filteredMetrics} repoName={repoName} />
        </div>
      </section>

      {/* Charts Grid */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          {t.metrics.metricsCharts}
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">
              {t.metrics.deploymentFrequency}
            </h3>
            <DeploymentFrequencyChart
              data={filteredMetrics.deployment_frequency}
            />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">
              {t.metrics.leadTimeForChanges}
            </h3>
            <LeadTimeChart data={filteredMetrics.lead_time_stats} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">
              {t.metrics.changeFailureRate}
            </h3>
            <ChangeFailureRateChart
              data={filteredMetrics.change_failure_rate}
            />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">{t.metrics.revertRate}</h3>
            <RevertRateChart data={filteredMetrics.revert_rate} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">{t.metrics.changeSize}</h3>
            <PRSizeChart data={filteredMetrics.pr_size_stats} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">
              {t.metrics.timeToFirstReview}
            </h3>
            <PickupTimeChart data={filteredMetrics.pickup_time_stats} />
          </div>
        </div>
      </section>

      <hr className="border-gray-200 dark:border-gray-700 mb-8" />

      {/* Detailed Tables */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t.metrics.detailedData}</h2>

        {/* Period Summary Table (Merge Frequency + Revert Rate + Lead Time) */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">
            {t.metrics.periodSummary}
          </h3>
          {filteredMetrics.deployment_frequency.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              {t.metrics.noDataAvailable}
            </p>
          ) : (
            <PeriodSummaryTable
              deploymentFrequency={filteredMetrics.deployment_frequency}
              revertRate={filteredMetrics.revert_rate}
              leadTimeStats={filteredMetrics.lead_time_stats}
              t={t}
            />
          )}
        </div>

        {/* Change Failure Rate Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">
            {t.metrics.changeFailureRate}
          </h3>
          {filteredMetrics.change_failure_rate.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              {t.metrics.noDeploymentData}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">
                      {t.metrics.periodHeader}
                    </th>
                    <th className="text-right py-2 px-4">{t.metrics.total}</th>
                    <th className="text-right py-2 px-4">{t.metrics.failed}</th>
                    <th className="text-right py-2 px-4">
                      {t.metrics.failureRate}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.change_failure_rate.map((item) => (
                    <tr
                      key={item.period}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 px-4">{formatPeriod(item.period)}</td>
                      <td className="text-right py-2 px-4">
                        {item.total_deployments}
                      </td>
                      <td className="text-right py-2 px-4">
                        {item.failed_deployments}
                      </td>
                      <td className="text-right py-2 px-4">
                        {item.failure_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lead Time per-PR Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">
            {t.metrics.leadTimePerPR}
          </h3>
          {filteredMetrics.lead_time_for_changes.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              {t.metrics.noMergedPRData}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">{t.metrics.pr}</th>
                    <th className="text-left py-2 px-4">{t.metrics.title}</th>
                    <th className="text-right py-2 px-4">
                      {t.metrics.leadTimeHours}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredMetrics.lead_time_for_changes]
                    .sort((a, b) => b.lead_time_hours - a.lead_time_hours)
                    .slice(0, 30)
                    .map((item) => (
                      <tr
                        key={item.pr_number}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-2 px-4">#{item.pr_number}</td>
                        <td className="py-2 px-4 max-w-md truncate">
                          {item.title}
                        </td>
                        <td className="text-right py-2 px-4">
                          {item.lead_time_hours}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PR Size Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">
            {t.metrics.changeSizeLOC}
          </h3>
          {filteredMetrics.pr_size.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              {t.metrics.noPRSizeData}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">{t.metrics.pr}</th>
                    <th className="text-left py-2 px-4">{t.metrics.title}</th>
                    <th className="text-right py-2 px-4">
                      {t.metrics.additions}
                    </th>
                    <th className="text-right py-2 px-4">
                      {t.metrics.deletions}
                    </th>
                    <th className="text-right py-2 px-4">
                      {t.metrics.totalLOC}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.pr_size.slice(0, 10).map((item) => (
                    <tr
                      key={item.pr_number}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 px-4">#{item.pr_number}</td>
                      <td className="py-2 px-4 max-w-md truncate">
                        {item.title}
                      </td>
                      <td className="text-right py-2 px-4 text-green-600">
                        +{item.additions}
                      </td>
                      <td className="text-right py-2 px-4 text-red-600">
                        -{item.deletions}
                      </td>
                      <td className="text-right py-2 px-4">
                        {item.total_lines}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pick-up Time Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">
            {t.metrics.timeToFirstReview}
          </h3>
          {filteredMetrics.pickup_time.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              {t.metrics.noReviewData}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">{t.metrics.pr}</th>
                    <th className="text-left py-2 px-4">{t.metrics.title}</th>
                    <th className="text-right py-2 px-4">
                      {t.metrics.timeToFirstReviewHours}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.pickup_time.slice(0, 10).map((item) => (
                    <tr
                      key={item.pr_number}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 px-4">#{item.pr_number}</td>
                      <td className="py-2 px-4 max-w-md truncate">
                        {item.title}
                      </td>
                      <td className="text-right py-2 px-4">
                        {item.pickup_time_hours}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <hr className="border-gray-200 dark:border-gray-700 mb-8" />

      {/* Per-Person Metrics */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          {t.metrics.perPersonPRMetrics}
        </h2>
        {perPersonPR.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            {t.metrics.noPRAuthorData}
          </p>
        ) : (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-4">{t.metrics.user}</th>
                  <th className="text-right py-2 px-4">
                    {t.metrics.mergedPRs}
                  </th>
                  <th className="text-right py-2 px-4">
                    {t.metrics.avgPRsPerBusinessDay}
                  </th>
                  <th className="text-right py-2 px-4">
                    {t.metrics.additions}
                  </th>
                  <th className="text-right py-2 px-4">
                    {t.metrics.deletions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {perPersonPR.map((row) => (
                  <tr
                    key={row.login}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2 px-4">
                      <button
                        type="button"
                        className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        onClick={() => setSelectedUser(row.login)}
                      >
                        {row.login}
                      </button>
                    </td>
                    <td className="text-right py-2 px-4">{row.count}</td>
                    <td className="text-right py-2 px-4">{row.avgPerDay}</td>
                    <td className="text-right py-2 px-4 text-green-600">
                      +{row.additions}
                    </td>
                    <td className="text-right py-2 px-4 text-red-600">
                      -{row.deletions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-4">
          {t.metrics.perPersonReviewMetrics}
        </h2>
        {perPersonReview.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            {t.metrics.noReviewerData}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-4">{t.metrics.user}</th>
                  <th className="text-right py-2 px-4">
                    {t.metrics.reviewedPRsUnique}
                  </th>
                  <th className="text-right py-2 px-4">
                    {t.metrics.reviewCount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {perPersonReview.map((row) => (
                  <tr
                    key={row.login}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2 px-4">
                      <button
                        type="button"
                        className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        onClick={() => setSelectedUser(row.login)}
                      >
                        {row.login}
                      </button>
                    </td>
                    <td className="text-right py-2 px-4">{row.uniquePRs}</td>
                    <td className="text-right py-2 px-4">{row.totalCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedUser && (
        <PersonActivityModal
          login={selectedUser}
          repoFullName={repoFullName}
          pulls={pulls}
          commits={commits}
          reviews={reviews}
          loginToEmails={loginToEmails}
          dateRange={dateRange}
          onClose={() => setSelectedUser(null)}
          t={t}
        />
      )}
    </div>
  );
}

function PersonActivityModal({
  login,
  repoFullName,
  pulls,
  commits,
  reviews,
  loginToEmails,
  dateRange,
  onClose,
  t,
}: {
  login: string;
  repoFullName: string;
  pulls: PullRequest[];
  commits: Commit[];
  reviews: Review[];
  loginToEmails: Map<string, Set<string>>;
  dateRange: { start: string | null; end: string | null };
  onClose: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const [activeTab, setActiveTab] = useState<"prs" | "commits" | "reviews">(
    "prs",
  );
  const startDate = dateRange.start ? new Date(dateRange.start) : null;
  const endDate = dateRange.end ? new Date(dateRange.end) : null;

  // User's merged PRs in date range (by assignees, fallback to user_login)
  const userPRs = useMemo(() => {
    return pulls
      .filter((pr) => {
        if (!pr.merged_at) return false;
        const assigned = pr.assignees?.length
          ? pr.assignees.includes(login)
          : pr.user_login === login;
        if (!assigned) return false;
        const d = new Date(pr.merged_at);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [pulls, login, startDate, endDate]);

  // Build sha → PR lookup for related PR column
  const shaTopr = useMemo(() => {
    const map = new Map<string, PullRequest>();
    for (const pr of pulls) {
      if (pr.merge_commit_sha) {
        map.set(pr.merge_commit_sha, pr);
      }
    }
    return map;
  }, [pulls]);

  // User's commits in date range (matched via email mapping)
  const userCommits = useMemo(() => {
    const emails = loginToEmails.get(login);
    if (!emails || emails.size === 0) return [];
    return commits
      .filter((c) => {
        if (!emails.has(c.author.email)) return false;
        const d = new Date(c.author.date);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.author.date).getTime() - new Date(a.author.date).getTime(),
      );
  }, [commits, login, loginToEmails, startDate, endDate]);

  // User's reviews in date range
  const userReviews = useMemo(() => {
    return reviews
      .filter((r) => {
        if (r.user_login !== login || r.user_type === "Bot") return false;
        const d = new Date(r.submitted_at);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.submitted_at).getTime() -
          new Date(a.submitted_at).getTime(),
      );
  }, [reviews, login, startDate, endDate]);

  // PR number → PR lookup for review tab
  const prByNumber = useMemo(() => {
    const map = new Map<number, PullRequest>();
    for (const pr of pulls) {
      map.set(pr.number, pr);
    }
    return map;
  }, [pulls]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold">
            {t.metrics.activityHistory(login)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl leading-none px-2"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
          <button
            type="button"
            onClick={() => setActiveTab("prs")}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "prs"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.metrics.mergedPRsTab} ({userPRs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("commits")}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "commits"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.metrics.commitHistory} ({userCommits.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reviews")}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "reviews"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.metrics.reviewHistory} ({userReviews.length})
          </button>
        </div>

        <div className="p-4">
          {/* Created PRs Tab */}
          {activeTab === "prs" &&
            (userPRs.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {t.metrics.noMergedPRData}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3">
                        {t.metrics.createdDate}
                      </th>
                      <th className="text-left py-2 px-3">{t.metrics.pr}</th>
                      <th className="text-left py-2 px-3">
                        {t.metrics.mergedDate}
                      </th>
                      <th className="text-right py-2 px-3">
                        {t.metrics.timeToMerge}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {userPRs.map((pr) => {
                      const leadHours = pr.merged_at
                        ? Math.round(
                            ((new Date(pr.merged_at).getTime() -
                              new Date(pr.created_at).getTime()) /
                              3600000) *
                              10,
                          ) / 10
                        : null;
                      return (
                        <tr
                          key={pr.number}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          <td className="py-2 px-3 whitespace-nowrap">
                            {formatDate(pr.created_at)}
                          </td>
                          <td className="py-2 px-3">
                            <a
                              href={`https://github.com/${repoFullName}/pull/${pr.number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              #{pr.number}
                            </a>{" "}
                            <span className="max-w-xs truncate inline-block align-bottom">
                              {pr.title}
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {pr.merged_at ? formatDate(pr.merged_at) : "-"}
                          </td>
                          <td className="text-right py-2 px-3">
                            {leadHours ?? "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

          {/* Commits Tab */}
          {activeTab === "commits" &&
            (userCommits.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {t.metrics.noCommitData}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3">
                        {t.metrics.commitDate}
                      </th>
                      <th className="text-left py-2 px-3">
                        {t.metrics.commitMessage}
                      </th>
                      <th className="text-left py-2 px-3">
                        {t.metrics.relatedPR}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {userCommits.slice(0, 100).map((c) => {
                      const relatedPR = shaTopr.get(c.sha);
                      return (
                        <tr
                          key={c.sha}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          <td className="py-2 px-3 whitespace-nowrap">
                            {formatDate(c.author.date)}
                          </td>
                          <td className="py-2 px-3 max-w-md truncate">
                            <a
                              href={`https://github.com/${repoFullName}/commit/${c.sha}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {c.message.split("\n")[0]}
                            </a>
                          </td>
                          <td className="py-2 px-3">
                            {relatedPR ? (
                              <a
                                href={`https://github.com/${repoFullName}/pull/${relatedPR.number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                #{relatedPR.number} {relatedPR.title}
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

          {/* Reviews Tab */}
          {activeTab === "reviews" &&
            (userReviews.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {t.metrics.noReviewActivityData}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3">
                        {t.metrics.reviewDate}
                      </th>
                      <th className="text-left py-2 px-3">
                        {t.metrics.reviewedPR}
                      </th>
                      <th className="text-left py-2 px-3">
                        {t.metrics.reviewState}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {userReviews.slice(0, 100).map((r) => {
                      const pr = prByNumber.get(r.pr_number);
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          <td className="py-2 px-3 whitespace-nowrap">
                            {formatDate(r.submitted_at)}
                          </td>
                          <td className="py-2 px-3">
                            <a
                              href={`https://github.com/${repoFullName}/pull/${r.pr_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              #{r.pr_number}
                            </a>{" "}
                            {pr && (
                              <span className="max-w-xs truncate inline-block align-bottom">
                                {pr.title}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                r.state === "APPROVED"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                  : r.state === "CHANGES_REQUESTED"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {r.state}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function PeriodSummaryTable({
  deploymentFrequency,
  revertRate,
  leadTimeStats,
  t,
}: {
  deploymentFrequency: DeploymentFrequency[];
  revertRate: RevertRate[];
  leadTimeStats: LeadTimePeriodStats[];
  t: ReturnType<typeof useI18n>["t"];
}) {
  // Collect all unique periods
  const periods = new Set<string>();
  for (const d of deploymentFrequency) periods.add(d.period);
  for (const r of revertRate) periods.add(r.period);
  for (const l of leadTimeStats) periods.add(l.period);

  const sortedPeriods = [...periods].sort();

  // Build lookup maps
  const dfMap = new Map(deploymentFrequency.map((d) => [d.period, d]));
  const rrMap = new Map(revertRate.map((r) => [r.period, r]));
  const ltMap = new Map(leadTimeStats.map((l) => [l.period, l]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-3">{t.metrics.periodHeader}</th>
            <th className="text-right py-2 px-3">{t.metrics.merges}</th>
            <th className="text-right py-2 px-3">{t.metrics.reverts}</th>
            <th className="text-right py-2 px-3">
              {t.metrics.revertRateHeader}
            </th>
            <th className="text-right py-2 px-3">{t.metrics.avgLeadTimeH}</th>
            <th className="text-right py-2 px-3">{t.metrics.sigmaH}</th>
          </tr>
        </thead>
        <tbody>
          {sortedPeriods.map((period) => {
            const df = dfMap.get(period);
            const rr = rrMap.get(period);
            const lt = ltMap.get(period);
            return (
              <tr
                key={period}
                className="border-b border-gray-100 dark:border-gray-800"
              >
                <td className="py-2 px-3">{formatPeriod(period)}</td>
                <td className="text-right py-2 px-3">{df?.count ?? "-"}</td>
                <td className="text-right py-2 px-3">
                  {rr?.revert_commits ?? "-"}
                </td>
                <td className="text-right py-2 px-3">
                  {rr ? `${rr.revert_rate}%` : "-"}
                </td>
                <td className="text-right py-2 px-3">{lt?.avg_hours ?? "-"}</td>
                <td className="text-right py-2 px-3">
                  {lt?.stddev_hours ?? "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
