"use client";

import { useMemo, useState } from "react";
import ConceptScene from "./ConceptScene";
import { innerConcepts, innerRelations } from "../content";
import "./scene.css";

type SavedCard = { id: string; title: string; front: string; back: string; createdAt: string };
const guided = ["fact", "interpretation", "emotion", "behavior", "empathy", "conversational-safety"];
const caseSteps = [
  { id: "fact", title: "先固定事实", text: "用户连续三天在晚上11点之后发来咨询消息。摄像机可以记录这件事。", active: ["fact"] },
  { id: "interpretation", title: "看见两种解释", text: "“他不尊重我的时间”和“他可能只有深夜方便”，都是尚待核实的解释。", active: ["fact", "interpretation"] },
  { id: "emotion", title: "解释影响情绪", text: "第一种解释可能带来愤怒；第二种可能带来理解，同时仍然疲惫。", active: ["interpretation", "emotion"] },
  { id: "behavior", title: "情绪影响行动倾向", text: "你可能讽刺或回避，也可以选择第二天说明边界并询问对方的情况。", active: ["emotion", "behavior"] },
  { id: "empathy", title: "用共情打开可能性", text: "先承认自己还不知道原因，再通过提问核实；理解不等于取消边界。", active: ["empathy", "interpretation"] },
  { id: "conversational-safety", title: "让真实信息继续流动", text: "“我通常不在晚上处理咨询。你一般只有晚上方便吗？”既询问情况，也清楚表达边界。", active: ["interpretation", "conversational-safety"] },
];

function saveCard(title: string, definition: string) {
  try { const cards: SavedCard[] = JSON.parse(localStorage.getItem("dc-cards") ?? "[]"); cards.push({ id: crypto.randomUUID(), title, front: `什么是“${title}”？`, back: definition, createdAt: new Date().toISOString() }); localStorage.setItem("dc-cards", JSON.stringify(cards)); return true; } catch { return false; }
}

export default function Alpha3D() {
  const [mode, setMode] = useState<"guide" | "free" | "case">("guide");
  const [selected, setSelected] = useState("fact"); const [guideIndex, setGuideIndex] = useState(0); const [caseIndex, setCaseIndex] = useState(0); const [failed, setFailed] = useState(false); const [saved, setSaved] = useState(false); const [panelCollapsed, setPanelCollapsed] = useState(false);
  const concept = useMemo(() => innerConcepts.find((item) => item.id === selected) ?? innerConcepts[0], [selected]);
  const focus = mode === "case" ? caseSteps[caseIndex].id : selected;
  const active = mode === "case" ? caseSteps[caseIndex].active : mode === "guide" ? guided.slice(0, guideIndex + 1) : [selected];
  const choose = (id: string) => { setSelected(id); setPanelCollapsed(false); if (mode === "guide") setGuideIndex(Math.max(0, guided.indexOf(id))); };
  const changeMode = (next: "guide" | "free" | "case") => { setMode(next); setPanelCollapsed(false); if (next === "guide") { setGuideIndex(0); setSelected("fact"); } if (next === "case") setCaseIndex(0); };
  return <main className="three-d-page">
    <header className="three-d-nav"><a href="/">← 返回 2D 稳定版</a><div><strong>高难度沟通 · 概念空间</strong><span>alpha-3d-0.2</span></div><nav aria-label="学习模式"><button className={mode === "guide" ? "active" : ""} onClick={() => changeMode("guide")}>引导学习</button><button className={mode === "free" ? "active" : ""} onClick={() => changeMode("free")}>自由探索</button><button className={mode === "case" ? "active" : ""} onClick={() => changeMode("case")}>深夜案例</button></nav></header>
    <div className="scene-stage">{failed ? <div className="webgl-fallback"><b>当前设备无法启动3D场景</b><p>知识内容仍然可以在2D稳定版中完整学习。</p><a href="/#unit-a">返回2D概念学习</a></div> : <ConceptScene focusId={focus} activeIds={active} free={mode === "free"} onSelect={choose} onError={() => setFailed(true)} />}
      <div className="scene-hint">{mode === "free" ? "拖动旋转 · 滚轮缩放 · 点击节点" : "点击节点可跳转 · 使用右侧面板继续"}</div>
      <aside className={`knowledge-panel ${panelCollapsed ? "collapsed" : ""}`}>
        <button className="panel-collapse-toggle" aria-expanded={!panelCollapsed} aria-controls="knowledge-panel-content" onClick={() => setPanelCollapsed(!panelCollapsed)}><i /><span><small>{panelCollapsed ? "点击展开" : "向下折叠"}</small><b>{mode === "case" ? caseSteps[caseIndex].title : concept.title}</b></span><strong>{panelCollapsed ? "⌃" : "⌄"}</strong></button><div className="panel-content" id="knowledge-panel-content">
        {mode === "case" ? <><p className="panel-kicker">DYNAMIC CASE · {caseIndex + 1}/6</p><h1>{caseSteps[caseIndex].title}</h1><p className="panel-summary">{caseSteps[caseIndex].text}</p><div className="case-dots">{caseSteps.map((step, index) => <button aria-label={`案例步骤${index + 1}`} key={step.title} className={index <= caseIndex ? "active" : ""} onClick={() => setCaseIndex(index)} />)}</div><div className="panel-actions"><button disabled={caseIndex === 0} onClick={() => setCaseIndex(caseIndex - 1)}>上一步</button><button onClick={() => caseIndex < 5 ? setCaseIndex(caseIndex + 1) : changeMode("free")}>{caseIndex < 5 ? "下一步" : "自由探索"}</button></div></> : <><p className="panel-kicker">{mode === "guide" ? `GUIDED · ${guideIndex + 1}/6` : "FREE EXPLORE"}</p><h1>{concept.title}</h1><b className="concept-cue">{concept.cue}</b><p className="panel-summary">{concept.definition}</p><div className="concept-boundary"><div><span>它包括</span><p>{concept.includes.slice(0, 2).join(" · ")}</p></div><div><span>它不包括</span><p>{concept.excludes.slice(0, 2).join(" · ")}</p></div></div><blockquote><span>例子</span>{concept.example}</blockquote><button className="save-3d-card" onClick={() => { setSaved(saveCard(concept.title, `${concept.definition}\n\n边界：${concept.excludes.join("、")}`)); setTimeout(() => setSaved(false), 1600); }}>{saved ? "✓ 已保存到我的卡片" : "＋ 制作概念卡"}</button>{mode === "guide" && <div className="panel-actions"><button disabled={guideIndex === 0} onClick={() => { const next = guideIndex - 1; setGuideIndex(next); setSelected(guided[next]); }}>上一个</button><button onClick={() => { if (guideIndex < 5) { const next = guideIndex + 1; setGuideIndex(next); setSelected(guided[next]); } else changeMode("case"); }}>{guideIndex < 5 ? "下一个概念" : "进入案例"}</button></div>}</>}</div>
      </aside>
      <section className="relation-strip" aria-label="概念关系">{innerRelations.map((relation) => <button key={relation.id} onClick={() => choose(innerConcepts.find((item) => item.title === relation.to || (relation.to === "安全感" && item.id === "conversational-safety"))?.id ?? "interpretation")}><b>{relation.from}</b><span>{relation.verb} →</span><b>{relation.to}</b></button>)}</section>
    </div>
  </main>;
}
