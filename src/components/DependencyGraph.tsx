"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import {
  buildDependencyGraph,
  capVisibleIssueNumbers,
  computeVisibleIssueNumbers,
  DEFAULT_DISPLAY_LIMIT,
  type NodePositionOverrides,
} from "@/lib/dependencies/graph";
import type { LayoutDirection } from "@/lib/dependencies/layout";
import { useI18n } from "@/lib/i18n";
import type { Issue, IssueDependencyEdge, IssueSubIssueEdge } from "@/types";

// Client-only: React Flow resolves `colorMode="system"` from matchMedia,
// which does not match the server-rendered markup in dark mode.
const DependencyFlow = dynamic(
  () =>
    import("@/components/dependency-graph/DependencyFlow").then(
      (m) => m.DependencyFlow,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[420px] w-full rounded-lg border border-gray-200 dark:border-gray-700" />
    ),
  },
);

interface Props {
  repoKey: string;
  repoFullName: string;
  issues: Issue[];
  initialEdges: IssueDependencyEdge[];
  subIssues: IssueSubIssueEdge[];
}

type StartMode = "all" | "issue" | "label";

/** 0 stands for "no limit". */
const DISPLAY_LIMIT_OPTIONS = [100, 250, DEFAULT_DISPLAY_LIMIT, 1000, 2000, 0];

