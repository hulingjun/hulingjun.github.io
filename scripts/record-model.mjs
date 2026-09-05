import { OWNER_ID, section } from "./gallery-model.mjs";
export const RECORD_CONSENT="我确认这份记录可以在公开网站和 GitHub 仓库中展示。";
const EXCLUDED=/贝贝|王洁|营养师|瑜伽|普拉提/;
export function allowedContent(value){return !EXCLUDED.test(value);}
export function cleanGraph(raw){
  if(!raw||raw.version!==1||typeof raw.title!=="string"||!raw.title.trim()||raw.title.length>120||!Array.isArray(raw.nodes)||!Array.isArray(raw.relations)||raw.nodes.length>2000||raw.relations.length>6000)throw new Error("知识数据格式不正确或超过 2000 节点 / 6000 关系");
  const ids=new Set();
  const nodes=raw.nodes.map(n=>{
    if(!n||typeof n.id!=="string"||n.id.length>120||!n.id||ids.has(n.id)||typeof n.text!=="string"||n.text.length>12000||!Number.isFinite(n.position?.x)||!Number.isFinite(n.position?.y)||Math.abs(n.position.x)>1e7||Math.abs(n.position.y)>1e7)throw new Error("知识节点不合法或 ID 重复");
    ids.add(n.id);return{id:n.id,text:n.text,position:{x:n.position.x,y:n.position.y}};
  });
  const edgeIds=new Set(),handles=[null,undefined,"left","right","top","bottom"];
  const relations=raw.relations.map(r=>{
    if(!r||typeof r.id!=="string"||!r.id||r.id.length>120||edgeIds.has(r.id)||!ids.has(r.sourceId)||!ids.has(r.targetId)||typeof r.label!=="string"||r.label.length>2000||!handles.includes(r.sourceHandle)||!handles.includes(r.targetHandle))throw new Error("知识关系引用或连接点不合法");
    edgeIds.add(r.id);return{id:r.id,sourceId:r.sourceId,targetId:r.targetId,label:r.label,sourceHandle:r.sourceHandle??null,targetHandle:r.targetHandle??null};
  });
  return{version:1,title:raw.title,nodes,relations};
}
export function parseRecord(issue){
  if(issue.pull_request||issue.state!=="open"||issue.user?.id!==OWNER_ID)return null;
  const knowledge=issue.title?.startsWith("[知识]"),journal=issue.title?.startsWith("[成长]");
  if(!knowledge&&!journal)return null;
  if(!Number.isSafeInteger(issue.number)||issue.number<1)throw new Error("记录编号无效");
  const confirmation=section(issue.body,"公开确认");
  if(!confirmation.includes("- [x] "+RECORD_CONSENT)&&!confirmation.includes("- [X] "+RECORD_CONSENT))throw new Error("请勾选公开确认");
  if(knowledge){
    const text=section(issue.body,"知识数据").replace(/^```(?:json)?\s*\n?/,"").replace(/\n?```$/,"").trim();
    let data;try{data=JSON.parse(text)}catch{throw new Error("知识数据必须是从编辑器复制的完整 JSON")}
    if(data.version!==1||typeof data.spaceId!=="string"||!/^[a-zA-Z0-9_-]{1,80}$/.test(data.spaceId))throw new Error("空间编号不合法");
    const graph=cleanGraph(data.graph);
    if(!allowedContent(JSON.stringify(graph)))throw new Error("这份内容属于已屏蔽的项目或主题，不会公开收录");
    return{kind:"knowledge",id:data.spaceId,graph,issue:issue.number,date:issue.updated_at};
  }
  const title=section(issue.body,"记录标题"),date=section(issue.body,"记录日期"),content=section(issue.body,"记录正文"),category=section(issue.body,"记录归属");
  if(!title||title.length>120||title.includes("\n")||!content||content.length>10000)throw new Error("标题限 120 字，正文限 10000 字，均不能为空");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error("请填写有效的 YYYY-MM-DD 日期");
  if(!["我的成长","女儿的成长"].includes(category))throw new Error("请选择记录归属");
  if(!allowedContent(title+"\n"+content))throw new Error("这份内容属于已屏蔽的项目或主题，不会公开收录");
  return{kind:"journal",id:issue.number,title,date,scope:category==="我的成长"?"mine":"daughter",content,sourceUrl:"https://github.com/hulingjun/hulingjun.github.io/issues/"+issue.number};
}
