"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DependencyTable } from "@/components/dependency-graph/DependencyTable";
import { useBoardProblem } from "@/components/dependency-graph/useBoardProblem";
import {
  type DependencyFilters,
  dependencyFiltersToQuery,
} from "@/lib/dependencies/filter-params";
import {
  buildDependencyGraph,
  capVisibleIssueNumbers,
  computeVisibleIssueNumbers,
  DEFAULT_DISPLAY_LIMIT,
  type NodePositionOverrides,
} from "@/lib/dependencies/graph";
import type { LayoutDirection } from "@/lib/dependencies/layout";
import { useI18n } from "@/lib/i18n";
import type {
  Issue,
  IssueDependencyEdge,
  IssueSubIssueEdge,
  ProjectFieldDefinition,
} from "@/types";

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
  projectFields: ProjectFieldDefinition[];
  projectFieldsSyncedAt: string | null;
  /** Read from the query string on the server; see filter-params.ts. */
  initialFilters: DependencyFilters;
}

type ViewMode = "graph" | "table";

/** 0 stands for "no limit". */
const DISPLAY_LIMIT_OPTIONS = [100, 250, DEFAULT_DISPLAY_LIMIT, 1000, 2000, 0];

export function DependencyGraph({
  repoKey,
  repoFullName,
  issues,
  initialEdges,
  subIssues,
  projectFields,
  projectFieldsSyncedAt,
  initialFilters,
}: Props) {
  const { t } = useI18n();
  const [edges, setEdges] = useState<IssueDependencyEdge[]>(initialEdges);
  const [selectedIssues, setSelectedIssues] = useState<number[]>(
    initialFilters.issueNumbers,
  );
  const [issueQuery, setIssueQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(DEFAULT_DISPLAY_LIMIT);
  const [direction, setDirection] = useState<LayoutDirection>("TB");
  const [view, setView] = useState<ViewMode>("graph");
  const [selectedLabel, setSelectedLabel] = useState<string>(
    initialFilters.label,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Kept here rather than in the canvas: switching the start point can
  // empty the graph, unmounting the canvas and with it any state it owns.
  const [positions, setPositions] = useState<NodePositionOverrides>({});

  // Edges are held locally so a write can update the graph without a round
  // trip to the server, which leaves them stale when the server re-renders
  // with fresh ones — after a collection run, say. Server truth wins.
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges]);

  // Written straight to the History API rather than through the router:
  // this page is force-dynamic, so router.replace would re-run the server
  // component — and re-query DuckDB — on every tick of a checkbox, for a
  // filter that is applied entirely in the browser. Next supports the
  // native call and keeps its own router state in step with it.
  //
  // replaceState, not pushState: picking issues one at a time would
  // otherwise bury whatever the person was looking at before under a
  // dozen history entries they have to click back through.
  useEffect(() => {
    const query = dependencyFiltersToQuery(
      new URLSearchParams(window.location.search),
      { label: selectedLabel, issueNumbers: selectedIssues },
    );
    const next = `${window.location.pathname}${query}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, "", next);
  }, [selectedLabel, selectedIssues]);

  const pickerRef = useRef<HTMLDivElement>(null);

  // Closed by a press outside it rather than by blur: clicking a checkbox
  // inside the list blurs the search input, which would shut the list on
  // the first pick.
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    // Capture phase: the graph canvas stops mousedown from bubbling, so a
    // press on it would otherwise never reach a listener on the document.
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

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

  // Both filters are always live and combine as a union: an issue picked
  // here, plus everything carrying the chosen label. `null` means neither
  // is set, which shows the whole graph — there is no mode to be in.
  const roots = useMemo<number[] | null>(() => {
    const chosen = new Set(selectedIssues);
    if (selectedLabel) {
      for (const issue of issues) {
        if (issue.labels.some((l) => l.name === selectedLabel)) {
          chosen.add(issue.number);
        }
      }
    }
    return chosen.size === 0 ? null : [...chosen];
  }, [selectedIssues, selectedLabel, issues]);

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

  const emptyMessage = t.dependencies.noEdges;

  // Shown in both views: the cards carry Priority and Size too, so a
  // board nobody can read from is just as invisible on the graph.
  const boardProblem = useBoardProblem(projectFields, projectFieldsSyncedAt);

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
          <span className="text-gray-500 dark:text-gray-400">
            {t.dependencies.filterByLabel}
          </span>
          <select
            value={selectedLabel}
            onChange={(e) => setSelectedLabel(e.target.value)}
            className="max-w-[14rem] px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          >
            <option value="">{t.dependencies.selectLabel}</option>
            {allLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {/* The list drops over the canvas rather than sitting above it:
            always-on it would cost the graph a hundred pixels of height. */}
        <div ref={pickerRef} className="relative flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">
            {t.dependencies.filterByIssue}
          </span>
          <input
            type="search"
            value={issueQuery}
            onChange={(e) => {
              setIssueQuery(e.target.value);
              setPickerOpen(true);
            }}
            onFocus={() => setPickerOpen(true)}
            placeholder={t.dependencies.filterIssues}
            className="w-56 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
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
          {pickerOpen && (
            // Checkboxes rather than a multi-select: a selection made
            // before typing must survive the search hiding that row,
            // which a <select multiple> cannot do (it only reports the
            // options it has rendered).
            <div className="absolute top-full left-0 z-20 mt-1 max-h-64 w-96 overflow-y-auto rounded border border-gray-300 bg-white px-2 py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
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
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">
            {t.dependencies.view}
          </span>
          <div className="flex overflow-hidden rounded border border-gray-300 dark:border-gray-600">
            {(
              [
                ["graph", t.dependencies.viewGraph],
                ["table", t.dependencies.viewTable],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                className={`px-3 py-1 text-sm ${
                  view === mode
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Rank direction means nothing to a table. */}
        {view === "graph" && (
          <label className="flex items-center gap-2">
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
        )}

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
          <h2 className="text-base font-semibold">
            {view === "graph" ? t.dependencies.graph : t.dependencies.viewTable}
          </h2>
          {view === "graph" && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
              {t.dependencies.connectHint}
            </p>
          )}
        </div>
        {boardProblem && (
          <p className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300">
            {boardProblem}
          </p>
        )}
        {totalVisible > visibleNumbers.size && (
          <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
            {t.dependencies.limitedTo(visibleNumbers.size, totalVisible)}
          </p>
        )}
        <div className="min-h-0 flex-1">
          {view === "table" ? (
            <DependencyTable
              repoKey={repoKey}
              projectFields={projectFields}
              projectFieldsSyncedAt={projectFieldsSyncedAt}
              issues={issues}
              edges={edges}
              subIssues={subIssues}
              visibleNumbers={visibleNumbers}
              repoFullName={repoFullName}
            />
          ) : nodes.length > 0 ? (
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
