"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AssigneeCell,
  EditableCell,
} from "@/components/dependency-graph/EditableCell";
import {
  type ProjectFieldKind,
  useBoardProblem,
} from "@/components/dependency-graph/useBoardProblem";
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
  ProjectFieldDefinition,
} from "@/types";

interface Props {
  repoKey: string;
  projectFields: ProjectFieldDefinition[];
  projectFieldsSyncedAt: string | null;
  projectFieldsError: string | null;
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
  repoKey,
  projectFields,
  projectFieldsSyncedAt,
  projectFieldsError,
  issues,
  edges,
  subIssues,
  visibleNumbers,
  repoFullName,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [sortKey, setSortKey] = useState<DependencySortKey>("number");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [assignableUsers, setAssignableUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Only the collaborator list has to be fetched: the board's fields
  // arrive with the page, having been cached at collection time.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/github/issue-fields?key=${encodeURIComponent(repoKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAssignableUsers(data.assignableUsers ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [repoKey]);

  /**
   * Sends one edit and refreshes from the server.
   *
   * router.refresh() rather than patching local state: the server
   * component re-reads the row GitHub accepted, so the table can never
   * show a value the write did not actually produce.
   */
  const submit = useCallback(
    async (body: Record<string, unknown>) => {
      setError(null);
      try {
        const res = await fetch(
          `/api/github/issue-fields?key=${encodeURIComponent(repoKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    },
    [repoKey, router],
  );

  // Announced above both views by DependencyGraph; still needed here to
  // decide whether an individual cell can be edited.
  const boardProblem = useBoardProblem(
    projectFields,
    projectFieldsSyncedAt,
    projectFieldsError,
  );

  /**
   * Why one Priority or Size cell cannot be edited, or undefined when it
   * can.
   *
   * Answered per kind, not per table. A board that names its Priority
   * something we do not recognise still has a perfectly good Size, and
   * locking the Size column over the Priority column's problem would
   * take away an edit that works.
   *
   * Beyond the board-wide causes there is a per-issue one — this issue
   * is on no board — which stays on the cell, because it is true of that
   * row and not of its neighbours.
   */
  const uneditableReason = useCallback(
    (kind: ProjectFieldKind, projectItemId: string | null) => {
      if (boardProblem.blocked) return boardProblem.notice;
      if (boardProblem.missing.has(kind)) return boardProblem.notice;
      // A value read from one of GitHub's native issue fields has no
      // board item behind it, so the Projects mutation cannot write it.
      // Said plainly rather than reported as "not on a board", which
      // would send someone to add the issue to a board that would not
      // have helped.
      if (
        !projectFields.some((d) => d.kind === kind && d.source === "project")
      ) {
        return t.dependencies.nativeFieldReadOnly;
      }
      if (!projectItemId) return t.dependencies.notOnBoard;
      return undefined;
    },
    [boardProblem, projectFields, t],
  );

  /** The options a board offers for one of the two fields. */
  const optionsFor = useCallback(
    (kind: "priority" | "size", projectId: string | null) => {
      const definition = projectFields.find(
        (d) =>
          d.kind === kind &&
          d.source === "project" &&
          (!projectId || d.projectId === projectId),
      );
      return definition?.options.map((o) => o.name) ?? [];
    },
    [projectFields],
  );

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
    <div className="flex h-full flex-col">
      {error && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
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
                  <EditableCell
                    value={row.priority}
                    options={optionsFor("priority", row.projectId)}
                    disabledReason={uneditableReason(
                      "priority",
                      row.projectItemId,
                    )}
                    onChange={(next) =>
                      submit({
                        issue_number: row.number,
                        field: "priority",
                        value: next,
                      })
                    }
                  >
                    {row.priority ? (
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${priorityBadgeClass(row.priority)}`}
                      >
                        {row.priority}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-600">
                        —
                      </span>
                    )}
                  </EditableCell>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <EditableCell
                    value={row.size}
                    options={optionsFor("size", row.projectId)}
                    disabledReason={uneditableReason("size", row.projectItemId)}
                    onChange={(next) =>
                      submit({
                        issue_number: row.number,
                        field: "size",
                        value: next,
                      })
                    }
                  >
                    {row.size ?? (
                      <span className="text-gray-400 dark:text-gray-600">
                        —
                      </span>
                    )}
                  </EditableCell>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <AssigneeCell
                    repoKey={repoKey}
                    assignees={row.assignees}
                    candidates={assignableUsers}
                    onChange={(next) =>
                      submit({
                        issue_number: row.number,
                        field: "assignees",
                        assignees: next,
                      })
                    }
                  />
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
                  <RefCell
                    numbers={row.blockedBy}
                    repoFullName={repoFullName}
                  />
                </td>
                <td className="px-3 py-2">
                  <RefCell numbers={row.blocking} repoFullName={repoFullName} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
