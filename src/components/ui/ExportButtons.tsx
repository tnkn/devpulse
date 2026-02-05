"use client";

import type { DORAMetrics } from "@/types";

interface Props {
  metrics: DORAMetrics;
  repoName: string;
  dumpId: string;
}

export function ExportButtons({ metrics, repoName, dumpId }: Props) {
  const handleExportJSON = () => {
    const data = {
      repository: repoName,
      dump_id: dumpId,
      exported_at: new Date().toISOString(),
      metrics,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, `${repoName}-${dumpId}-metrics.json`);
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

    // Change Failure Rate
    lines.push("# Change Failure Rate");
    lines.push("period,total_deployments,failed_deployments,failure_rate");
    metrics.change_failure_rate.forEach((item) => {
      lines.push(
        `${item.period},${item.total_deployments},${item.failed_deployments},${item.failure_rate}`
      );
    });
    lines.push("");

    // Time to Restore
    lines.push("# Time to Restore (MTTR)");
    lines.push("issue_number,title,time_to_restore_hours,created_at,closed_at");
    metrics.time_to_restore.forEach((item) => {
      lines.push(
        `${item.issue_number},"${item.title.replace(/"/g, '""')}",${item.time_to_restore_hours},${item.created_at},${item.closed_at}`
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    downloadBlob(blob, `${repoName}-${dumpId}-metrics.csv`);
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
