"use client";

import { useState, useMemo } from "react";
import type { DORAMetrics, PeriodGranularity, PeriodMetrics, DeploymentFrequency, RevertRate, LeadTimePeriodStats } from "@/types";
import {
  DeploymentFrequencyChart,
  LeadTimeChart,
  ChangeFailureRateChart,
  RevertRateChart,
  PRSizeChart,
  PickupTimeChart,
} from "@/components/charts";
import { DateRangeFilter, ExportButtons } from "@/components/ui";

interface Props {
  metrics: DORAMetrics;
  allPeriodMetrics: Record<PeriodGranularity, PeriodMetrics>;
  repoName: string;
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

export function MetricsDashboard({ metrics, allPeriodMetrics, repoName }: Props) {
  const [dateRange, setDateRange] = useState<{
    start: string | null;
    end: string | null;
  }>({ start: null, end: null });

  const [granularity, setGranularity] = useState<PeriodGranularity>("week");

  // Merge selected granularity period data with per-item metrics
  const activeMetrics = useMemo((): DORAMetrics => {
    const pm = allPeriodMetrics[granularity];
    return {
      ...metrics,
      deployment_frequency: pm.deployment_frequency,
      lead_time_stats: pm.lead_time_stats,
      change_failure_rate: pm.change_failure_rate,
      revert_rate: pm.revert_rate,
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
      pickup_time: activeMetrics.pickup_time.filter((item) =>
        isInRange(item.first_review_at)
      ),
    };
  }, [activeMetrics, dateRange]);

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
              <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">Period:</span>
              {(["day", "week", "month"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    granularity === g
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
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
        <h2 className="text-xl font-semibold mb-4">Metrics Charts</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">PR Merge Frequency</h3>
            <DeploymentFrequencyChart data={filteredMetrics.deployment_frequency} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Lead Time for Changes</h3>
            <LeadTimeChart data={filteredMetrics.lead_time_stats} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Change Failure Rate</h3>
            <ChangeFailureRateChart data={filteredMetrics.change_failure_rate} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Revert Rate</h3>
            <RevertRateChart data={filteredMetrics.revert_rate} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">PR Size (LOC)</h3>
            <PRSizeChart data={filteredMetrics.pr_size} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Pick-up Time</h3>
            <PickupTimeChart data={filteredMetrics.pickup_time} />
          </div>
        </div>
      </section>

      {/* Detailed Tables */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Detailed Data</h2>

        {/* Period Summary Table (Merge Frequency + Revert Rate + Lead Time) */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Period Summary</h3>
          {filteredMetrics.deployment_frequency.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No data available.</p>
          ) : (
            <PeriodSummaryTable
              deploymentFrequency={filteredMetrics.deployment_frequency}
              revertRate={filteredMetrics.revert_rate}
              leadTimeStats={filteredMetrics.lead_time_stats}
            />
          )}
        </div>

        {/* Change Failure Rate Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Change Failure Rate</h3>
          {filteredMetrics.change_failure_rate.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No deployment data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">Period</th>
                    <th className="text-right py-2 px-4">Total</th>
                    <th className="text-right py-2 px-4">Failed</th>
                    <th className="text-right py-2 px-4">Failure Rate</th>
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
          <h3 className="text-lg font-medium mb-3">Lead Time per PR (Top 30)</h3>
          {filteredMetrics.lead_time_for_changes.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No merged PR data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">PR</th>
                    <th className="text-left py-2 px-4">Title</th>
                    <th className="text-right py-2 px-4">Lead Time (hours)</th>
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
          <h3 className="text-lg font-medium mb-3">PR Size (LOC)</h3>
          {filteredMetrics.pr_size.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No PR size data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">PR</th>
                    <th className="text-left py-2 px-4">Title</th>
                    <th className="text-right py-2 px-4">Additions</th>
                    <th className="text-right py-2 px-4">Deletions</th>
                    <th className="text-right py-2 px-4">Total LOC</th>
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
          <h3 className="text-lg font-medium mb-3">Pick-up Time</h3>
          {filteredMetrics.pickup_time.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No review data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">PR</th>
                    <th className="text-left py-2 px-4">Title</th>
                    <th className="text-right py-2 px-4">Pick-up Time (hours)</th>
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
    </div>
  );
}

function PeriodSummaryTable({
  deploymentFrequency,
  revertRate,
  leadTimeStats,
}: {
  deploymentFrequency: DeploymentFrequency[];
  revertRate: RevertRate[];
  leadTimeStats: LeadTimePeriodStats[];
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
            <th className="text-left py-2 px-3">Period</th>
            <th className="text-right py-2 px-3">Merges</th>
            <th className="text-right py-2 px-3">Reverts</th>
            <th className="text-right py-2 px-3">Revert Rate</th>
            <th className="text-right py-2 px-3">Avg Lead Time (h)</th>
            <th className="text-right py-2 px-3">σ (h)</th>
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
