import dagre from "@dagrejs/dagre";
import type { DependencyGraphLink, DependencyGraphNode } from "./graph";

export const ISSUE_NODE_WIDTH = 240;
export const ISSUE_NODE_HEIGHT = 76;
export const TERMINAL_NODE_WIDTH = 104;
export const TERMINAL_NODE_HEIGHT = 40;
/** Room for the group's header label above its children. */
export const GROUP_HEADER_HEIGHT = 34;
/** Breathing room between a group's border and the nodes inside it. */
export const GROUP_PADDING = 20;

/** Which way dagre ranks the graph: top-to-bottom or left-to-right. */
export type LayoutDirection = "TB" | "LR";

export const LAYOUT_DIRECTIONS: readonly LayoutDirection[] = ["TB", "LR"];

/**
 * Spacing is per direction because the cards are far wider than they are
 * tall: what reads as roomy stacked vertically reads as sparse when the
 * same gap separates two 240px-wide cards side by side.
 */
const SPACING: Record<LayoutDirection, { nodesep: number; ranksep: number }> = {
  TB: { nodesep: 40, ranksep: 64 },
  LR: { nodesep: 24, ranksep: 90 },
};

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function nodeSize(node: DependencyGraphNode): {
  width: number;
  height: number;
} {
  if (node.kind === "issue") {
    return { width: ISSUE_NODE_WIDTH, height: ISSUE_NODE_HEIGHT };
  }
  if (node.kind === "terminal") {
    return { width: TERMINAL_NODE_WIDTH, height: TERMINAL_NODE_HEIGHT };
  }
  // Groups are sized by dagre from the children they contain.
  return { width: ISSUE_NODE_WIDTH, height: ISSUE_NODE_HEIGHT };
}

/**
 * Lays the graph out with dagre in the given direction, using a compound
 * graph so that issues nested under a parent are placed inside its box.
 *
 * Returns absolute rectangles (top-left anchored). Renderers that expect
 * child coordinates relative to their parent must subtract the parent's
 * origin themselves.
 */
export function layoutDependencyGraph(
  nodes: DependencyGraphNode[],
  links: DependencyGraphLink[],
  direction: LayoutDirection = "TB",
): Map<string, NodeRect> {
  const childrenOf = new Map<string, DependencyGraphNode[]>();
  for (const node of nodes) {
    if (node.kind === "terminal" || !node.parentId) continue;
    const siblings = childrenOf.get(node.parentId);
    if (siblings) siblings.push(node);
    else childrenOf.set(node.parentId, [node]);
  }

  /**
   * dagre does not support an edge attached to a node that has children:
   * clusters are swapped for border nodes before ranking, and ranking
   * then reads the label of a node the swap removed. So an endpoint that
   * is a group is moved to a leaf inside it — a cluster-spanning edge,
   * which compound graphs do support. Nested groups are followed down to
   * the leaf; a hierarchy that loops back on itself stops where it
   * repeats. Ranking the leaf places the box too, since a group's
   * rectangle is derived from its children's bounding box below.
   */
  const anchorFor = (id: string): string => {
    let current = id;
    const seen = new Set<string>([id]);
    for (;;) {
      const child = childrenOf.get(current)?.[0];
      if (!child || seen.has(child.id)) return current;
      seen.add(child.id);
      current = child.id;
    }
  };

  const graph = new dagre.graphlib.Graph({ compound: true });
  graph.setDefaultEdgeLabel(() => ({}));
  // An edge can name a node that was never added; without a default it
  // would be created label-less and break ranking the same way.
  graph.setDefaultNodeLabel(() => ({
    width: ISSUE_NODE_WIDTH,
    height: ISSUE_NODE_HEIGHT,
  }));
  graph.setGraph({
    rankdir: direction,
    ...SPACING[direction],
    marginx: 8,
    marginy: 8,
  });

  for (const node of nodes) {
    graph.setNode(node.id, nodeSize(node));
  }
  // Parents must exist as nodes before children are attached to them.
  for (const node of nodes) {
    if (node.kind !== "terminal" && node.parentId) {
      graph.setParent(node.id, node.parentId);
    }
  }
  for (const link of links) {
    const source = anchorFor(link.source);
    const target = anchorFor(link.target);
    // A link between a group and its own contents collapses onto one
    // node, so it says nothing about rank; passing it would only make
    // dagre reserve room for a self-loop that is never drawn.
    if (source === target) continue;
    graph.setEdge(source, target);
  }

  dagre.layout(graph);

  const rects = new Map<string, NodeRect>();
  for (const node of nodes) {
    const laidOut = graph.node(node.id);
    // dagre reports centers; React Flow positions from the top-left.
    const width = laidOut?.width ?? nodeSize(node).width;
    const height = laidOut?.height ?? nodeSize(node).height;
    rects.set(node.id, {
      x: (laidOut?.x ?? 0) - width / 2,
      y: (laidOut?.y ?? 0) - height / 2,
      width,
      height,
    });
  }

  // dagre's own cluster rectangle can come out narrower than the nodes
  // inside it, so each group is resized to the bounding box of its
  // children plus padding and room for the header label. Innermost
  // groups are sized first so nested groups grow around finished boxes.
  const parentIdOf = new Map<string, string>();
  for (const node of nodes) {
    if (node.kind !== "terminal" && node.parentId) {
      parentIdOf.set(node.id, node.parentId);
    }
  }

  const groupDepth = (node: DependencyGraphNode): number => {
    let depth = 0;
    let parentId = parentIdOf.get(node.id);
    const seen = new Set<string>([node.id]);
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      depth++;
      parentId = parentIdOf.get(parentId);
    }
    return depth;
  };

  const groups = nodes
    .filter((n) => n.kind === "group")
    .sort((a, b) => groupDepth(b) - groupDepth(a));

  for (const group of groups) {
    const children = childrenOf.get(group.id) ?? [];
    if (children.length === 0) continue;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const child of children) {
      const rect = rects.get(child.id);
      if (!rect) continue;
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }
    if (!Number.isFinite(minX)) continue;

    rects.set(group.id, {
      x: minX - GROUP_PADDING,
      y: minY - GROUP_PADDING - GROUP_HEADER_HEIGHT,
      width: maxX - minX + GROUP_PADDING * 2,
      height: maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER_HEIGHT,
    });
  }

  return rects;
}
