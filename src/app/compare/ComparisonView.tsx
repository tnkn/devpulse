"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatTimestamp } from "@/lib/i18n/format";
import type { DORAMetrics, Repository } from "@/types";

interface RepoMetrics {
  repoName: string;
  displayName: string;
  metrics: DORAMetrics;
  summary: {
    total_deployments: number;
    avg_lead_time_hours: number;
    avg_failure_rate: number;
    avg_revert_rate: number;
    avg_pr_size: number;
    avg_pickup_time_hours: number;
  };
}

interface Props {
  repositories: Repository[];
  selectedMetrics: RepoMetrics[];
  initialSelected: string[];
}

export function ComparisonView({
  repositories,
  selectedMetrics,
  initialSelected,
}: Props) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const handleToggle = useCallback(
    (repoName: string) => {
      const newSelected = selected.includes(repoName)
        ? selected.filter((s) => s !== repoName)
        : [...selected, repoName];

      setSelected(newSelected);
    },
    [selected],
  );

  const handleCompare = useCallback(() => {
    const params = new URLSearchParams();
    if (selected.length > 0) {
      params.set("repos", selected.join(","));
    }
    router.push(`/compare?${params.toString()}`);
  }, [selected, router]);

  return (
    <div>
      {/* Repository Selection */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          {t.compare.selectRepositories}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
          {repositories.map((repo) => (
            <div
              key={repo.name}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selected.includes(repo.name)
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-400"
              }`}
              onClick={() => handleToggle(repo.name)}
            >
              <h3 className="font-semibold mb-2">{repo.displayName}</h3>
              {repo.lastCollected && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t.common.lastCollected}:{" "}
                  {formatTimestamp(repo.lastCollected, locale)}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleCompare}
            disabled={selected.length < 2}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.compare.compareSelected(selected.length)}
          </button>
          <Link href="/" className="text-blue-600 hover:underline">
            {t.compare.backToHome}
          </Link>
        </div>
      </section>

      {/* Comparison Results */}
      {selectedMetrics.length >= 2 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">
            {t.compare.comparisonResults}
          </h2>

          {/* Summary Comparison Table */}
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4">{t.compare.metric}</th>
                  {selectedMetrics.map((m) => (
                    <th key={m.repoName} className="text-right py-3 px-4">
                      {m.displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium">
                    {t.repo.deploymentFrequency}
                  </td>
                  {selectedMetrics.map((m) => (
                    <td key={m.repoName} className="text-right py-3 px-4">
                      {m.summary.total_deployments} {t.repo.merges}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium">
                    {t.repo.leadTimeForChanges}
                  </td>
                  {selectedMetrics.map((m) => (
                    <td key={m.repoName} className="text-right py-3 px-4">
                      <span
                        className={getLeadTimeColor(
                          m.summary.avg_lead_time_hours,
                        )}
                      >
                        {m.summary.avg_lead_time_hours} {t.repo.hours}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium">
                    {t.repo.changeFailureRate}
                  </td>
                  {selectedMetrics.map((m) => (
                    <td key={m.repoName} className="text-right py-3 px-4">
                      <span
                        className={getFailureRateColor(
                          m.summary.avg_failure_rate,
                        )}
                      >
                        {m.summary.avg_failure_rate}%
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium">{t.repo.revertRate}</td>
                  {selectedMetrics.map((m) => (
                    <td key={m.repoName} className="text-right py-3 px-4">
                      <span
                        className={getRevertRateColor(
                          m.summary.avg_revert_rate,
                        )}
                      >
                        {m.summary.avg_revert_rate}%
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium">{t.repo.changeSize}</td>
                  {selectedMetrics.map((m) => (
                    <td key={m.repoName} className="text-right py-3 px-4">
                      <span className={getPRSizeColor(m.summary.avg_pr_size)}>
                        {m.summary.avg_pr_size} {t.repo.loc}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium">
                    {t.repo.timeToFirstReview}
                  </td>
                  {selectedMetrics.map((m) => (
                    <td key={m.repoName} className="text-right py-3 px-4">
                      <span
                        className={getPickupTimeColor(
                          m.summary.avg_pickup_time_hours,
                        )}
                      >
                        {m.summary.avg_pickup_time_hours} {t.repo.hours}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Performance Rating */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {selectedMetrics.map((m) => (
              <div
                key={m.repoName}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <h3 className="font-semibold mb-2">{m.displayName}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{t.compare.deployments}:</span>
                    <span className="font-medium">
                      {m.summary.total_deployments}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.repo.leadTimeForChanges}:</span>
                    <span
                      className={getLeadTimeColor(
                        m.summary.avg_lead_time_hours,
                      )}
                    >
                      {m.summary.avg_lead_time_hours}h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.compare.failureRate}:</span>
                    <span
                      className={getFailureRateColor(
                        m.summary.avg_failure_rate,
                      )}
                    >
                      {m.summary.avg_failure_rate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.repo.revertRate}:</span>
                    <span
                      className={getRevertRateColor(m.summary.avg_revert_rate)}
                    >
                      {m.summary.avg_revert_rate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.repo.changeSize}:</span>
                    <span className={getPRSizeColor(m.summary.avg_pr_size)}>
                      {m.summary.avg_pr_size} {t.repo.loc}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.repo.timeToFirstReview}:</span>
                    <span
                      className={getPickupTimeColor(
                        m.summary.avg_pickup_time_hours,
                      )}
                    >
                      {m.summary.avg_pickup_time_hours}h
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedMetrics.length === 1 && (
        <p className="text-gray-500 dark:text-gray-400">
          {t.compare.selectAtLeast2}
        </p>
      )}

      {selectedMetrics.length === 0 && selected.length > 0 && (
        <p className="text-gray-500 dark:text-gray-400">
          {t.compare.clickCompare}
        </p>
      )}
    </div>
  );
}

function getLeadTimeColor(hours: number): string {
  if (hours < 24) return "text-green-600 dark:text-green-400";
  if (hours < 72) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getFailureRateColor(rate: number): string {
  if (rate < 15) return "text-green-600 dark:text-green-400";
  if (rate < 30) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getRevertRateColor(rate: number): string {
  if (rate < 5) return "text-green-600 dark:text-green-400";
  if (rate < 15) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getPRSizeColor(loc: number): string {
  if (loc < 200) return "text-green-600 dark:text-green-400";
  if (loc <= 500) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getPickupTimeColor(hours: number): string {
  if (hours < 4) return "text-green-600 dark:text-green-400";
  if (hours <= 24) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}
