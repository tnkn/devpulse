"use client";

import {
  Background,
  BackgroundVariant,
  BaseEdge,
  type Connection,
  Controls,
  type Edge,
  type EdgeProps,
  getSmoothStepPath,
  Handle,
  type IsValidConnection,
  MarkerType,
  MiniMap,
  type Node,
  type NodeProps,
  type OnNodeDrag,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ChainRole,
  type ChainTrace,
  type DependencyGraphLink,
  type DependencyGraphNode,
  type DependencyLinkKind,
  issueNumberFromNodeId,
  type NodePositionOverrides,
  traceDependencyChain,
} from "@/lib/dependencies/graph";
import {
  GROUP_HEADER_HEIGHT,
  ISSUE_NODE_HEIGHT,
  ISSUE_NODE_WIDTH,
  type LayoutDirection,
  layoutDependencyGraph,
  TERMINAL_NODE_HEIGHT,
  TERMINAL_NODE_WIDTH,
} from "@/lib/dependencies/layout";
import { useI18n } from "@/lib/i18n";
import type { IssueProgressStatus } from "@/types";

/**
 * How the node relates to whatever the reader is pointing at, and how
 * many hops away it is. `null` means nothing is focused; "muted" means
 * something is, but not this.
 */
type ChainHighlight = {
  role: ChainRole | "muted" | null;
  depth: number;
};

const NO_HIGHLIGHT: ChainHighlight = { role: null, depth: 0 };

type IssueNodeData = {
  number: number;
  title: string;
  status: IssueProgressStatus;
  url: string;
  assignees: string[];
  labels: string[];
  highlight: ChainHighlight;
};
type TerminalNodeData = { label: string; highlight: ChainHighlight };

type GroupNodeData = {
  number: number;
  title: string;
  status: IssueProgressStatus;
  url: string;
  highlight: ChainHighlight;
};

type IssueFlowNode = Node<IssueNodeData, "issue">;
type TerminalFlowNode = Node<TerminalNodeData, "terminal">;
type GroupFlowNode = Node<GroupNodeData, "group">;
type FlowNode = IssueFlowNode | TerminalFlowNode | GroupFlowNode;

const STATUS_NODE_CLASS: Record<IssueProgressStatus, string> = {
  notstarted:
    "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100",
  started:
    "bg-amber-100 dark:bg-amber-950 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100",
  completed:
    "bg-emerald-100 dark:bg-emerald-950 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100",
};

const STATUS_SWATCH_CLASS: Record<IssueProgressStatus, string> = {
  notstarted:
    "bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-500",
  started: "bg-amber-300 dark:bg-amber-700 border-amber-500",
  completed: "bg-emerald-300 dark:bg-emerald-700 border-emerald-500",
};

const STATUS_MINIMAP_COLOR: Record<IssueProgressStatus, string> = {
  notstarted: "#9ca3af",
  started: "#f59e0b",
  completed: "#10b981",
};

// Big enough to grab: these are the drag targets for creating a
// dependency, not just decoration.
const HANDLE_CLASS =
  "!h-3 !w-3 !border-2 !border-white dark:!border-gray-900 !bg-gray-400 dark:!bg-gray-500 hover:!bg-blue-500 hover:!h-4 hover:!w-4 transition-all";

/**
 * Upstream and downstream get different colours because they answer
 * different questions: what is holding this up, versus what this is
 * holding up.
 */
const CHAIN_RING_CLASS: Record<ChainRole, string> = {
  focus: "!border-blue-500 ring-2 ring-blue-500/60",
  upstream: "!border-rose-500 ring-2 ring-rose-400/50",
  downstream: "!border-sky-500 ring-2 ring-sky-400/50",
};

const CHAIN_EDGE_COLOR: Record<ChainRole, string> = {
  focus: "#3b82f6",
  upstream: "#f43f5e",
  downstream: "#0ea5e9",
};

/** Per-hop delay, so the chain lights up outwards from the focus. */
const CHAIN_STAGGER_MS = 45;

