"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { ChangeEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isKnowledgeGraph, KnowledgeGraph, serializePlantUml, starterGraph } from "./model";
import "./knowledge.css";

const STORAGE_KEY = "knowledge-structure-editor-v1";

type CanvasNodeData = {
  label: string;
  editing: boolean;
  onChange: (value: string) => void;
  onFinish: () => void;
};

type Selection = { kind: "node" | "relation"; id: string } | null;

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
      <Handle type="target" position={Position.Left} className="knowledge-handle" />
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
      <Handle type="source" position={Position.Right} className="knowledge-handle" />
    </div>
  );
});

const nodeTypes = { knowledge: KnowledgeNodeCard };

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

export default function KnowledgeEditor() {
  const [graph, setGraph] = useState<KnowledgeGraph>(cloneStarterGraph);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [nodeMeasurements, setNodeMeasurements] = useState<Record<string, { width?: number; height?: number }>>({});
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setGraph(readStoredGraph());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
  }, [graph, ready]);

  const updateNodeText = useCallback((id: string, text: string) => {
    setGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, text } : node)),
    }));
  }, []);

  const nodes = useMemo<Node<CanvasNodeData>[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: "knowledge",
        position: node.position,
        width: 190,
        height: 100,
        ariaLabel: node.text || "未命名节点",
        measured: nodeMeasurements[node.id],
        selected: selection?.kind === "node" && selection.id === node.id,
        data: {
          label: node.text,
          editing: editingNodeId === node.id,
          onChange: (value) => updateNodeText(node.id, value),
          onFinish: () => setEditingNodeId(null),
        },
      })),
    [editingNodeId, graph.nodes, nodeMeasurements, selection, updateNodeText],
  );

  const edges = useMemo<Edge[]>(
    () =>
      graph.relations.map((relation) => ({
        id: relation.id,
        source: relation.sourceId,
        target: relation.targetId,
        label: relation.label,
        selected: selection?.kind === "relation" && selection.id === relation.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#356f66" },
        style: { stroke: "#56877f", strokeWidth: 2 },
        labelStyle: { fill: "#355c56", fontSize: 12, fontWeight: 750 },
        labelBgStyle: { fill: "#f4f8f6", fillOpacity: 0.94 },
        labelBgPadding: [7, 5],
        labelBgBorderRadius: 6,
      })),
    [graph.relations, selection],
  );

  const plantUml = useMemo(() => serializePlantUml(graph), [graph]);
  const selectedNode = selection?.kind === "node" ? graph.nodes.find((node) => node.id === selection.id) : undefined;
  const selectedRelation =
    selection?.kind === "relation" ? graph.relations.find((relation) => relation.id === selection.id) : undefined;

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const removed = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    const measured = changes.filter((change) => change.type === "dimensions");
    if (measured.length || removed.size) {
      setNodeMeasurements((current) => {
        const next = { ...current };
        for (const change of measured) {
          if (change.type === "dimensions") next[change.id] = change.dimensions;
        }
        for (const id of removed) delete next[id];
        return next;
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
    if (selectedChange) setSelection({ kind: "node", id: selectedChange.id });
    if (removed.has(selection?.id ?? "")) setSelection(null);
  }, [selection]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
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
    if (removed.has(selection?.id ?? "")) setSelection(null);
  }, [selection]);

  const addNode = () => {
    const id = crypto.randomUUID();
    const offset = graph.nodes.length * 26;
    setGraph((current) => ({
      ...current,
      nodes: [
        ...current.nodes,
        { id, text: "新概念", position: { x: 120 + (offset % 520), y: 110 + (offset % 280) } },
      ],
    }));
    setSelection({ kind: "node", id });
    setEditingNodeId(id);
  };

  const connect = (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const relation = {
      id: crypto.randomUUID(),
      sourceId: connection.source,
      targetId: connection.target,
      label: "关联",
    };
    setGraph((current) => ({ ...current, relations: [...current.relations, relation] }));
    setSelection({ kind: "relation", id: relation.id });
  };

  const removeSelection = () => {
    if (!selection) return;
    setGraph((current) =>
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
    setSelection(null);
  };

  const importGraph = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const next = JSON.parse(await file.text());
      if (!isKnowledgeGraph(next)) throw new Error("invalid");
      setGraph(next);
      setSelection(null);
    } catch {
      window.alert("无法导入：请选择由知识整理器导出的 JSON 文件。");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <main className="knowledge-editor-page">
      <header className="knowledge-editor-header">
        <a href="/" className="knowledge-back">← 返回学习站</a>
        <div className="knowledge-title">
          <span>KNOWLEDGE STRUCTURE EDITOR</span>
          <input
            aria-label="知识结构标题"
            value={graph.title}
            onChange={(event) => setGraph((current) => ({ ...current, title: event.target.value }))}
          />
        </div>
        <div className="knowledge-header-actions">
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
            备份
          </button>
          <button className="export-button" onClick={() => downloadText(`${graph.title || "知识结构"}.puml`, plantUml)}>
            导出 PlantUML
          </button>
        </div>
      </header>

      <section className="knowledge-workspace">
        <div className="knowledge-canvas-shell">
          <div className="knowledge-toolbar" aria-label="画布工具">
            <button className="primary" onClick={addNode}>＋ 添加节点</button>
            <span>从节点右侧圆点拖向另一节点即可建立关系</span>
            <button disabled={!selection} onClick={removeSelection}>删除所选</button>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={connect}
            onNodeClick={(_, node) => setSelection({ kind: "node", id: node.id })}
            onNodeDoubleClick={(_, node) => {
              setSelection({ kind: "node", id: node.id });
              setEditingNodeId(node.id);
            }}
            onEdgeClick={(_, edge) => setSelection({ kind: "relation", id: edge.id })}
            onPaneClick={() => {
              setSelection(null);
              setEditingNodeId(null);
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
              nodeColor="#d3e6df"
              nodeStrokeColor="#2d675e"
              maskColor="rgba(239,245,242,.72)"
            />
          </ReactFlow>
          <div className="knowledge-save-state"><i /> 已自动保存在当前浏览器</div>
        </div>

        <aside className="knowledge-inspector">
          <div className="inspector-heading">
            <span>{selectedNode ? "NODE" : selectedRelation ? "RELATION" : "PLANTUML"}</span>
            <h2>{selectedNode ? "编辑节点" : selectedRelation ? "编辑关系" : "可移植的知识结构"}</h2>
          </div>

          {selectedNode ? (
            <div className="inspector-form">
              <label>
                节点文字
                <textarea
                  value={selectedNode.text}
                  onChange={(event) => updateNodeText(selectedNode.id, event.target.value)}
                />
              </label>
              <p>也可以双击画布中的节点直接编辑。按 ⌘/Ctrl + Enter 完成。</p>
            </div>
          ) : selectedRelation ? (
            <div className="inspector-form">
              <label>
                关系文字
                <input
                  value={selectedRelation.label}
                  onChange={(event) =>
                    setGraph((current) => ({
                      ...current,
                      relations: current.relations.map((relation) =>
                        relation.id === selectedRelation.id ? { ...relation, label: event.target.value } : relation,
                      ),
                    }))
                  }
                  placeholder="例如：影响、支持、包含"
                />
              </label>
              <div className="relation-summary">
                <b>{graph.nodes.find((node) => node.id === selectedRelation.sourceId)?.text}</b>
                <span>→</span>
                <b>{graph.nodes.find((node) => node.id === selectedRelation.targetId)?.text}</b>
              </div>
            </div>
          ) : (
            <p className="inspector-intro">
              画布状态会转成独立的 Knowledge Graph，再由序列化器输出 PlantUML。节点位置只服务编辑体验，不污染知识语义。
            </p>
          )}

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

          <button
            className="reset-demo"
            onClick={() => {
              if (!window.confirm("恢复《关键对话》示例？当前画布会被替换。建议先备份 JSON。")) return;
              setGraph(cloneStarterGraph());
              setSelection(null);
            }}
          >
            恢复《关键对话》示例
          </button>
        </aside>
      </section>
    </main>
  );
}
