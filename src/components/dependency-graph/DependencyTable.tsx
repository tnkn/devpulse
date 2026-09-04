"use client";

import { useMemo, useState } from "react";
import { priorityRank } from "@/lib/dependencies/priority";
import {
  buildDependencyRows,
  type DependencyRow,
  type DependencySortKey,
  type SortDirection,
  sortDependencyRows,
} from "@/lib/dependencies/table";
import { useI18n } from "@/lib/i18n";
import type {
  Issue,
  IssueDependencyEdge,
  IssueProgressStatus,
  IssueSubIssueEdge,
} from "@/types";

interface Props {
  issues: Issue[];
  edges: IssueDependencyEdge[];
  subIssues: IssueSubIssueEdge[];
  visibleNumbers: Set<number>;
  repoFullName: string;
}

/** Same colours as the graph's cards, so one reading covers both views. */
const PRIORITY_BADGE_CLASS: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

/** An unrecognised wording still shows, just without the emphasis. */
function priorityBadgeClass(priority: string): string {
  const rank = priorityRank(priority);
  return rank
    ? PRIORITY_BADGE_CLASS[rank]
    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
}

const STATUS_BADGE_CLASS: Record<IssueProgressStatus, string> = {
  notstarted:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600",
  started:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100 border-amber-400 dark:border-amber-700",
  completed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 border-emerald-400 dark:border-emerald-700",
};

function IssueLink({
  number,
  title,
  repoFullName,
}: {
  number: number;
  title?: string;
  repoFullName: string;
}) {
  return (
    <a
      href={`https://github.com/${repoFullName}/issues/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      title={title ? `#${number} ${title}` : `#${number}`}
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      #{number}
    </a>
  );
}

/** A cell of issue references, or a dash when there are none. */
function RefCell({
  numbers,
  repoFullName,
}: {
  numbers: number[];
  repoFullName: string;
}) {
  if (numbers.length === 0) {
    return <span className="text-gray-400 dark:text-gray-600">—</span>;
  }
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {numbers.map((n) => (
        <IssueLink key={n} number={n} repoFullName={repoFullName} />
      ))}
    </span>
  );
}

/**
 * The same relationships the canvas draws, as rows. Reading a graph is
 * good for shape and bad for detail: this is where you scan assignees,
 * count what an issue is holding up, or sort by how blocked things are.
 */
export function DependencyTable({
  issues,
  edges,
  subIssues,
  visibleNumbers,
  repoFullName,
}: Props) {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<DependencySortKey>("number");
  const [direction, setDirection] = useState<SortDirection>("asc");

  const rows = useMemo(
    () =>
      buildDependencyRows(
        issues,
        edges,
        visibleNumbers,
        repoFullName,
        subIssues,
      ),
    [issues, edges, visibleNumbers, repoFullName, subIssues],
  );

  const sorted = useMemo(
    () => sortDependencyRows(rows, sortKey, direction),
    [rows, sortKey, direction],
  );

  // Clicking the active column flips it; a new column starts ascending.
  const toggleSort = (key: DependencySortKey) => {
    if (key === sortKey) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection("asc");
  };

  const columns: { key: DependencySortKey; label: string; wide?: boolean }[] = [
    { key: "number", label: t.dependencies.colIssue },
    { key: "title", label: t.dependencies.colTitle, wide: true },
    { key: "status", label: t.dependencies.colStatus },
    { key: "priority", label: t.dependencies.colPriority },
    { key: "size", label: t.dependencies.colSize },
    { key: "assignees", label: t.dependencies.colAssignees },
    { key: "parent", label: t.dependencies.colParent },
    { key: "blockedBy", label: t.dependencies.colBlockedBy },
    { key: "blocking", label: t.dependencies.colBlocking },
  ];

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t.dependencies.noEdges}
      </p>
    );
  }

  return (
    // The table scrolls inside its own box so the page itself never does.
    <div className="h-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {columns.map((column) => {
              const active = column.key === sortKey;
              return (
                <th
                  key={column.key}
                  scope="col"
                  // aria-sort belongs on the header cell, not the control
                  // inside it: it describes the column, not the button.
                  aria-sort={
                    active
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={`px-3 py-2 text-left font-semibold ${column.wide ? "w-2/5" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="flex items-center gap-1 hover:underline"
                  >
                    {column.label}
                    <span
                      className={
                        active
                          ? "text-gray-500 dark:text-gray-400"
                          : "text-transparent"
                      }
                      aria-hidden="true"
                    >
                      {active && direction === "desc" ? "▼" : "▲"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row: DependencyRow) => (
            <tr
              key={row.number}
              className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
            >
              <td className="px-3 py-2 whitespace-nowrap">
                <IssueLink
                  number={row.number}
                  title={row.title}
                  repoFullName={repoFullName}
                />
              </td>
              <td className="px-3 py-2">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={row.title}
                  className="hover:underline"
                >
                  {row.title}
                </a>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span
                  className={`inline-block rounded border px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[row.status]}`}
                >
                  {row.status === "completed"
                    ? t.dependencies.completed
                    : row.status === "started"
                      ? t.dependencies.started
                      : t.dependencies.notStarted}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {row.priority ? (
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${priorityBadgeClass(row.priority)}`}
                  >
                    {row.priority}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-600">—</span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {row.size ?? (
                  <span className="text-gray-400 dark:text-gray-600">—</span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {row.assignees.length > 0 ? (
                  row.assignees.join(", ")
                ) : (
                  <span className="text-gray-400 dark:text-gray-600">—</span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {row.parent ? (
                  <IssueLink
                    number={row.parent.number}
                    title={row.parent.title}
                    repoFullName={repoFullName}
                  />
                ) : (
                  <span className="text-gray-400 dark:text-gray-600">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <RefCell numbers={row.blockedBy} repoFullName={repoFullName} />
              </td>
              <td className="px-3 py-2">
                <RefCell numbers={row.blocking} repoFullName={repoFullName} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