export function DependencyGraph({
  repoKey,
  repoFullName,
  issues,
  initialEdges,
  subIssues,
}: Props) {
  const { t } = useI18n();
  const [edges, setEdges] = useState<IssueDependencyEdge[]>(initialEdges);
  const [startMode, setStartMode] = useState<StartMode>("all");
  const [selectedIssues, setSelectedIssues] = useState<number[]>([]);
  const [issueQuery, setIssueQuery] = useState("");
  const [displayLimit, setDisplayLimit] = useState(DEFAULT_DISPLAY_LIMIT);
  const [direction, setDirection] = useState<LayoutDirection>("TB");
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Kept here rather than in the canvas: switching the start point can
  // empty the graph, unmounting the canvas and with it any state it owns.
  const [positions, setPositions] = useState<NodePositionOverrides>({});

  const handleNodeMoved = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      setPositions((current) => ({ ...current, [nodeId]: position }));
    },
    [],
  );
  const handleResetLayout = useCallback(() => setPositions({}), []);

  // Dragged positions are absolute coordinates from the old layout, so
  // they would strand nodes far from the re-ranked graph.
  const handleDirectionChange = useCallback((next: LayoutDirection) => {
    setDirection(next);
    setPositions({});
  }, []);

  const sortedIssues = useMemo(
    () => [...issues].sort((a, b) => b.number - a.number),
    [issues],
  );

  /**
   * Narrows the issue picker by number or title. A purely numeric query
   * ("#12", "12") is matched against the issue number as a substring so
   * that typing a prefix narrows a long list; anything else is matched
   * against the title, case-insensitively.
   */
  const matchingIssues = useMemo(() => {
    const query = issueQuery.trim().toLowerCase();
    if (!query) return sortedIssues;
    const numberQuery = /^#?\d+$/.test(query) ? query.replace(/^#/, "") : null;
    const matches = sortedIssues.filter(
      (issue) =>
        issue.title.toLowerCase().includes(query) ||
        (numberQuery !== null && String(issue.number).includes(numberQuery)),
    );
    // A chosen issue stays listed even once the query stops matching it,
    // so the graph never has a start point the picker cannot show or undo.
    const shown = new Set(matches.map((i) => i.number));
    const selectedElsewhere = sortedIssues.filter(
      (i) => selectedIssues.includes(i.number) && !shown.has(i.number),
    );
    return [...selectedElsewhere, ...matches];
  }, [sortedIssues, issueQuery, selectedIssues]);

  const toggleIssue = useCallback((number: number) => {
    setSelectedIssues((current) =>
      current.includes(number)
        ? current.filter((n) => n !== number)
        : [...current, number],
    );
  }, []);

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues) {
      for (const label of issue.labels) set.add(label.name);
    }
    return [...set].sort();
  }, [issues]);

  // `null` means "no start point selected", which shows the whole graph.
  // An empty array means a filter is active but nothing is picked yet.
  const roots = useMemo<number[] | null>(() => {
    if (startMode === "issue") return selectedIssues;
    if (startMode === "label") {
      if (!selectedLabel) return [];
      return issues
        .filter((i) => i.labels.some((l) => l.name === selectedLabel))
        .map((i) => i.number);
    }
    return null;
  }, [startMode, selectedIssues, selectedLabel, issues]);

  const allNumbers = useMemo(() => issues.map((i) => i.number), [issues]);

  // Capped rather than merely counted: a repository with thousands of
  // issues would otherwise lay out and render every one of them.
  const { visibleNumbers, totalVisible } = useMemo(() => {
    const all = computeVisibleIssueNumbers(edges, roots, subIssues, allNumbers);
    return {
      visibleNumbers: capVisibleIssueNumbers(
        all,
        edges,
        subIssues,
        displayLimit,
      ),
      totalVisible: all.size,
    };
  }, [edges, roots, subIssues, allNumbers, displayLimit]);

  const { nodes, links } = useMemo(
    () =>
      buildDependencyGraph(
        issues,
        edges,
        visibleNumbers,
        repoFullName,
        subIssues,
      ),
    [issues, edges, visibleNumbers, repoFullName, subIssues],
  );

  const emptyMessage =
    roots !== null && roots.length === 0
      ? t.dependencies.selectStartPointHint
      : t.dependencies.noEdges;

  const addDependency = useCallback(
    async (blockerNumber: number, blockedNumber: number): Promise<boolean> => {
      setError(null);
      if (
        edges.some(
          (e) =>
            e.blocker_number === blockerNumber &&
            e.blocked_number === blockedNumber,
        )
      ) {
        setError(t.dependencies.alreadyLinked);
        return false;
      }
      setPending(true);
      try {
        const res = await fetch(
          `/api/github/dependencies?key=${encodeURIComponent(repoKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blocker_number: blockerNumber,
              blocked_number: blockedNumber,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.code === "forbidden"
              ? t.dependencies.writePermissionRequired
              : data.error || "Failed to add dependency",
          );
        }
        setEdges(data.edges ?? []);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add");
        return false;
      } finally {
        setPending(false);
      }
    },
    [repoKey, edges, t],
  );

  /** Dragging one node's handle onto another creates the dependency. */
  const handleConnect = useCallback(
    (blockerNumber: number, blockedNumber: number) => {
      if (blockerNumber === blockedNumber) {
        setError(t.dependencies.cannotLinkToItself);
        return;
      }
      void addDependency(blockerNumber, blockedNumber);
    },
    [addDependency, t],
  );

  const handleRemove = useCallback(
    async (blocker: number, blocked: number) => {
      setPending(true);
      try {
        const res = await fetch(
          `/api/github/dependencies?key=${encodeURIComponent(repoKey)}&blocker=${blocker}&blocked=${blocked}`,
          { method: "DELETE" },
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.code === "forbidden"
              ? t.dependencies.writePermissionRequired
              : data.error || "Failed to remove dependency",
          );
        }
        setEdges(data.edges ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove");
      } finally {
        setPending(false);
      }
    },
    [repoKey, t],
  );

  return (
    // Fills the page height so the canvas grows with the window: the
    // surrounding chrome is kept to one toolbar row and a slim header.
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="font-semibold">{t.dependencies.startPoint}</span>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="start-mode"
            checked={startMode === "all"}
            onChange={() => setStartMode("all")}
          />
          {t.dependencies.all}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="start-mode"
            checked={startMode === "issue"}
            onChange={() => setStartMode("issue")}
          />
          {t.dependencies.byIssue}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="start-mode"
            checked={startMode === "label"}
            onChange={() => setStartMode("label")}
          />
          {t.dependencies.byLabel}
        </label>

        {startMode === "issue" && (
          // Checkboxes rather than a multi-select: a selection made before
          // typing must survive the search hiding that row, which a
          // <select multiple> cannot do (it only reports rendered options).
          <div className="flex w-full max-w-md flex-col gap-1">
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={issueQuery}
                onChange={(e) => setIssueQuery(e.target.value)}
                placeholder={t.dependencies.filterIssues}
                className="min-w-0 flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              />
              {selectedIssues.length > 0 && (
                <>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {t.dependencies.selectedCount(selectedIssues.length)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedIssues([])}
                    className="shrink-0 text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {t.dependencies.clearSelection}
                  </button>
                </>
              )}
            </div>
            <div className="h-24 overflow-y-auto rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800">
              {matchingIssues.length === 0 ? (
                <p className="py-1 text-xs text-gray-500 dark:text-gray-400">
                  {t.dependencies.noMatchingIssues}
                </p>
              ) : (
                matchingIssues.map((issue) => (
                  <label
                    key={issue.number}
                    className="flex cursor-pointer items-center gap-2 py-0.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIssues.includes(issue.number)}
                      onChange={() => toggleIssue(issue.number)}
                    />
                    <span className="truncate">
                      #{issue.number} {issue.title}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        {startMode === "label" && (
          <select
            value={selectedLabel}
            onChange={(e) => setSelectedLabel(e.target.value)}
            className="max-w-xs px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          >
            <option value="">{t.dependencies.selectLabel}</option>
            {allLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        )}

        <label className="ml-auto flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">
            {t.dependencies.layout}
          </span>
          <select
            value={direction}
            onChange={(e) =>
              handleDirectionChange(e.target.value as LayoutDirection)
            }
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          >
            <option value="TB">{t.dependencies.layoutTopDown}</option>
            <option value="LR">{t.dependencies.layoutLeftRight}</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">
            {t.dependencies.displayLimit}
          </span>
          <select
            value={displayLimit}
            onChange={(e) => setDisplayLimit(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          >
            {DISPLAY_LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 0 ? t.dependencies.noLimit : option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="flex min-h-0 flex-1 flex-col border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <h2 className="text-base font-semibold">{t.dependencies.graph}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
            {t.dependencies.connectHint}
          </p>
        </div>
        {totalVisible > visibleNumbers.size && (
          <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
            {t.dependencies.limitedTo(visibleNumbers.size, totalVisible)}
          </p>
        )}
        <div className="min-h-0 flex-1">
          {nodes.length > 0 ? (
            <DependencyFlow
              nodes={nodes}
              links={links}
              pending={pending}
              positionOverrides={positions}
              direction={direction}
              onNodeMoved={handleNodeMoved}
              onResetLayout={handleResetLayout}
              onConnectDependency={handleConnect}
              onDeleteDependency={handleRemove}
            />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {emptyMessage}
            </p>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </section>
    </div>
  );
}
