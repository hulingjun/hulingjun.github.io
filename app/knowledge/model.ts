export type KnowledgeNode = {
  id: string;
  text: string;
  position: { x: number; y: number };
};

export type KnowledgeRelation = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
};

export type KnowledgeGraph = {
  version: 1;
  title: string;
  nodes: KnowledgeNode[];
  relations: KnowledgeRelation[];
};

export const starterGraph: KnowledgeGraph = {
  version: 1,
  title: "关键对话 · 知识结构",
  nodes: [
    { id: "fact", text: "事实", position: { x: 40, y: 180 } },
    { id: "interpretation", text: "解释", position: { x: 300, y: 180 } },
    { id: "emotion", text: "情绪", position: { x: 560, y: 180 } },
    { id: "behavior", text: "行为", position: { x: 820, y: 180 } },
    { id: "safety", text: "对话安全感", position: { x: 300, y: 390 } },
  ],
  relations: [
    { id: "fact-interpretation", sourceId: "fact", targetId: "interpretation", label: "被赋予含义" },
    { id: "interpretation-emotion", sourceId: "interpretation", targetId: "emotion", label: "影响" },
    { id: "emotion-behavior", sourceId: "emotion", targetId: "behavior", label: "影响" },
    { id: "safety-interpretation", sourceId: "safety", targetId: "interpretation", label: "支持核实" },
  ],
};

function escapeObjectLabel(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\r", "")
    .replaceAll("\n", "\\n");
}

function escapeRelationLabel(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r", "")
    .replaceAll("\n", "\\n");
}

export function serializePlantUml(graph: KnowledgeGraph) {
  const aliases = new Map(graph.nodes.map((node, index) => [node.id, `N${index + 1}`]));
  const declarations = graph.nodes.map(
    (node) => `object "${escapeObjectLabel(node.text || "未命名节点")}" as ${aliases.get(node.id)}`,
  );
  const relations = graph.relations.flatMap((relation) => {
    const source = aliases.get(relation.sourceId);
    const target = aliases.get(relation.targetId);
    if (!source || !target) return [];
    const label = relation.label.trim();
    return [`${source} --> ${target}${label ? ` : ${escapeRelationLabel(label)}` : ""}`];
  });

  return [
    "@startuml",
    `title ${escapeRelationLabel(graph.title || "知识结构")}`,
    "left to right direction",
    "",
    ...declarations,
    "",
    ...relations,
    "@enduml",
    "",
  ].join("\n");
}

export function isKnowledgeGraph(value: unknown): value is KnowledgeGraph {
  if (!value || typeof value !== "object") return false;
  const graph = value as Partial<KnowledgeGraph>;
  return (
    graph.version === 1 &&
    typeof graph.title === "string" &&
    Array.isArray(graph.nodes) &&
    Array.isArray(graph.relations) &&
    graph.nodes.every(
      (node) =>
        node &&
        typeof node.id === "string" &&
        typeof node.text === "string" &&
        typeof node.position?.x === "number" &&
        typeof node.position?.y === "number",
    ) &&
    graph.relations.every(
      (relation) =>
        relation &&
        typeof relation.id === "string" &&
        typeof relation.sourceId === "string" &&
        typeof relation.targetId === "string" &&
        typeof relation.label === "string",
    )
  );
}
