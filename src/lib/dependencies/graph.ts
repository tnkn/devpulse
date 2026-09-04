import type {
  Issue,
  IssueDependencyEdge,
  IssueProgressStatus,
  IssueSubIssueEdge,
} from "@/types";

/**
 * GitHub has no native "in progress" issue state, so we approximate it:
 * an open issue with an assignee or a WIP-style label counts as started.
 */
export function getIssueProgressStatus(issue: Issue): IssueProgressStatus {
  if (issue.state === "closed") return "completed";
  const hasProgressLabel = issue.labels.some((l) =>
    /in.?progress|\bwip\b|doing/i.test(l.name),
  );
  const hasAssignee = (issue.assignees?.length ?? 0) > 0;
  return hasProgressLabel || hasAssignee ? "started" : "notstarted";
}

/**
 * Resolves which issue numbers should be visible in the graph.
 *
 * `roots === null` means no start point is active, which shows every
 * issue in `allNumbers` — including ones with no dependency and no
 * parent, since "All" should not quietly mean "all the connected ones".
 * An empty array means a start point filter is active but nothing has
 * been picked yet, which shows nothing rather than silently falling back
 * to the whole graph.
 */
export function computeVisibleIssueNumbers(
  edges: IssueDependencyEdge[],
  roots: number[] | null,
  subIssues: IssueSubIssueEdge[] = [],
  allNumbers: number[] = [],
): Set<number> {
  if (roots === null) {
    const all = new Set<number>(allNumbers);
    // Relations can name an issue the caller did not list (a stale row,
    // or one filtered out upstream); keep drawing it rather than leaving
    // an edge pointing at nothing.
    for (const e of edges) {
      all.add(e.blocker_number);
      all.add(e.blocked_number);
    }
    for (const e of subIssues) {
      all.add(e.parent_number);
      all.add(e.child_number);
    }
    return all;
  }
  if (roots.length === 0) return new Set();

  const adjacency = new Map<number, number[]>();
  const addEdge = (from: number, to: number) => {
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  };
  for (const e of edges) {
    addEdge(e.blocker_number, e.blocked_number);
    addEdge(e.blocked_number, e.blocker_number);
  }
  // Children of a chosen parent belong to its subgraph too.
  for (const e of subIssues) {
    addEdge(e.parent_number, e.child_number);
    addEdge(e.child_number, e.parent_number);
  }

  const visited = new Set<number>(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

/** Default ceiling on how many issues the canvas will draw at once. */
export const DEFAULT_DISPLAY_LIMIT = 500;

/**
 * Trims the visible set down to `limit` issues.
 *
 * What goes first is what carries the least information: issues in no
 * relation at all, then the lowest-numbered (oldest) of the remainder.
 * `buildDependencyGraph` only draws a relation when both of its ends are
 * visible, so trimming never leaves a dangling arrow or a sub-issue
 * pointing at a container that is not on the canvas.
 *
 * A `limit` of 0 or less means no ceiling.
 */
export function capVisibleIssueNumbers(
  visible: Set<number>,
  edges: IssueDependencyEdge[],
  subIssues: IssueSubIssueEdge[],
  limit: number,
): Set<number> {
  if (limit <= 0 || visible.size <= limit) return visible;

  const inRelation = new Set<number>();
  for (const e of edges) {
    inRelation.add(e.blocker_number);
    inRelation.add(e.blocked_number);
  }
  for (const e of subIssues) {
    inRelation.add(e.parent_number);
    inRelation.add(e.child_number);
  }

  const ordered = [...visible].sort((a, b) => {
    const rank = Number(inRelation.has(b)) - Number(inRelation.has(a));
    return rank !== 0 ? rank : b - a;
  });
  return new Set(ordered.slice(0, limit));
}

export interface IssueGraphNode {
  id: string;
  kind: "issue";
  number: number;
  title: string;
  status: IssueProgressStatus;
  url: string;
  assignees: string[];
  labels: string[];
  /** Priority and Size as written on the issue's Projects v2 board. */
  priority: string | null;
  size: string | null;
  /** Id of the group node this issue is nested in, if it has a parent. */
  parentId?: string;
}

/**
 * An issue that has sub-issues. It is drawn as a container holding its
 * children rather than as a node with arrows to them: containment and
 * "must finish first" are different relationships and should not look
 * alike.
 */
export interface GroupGraphNode {
  id: string;
  kind: "group";
  number: number;
  title: string;
  status: IssueProgressStatus;
  url: string;
  priority: string | null;
  size: string | null;
  parentId?: string;
}

export interface TerminalGraphNode {
  id: "start" | "finish";
  kind: "terminal";
}

export type DependencyGraphNode =
  | IssueGraphNode
  | GroupGraphNode
  | TerminalGraphNode;

export type DependencyLinkKind = "dependency" | "terminal";

export interface DependencyGraphLink {
  id: string;
  source: string;
  target: string;
  kind: DependencyLinkKind;
  /**
   * True while the blocker is still open, so the dependency is actually
   * holding the other issue up. A dependency on a closed issue is
   * history, and is drawn at rest.
   */
  blocking: boolean;
}

/** How a node relates to the one the reader is pointing at. */
export type ChainRole = "focus" | "upstream" | "downstream";

export interface ChainTrace {
  /** Node id to its role, for every node on the focused chain. */
  roles: Map<string, ChainRole>;
  /** Node id to how many hops it sits from the focus, for staggering. */
  depths: Map<string, number>;
  /** Ids of the links that make up the chain. */
  linkIds: Set<string>;
}

/**
 * Walks both ways from `nodeId`: upstream is what has to finish before
 * it, downstream is what it is holding up. Returns per-node hop counts
 * so a renderer can stagger the reveal outwards from the focus.
 */
export function traceDependencyChain(
  links: DependencyGraphLink[],
  nodeId: string,
): ChainTrace {
  const roles = new Map<string, ChainRole>([[nodeId, "focus"]]);
  const depths = new Map<string, number>([[nodeId, 0]]);
  const linkIds = new Set<string>();

  const outgoing = new Map<string, DependencyGraphLink[]>();
  const incoming = new Map<string, DependencyGraphLink[]>();
  for (const link of links) {
    if (link.kind !== "dependency") continue;
    const out = outgoing.get(link.source);
    if (out) out.push(link);
    else outgoing.set(link.source, [link]);
    const into = incoming.get(link.target);
    if (into) into.push(link);
    else incoming.set(link.target, [link]);
  }

  const walk = (
    role: ChainRole,
    adjacency: Map<string, DependencyGraphLink[]>,
  ) => {
    let frontier = [nodeId];
    let depth = 0;
    const seen = new Set<string>([nodeId]);
    while (frontier.length > 0) {
      depth++;
      const next: string[] = [];
      for (const current of frontier) {
        for (const link of adjacency.get(current) ?? []) {
          linkIds.add(link.id);
          const other = role === "downstream" ? link.target : link.source;
          if (seen.has(other)) continue;
          seen.add(other);
          // The focus keeps its own role even if a cycle leads back to it.
          if (!roles.has(other)) roles.set(other, role);
          if (!depths.has(other)) depths.set(other, depth);
          next.push(other);
        }
      }
      frontier = next;
    }
  };

  walk("downstream", outgoing);
  walk("upstream", incoming);

  return { roles, depths, linkIds };
}

/** Positions the user dragged nodes to, keyed by graph node id. */
export type NodePositionOverrides = Record<string, { x: number; y: number }>;

export function issueNodeId(number: number): string {
  return `issue-${number}`;
}

export function groupNodeId(number: number): string {
  return `group-${number}`;
}

/**
 * Recovers the issue number a node id refers to. Returns null for the
 * synthetic start/finish nodes, which stand for no issue at all.
 */
export function issueNumberFromNodeId(nodeId: string): number | null {
  const match = /^(?:issue|group)-(\d+)$/.exec(nodeId);
  return match ? Number(match[1]) : null;
}

/**
 * Turns the synced relationships into a renderer-agnostic graph.
 *
 * Dependencies become arrows (A must finish before B). Sub-issues become
 * nesting: an issue with children is emitted as a group node containing
 * them, so containment never looks like an ordering arrow.
 */
export function buildDependencyGraph(
  issues: Issue[],
  edges: IssueDependencyEdge[],
  visibleNumbers: Set<number>,
  repoFullName: string,
  subIssues: IssueSubIssueEdge[] = [],
): { nodes: DependencyGraphNode[]; links: DependencyGraphLink[] } {
  const issueMap = new Map(issues.map((i) => [i.number, i]));
  const numbers = [...visibleNumbers].sort((a, b) => a - b);

  if (numbers.length === 0) return { nodes: [], links: [] };

  const visibleEdges = edges.filter(
    (e) =>
      visibleNumbers.has(e.blocker_number) &&
      visibleNumbers.has(e.blocked_number),
  );
  const visibleSubIssues = subIssues.filter(
    (e) =>
      visibleNumbers.has(e.parent_number) && visibleNumbers.has(e.child_number),
  );

  // GitHub gives a sub-issue exactly one parent, so this is a forest.
  const parentOf = new Map<number, number>();
  const isParent = new Set<number>();
  for (const e of visibleSubIssues) {
    if (e.parent_number === e.child_number) continue;
    parentOf.set(e.child_number, e.parent_number);
    isParent.add(e.parent_number);
  }

  const nodeIdFor = (n: number) =>
    isParent.has(n) ? groupNodeId(n) : issueNodeId(n);
  /** Guards against a malformed cycle in the reported hierarchy. */
  const parentIdFor = (n: number): string | undefined => {
    const seen = new Set<number>([n]);
    const parent = parentOf.get(n);
    if (parent === undefined || seen.has(parent)) return undefined;
    return groupNodeId(parent);
  };

  const describe = (number: number) => {
    const issue = issueMap.get(number);
    return {
      number,
      title: issue?.title ?? "",
      status: issue ? getIssueProgressStatus(issue) : "notstarted",
      url: `https://github.com/${repoFullName}/issues/${number}`,
      assignees: issue?.assignees ?? [],
      labels: issue?.labels.map((l) => l.name) ?? [],
      priority: issue?.priority ?? null,
      size: issue?.size ?? null,
    };
  };

  // Groups first, outermost first: renderers generally require a parent
  // to be declared before the nodes nested inside it.
  const depth = (n: number): number => {
    let d = 0;
    let current = parentOf.get(n);
    const seen = new Set<number>([n]);
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      d++;
      current = parentOf.get(current);
    }
    return d;
  };

  const groupNumbers = numbers
    .filter((n) => isParent.has(n))
    .sort((a, b) => depth(a) - depth(b) || a - b);
  const leafNumbers = numbers.filter((n) => !isParent.has(n));

  const nodes: DependencyGraphNode[] = [];
  for (const number of groupNumbers) {
    const { title, status, url, priority, size } = describe(number);
    nodes.push({
      id: groupNodeId(number),
      kind: "group",
      number,
      title,
      status,
      url,
      priority,
      size,
      ...(parentIdFor(number) ? { parentId: parentIdFor(number) } : {}),
    });
  }
  nodes.push({ id: "start", kind: "terminal" });
  for (const number of leafNumbers) {
    nodes.push({
      id: issueNodeId(number),
      kind: "issue",
      ...describe(number),
      ...(parentIdFor(number) ? { parentId: parentIdFor(number) } : {}),
    });
  }
  nodes.push({ id: "finish", kind: "terminal" });

  const hasIncoming = new Set(visibleEdges.map((e) => e.blocked_number));
  const hasOutgoing = new Set(visibleEdges.map((e) => e.blocker_number));
  // Start/finish bracket the dependency ordering only, so an issue that
  // only takes part in the hierarchy is left out of the bracket.
  const inDependencyOrder = (n: number) =>
    hasIncoming.has(n) || hasOutgoing.has(n);

  const links: DependencyGraphLink[] = [];
  for (const number of numbers) {
    if (inDependencyOrder(number) && !hasIncoming.has(number)) {
      links.push({
        id: `start-${number}`,
        source: "start",
        target: nodeIdFor(number),
        kind: "terminal",
        blocking: false,
      });
    }
  }
  for (const e of visibleEdges) {
    const blocker = issueMap.get(e.blocker_number);
    links.push({
      id: `dep-${e.blocker_number}-${e.blocked_number}`,
      source: nodeIdFor(e.blocker_number),
      target: nodeIdFor(e.blocked_number),
      kind: "dependency",
      // Unknown issues are treated as unfinished: an edge that might be
      // holding work up should say so rather than look resolved.
      blocking: !blocker || getIssueProgressStatus(blocker) !== "completed",
    });
  }
  for (const number of numbers) {
    if (inDependencyOrder(number) && !hasOutgoing.has(number)) {
      links.push({
        id: `${number}-finish`,
        source: nodeIdFor(number),
        target: "finish",
        kind: "terminal",
        blocking: false,
      });
    }
  }

  return { nodes, links };
}
