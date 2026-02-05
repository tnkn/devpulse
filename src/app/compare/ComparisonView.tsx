"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Repository, DORAMetrics } from "@/types";

interface RepoMetrics {
  repoName: string;
  dumpId: string;
  dumpTimestamp: string;
  metrics: DORAMetrics;
  summary: {
    total_deployments: number;
    avg_lead_time_hours: number;
    avg_failure_rate: number;
    avg_restore_time_hours: number;
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
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const handleToggle = useCallback(
    (repoName: string, dumpId?: string) => {
      const key = dumpId ? `${repoName}:${dumpId}` : repoName;
      const newSelected = selected.includes(key)
        ? selected.filter((s) => s !== key && !s.startsWith(`${repoName}:`))
        : [...selected.filter((s) => !s.startsWith(`${repoName}:`)), key];

      setSelected(newSelected);
    },
    [selected]
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
        <h2 className="text-xl font-semibold mb-4">Select Repositories</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
          {repositories.map((repo) => (
            <div
              key={repo.name}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selected.some((s) => s === repo.name || s.startsWith(`${repo.name}:`))
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-400"
              }`}
              onClick={() => handleToggle(repo.name, repo.dumps[0]?.id)}
            >
              <h3 className="font-semibold mb-2">{repo.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {repo.dumps.length} dump(s)
              </p>
              {repo.dumps.length > 0 && (
                <select
                  className="mt-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-full"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleToggle(repo.name, e.target.value)}
                  value={
                    selected
                      .find((s) => s.startsWith(`${repo.name}:`))
                      ?.split(":")[1] || repo.dumps[0]?.id
                  }
                >
                  {repo.dumps.map((dump) => (
                    <option key={dump.id} value={dump.id}>
                      {formatTimestamp(dump.timestamp)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleCompare}
            disabled={selected.length < 2}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Compare ({selected.length} selected)
          </button>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Home
          </Link>
        </div>
      </section>

      {/* Comparison Results */}
      {selectedMetrics.length >= 2 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Comparison Results</h2>

          {/* Summary Comparison Table */}
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4">Metric</th>
                  {selectedMetrics.map((m) => (
                    <th key={m.repoName} className="text-right py-3 px-4">
                      {m.repoName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium">Deployment Frequency</td>
                  {selectedMetrics.map((m) => (
                    <td key={m.repoName} className="text-right py-3 px-4">
                      {m.summary.total_deployments} deployments
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium">Avg Lead Time</td>
                  {selectedMetrics.map((m) => (
                    <td key={m.repoName} className="text-right py-3 px-4">
                      <span
                        className={getLeadTimeColor(m.summary.avg_lead_time_hours)}
                      >
                        {m.summary.avg_lead_time_hours} hours
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium">Change Failure Rate</td>
                  {selectedMetrics.map((m) => (
                    <td key={m.repoName} className="text-right py-3 px-4">
                      <span
                        className={getFailureRateColor(m.summary.avg_failure_rate)}
                      >
                        {m.summary.avg_failure_rate}%
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 px-4 font-medium">MTTR</td>
                  {selectedMetrics.map((m) => (
                    <td key={m.repoName} className="text-right py-3 px-4">
                      <span className={getMTTRColor(m.summary.avg_restore_time_hours)}>
                        {m.summary.avg_restore_time_hours} hours
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Performance Rating */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {selectedMetrics.map((m) => (
              <div
                key={m.repoName}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <h3 className="font-semibold mb-2">{m.repoName}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {formatTimestamp(m.dumpTimestamp)}
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Deployments:</span>
                    <span className="font-medium">{m.summary.total_deployments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lead Time:</span>
                    <span className={getLeadTimeColor(m.summary.avg_lead_time_hours)}>
                      {m.summary.avg_lead_time_hours}h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failure Rate:</span>
                    <span className={getFailureRateColor(m.summary.avg_failure_rate)}>
                      {m.summary.avg_failure_rate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>MTTR:</span>
                    <span className={getMTTRColor(m.summary.avg_restore_time_hours)}>
                      {m.summary.avg_restore_time_hours}h
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
          Select at least 2 repositories to compare.
        </p>
      )}

      {selectedMetrics.length === 0 && selected.length > 0 && (
        <p className="text-gray-500 dark:text-gray-400">
          Click &quot;Compare&quot; to see the results.
        </p>
      )}
    </div>
  );
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
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

function getMTTRColor(hours: number): string {
  if (hours < 4) return "text-green-600 dark:text-green-400";
  if (hours < 24) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}
