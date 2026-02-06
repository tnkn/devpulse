"use client";

import type { DORAMetrics } from "@/types";

interface Props {
  metrics: DORAMetrics;
  repoName: string;
}

export function ExportButtons({ metrics, repoName }: Props) {
  const safeRepoName = repoName.replace(/\//g, "_");

  const handleExportJSON = () => {
    const data = {
      repository: repoName,
      exported_at: new Date().toISOString(),
      metrics,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, `${safeRepoName}-metrics.json`);
  };

  const handleExportCSV = () => {
    const lines: string[] = [];

    // Deployment Frequency
    lines.push("# Deployment Frequency");
    lines.push("period,count");
    metrics.deployment_frequency.forEach((item) => {
      lines.push(`${item.period},${item.count}`);
    });
    lines.push("");

    // Lead Time for Changes
    lines.push("# Lead Time for Changes");
    lines.push("pr_number,title,lead_time_hours,created_at,merged_at");
    metrics.lead_time_for_changes.forEach((item) => {
      lines.push(
        `${item.pr_number},"${item.title.replace(/"/g, '""')}",${item.lead_time_hours},${item.created_at},${item.merged_at}`
      );
    });
    lines.push("");

    // Lead Time Stats (period)
    lines.push("# Lead Time Stats");
    lines.push("period,avg_hours,stddev_hours,plus_sigma,minus_sigma,count");
    metrics.lead_time_stats.forEach((item) => {
      lines.push(
        `${item.period},${item.avg_hours},${item.stddev_hours},${item.plus_sigma},${item.minus_sigma},${item.count}`
      );
    });
    lines.push("");

    // Change Failure Rate
    lines.push("# Change Failure Rate");
    lines.push("period,failed_deployments,failure_rate");
    metrics.change_failure_rate.forEach((item) => {
      lines.push(
        `${item.period},${item.failed_deployments},${item.failure_rate}`
      );
    });
    lines.push("");

    // Revert Rate
    lines.push("# Revert Rate");
    lines.push("period,total_commits,revert_commits,revert_rate");
    metrics.revert_rate.forEach((item) => {
      lines.push(
        `${item.period},${item.total_commits},${item.revert_commits},${item.revert_rate}`
      );
    });
    lines.push("");

    // PR Size
    lines.push("# PR Size");
    lines.push("pr_number,title,additions,deletions,total_lines,merged_at");
    metrics.pr_size.forEach((item) => {
      lines.push(
        `${item.pr_number},"${item.title.replace(/"/g, '""')}",${item.additions},${item.deletions},${item.total_lines},${item.merged_at}`
      );
    });
    lines.push("");

    // Pick-up Time
    lines.push("# Pick-up Time");
    lines.push("pr_number,title,pickup_time_hours,created_at,first_review_at");
    metrics.pickup_time.forEach((item) => {
      lines.push(
        `${item.pr_number},"${item.title.replace(/"/g, '""')}",${item.pickup_time_hours},${item.created_at},${item.first_review_at}`
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    downloadBlob(blob, `${safeRepoName}-metrics.csv`);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400">Export:</span>
      <button
        onClick={handleExportJSON}
        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        JSON
      </button>
      <button
        onClick={handleExportCSV}
        className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        CSV
      </button>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
