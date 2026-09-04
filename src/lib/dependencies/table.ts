import type {
  Issue,
  IssueDependencyEdge,
  IssueProgressStatus,
  IssueSubIssueEdge,
} from "@/types";
import { getIssueProgressStatus } from "./graph";
import { priorityOrder, sizeOrder } from "./priority";

/** One issue's row: the same relationships the graph draws, listed. */
export interface DependencyRow {
  number: number;
  title: string;
  url: string;
  status: IssueProgressStatus;
  assignees: string[];
  labels: string[];
  priority: string | null;
  size: string | null;
  /** The sub-issue parent, when this issue has one and it is visible. */
  parent: { number: number; title: string } | null;
  /** Issues that must finish first, ascending. */
  blockedBy: number[];
  /** Issues waiting on this one, ascending. */
  blocking: number[];
}

export type DependencySortKey =
  | "number"
  | "title"
  | "status"
  | "priority"
  | "size"
  | "assignees"
  | "parent"
  | "blockedBy"
  | "blocking";

export type SortDirection = "asc" | "desc";

/** Ordered so that sorting by status runs from untouched to finished. */
const STATUS_ORDER: Record<IssueProgressStatus, number> = {
  notstarted: 0,
  started: 1,
  completed: 2,
};

/**
 * Turns the synced relationships into table rows, over exactly the issues
 * the graph would draw. A relationship whose other end is not visible is
 * left out, so the two views never disagree about what exists.
 */
export function buildDependencyRows(
  issues: Issue[],
  edges: IssueDependencyEdge[],
  visibleNumbers: Set<number>,
  repoFullName: string,
  subIssues: IssueSubIssueEdge[] = [],
): DependencyRow[] {
  const issueMap = new Map(issues.map((i) => [i.number, i]));

  const blockedBy = new Map<number, number[]>();
  const blocking = new Map<number, number[]>();
  for (const e of edges) {
    if (
      !visibleNumbers.has(e.blocker_number) ||
      !visibleNumbers.has(e.blocked_number)
    ) {
      continue;
    }
    const blockers = blockedBy.get(e.blocked_number);
    if (blockers) blockers.push(e.blocker_number);
    else blockedBy.set(e.blocked_number, [e.blocker_number]);

    const blocked = blocking.get(e.blocker_number);
    if (blocked) blocked.push(e.blocked_number);
    else blocking.set(e.blocker_number, [e.blocked_number]);
  }

  const parentOf = new Map<number, number>();
  for (const e of subIssues) {
    if (e.parent_number === e.child_number) continue;
    if (!visibleNumbers.has(e.parent_number)) continue;
    if (!visibleNumbers.has(e.child_number)) continue;
    parentOf.set(e.child_number, e.parent_number);
  }

  const ascending = (a: number, b: number) => a - b;

  return [...visibleNumbers].sort(ascending).map((number): DependencyRow => {
    const issue = issueMap.get(number);
    const parentNumber = parentOf.get(number);
    const parentIssue =
      parentNumber === undefined ? undefined : issueMap.get(parentNumber);
    return {
      number,
      title: issue?.title ?? "",
      url: `https://github.com/${repoFullName}/issues/${number}`,
      status: issue ? getIssueProgressStatus(issue) : "notstarted",
      assignees: issue?.assignees ?? [],
      labels: issue?.labels.map((l) => l.name) ?? [],
      priority: issue?.priority ?? null,
      size: issue?.size ?? null,
      parent:
        parentNumber === undefined
          ? null
          : { number: parentNumber, title: parentIssue?.title ?? "" },
      blockedBy: (blockedBy.get(number) ?? []).sort(ascending),
      blocking: (blocking.get(number) ?? []).sort(ascending),
    };
  });
}

/**
 * Sorts rows in place-safe fashion (a copy is returned).
 *
 * Ties always fall back to the issue number so that a re-sort on the same
 * key is stable and rows never shuffle unpredictably.
 */
export function sortDependencyRows(
  rows: DependencyRow[],
  key: DependencySortKey,
  direction: SortDirection,
): DependencyRow[] {
  const sign = direction === "asc" ? 1 : -1;
  const compare = (a: DependencyRow, b: DependencyRow): number => {
    switch (key) {
      case "title":
        return a.title.localeCompare(b.title);
      case "status":
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      // By urgency and by magnitude, not alphabetically: "P10" after
      // "P2", and 10 points after 2.
      case "priority":
        // Rank first, then the wording itself, so P0 comes above P1
        // rather than the two sitting interleaved inside "high".
        return (
          priorityOrder(a.priority) - priorityOrder(b.priority) ||
          (a.priority ?? "").localeCompare(b.priority ?? "")
        );
      case "size":
        return sizeOrder(a.size) - sizeOrder(b.size);
      case "assignees":
        return a.assignees.join(",").localeCompare(b.assignees.join(","));
      case "parent":
        // Rows with no parent sort together, after every parented row.
        return (
          (a.parent?.number ?? Number.MAX_SAFE_INTEGER) -
          (b.parent?.number ?? Number.MAX_SAFE_INTEGER)
        );
      case "blockedBy":
        return a.blockedBy.length - b.blockedBy.length;
      case "blocking":
        return a.blocking.length - b.blocking.length;
      default:
        return a.number - b.number;
    }
  };
  return [...rows].sort(
    (a, b) => sign * compare(a, b) || sign * (a.number - b.number),
  );
}
