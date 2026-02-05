"use client";

import { useState, useMemo } from "react";
import type { DORAMetrics } from "@/types";
import {
  DeploymentFrequencyChart,
  LeadTimeChart,
  ChangeFailureRateChart,
  MTTRChart,
} from "@/components/charts";
import { DateRangeFilter, ExportButtons } from "@/components/ui";

interface Props {
  metrics: DORAMetrics;
  repoName: string;
  dumpId: string;
}

export function MetricsDashboard({ metrics, repoName, dumpId }: Props) {
  const [dateRange, setDateRange] = useState<{
    start: string | null;
    end: string | null;
  }>({ start: null, end: null });

  const filteredMetrics = useMemo(() => {
    if (!dateRange.start && !dateRange.end) {
      return metrics;
    }

    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange.end ? new Date(dateRange.end) : null;

    const isInRange = (dateStr: string) => {
      const date = new Date(dateStr);
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    };

    return {
      deployment_frequency: metrics.deployment_frequency.filter((item) => {
        const [year, month] = item.period.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      }),
      lead_time_for_changes: metrics.lead_time_for_changes.filter((item) =>
        isInRange(item.merged_at)
      ),
      change_failure_rate: metrics.change_failure_rate.filter((item) => {
        const [year, month] = item.period.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      }),
      time_to_restore: metrics.time_to_restore.filter((item) =>
        isInRange(item.closed_at)
      ),
    };
  }, [metrics, dateRange]);

  const handleFilterChange = (start: string | null, end: string | null) => {
    setDateRange({ start, end });
  };

  return (
    <div>
      {/* Filter & Export */}
      <section className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <DateRangeFilter onFilterChange={handleFilterChange} />
          <ExportButtons
            metrics={filteredMetrics}
            repoName={repoName}
            dumpId={dumpId}
          />
        </div>
      </section>

      {/* Charts Grid */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Metrics Charts</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Deployment Frequency</h3>
            <DeploymentFrequencyChart data={filteredMetrics.deployment_frequency} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Lead Time for Changes</h3>
            <LeadTimeChart data={filteredMetrics.lead_time_for_changes} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Change Failure Rate</h3>
            <ChangeFailureRateChart data={filteredMetrics.change_failure_rate} />
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">Time to Restore (MTTR)</h3>
            <MTTRChart data={filteredMetrics.time_to_restore} />
          </div>
        </div>
      </section>

      {/* Detailed Tables */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Detailed Data</h2>

        {/* Deployment Frequency Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Deployment Frequency</h3>
          {filteredMetrics.deployment_frequency.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No release data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">Period</th>
                    <th className="text-right py-2 px-4">Deployments</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.deployment_frequency.map((item) => (
                    <tr
                      key={item.period}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 px-4">{item.period}</td>
                      <td className="text-right py-2 px-4">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lead Time Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Lead Time for Changes</h3>
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
                  {filteredMetrics.lead_time_for_changes.slice(0, 10).map((item) => (
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

        {/* MTTR Table */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Time to Restore (MTTR)</h3>
          {filteredMetrics.time_to_restore.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No incident/bug issues found. (Labels: bug, incident, hotfix, critical)
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-4">Issue</th>
                    <th className="text-left py-2 px-4">Title</th>
                    <th className="text-right py-2 px-4">Time to Restore (hours)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.time_to_restore.slice(0, 10).map((item) => (
                    <tr
                      key={item.issue_number}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 px-4">#{item.issue_number}</td>
                      <td className="py-2 px-4 max-w-md truncate">{item.title}</td>
                      <td className="text-right py-2 px-4">{item.time_to_restore_hours}</td>
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