/**
 * The reveal is a transition, so it is styled rather than scripted:
 * nodes off the chain fade back, nodes on it come forward after a delay
 * proportional to their distance.
 */
function highlightStyle({ role, depth }: ChainHighlight): React.CSSProperties {
  if (role === null)
    return { transition: "opacity 150ms ease, filter 150ms ease" };
  const delay = role === "muted" ? 0 : depth * CHAIN_STAGGER_MS;
  return {
    opacity: role === "muted" ? 0.2 : 1,
    transition: "opacity 200ms ease, filter 200ms ease",
    transitionDelay: `${delay}ms`,
  };
}

const EDGE_COLOR: Record<DependencyLinkKind, string> = {
  dependency: "#6b7280",
  terminal: "#9ca3af",
};

/**
 * Whether this reader wants motion at all. Everything decorative — the
 * marching dependencies, the particles, the layout tween — is switched
 * off when they have asked the system to reduce motion.
 */
function usePrefersMotion(): boolean {
  const [motion, setMotion] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return motion;
}

/**
 * The whole card is a link, so a drag would otherwise navigate on
 * mouseup. Only a press that stayed put counts as a click.
 */
function useClickWithoutDrag() {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    origin.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onClick = useCallback((e: React.MouseEvent) => {
    const from = origin.current;
    origin.current = null;
    if (!from) return;
    const moved = Math.hypot(e.clientX - from.x, e.clientY - from.y);
    if (moved > 4) e.preventDefault();
  }, []);
  return { onMouseDown, onClick };
}

function IssueNode({
  data,
  sourcePosition,
  targetPosition,
}: NodeProps<IssueFlowNode>) {
  const assignees = data.assignees.join(", ");
  const clickGuard = useClickWithoutDrag();
  const { role } = data.highlight;
  const ring = role && role !== "muted" ? CHAIN_RING_CLASS[role] : "";
  return (
    <div style={highlightStyle(data.highlight)}>
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        className={HANDLE_CLASS}
      />
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`#${data.number} ${data.title}${assignees ? ` (${assignees})` : ""}`}
        style={{ width: ISSUE_NODE_WIDTH, height: ISSUE_NODE_HEIGHT }}
        {...clickGuard}
        className={`flex cursor-grab flex-col justify-center gap-1 rounded-lg border px-3 py-2 text-left no-underline shadow-sm transition-shadow hover:shadow-md focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 active:cursor-grabbing ${STATUS_NODE_CLASS[data.status]} ${ring}`}
      >
        <span className="text-[11px] font-semibold opacity-70">
          #{data.number}
        </span>
        <span className="line-clamp-2 text-xs leading-snug font-medium">
          {data.title}
        </span>
      </a>
      <Handle
        type="source"
        position={sourcePosition ?? Position.Bottom}
        className={HANDLE_CLASS}
      />
    </div>
  );
}

function TerminalNode({
  data,
  sourcePosition,
  targetPosition,
}: NodeProps<TerminalFlowNode>) {
  return (
    <div style={highlightStyle(data.highlight)}>
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        className={HANDLE_CLASS}
      />
      <div
        style={{ width: TERMINAL_NODE_WIDTH, height: TERMINAL_NODE_HEIGHT }}
        className="flex items-center justify-center rounded-full border border-dashed border-gray-400 bg-white text-xs font-semibold text-gray-500 dark:border-gray-500 dark:bg-gray-900 dark:text-gray-400"
      >
        {data.label}
      </div>
      <Handle
        type="source"
        position={sourcePosition ?? Position.Bottom}
        className={HANDLE_CLASS}
      />
    </div>
  );
}

const STATUS_ACCENT_CLASS: Record<IssueProgressStatus, string> = {
  notstarted: "border-gray-400 dark:border-gray-500",
  started: "border-amber-400 dark:border-amber-600",
  completed: "border-emerald-400 dark:border-emerald-600",
};

/**
 * A parent issue, drawn as a container around its sub-issues. Its header
 * is the link to the issue itself; the body is empty space that React
 * Flow fills with the nested child nodes.
 */
