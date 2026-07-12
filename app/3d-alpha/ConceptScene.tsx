"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { innerConcepts, innerRelations } from "../content";

const ForceGraph3D = lazy(() => import("react-force-graph-3d"));

const coordinates: Record<string, [number, number, number]> = {
  fact: [-82, 0, 0], interpretation: [-28, 0, 0], emotion: [28, 0, 0], behavior: [82, 0, 0],
  empathy: [-28, 48, 8], "conversational-safety": [28, -48, 8],
};

const titleToId: Record<string, string> = {
  事实: "fact", 解释: "interpretation", 情绪: "emotion", 行为: "behavior", 共情: "empathy", 审视解释: "interpretation", 安全感: "conversational-safety",
};

type GraphNode = { id: string; title: string; cue: string; color: string; fx: number; fy: number; fz: number };
type GraphLink = { source: string; target: string; verb: string; id: string };
const linkNodeId = (value: string | GraphNode) => typeof value === "string" ? value : value.id;

export default function ConceptScene({ focusId, activeIds, free, onSelect, onError }: { focusId: string; activeIds: string[]; free: boolean; onSelect: (id: string) => void; onError: () => void }) {
  const graphRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const stateRef = useRef({ focusId, activeIds, onSelect });
  stateRef.current = { focusId, activeIds, onSelect };

  const graphData = useMemo(() => ({
    nodes: innerConcepts.map((concept) => { const [fx, fy, fz] = coordinates[concept.id]; return { id: concept.id, title: concept.title, cue: concept.cue, color: concept.accent, fx, fy, fz }; }),
    links: innerRelations.map((relation) => ({ id: relation.id, source: titleToId[relation.from], target: titleToId[relation.to], verb: relation.verb })),
  }), []);

  const extraRenderers = useMemo(() => typeof window === "undefined" ? [] : [new CSS2DRenderer()], []);

  const makeNode = useCallback((raw: object) => {
    const node = raw as GraphNode;
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(7.2, 36, 36),
      new THREE.MeshPhysicalMaterial({ color: node.color, roughness: .25, metalness: .06, transmission: .12, transparent: true, opacity: .9, emissive: node.color, emissiveIntensity: .2 }),
    );
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(9.2, 9.65, 64),
      new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: .42, side: THREE.DoubleSide }),
    );
    group.add(core, halo);
    const label = document.createElement("div");
    label.className = "graph-node-label";
    label.dataset.nodeId = node.id;
    label.innerHTML = `<strong>${node.title}</strong><span>${node.cue}</span>`;
    label.style.setProperty("--node-color", node.color);
    label.addEventListener("click", () => stateRef.current.onSelect(node.id));
    const labelObject = new CSS2DObject(label); labelObject.position.set(0, -14, 0); group.add(labelObject);
    group.userData = { core, halo, id: node.id };
    return group;
  }, []);

  useEffect(() => {
    if (!ready || !graphRef.current) return;
    const [x, y, z] = coordinates[focusId] ?? [0, 0, 0];
    const distance = free ? 190 : 112;
    graphRef.current.cameraPosition({ x, y: y + 8, z: z + distance }, { x, y, z }, 850);
  }, [focusId, free, ready]);

  const styleNode = useCallback((object: THREE.Object3D, _coords: unknown, raw: object) => {
    const node = raw as GraphNode; const active = stateRef.current.activeIds.includes(node.id) || stateRef.current.focusId === node.id;
    const target = active ? 1.16 : .92; object.scale.lerp(new THREE.Vector3(target, target, target), .14);
    const core = object.userData.core as THREE.Mesh | undefined; const halo = object.userData.halo as THREE.Mesh | undefined;
    if (core) (core.material as THREE.MeshPhysicalMaterial).opacity = active ? .98 : .32;
    if (halo) { (halo.material as THREE.MeshBasicMaterial).opacity = active ? .72 : .12; halo.rotation.z += active ? .004 : .001; }
    const element = object.children.find((child) => child instanceof CSS2DObject) as CSS2DObject | undefined;
    if (element) element.element.classList.toggle("muted", !active && !free);
    return false;
  }, [free]);

  return <div className="force-graph-stage"><Suspense fallback={<div className="graph-loading">正在建立概念空间…</div>}>
    <ForceGraph3D ref={graphRef} graphData={graphData} extraRenderers={extraRenderers}
      backgroundColor="#071417" showNavInfo={false} nodeThreeObject={makeNode} nodeThreeObjectExtend={false} nodePositionUpdate={styleNode}
      linkColor={() => "#75b8ab"} linkOpacity={.35} linkWidth={1.1} linkCurvature={.08}
      linkDirectionalArrowLength={4.5} linkDirectionalArrowRelPos={.72} linkDirectionalArrowColor={() => "#9de2d4"}
      linkDirectionalParticles={(link: object) => { const item = link as unknown as { source: string | GraphNode; target: string | GraphNode }; return activeIds.includes(linkNodeId(item.source)) || activeIds.includes(linkNodeId(item.target)) ? 2 : 0; }}
      linkDirectionalParticleColor={() => "#d8fff7"} linkDirectionalParticleWidth={1.7} linkDirectionalParticleSpeed={.004}
      onNodeClick={(node: object) => onSelect((node as GraphNode).id)} onEngineStop={() => setReady(true)} warmupTicks={20} cooldownTicks={1}
      enableNodeDrag={false} enableNavigationControls={true} controlType="orbit" onRenderFramePost={() => { if (!ready) setReady(true); }}
    /></Suspense>
    <div className="graph-atmosphere" aria-hidden="true" />
  </div>;
}
