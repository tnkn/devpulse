"use client";

import { useState, useMemo } from "react";
import type { DORAMetrics, PeriodGranularity, PeriodMetrics, DeploymentFrequency, RevertRate, LeadTimePeriodStats, PeriodStats, PullRequest, Review } from "@/types";
import {
  DeploymentFrequencyChart,
  LeadTimeChart,
  ChangeFailureRateChart,
  RevertRateChart,
  PRSizeChart,
  PickupTimeChart,
} from "@/components/charts";
import { DateRangeFilter, ExportButtons } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

interface Props {
  metrics: DORAMetrics;
  allPeriodMetrics: Record<PeriodGranularity, PeriodMetrics>;
  repoName: string;
  pulls: PullRequest[];
  reviews: Review[];
}

function periodToDate(period: string): Date {
  // YYYY-MM-DD (day)
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return new Date(period + "T00:00:00");
  }
  // YYYY-Www (week)
  if (period.includes("-W")) {
    const [yearStr, weekStr] = period.split("-W");
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);
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
  return new Date(parseInt(year), parseInt(month) - 1, 1);
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

export function MetricsDashboard({ metrics, allPeriodMetrics, repoName, pulls, reviews }: Props) {
  const { t } = useI18n();
  const [dateRange, setDateRange] = useState<{
    start: string | null;
    end: string | null;
  }>({ start: null, end: null });

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
        isPeriodInRange(item.period)
      ),
      lead_time_for_changes: activeMetrics.lead_time_for_changes.filter((item) =>
        isInRange(item.merged_at)
      ),
      lead_time_stats: activeMetrics.lead_time_stats.filter((item) =>
        isPeriodInRange(item.period)
      ),
      change_failure_rate: activeMetrics.change_failure_rate.filter((item) =>
        isPeriodInRange(item.period)
      ),
      revert_rate: activeMetrics.revert_rate.filter((item) =>
        isPeriodInRange(item.period)
      ),
      pr_size: activeMetrics.pr_size.filter((item) =>
        isInRange(item.merged_at)
      ),
      pr_size_stats: activeMetrics.pr_size_stats.filter((item) =>
        isPeriodInRange(item.period)
      ),
      pickup_time: activeMetrics.pickup_time.filter((item) =>
        isInRange(item.first_review_at)
      ),
      pickup_time_stats: activeMetrics.pickup_time_stats.filter((item) =>
        isPeriodInRange(item.period)
      ),
    };
  }, [activeMetrics, dateRange]);

  // Per-person PR metrics
  const perPersonPR = useMemo(() => {
    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange.end ? new Date(dateRange.end) : null;

    const merged = pulls.filter((pr) => {
      if (!pr.merged_at || !pr.user_login) return false;
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
      rangeStart = startDate ?? new Date(Math.min(...dates.map((d) => d.getTime())));
      rangeEnd = endDate ?? new Date(Math.max(...dates.map((d) => d.getTime())));
    }
    const bizDays = countBusinessDays(rangeStart, rangeEnd);

    const byUser = new Map<string, { count: number; additions: number; deletions: number }>();
    for (const pr of merged) {
      const login = pr.user_login!;
      const cur = byUser.get(login) ?? { count: 0, additions: 0, deletions: 0 };
      cur.count++;
      cur.additions += pr.additions ?? 0;
      cur.deletions += pr.deletions ?? 0;
      byUser.set(login, cur);
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

    const byUser = new Map<string, { prNumbers: Set<number>; totalCount: number }>();
    for (const r of filtered) {
      const cur = byUser.get(r.user_login) ?? { prNumbers: new Set<number>(), totalCount: 0 };
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

  const handleFilterChange = (start: string | null, end: string | null) => {
    setDateRange({ start, end });
  };

  return (
    <div>
      {/* Filter & Export */}
      <section className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <DateRangeFilter onFilterChange={handleFilterChange} />
            <div className="flex items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">{t.metrics.period}:</span>
              {granularityKeys.map((g) => (
                <button
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
          <ExportButtons
            metrics={filteredMetrics}
            repoName={repoName}
          />
        </div>
      </section>

      {/* Charts Grid */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t.metrics.metricsCharts}</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">{t.metrics.deploymentFrequency}</h3>
            <DeploymentFrequencyChart data={filteredMetrics.deployment_frequency} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">{t.metrics.leadTimeForChanges}</h3>
            <LeadTimeChart data={filteredMetrics.lead_time_stats} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">{t.metrics.changeFailureRate}</h3>
            <ChangeFailureRateChart data={filteredMetrics.change_failure_rate} />
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
            <h3 className="text-lg font-medium mb-4">{t.metrics.timeToFirstReview}</h3>
            <PickupTimeChart data={filteredMetrics.pickup_time_stats} />
          </div>
        </div>
      </section>

      {/* Detailed Tables */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t.metrics.detailedData}</h2>

        {/* Period Summary Table (Merge Frequency + Revert Rate + Lead Time) */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">{t.metrics.periodSummary}</h3>
          {filteredMetrics.deployment_frequency.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{t.metrics.noDataAvailable}</p>
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
          <h3 className="text-lg font-medium mb-3">{t.metrics.changeFailureRate}</h3>
          {filteredMetrics.change_failure_rate.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{t.metrics.noDeploymentData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">{t.metrics.periodHeader}</th>
                    <th className="text-right py-2 px-4">{t.metrics.total}</th>
                    <th className="text-right py-2 px-4">{t.metrics.failed}</th>
                    <th className="text-right py-2 px-4">{t.metrics.failureRate}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.change_failure_rate.map((item) => (
                    <tr
                      key={item.period}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 px-4">{item.period}</td>
                      <td className="text-right py-2 px-4">{item.total_deployments}</td>
                      <td className="text-right py-2 px-4">{item.failed_deployments}</td>
                      <td className="text-right py-2 px-4">{item.failure_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lead Time per-PR Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">{t.metrics.leadTimePerPR}</h3>
          {filteredMetrics.lead_time_for_changes.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{t.metrics.noMergedPRData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">{t.metrics.pr}</th>
                    <th className="text-left py-2 px-4">{t.metrics.title}</th>
                    <th className="text-right py-2 px-4">{t.metrics.leadTimeHours}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredMetrics.lead_time_for_changes].sort((a, b) => b.lead_time_hours - a.lead_time_hours).slice(0, 30).map((item) => (
                    <tr
                      key={item.pr_number}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 px-4">#{item.pr_number}</td>
                      <td className="py-2 px-4 max-w-md truncate">{item.title}</td>
                      <td className="text-right py-2 px-4">{item.lead_time_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PR Size Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">{t.metrics.changeSizeLOC}</h3>
          {filteredMetrics.pr_size.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{t.metrics.noPRSizeData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">{t.metrics.pr}</th>
                    <th className="text-left py-2 px-4">{t.metrics.title}</th>
                    <th className="text-right py-2 px-4">{t.metrics.additions}</th>
                    <th className="text-right py-2 px-4">{t.metrics.deletions}</th>
                    <th className="text-right py-2 px-4">{t.metrics.totalLOC}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.pr_size.slice(0, 10).map((item) => (
                    <tr
                      key={item.pr_number}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 px-4">#{item.pr_number}</td>
                      <td className="py-2 px-4 max-w-md truncate">{item.title}</td>
                      <td className="text-right py-2 px-4 text-green-600">+{item.additions}</td>
                      <td className="text-right py-2 px-4 text-red-600">-{item.deletions}</td>
                      <td className="text-right py-2 px-4">{item.total_lines}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pick-up Time Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">{t.metrics.timeToFirstReview}</h3>
          {filteredMetrics.pickup_time.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{t.metrics.noReviewData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">{t.metrics.pr}</th>
                    <th className="text-left py-2 px-4">{t.metrics.title}</th>
                    <th className="text-right py-2 px-4">{t.metrics.timeToFirstReviewHours}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.pickup_time.slice(0, 10).map((item) => (
                    <tr
                      key={item.pr_number}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 px-4">#{item.pr_number}</td>
                      <td className="py-2 px-4 max-w-md truncate">{item.title}</td>
                      <td className="text-right py-2 px-4">{item.pickup_time_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Per-Person Metrics */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t.metrics.perPersonPRMetrics}</h2>
        {perPersonPR.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">{t.metrics.noPRAuthorData}</p>
        ) : (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-4">{t.metrics.user}</th>
                  <th className="text-right py-2 px-4">{t.metrics.mergedPRs}</th>
                  <th className="text-right py-2 px-4">{t.metrics.avgPRsPerBusinessDay}</th>
                  <th className="text-right py-2 px-4">{t.metrics.additions}</th>
                  <th className="text-right py-2 px-4">{t.metrics.deletions}</th>
                </tr>
              </thead>
              <tbody>
                {perPersonPR.map((row) => (
                  <tr key={row.login} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-4">{row.login}</td>
                    <td className="text-right py-2 px-4">{row.count}</td>
                    <td className="text-right py-2 px-4">{row.avgPerDay}</td>
                    <td className="text-right py-2 px-4 text-green-600">+{row.additions}</td>
                    <td className="text-right py-2 px-4 text-red-600">-{row.deletions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-4">{t.metrics.perPersonReviewMetrics}</h2>
        {perPersonReview.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">{t.metrics.noReviewerData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-4">{t.metrics.user}</th>
                  <th className="text-right py-2 px-4">{t.metrics.reviewedPRsUnique}</th>
                  <th className="text-right py-2 px-4">{t.metrics.reviewCount}</th>
                </tr>
              </thead>
              <tbody>
                {perPersonReview.map((row) => (
                  <tr key={row.login} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-4">{row.login}</td>
                    <td className="text-right py-2 px-4">{row.uniquePRs}</td>
                    <td className="text-right py-2 px-4">{row.totalCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
  deploymentFrequency.forEach((d) => periods.add(d.period));
  revertRate.forEach((r) => periods.add(r.period));
  leadTimeStats.forEach((l) => periods.add(l.period));

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
            <th className="text-right py-2 px-3">{t.metrics.revertRateHeader}</th>
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
                <td className="py-2 px-3">{period}</td>
                <td className="text-right py-2 px-3">{df?.count ?? "-"}</td>
                <td className="text-right py-2 px-3">{rr?.revert_commits ?? "-"}</td>
                <td className="text-right py-2 px-3">
                  {rr ? `${rr.revert_rate}%` : "-"}
                </td>
                <td className="text-right py-2 px-3">{lt?.avg_hours ?? "-"}</td>
                <td className="text-right py-2 px-3">{lt?.stddev_hours ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