function GroupNode({
  data,
  sourcePosition,
  targetPosition,
}: NodeProps<GroupFlowNode>) {
  const clickGuard = useClickWithoutDrag();
  // The container covers a large area on top of the edges layer, so it
  // lets clicks through; only its header and handles stay interactive.
  return (
    <div className="h-full w-full" style={highlightStyle(data.highlight)}>
      <Handle
        type="target"
        position={targetPosition ?? Position.Top}
        className={`${HANDLE_CLASS} !pointer-events-auto`}
      />
      <div
        className={`pointer-events-none h-full w-full rounded-xl border-2 border-dashed bg-gray-500/5 dark:bg-gray-400/5 ${STATUS_ACCENT_CLASS[data.status]}`}
      >
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`#${data.number} ${data.title}`}
          style={{ height: GROUP_HEADER_HEIGHT }}
          {...clickGuard}
          className="pointer-events-auto inline-flex max-w-full cursor-grab items-center gap-2 px-3 text-xs font-semibold text-gray-700 no-underline hover:underline active:cursor-grabbing dark:text-gray-200"
        >
          <span className="opacity-60">#{data.number}</span>
          <span className="truncate">{data.title}</span>
        </a>
      </div>
      <Handle
        type="source"
        position={sourcePosition ?? Position.Bottom}
        className={`${HANDLE_CLASS} !pointer-events-auto`}
      />
    </div>
  );
}

const TOOL_BUTTON_CLASS =
  "rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm backdrop-blur hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-200 dark:hover:bg-gray-800";

type DependencyEdgeData = {
  /** Role of the chain this edge belongs to, or null when none is focused. */
  role: ChainRole | "muted" | null;
  /** Hops from the focus, for staggering the reveal. */
  depth: number;
  /** Whether a particle should run along the path. */
  particle: boolean;
  color: string;
  width: number;
  dashed: boolean;
};

type DependencyFlowEdge = Edge<DependencyEdgeData, "dependency">;

/**
 * The graph's only edge type. Beyond drawing the smooth step path it
 * carries the chain highlight and, when asked, a dot that runs along the
 * path so the direction of the dependency is unmistakable.
 */
function DependencyEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps<DependencyFlowEdge>) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const role = data?.role ?? null;
  const highlighted = role !== null && role !== "muted";
  const color = highlighted
    ? CHAIN_EDGE_COLOR[role]
    : (data?.color ?? EDGE_COLOR.dependency);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: highlighted ? 2.5 : (data?.width ?? 1.5),
          ...(data?.dashed ? { strokeDasharray: "4 4" } : {}),
          ...highlightStyle({ role, depth: data?.depth ?? 0 }),
        }}
      />
      {/* animateMotion rather than a JS loop: the browser runs it off the
          main thread, and it stops with the element when the edge goes. */}
      {data?.particle && (
        <circle r={4} fill={color}>
          <animateMotion dur="1.6s" repeatCount="indefinite" begin="0s">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      )}
    </>
  );
}

const EDGE_TYPES = { dependency: DependencyEdge };

/** Above this many edges on one chain, particles are noise. */
const MAX_PARTICLE_EDGES = 60;

/**
 * Spreading a discriminated union loses the discriminant, so each node
 * kind is rebuilt on its own branch rather than cast back into shape.
 */
function withHighlight(node: FlowNode, highlight: ChainHighlight): FlowNode {
  if (node.type === "issue") {
    return { ...node, data: { ...node.data, highlight } };
  }
  if (node.type === "group") {
    return { ...node, data: { ...node.data, highlight } };
  }
  return { ...node, data: { ...node.data, highlight } };
}

/**
 * Which half of the chain an edge belongs to. Every edge reachable
 * upstream leaves a node that is itself upstream; everything else runs
 * away from the focus.
 */
function edgeChainRole(
  trace: ChainTrace,
  edge: { source: string; target: string },
): ChainRole {
  return trace.roles.get(edge.source) === "upstream"
    ? "upstream"
    : "downstream";
}

