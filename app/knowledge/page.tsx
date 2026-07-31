"use client";

import dagre from "@dagrejs/dagre";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  getBezierPath,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { ChangeEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isKnowledgeGraph,
  KnowledgeGraph,
  KnowledgeNode,
  serializePlantUml,
  starterGraph,
} from "./model";
import "./knowledge.css";

const STORAGE_KEY = "knowledge-structure-editor-v1";
const SPACE_INDEX_KEY = "knowledge-structure-editor-spaces-v1";
const SPACE_STORAGE_PREFIX = "knowledge-structure-editor-space-v1:";
const COLLAPSED_KEY = "knowledge-structure-editor-collapsed-v1";
const INSPECTOR_KEY = "knowledge-structure-editor-inspector-collapsed-v1";
const HEADER_KEY = "knowledge-structure-editor-header-collapsed-v1";
const NODE_WIDTH = 190;
const NODE_HEIGHT = 100;
const NODE_GAP_X = 76;
const NODE_GAP_Y = 38;

type CanvasNodeData = {
  label: string;
  editing: boolean;
  hasChildren: boolean;
  collapsed: boolean;
  onChange: (value: string) => void;
  onFinish: () => void;
  onToggle: () => void;
};

type CanvasEdgeData = {
  label: string;
  editing: boolean;
  onChange: (value: string) => void;
  onEdit: () => void;
  onFinish: () => void;
};

type CanvasEdge = Edge<CanvasEdgeData, "knowledge">;
type Selection = { kind: "node" | "relation"; id: string } | { kind: "canvas" } | null;
type Point = { x: number; y: number };
type KnowledgeSpace = { id: string; title: string };
type KnowledgeSpaceState = {
  spaces: KnowledgeSpace[];
  activeSpaceId: string;
  graph: KnowledgeGraph;
};

const KnowledgeNodeCard = memo(function KnowledgeNodeCard({
  data,
  selected,
}: {
  data: CanvasNodeData;
  selected?: boolean;
}) {
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (data.editing) {
      editorRef.current?.focus();
      editorRef.current?.select();
    }
  }, [data.editing]);

  return (
    <div className={`knowledge-node-card ${selected ? "selected" : ""}`}>
      <Handle id="left" type="target" position={Position.Left} className="knowledge-handle" />
      <Handle id="top" type="source" position={Position.Top} className="knowledge-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="knowledge-handle" />
      {data.editing ? (
        <textarea
          ref={editorRef}
          className="nodrag nowheel"
          aria-label="节点文字"
          value={data.label}
          onChange={(event) => data.onChange(event.target.value)}
          onBlur={data.onFinish}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") data.onFinish();
            if (event.key === "Escape") data.onFinish();
          }}
        />
      ) : (
        <span>{data.label || "未命名节点"}</span>
      )}
      {data.hasChildren ? (
        <button
          type="button"
          className="node-branch-toggle nodrag nopan"
          aria-label={data.collapsed ? "展开子节点" : "收起子节点"}
          title={data.collapsed ? "展开子节点" : "收起子节点"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle();
          }}
        >
          {data.collapsed ? "+" : "−"}
        </button>
      ) : null}
      <Handle id="right" type="source" position={Position.Right} className="knowledge-handle" />
    </div>
  );
});