const NODE_TYPES = {
  issue: IssueNode,
  terminal: TerminalNode,
  group: GroupNode,
};

/** Where every node sits, as a string, so a moved layout is one compare. */
function layoutSignature(
  nodes: { id: string; position: XYPosition }[],
): string {
  return nodes
    .map(
      (n) => `${n.id}@${Math.round(n.position.x)},${Math.round(n.position.y)}`,
    )
    .join("|");
}

/**
 * Re-frames the viewport whenever `refitKey` changes: a different visible
 * subgraph, a new layout direction, or the canvas being expanded to fill
 * the window.
 *
 * `layoutKey` is what the layout should be. React Flow applies pushed
 * nodes a render later and measures group boxes a frame after that, so
 * fitting immediately frames the layout being replaced — the fit is held
 * until the store agrees with `layoutKey`.
 */
function FitViewOnChange({
  layoutKey,
  refitKey,
}: {
  layoutKey: string;
  refitKey: string;
}) {
  const { fitView, getNodes } = useReactFlow();
  useEffect(() => {
    if (layoutKey.length === 0 || refitKey.length === 0) return;
    let frame = 0;
    let attempts = 0;
    const tick = () => {
      // Bounded so a layout the store never reproduces still gets framed
      // rather than leaving the viewport wherever it happened to be.
      if (layoutSignature(getNodes()) === layoutKey || attempts++ > 30) {
        fitView({ padding: 0.15, duration: 200 });
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [layoutKey, refitKey, fitView, getNodes]);
  return null;
}

interface Props {
  nodes: DependencyGraphNode[];
  links: DependencyGraphLink[];
  pending?: boolean;
  /**
   * Where the user has dragged nodes to. Owned by the caller so that an
   * arrangement outlives this canvas being unmounted, which happens
   * whenever the start-point filter empties the graph.
   */
  positionOverrides: NodePositionOverrides;
  /** Which way dagre ranks the graph. */
  direction: LayoutDirection;
  onNodeMoved: (nodeId: string, position: { x: number; y: number }) => void;
  onResetLayout: () => void;
  /** Dragging from one issue's handle to another's creates a dependency. */
  onConnectDependency?: (blockerNumber: number, blockedNumber: number) => void;
  onDeleteDependency?: (blockerNumber: number, blockedNumber: number) => void;
}

/** The expand state lives on the wrapper, which is the element that grows. */
interface InnerProps extends Props {
  expanded: boolean;
  onToggleExpand: () => void;
}

function DependencyFlowInner({
  nodes,
  links,
  pending,
  positionOverrides: overrides,
  direction,
  onNodeMoved: moveNode,
  onResetLayout: reset,
  onConnectDependency,
  onDeleteDependency,
  expanded,
  onToggleExpand,
}: InnerProps) {
  const { t } = useI18n();
  const connectable = Boolean(onConnectDependency) && !pending;
  const motion = usePrefersMotion();
  // What the reader is pointing at. Null means nothing is focused and
  // the graph is drawn plainly.
  const [focusId, setFocusId] = useState<string | null>(null);

  const flowNodes = useMemo<FlowNode[]>(() => {
    const rects = layoutDependencyGraph(nodes, links, direction);
    // Handles have to sit on the faces the edges actually leave from,
    // or an arrow crosses over its own card to reach the next one.
    const flowDirection =
      direction === "LR"
        ? { targetPosition: Position.Left, sourcePosition: Position.Right }
        : { targetPosition: Position.Top, sourcePosition: Position.Bottom };
    const origin = { x: 0, y: 0 };

    // React Flow positions a nested node relative to its parent, while
    // the layout reports absolute coordinates. A node the user dragged
    // keeps where they put it instead of being laid out again.
    const positionOf = (node: DependencyGraphNode) => {
      const dragged = overrides[node.id];
      if (dragged) return dragged;
      const rect = rects.get(node.id) ?? { ...origin, width: 0, height: 0 };
      const parentId = node.kind === "terminal" ? undefined : node.parentId;
      const parentRect = parentId ? rects.get(parentId) : undefined;
      return parentRect
        ? { x: rect.x - parentRect.x, y: rect.y - parentRect.y }
        : { x: rect.x, y: rect.y };
    };

    return nodes.map((node) => {
      const position = positionOf(node);
      if (node.kind === "terminal") {
        return {
          id: node.id,
          type: "terminal",
          position,
          ...flowDirection,
          // Declared explicitly: the flow is controlled without
          // onNodesChange, so measured sizes are never committed and the
          // minimap would otherwise have nothing to draw.
          width: TERMINAL_NODE_WIDTH,
          height: TERMINAL_NODE_HEIGHT,
          deletable: false,
          data: {
            label:
              node.id === "start"
                ? t.dependencies.start
                : t.dependencies.finish,
            highlight: NO_HIGHLIGHT,
          },
        } satisfies TerminalFlowNode;
      }

      // Deliberately not constrained to the parent box: dragging is for
      // untangling a busy graph, and a reload restores the layout anyway.
      const parent = node.parentId ? { parentId: node.parentId } : {};

      if (node.kind === "group") {
        const rect = rects.get(node.id);
        return {
          id: node.id,
          type: "group",
          position,
          ...flowDirection,
          ...parent,
          width: rect?.width ?? ISSUE_NODE_WIDTH,
          height: rect?.height ?? ISSUE_NODE_HEIGHT,
          deletable: false,
          // React Flow ships its own background and border for group
          // nodes, which would double up with the container we render.
          // pointerEvents none keeps the box from swallowing clicks meant
          // for the edges and nodes it sits over.
          style: {
            background: "transparent",
            border: "none",
            padding: 0,
            pointerEvents: "none" as const,
          },
          data: {
            number: node.number,
            title: node.title,
            status: node.status,
            url: node.url,
            highlight: NO_HIGHLIGHT,
          },
        } satisfies GroupFlowNode;
      }

      return {
        id: node.id,
        type: "issue",
        position,
        ...flowDirection,
        ...parent,
        width: ISSUE_NODE_WIDTH,
        height: ISSUE_NODE_HEIGHT,
        deletable: false,
        data: {
          number: node.number,
          title: node.title,
          status: node.status,
          url: node.url,
          assignees: node.assignees,
          labels: node.labels,
          highlight: NO_HIGHLIGHT,
        },
      } satisfies IssueFlowNode;
    });
  }, [nodes, links, t, overrides, direction]);

  const flowEdges = useMemo<DependencyFlowEdge[]>(
    () =>
      links.map((link) => {
        const color = EDGE_COLOR[link.kind];
        return {
          id: link.id,
          source: link.source,
          target: link.target,
          type: "dependency" as const,
          // A dependency whose blocker is still open is actively holding
          // work up, and says so by marching. Everything else is at rest.
          animated: link.blocking && motion,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color,
          },
          // Only real dependencies can be removed; start/finish are drawn
          // by us and mean nothing on GitHub.
          deletable: link.kind === "dependency",
          data: {
            role: null,
            depth: 0,
            particle: false,
            color,
            width: link.kind === "dependency" ? 1.5 : 1,
            dashed: link.kind === "terminal",
          },
        };
      }),
    [links, motion],
  );

  // React Flow needs to own selection state to let an edge be picked and
  // deleted, so the derived graph is pushed into its state rather than
  // passed straight through as props.
  const [renderedNodes, setRenderedNodes, onNodesChange] =
    useNodesState<FlowNode>([]);
  const [renderedEdges, setRenderedEdges, onEdgesChange] =
    useEdgesState<DependencyFlowEdge>([]);

  // D. Nodes slide to their new places instead of teleporting, so the
  // reader can follow where a card went when the layout is re-ranked.
  // The movement is a CSS transition on the node (see globals.css), not
  // an animated React state: this costs nothing per frame.
  useEffect(() => {
    // A re-layout drops whatever chain was focused; the cards it lit up
    // are no longer under the pointer.
    setFocusId(null);
    setRenderedNodes(flowNodes);
  }, [flowNodes, setRenderedNodes]);

  useEffect(() => {
    setRenderedEdges(flowEdges);
  }, [flowEdges, setRenderedEdges]);

  // B. What the focused node depends on and what depends on it.
  const trace = useMemo(
    () => (focusId ? traceDependencyChain(links, focusId) : null),
    [links, focusId],
  );

  // Applied as a patch rather than by rebuilding the arrays: only the
  // nodes whose highlight actually changed get a new object, so React
  // Flow can skip re-rendering the rest of a large graph.
  useEffect(() => {
    setRenderedNodes((current) =>
      current.map((node) => {
        const role = trace ? (trace.roles.get(node.id) ?? "muted") : null;
        const depth = trace ? (trace.depths.get(node.id) ?? 0) : 0;
        const previous = node.data.highlight;
        if (previous.role === role && previous.depth === depth) return node;
        return withHighlight(node, { role, depth });
      }),
    );

    // C. Particles are for following one chain, so they are limited to
    // the highlighted edges — and dropped entirely when the chain is
    // large enough that a swarm would obscure what it is pointing at.
    const withParticles =
      motion && trace !== null && trace.linkIds.size <= MAX_PARTICLE_EDGES;

    setRenderedEdges((current) =>
      current.map((edge) => {
        const onChain = trace?.linkIds.has(edge.id) ?? false;
        const role = trace
          ? onChain
            ? edgeChainRole(trace, edge)
            : "muted"
          : null;
        const depth = onChain
          ? Math.max(
              trace?.depths.get(edge.source) ?? 0,
              trace?.depths.get(edge.target) ?? 0,
            )
          : 0;
        const particle = onChain && withParticles;
        const previous = edge.data;
        if (
          previous &&
          previous.role === role &&
          previous.depth === depth &&
          previous.particle === particle
        ) {
          return edge;
        }
        return {
          ...edge,
          data: { ...(previous as DependencyEdgeData), role, depth, particle },
        };
      }),
    );
  }, [trace, motion, setRenderedNodes, setRenderedEdges]);

  // Positions rather than ids: this has to change when the same issues
  // are re-ranked into a new direction, not only when the set changes.
  const layoutKey = useMemo(() => layoutSignature(flowNodes), [flowNodes]);

  /** Start/finish carry no issue number and cannot take part in a link. */
  const issueNumberOf = useCallback((nodeId: string | null): number | null => {
    if (!nodeId) return null;
    const number = issueNumberFromNodeId(nodeId);
    return number === null ? null : number;
  }, []);

  const isValidConnection = useCallback<IsValidConnection>(
    ({ source, target }) => {
      const blocker = issueNumberOf(source);
      const blocked = issueNumberOf(target);
      return blocker !== null && blocked !== null && blocker !== blocked;
    },
    [issueNumberOf],
  );

  const handleConnect = useCallback(
    ({ source, target }: Connection) => {
      const blocker = issueNumberOf(source);
      const blocked = issueNumberOf(target);
      if (blocker === null || blocked === null) return;
      onConnectDependency?.(blocker, blocked);
    },
    [issueNumberOf, onConnectDependency],
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<FlowNode>>(
    (_event, node) => {
      moveNode(node.id, node.position);
    },
    [moveNode],
  );

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        const blocker = issueNumberOf(edge.source);
        const blocked = issueNumberOf(edge.target);
        if (blocker !== null && blocked !== null) {
          onDeleteDependency?.(blocker, blocked);
        }
      }
    },
    [issueNumberOf, onDeleteDependency],
  );

  return (
    <ReactFlow
      nodes={renderedNodes}
      edges={renderedEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      onNodeMouseEnter={(_, node) => setFocusId(node.id)}
      onNodeMouseLeave={() => setFocusId(null)}
      onPaneClick={() => setFocusId(null)}
      colorMode="system"
      nodesDraggable
      onNodeDragStop={handleNodeDragStop}
      // A few pixels of slack so a click on a card is not read as a
      // drag, and vice versa.
      nodeDragThreshold={3}
      nodesConnectable={connectable}
      // Left selectable on purpose: React Flow drops pointer-events on
      // nodes when they are neither selectable nor draggable, which would
      // make the issue links inside them unclickable.
      elementsSelectable
      onConnect={handleConnect}
      isValidConnection={isValidConnection}
      onEdgesDelete={onDeleteDependency ? handleEdgesDelete : undefined}
      // React Flow only listens for Backspace by default; Delete is the
      // key most people reach for, and the hint promises it works.
      deleteKeyCode={["Backspace", "Delete"]}
      proOptions={{ hideAttribution: false }}
      fitView
      minZoom={0.1}
      maxZoom={2}
    >
      <FitViewOnChange
        layoutKey={layoutKey}
        refitKey={`${layoutKey}|${expanded}`}
      />
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(node) =>
          node.type === "issue"
            ? STATUS_MINIMAP_COLOR[(node.data as IssueNodeData).status]
            : "#d1d5db"
        }
        className="!bg-white/80 dark:!bg-gray-900/80"
      />
      <Panel position="top-right">
        <div className="flex items-center gap-2">
          {Object.keys(overrides).length > 0 && (
            <button type="button" onClick={reset} className={TOOL_BUTTON_CLASS}>
              {t.dependencies.resetLayout}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleExpand}
            aria-pressed={expanded}
            className={TOOL_BUTTON_CLASS}
          >
            {expanded ? t.dependencies.exitExpand : t.dependencies.expand}
          </button>
        </div>
      </Panel>
      <Panel position="top-left">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
          <span className="font-semibold">{t.dependencies.legend}</span>
          {(
            [
              ["notstarted", t.dependencies.notStarted],
              ["started", t.dependencies.started],
              ["completed", t.dependencies.completed],
            ] as const
          ).map(([status, label]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span
                className={`inline-block h-3 w-3 rounded border ${STATUS_SWATCH_CLASS[status]}`}
              />
              {label}
            </span>
          ))}
          <span className="mx-1 h-3 w-px bg-gray-300 dark:bg-gray-600" />
          <span className="flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="22"
                y2="4"
                stroke={EDGE_COLOR.dependency}
                strokeWidth="1.5"
              />
            </svg>
            {t.dependencies.dependencyEdge}
          </span>
          {motion && (
            <span className="flex items-center gap-1.5">
              <svg width="22" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="22"
                  y2="4"
                  stroke={EDGE_COLOR.dependency}
                  strokeWidth="1.5"
                  strokeDasharray="5"
                  className="[animation:dashdraw_0.5s_linear_infinite]"
                />
              </svg>
              {t.dependencies.blockingNow}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded border-2 border-dashed border-gray-400 dark:border-gray-500" />
            {t.dependencies.subIssueGroup}
          </span>
          {/* Only while a chain is lit: two more colours in the legend at
              all times would explain something that is not on screen. */}
          {focusId !== null && (
            <>
              <span className="mx-1 h-3 w-px bg-gray-300 dark:bg-gray-600" />
              {(
                [
                  ["upstream", t.dependencies.chainUpstream],
                  ["downstream", t.dependencies.chainDownstream],
                ] as const
              ).map(([role, label]) => (
                <span key={role} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1 w-4 rounded"
                    style={{ background: CHAIN_EDGE_COLOR[role] }}
                  />
                  {label}
                </span>
              ))}
            </>
          )}
        </div>
      </Panel>
    </ReactFlow>
  );
}

export function DependencyFlow(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const toggleExpand = useCallback(() => setExpanded((v) => !v), []);

  // Escape is the expected way out of anything covering the page.
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  return (
    <div
      className={
        expanded
          ? "fixed inset-0 z-50 h-screen w-screen bg-white dark:bg-gray-900"
          : "h-full min-h-[420px] w-full rounded-lg border border-gray-200 dark:border-gray-700"
      }
    >
      <ReactFlowProvider>
        <DependencyFlowInner
          {...props}
          expanded={expanded}
          onToggleExpand={toggleExpand}
        />
      </ReactFlowProvider>
    </div>
  );
}