const KnowledgeEdge = memo(function KnowledgeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps<CanvasEdge>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.32,
  });

  useEffect(() => {
    if (data?.editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [data?.editing]);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke: selected ? "#1d635b" : "#7f918d", strokeWidth: selected ? 3 : 2 }}
      />
      <EdgeLabelRenderer>
        <div
          className={`edge-midpoint nodrag nopan ${data?.label ? "has-label" : ""} ${selected ? "selected" : ""}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
        >
          {data?.editing ? (
            <input
              ref={inputRef}
              aria-label="关系文字"
              value={data.label}
              placeholder="输入关系"
              onChange={(event) => data.onChange(event.target.value)}
              onBlur={data.onFinish}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "Escape") data.onFinish();
              }}
            />
          ) : (
            <button type="button" aria-label="编辑关系文字" title="添加或编辑关系文字" onClick={data?.onEdit}>
              {data?.label || "+"}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

const nodeTypes = { knowledge: KnowledgeNodeCard };
const edgeTypes = { knowledge: KnowledgeEdge };

function downloadText(name: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

function cloneStarterGraph() {
  return JSON.parse(JSON.stringify(starterGraph)) as KnowledgeGraph;
}

function readStoredGraph() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return isKnowledgeGraph(stored) ? stored : cloneStarterGraph();
  } catch {
    return cloneStarterGraph();
  }
}

function createEmptyGraph(title: string): KnowledgeGraph {
  return { version: 1, title, nodes: [], relations: [] };
}

function spaceStorageKey(id: string) {
  return `${SPACE_STORAGE_PREFIX}${id}`;
}

function readStoredSpaces(): KnowledgeSpaceState {
  const legacyGraph = readStoredGraph();
  try {
    const stored = JSON.parse(localStorage.getItem(SPACE_INDEX_KEY) ?? "null");
    const validSpaces =
      stored?.version === 1 &&
      Array.isArray(stored.spaces) &&
      stored.spaces.length > 0 &&
      stored.spaces.every(
        (space: unknown) =>
          space &&
          typeof space === "object" &&
          typeof (space as KnowledgeSpace).id === "string" &&
          typeof (space as KnowledgeSpace).title === "string",
      );
    if (validSpaces) {
      const spaces = stored.spaces as KnowledgeSpace[];
      const activeSpaceId = spaces.some((space) => space.id === stored.activeSpaceId)
        ? stored.activeSpaceId
        : spaces[0].id;
      const activeSpace = spaces.find((space) => space.id === activeSpaceId)!;
      const savedGraph = JSON.parse(localStorage.getItem(spaceStorageKey(activeSpaceId)) ?? "null");
      return {
        spaces,
        activeSpaceId,
        graph: isKnowledgeGraph(savedGraph) ? savedGraph : createEmptyGraph(activeSpace.title),
      };
    }
  } catch {
    // Fall through to migration from the original single-space storage.
  }

  const activeSpaceId = crypto.randomUUID();
  return {
    spaces: [{ id: activeSpaceId, title: legacyGraph.title || "默认知识空间" }],
    activeSpaceId,
    graph: legacyGraph,
  };
}

function readSpaceGraph(id: string, title: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(spaceStorageKey(id)) ?? "null");
    return isKnowledgeGraph(saved) ? saved : createEmptyGraph(title);
  } catch {
    return createEmptyGraph(title);
  }
}

function readCollapsedNodes() {
  try {
    const stored = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
    return Array.isArray(stored) ? new Set(stored.filter((id): id is string => typeof id === "string")) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function readInspectorCollapsed() {
  return localStorage.getItem(INSPECTOR_KEY) === "true";
}

function readHeaderCollapsed() {
  return localStorage.getItem(HEADER_KEY) === "true";
}

function overlaps(point: Point, nodes: KnowledgeNode[]) {
  const padding = 18;
  return nodes.some(
    (node) =>
      point.x < node.position.x + NODE_WIDTH + padding &&
      point.x + NODE_WIDTH + padding > node.position.x &&
      point.y < node.position.y + NODE_HEIGHT + padding &&
      point.y + NODE_HEIGHT + padding > node.position.y,
  );
}

export default function KnowledgeEditor() {
  const [graph, setGraph] = useState<KnowledgeGraph>(cloneStarterGraph);
  const [spaces, setSpaces] = useState<KnowledgeSpace[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState("");
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingRelationId, setEditingRelationId] = useState<string | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set);
  const [nodeMeasurements, setNodeMeasurements] = useState<Record<string, { width?: number; height?: number }>>({});
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const copiedNodeRef = useRef<KnowledgeNode | null>(null);
  const lastNodeIdRef = useRef<string | null>(null);
  const activeSpaceIdRef = useRef("");
  const graphRef = useRef<KnowledgeGraph>(graph);
  const undoStackRef = useRef<KnowledgeGraph[]>([]);
  const redoStackRef = useRef<KnowledgeGraph[]>([]);
  const dragStartGraphRef = useRef<KnowledgeGraph | null>(null);

  useEffect(() => {
    const stored = readStoredSpaces();
    activeSpaceIdRef.current = stored.activeSpaceId;
    setSpaces(stored.spaces);
    setActiveSpaceId(stored.activeSpaceId);
    setGraph(stored.graph);
    lastNodeIdRef.current = stored.graph.nodes.at(-1)?.id ?? null;
    setCollapsedNodeIds(readCollapsedNodes());
    setInspectorCollapsed(readInspectorCollapsed());
    setHeaderCollapsed(readHeaderCollapsed());
    setReady(true);
  }, []);

  useEffect(() => {
    graphRef.current = graph;
    if (!ready || !activeSpaceIdRef.current) return;
    localStorage.setItem(spaceStorageKey(activeSpaceIdRef.current), JSON.stringify(graph));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
    setSpaces((current) => {
      const active = current.find((space) => space.id === activeSpaceIdRef.current);
      if (!active || active.title === graph.title) return current;
      return current.map((space) =>
        space.id === activeSpaceIdRef.current ? { ...space, title: graph.title || "未命名空间" } : space,
      );
    });
  }, [graph, ready]);

  useEffect(() => {
    if (!ready || !activeSpaceId) return;
    localStorage.setItem(
      SPACE_INDEX_KEY,
      JSON.stringify({ version: 1, activeSpaceId, spaces }),
    );
  }, [activeSpaceId, ready, spaces]);

  useEffect(() => {
    if (ready) localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsedNodeIds]));
  }, [collapsedNodeIds, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem(INSPECTOR_KEY, String(inspectorCollapsed));
  }, [inspectorCollapsed, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem(HEADER_KEY, String(headerCollapsed));
  }, [headerCollapsed, ready]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1400);
  }, []);

  const recordHistory = useCallback((snapshot: KnowledgeGraph) => {
    const stack = undoStackRef.current;
    if (stack.at(-1) === snapshot) return;
    stack.push(snapshot);
    if (stack.length > 80) stack.shift();
    redoStackRef.current = [];
  }, []);

  const commitGraph = useCallback((updater: (current: KnowledgeGraph) => KnowledgeGraph) => {
    setGraph((current) => {
      const next = updater(current);
      if (next !== current) recordHistory(current);
      return next;
    });
  }, [recordHistory]);

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) {
      showNotice("没有可以撤销的操作");
      return;
    }
    redoStackRef.current.push(graphRef.current);
    graphRef.current = previous;
    setGraph(previous);
    setSelection({ kind: "canvas" });
    setEditingNodeId(null);
    setEditingRelationId(null);
    showNotice("已撤销上一步");
  }, [showNotice]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) {
      showNotice("没有可以重做的操作");
      return;
    }
    undoStackRef.current.push(graphRef.current);
    graphRef.current = next;
    setGraph(next);
    setSelection({ kind: "canvas" });
    setEditingNodeId(null);
    setEditingRelationId(null);
    showNotice("已重做操作");
  }, [showNotice]);

  const activateSpace = useCallback((id: string) => {
    if (!id || id === activeSpaceIdRef.current) return;
    const target = spaces.find((space) => space.id === id);
    if (!target) return;
    const nextGraph = readSpaceGraph(id, target.title);
    activeSpaceIdRef.current = id;
    graphRef.current = nextGraph;
    setActiveSpaceId(id);
    setGraph(nextGraph);
    setSelection({ kind: "canvas" });
    setEditingNodeId(null);
    setEditingRelationId(null);
    setCollapsedNodeIds(new Set);
    setNodeMeasurements({});
    lastNodeIdRef.current = nextGraph.nodes.at(-1)?.id ?? null;
    undoStackRef.current = [];
    redoStackRef.current = [];
    requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.24, duration: 320 }));
    showNotice(`已切换到「${target.title}」`);
  }, [showNotice, spaces]);

  const createSpace = useCallback(() => {
    const id = crypto.randomUUID();
    const title = `知识空间 ${spaces.length + 1}`;
    const nextGraph = createEmptyGraph(title);
    localStorage.setItem(spaceStorageKey(id), JSON.stringify(nextGraph));
    activeSpaceIdRef.current = id;
    graphRef.current = nextGraph;
    setSpaces((current) => [...current, { id, title }]);
    setActiveSpaceId(id);
    setGraph(nextGraph);
    setSelection({ kind: "canvas" });
    setEditingNodeId(null);
    setEditingRelationId(null);
    setCollapsedNodeIds(new Set);
    setNodeMeasurements({});
    lastNodeIdRef.current = null;
    undoStackRef.current = [];
    redoStackRef.current = [];
    requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.24, duration: 320 }));
    showNotice(`已新建「${title}」`);
  }, [showNotice, spaces.length]);

  const updateNodeText = useCallback((id: string, text: string) => {
    commitGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, text } : node)),
    }));
  }, [commitGraph]);

  const updateRelationText = useCallback((id: string, label: string) => {
    commitGraph((current) => ({
      ...current,
      relations: current.relations.map((relation) => (relation.id === id ? { ...relation, label } : relation)),
    }));
  }, [commitGraph]);

  const outgoingByNode = useMemo(() => {
    const outgoing = new Map<string, string[]>();
    for (const relation of graph.relations) {
      outgoing.set(relation.sourceId, [...(outgoing.get(relation.sourceId) ?? []), relation.targetId]);
    }
    return outgoing;
  }, [graph.relations]);

  const hiddenNodeIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const rootId of collapsedNodeIds) {
      const queue = [...(outgoingByNode.get(rootId) ?? [])];
      const visited = new Set<string>([rootId]);
      while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        hidden.add(id);
        queue.push(...(outgoingByNode.get(id) ?? []));
      }
    }
    return hidden;
  }, [collapsedNodeIds, outgoingByNode]);

  const toggleNode = useCallback((id: string) => {
    setCollapsedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const nodes = useMemo<Node<CanvasNodeData>[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: "knowledge",
        position: node.position,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        hidden: hiddenNodeIds.has(node.id),
        ariaLabel: node.text || "未命名节点",
        measured: nodeMeasurements[node.id],
        selected: selection?.kind === "node" && selection.id === node.id,
        data: {
          label: node.text,
          editing: editingNodeId === node.id,
          hasChildren: (outgoingByNode.get(node.id)?.length ?? 0) > 0,
          collapsed: collapsedNodeIds.has(node.id),
          onChange: (value) => updateNodeText(node.id, value),
          onFinish: () => setEditingNodeId(null),
          onToggle: () => toggleNode(node.id),
        },
      })),
    [
      collapsedNodeIds,
      editingNodeId,
      graph.nodes,
      hiddenNodeIds,
      nodeMeasurements,
      outgoingByNode,
      selection,
      toggleNode,
      updateNodeText,
    ],
  );

  const edges = useMemo<CanvasEdge[]>(
    () =>
      graph.relations.map((relation) => ({
        id: relation.id,
        source: relation.sourceId,
        target: relation.targetId,
        sourceHandle: relation.sourceHandle ?? "right",
        targetHandle: relation.targetHandle ?? "left",
        type: "knowledge",
        reconnectable: true,
        hidden: hiddenNodeIds.has(relation.sourceId) || hiddenNodeIds.has(relation.targetId),
        selected: selection?.kind === "relation" && selection.id === relation.id,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#758b86" },
        data: {
          label: relation.label,
          editing: editingRelationId === relation.id,
          onChange: (value) => updateRelationText(relation.id, value),
          onEdit: () => {
            setSelection({ kind: "relation", id: relation.id });
            setEditingRelationId(relation.id);
          },
          onFinish: () => setEditingRelationId(null),
        },
      })),
    [editingRelationId, graph.relations, hiddenNodeIds, selection, updateRelationText],
  );

  const plantUml = useMemo(() => serializePlantUml(graph), [graph]);
  const selectedNode = selection?.kind === "node" ? graph.nodes.find((node) => node.id === selection.id) : undefined;
  const selectedRelation =
    selection?.kind === "relation" ? graph.relations.find((relation) => relation.id === selection.id) : undefined;

  const getVisibleBounds = useCallback(() => {
    const shell = canvasShellRef.current;
    const flow = flowRef.current;
    if (!shell || !flow) return null;
    const rect = shell.getBoundingClientRect();
    const topLeft = flow.screenToFlowPosition({ x: rect.left + 28, y: rect.top + 86 });
    const bottomRight = flow.screenToFlowPosition({ x: rect.right - 28, y: rect.bottom - 28 });
    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, bottomRight.y),
      maxX: Math.max(topLeft.x, bottomRight.x) - NODE_WIDTH,
      maxY: Math.max(topLeft.y, bottomRight.y) - NODE_HEIGHT,
    };
  }, []);

  const findOpenPosition = useCallback(
    (anchor: Point | null, existingNodes: KnowledgeNode[]) => {
      const bounds = getVisibleBounds();
      const clamp = (point: Point): Point =>
        bounds
          ? {
              x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
              y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)),
            }
          : point;
      const base = anchor ?? (bounds ? { x: bounds.minX, y: bounds.minY } : { x: 120, y: 120 });
      const candidates: Point[] = [];
      for (let ring = 1; ring <= 8; ring += 1) {
        candidates.push(
          { x: base.x + (NODE_WIDTH + NODE_GAP_X) * ring, y: base.y },
          { x: base.x, y: base.y + (NODE_HEIGHT + NODE_GAP_Y) * ring },
          { x: base.x, y: base.y - (NODE_HEIGHT + NODE_GAP_Y) * ring },
          { x: base.x - (NODE_WIDTH + NODE_GAP_X) * ring, y: base.y },
        );
      }
      if (bounds) {
        for (let y = bounds.minY; y <= bounds.maxY; y += NODE_HEIGHT + NODE_GAP_Y) {
          for (let x = bounds.minX; x <= bounds.maxX; x += NODE_WIDTH + NODE_GAP_X) candidates.push({ x, y });
        }
      }
      for (const candidate of candidates) {
        const point = clamp(candidate);
        if (!overlaps(point, existingNodes.filter((node) => !hiddenNodeIds.has(node.id)))) return point;
      }
      return clamp({ x: base.x + 28, y: base.y + 28 });
    },
    [getVisibleBounds, hiddenNodeIds],
  );

  const addNode = useCallback(() => {
    const id = crypto.randomUUID();
    const anchorId =
      selection?.kind === "node" ? selection.id : lastNodeIdRef.current ?? graph.nodes.at(-1)?.id;
    const anchor = graph.nodes.find((node) => node.id === anchorId)?.position ?? null;
    const position = findOpenPosition(anchor, graph.nodes);
    commitGraph((current) => ({
      ...current,
      nodes: [...current.nodes, { id, text: "新概念", position }],
    }));
    lastNodeIdRef.current = id;
    setSelection({ kind: "node", id });
    setEditingNodeId(id);
  }, [commitGraph, findOpenPosition, graph.nodes, selection]);

  const pasteCopiedNode = useCallback(() => {
    const copiedNode = copiedNodeRef.current;
    if (!copiedNode) return;
    const id = crypto.randomUUID();
    const position = findOpenPosition(copiedNode.position, graph.nodes);
    commitGraph((current) => ({
      ...current,
      nodes: [...current.nodes, { id, text: copiedNode.text, position }],
    }));
    lastNodeIdRef.current = id;
    setSelection({ kind: "node", id });
    showNotice("节点已粘贴到最近空位");
  }, [commitGraph, findOpenPosition, graph.nodes, showNotice]);

  useEffect(() => {
    const handleClipboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (key === "c" && selection?.kind === "node") {
        const node = graph.nodes.find((item) => item.id === selection.id);
        if (!node) return;
        event.preventDefault();
        copiedNodeRef.current = { ...node, position: { ...node.position } };
        showNotice("节点已复制");
      }
      if (key === "v" && copiedNodeRef.current) {
        event.preventDefault();
        pasteCopiedNode();
      }
    };
    window.addEventListener("keydown", handleClipboard);
    return () => window.removeEventListener("keydown", handleClipboard);
  }, [graph.nodes, pasteCopiedNode, redo, selection, showNotice, undo]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const removed = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    if (removed.size) recordHistory(graphRef.current);
    const measured = changes.filter((change) => change.type === "dimensions");
    if (measured.length || removed.size) {
      setNodeMeasurements((current) => {
        const next = { ...current };
        let changed = false;
        for (const change of measured) {
          if (
            change.type === "dimensions" &&
            (current[change.id]?.width !== change.dimensions.width ||
              current[change.id]?.height !== change.dimensions.height)
          ) {
            next[change.id] = change.dimensions;
            changed = true;
          }
        }
        for (const id of removed) {
          if (id in next) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }
    setGraph((current) => ({
      ...current,
      nodes: current.nodes
        .filter((node) => !removed.has(node.id))
        .map((node) => {
          const positionChange = changes.find(
            (change) => change.type === "position" && change.id === node.id && change.position,
          );
          return positionChange && positionChange.type === "position" && positionChange.position
            ? { ...node, position: positionChange.position }
            : node;
        }),
      relations: current.relations.filter(
        (relation) => !removed.has(relation.sourceId) && !removed.has(relation.targetId),
      ),
    }));
    const selectedChange = changes.find(
      (change): change is Extract<NodeChange, { type: "select" }> => change.type === "select" && change.selected,
    );
    if (selectedChange) {
      setSelection({ kind: "node", id: selectedChange.id });
      lastNodeIdRef.current = selectedChange.id;
    }
    if (removed.has(selection?.kind === "node" || selection?.kind === "relation" ? selection.id : "")) {
      setSelection({ kind: "canvas" });
    }
  }, [recordHistory, selection]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    if (removed.size) recordHistory(graphRef.current);
    if (removed.size) {
      setGraph((current) => ({
        ...current,
        relations: current.relations.filter((relation) => !removed.has(relation.id)),
      }));
    }
    const selectedChange = changes.find(
      (change): change is Extract<EdgeChange, { type: "select" }> => change.type === "select" && change.selected,
    );
    if (selectedChange) setSelection({ kind: "relation", id: selectedChange.id });
    if (selection?.kind === "relation" && removed.has(selection.id)) setSelection({ kind: "canvas" });
  }, [recordHistory, selection]);

  const reconnectRelation = useCallback((oldEdge: Edge, connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    commitGraph((current) => ({
      ...current,
      relations: current.relations.map((relation) =>
        relation.id === oldEdge.id
          ? {
              ...relation,
              sourceId: connection.source,
              targetId: connection.target,
              sourceHandle: connection.sourceHandle,
              targetHandle: connection.targetHandle,
            }
          : relation,
      ),
    }));
    setSelection({ kind: "relation", id: oldEdge.id });
    showNotice("连接位置已更新");
  }, [commitGraph, showNotice]);

  const connect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const relation = {
      id: crypto.randomUUID(),
      sourceId: connection.source,
      targetId: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      label: "",
    };
    commitGraph((current) => ({ ...current, relations: [...current.relations, relation] }));
    setSelection({ kind: "relation", id: relation.id });
    setEditingRelationId(relation.id);
  }, [commitGraph]);

  const removeSelection = () => {
    if (!selection || selection.kind === "canvas") return;
    commitGraph((current) =>
      selection.kind === "node"
        ? {
            ...current,
            nodes: current.nodes.filter((node) => node.id !== selection.id),
            relations: current.relations.filter(
              (relation) => relation.sourceId !== selection.id && relation.targetId !== selection.id,
            ),
          }
        : { ...current, relations: current.relations.filter((relation) => relation.id !== selection.id) },
    );
    setSelection({ kind: "canvas" });
  };

  const autoLayout = useCallback(() => {
    const layoutGraph = new dagre.graphlib.Graph();
    layoutGraph.setDefaultEdgeLabel(() => ({}));
    layoutGraph.setGraph({ rankdir: "LR", nodesep: 54, ranksep: 90, marginx: 24, marginy: 24 });
    for (const node of graph.nodes) layoutGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    for (const relation of graph.relations) layoutGraph.setEdge(relation.sourceId, relation.targetId);
    dagre.layout(layoutGraph);
    commitGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        const placed = layoutGraph.node(node.id);
        return placed
          ? { ...node, position: { x: placed.x - NODE_WIDTH / 2, y: placed.y - NODE_HEIGHT / 2 } }
          : node;
      }),
    }));
    requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.22, duration: 420 }));
    showNotice("画布已从左到右对齐");
  }, [commitGraph, graph.nodes, graph.relations, showNotice]);

  const importGraph = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const next = JSON.parse(await file.text());
      if (!isKnowledgeGraph(next)) throw new Error("invalid");
      commitGraph(() => next);
      setCollapsedNodeIds(new Set);
      setSelection({ kind: "canvas" });
    } catch {
      window.alert("无法导入：请选择由知识整理器导出的 JSON 文件。");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <main className={`knowledge-editor-page ${headerCollapsed ? "topbar-collapsed" : ""}`}>
      <header className={`knowledge-editor-header ${headerCollapsed ? "collapsed" : ""}`}>
        <div className="knowledge-header-primary">
          <div className="knowledge-navigation">
            <a href="/" className="knowledge-back">← 返回学习站</a>
            <div className="knowledge-space-switcher">
              <select
                aria-label="切换知识空间"
                value={activeSpaceId}
                disabled={!ready}
                onChange={(event) => activateSpace(event.target.value)}
              >
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>{space.title}</option>
                ))}
              </select>
              <button type="button" onClick={createSpace} disabled={!ready}>＋ 新建空间</button>
            </div>
          </div>
          <div className="knowledge-title">
            <span>KNOWLEDGE STRUCTURE EDITOR</span>
            <input
              aria-label="知识结构标题"
              value={graph.title}
              onChange={(event) => commitGraph((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <button
            type="button"
            className="topbar-toggle"
            aria-label={headerCollapsed ? "展开上边栏" : "折叠上边栏"}
            title={headerCollapsed ? "展开上边栏" : "折叠上边栏"}
            onClick={() => setHeaderCollapsed((current) => !current)}
          >
            {headerCollapsed ? "⌄" : "⌃"}
          </button>
        </div>

        {!headerCollapsed ? (
          <div className="knowledge-header-secondary">
            <div className="header-action-group">
              <span>画布</span>
              <button className="primary" onClick={addNode}>＋ 添加节点</button>
              <button onClick={autoLayout}>一键排版</button>
              <button onClick={undo}>撤销</button>
              <button onClick={redo}>重做</button>
              <button
                className="danger"
                disabled={!selection || selection.kind === "canvas"}
                onClick={removeSelection}
              >
                删除所选
              </button>
            </div>
            <p className="header-operation-hint">拖动节点连接点创建关系 · 选中线条后拖动端点改接 · 点击线条中点添加关系文字</p>
            <div className="header-action-group file-actions">
              <span>文件</span>
              <button onClick={() => fileInputRef.current?.click()}>导入 JSON</button>
              <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={importGraph} hidden />
              <button
                onClick={() =>
                  downloadText(
                    `${graph.title || "知识结构"}.json`,
                    JSON.stringify(graph, null, 2),
                    "application/json;charset=utf-8",
                  )
                }
              >
                备份 JSON
              </button>
              <button className="export-button" onClick={() => downloadText(`${graph.title || "知识结构"}.puml`, plantUml)}>
                导出 PlantUML
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <section className={`knowledge-workspace ${inspectorCollapsed ? "inspector-collapsed" : ""}`}>
        <div className="knowledge-canvas-shell" ref={canvasShellRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            onInit={(instance) => {
              flowRef.current = instance;
            }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={connect}
            onReconnect={reconnectRelation}
            connectionRadius={18}
            reconnectRadius={20}
            onNodeDragStart={() => {
              dragStartGraphRef.current = graphRef.current;
            }}
            onNodeDragStop={() => {
              const snapshot = dragStartGraphRef.current;
              if (snapshot && snapshot !== graphRef.current) recordHistory(snapshot);
              dragStartGraphRef.current = null;
            }}
            onNodeClick={(_, node) => {
              setSelection({ kind: "node", id: node.id });
              lastNodeIdRef.current = node.id;
            }}
            onNodeDoubleClick={(_, node) => {
              setSelection({ kind: "node", id: node.id });
              setEditingNodeId(node.id);
            }}
            onEdgeClick={(_, edge) => setSelection({ kind: "relation", id: edge.id })}
            onPaneClick={() => {
              setSelection({ kind: "canvas" });
              setEditingNodeId(null);
              setEditingRelationId(null);
            }}
            isValidConnection={(connection) => connection.source !== connection.target}
            fitView
            fitViewOptions={{ padding: 0.24 }}
            minZoom={0.2}
            maxZoom={2}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#b7c9c4" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => node.selected ? "#b8dfcf" : "#d9dedc"}
              nodeStrokeColor={(node) => node.selected ? "#1d635b" : "#8a9995"}
              maskColor="rgba(239,245,242,.72)"
            />
          </ReactFlow>
          {notice ? <div className="knowledge-toast">{notice}</div> : null}
          <div className="knowledge-save-state"><i /> 已自动保存在当前浏览器</div>
        </div>

        <aside className={`knowledge-inspector ${inspectorCollapsed ? "collapsed" : ""}`}>
          <button
            type="button"
            className="inspector-toggle"
            aria-label={inspectorCollapsed ? "展开右侧栏" : "折叠右侧栏"}
            title={inspectorCollapsed ? "展开右侧栏" : "折叠右侧栏"}
            onClick={() => setInspectorCollapsed((current) => !current)}
          >
            {inspectorCollapsed ? "‹" : "›"}
          </button>
          {!inspectorCollapsed ? <div className="knowledge-inspector-content">
            <div className="inspector-heading">
              <span>CONTEXT PANEL</span>
              <h2>
                {selectedNode
                  ? "节点属性"
                  : selectedRelation
                    ? "关系属性"
                    : selection?.kind === "canvas"
                      ? "画布信息"
                      : "知识结构"}
              </h2>
            </div>

            <section className="inspector-section">
              <div className="inspector-section-label">当前选择</div>
              {selectedNode ? (
                <div className="inspector-form">
                  <label>
                    节点文字
                    <textarea
                      value={selectedNode.text}
                      onChange={(event) => updateNodeText(selectedNode.id, event.target.value)}
                    />
                  </label>
                  <p>双击节点可直接编辑；Ctrl/Cmd+C、V 可复制到附近空位。</p>
                </div>
              ) : selectedRelation ? (
                <div className="inspector-form">
                  <label>
                    关系文字
                    <input
                      value={selectedRelation.label}
                      onChange={(event) => updateRelationText(selectedRelation.id, event.target.value)}
                      placeholder="可留空，例如：影响、支持、包含"
                    />
                  </label>
                  <div className="relation-summary">
                    <b>{graph.nodes.find((node) => node.id === selectedRelation.sourceId)?.text}</b>
                    <span>→</span>
                    <b>{graph.nodes.find((node) => node.id === selectedRelation.targetId)?.text}</b>
                  </div>
                </div>
              ) : selection?.kind === "canvas" ? (
                <p className="inspector-intro">
                  已选中画布。添加节点、排版、撤销和删除等画布操作已集中到上边栏“画布”分组。
                </p>
              ) : (
                <p className="inspector-intro">
                  选择节点或关系后，在这里编辑它的属性。右边栏只处理当前对象和输出预览。
                </p>
              )}
            </section>

            <section className="inspector-section">
              <div className="inspector-section-label">输出 · PlantUML</div>
              <div className="plantuml-preview">
                <div>
                  <span>PlantUML v1.2026.6</span>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(plantUml);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    }}
                  >
                    {copied ? "已复制" : "复制源码"}
                  </button>
                </div>
                <pre>{plantUml}</pre>
              </div>
            </section>

            <section className="inspector-section inspector-recovery">
              <div className="inspector-section-label">示例与恢复</div>
              <button
                className="reset-demo"
                onClick={() => {
                  if (!window.confirm("恢复《关键对话》示例？当前画布会被替换。建议先备份 JSON。")) return;
                  commitGraph(() => cloneStarterGraph());
                  setCollapsedNodeIds(new Set);
                  setSelection({ kind: "canvas" });
                }}
              >
                恢复《关键对话》示例
              </button>
            </section>
          </div> : null}
        </aside>
      </section>
    </main>
  );
}
