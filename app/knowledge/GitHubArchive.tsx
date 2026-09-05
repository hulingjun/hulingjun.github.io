import {useEffect,useRef,useState} from "react";
import type {KnowledgeGraph} from "./model";
import {isKnowledgeGraph} from "./model";
import {Archive,getJson,NEW_KNOWLEDGE,KnowledgeRecord} from "../shared/archive";
import "./github-archive.css";
export default function GitHubArchive({graph,spaceId,onLoad}:{graph:KnowledgeGraph;spaceId:string;onLoad:(id:string,graph:KnowledgeGraph)=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const textarea=useRef<HTMLTextAreaElement>(null);
  const [mode,setMode]=useState<"save"|"load">("save");
  const [items,setItems]=useState<KnowledgeRecord[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [payload,setPayload]=useState("");
  const autoOpened=useRef(false);
  async function loadRecord(item:KnowledgeRecord){
    setBusy(true);setMessage("正在读取 GitHub 版本……");
    try{
      const data=await getJson<{spaceId:string;graph:KnowledgeGraph}>(item.path);
      if(!isKnowledgeGraph(data.graph)||data.spaceId!==item.id)throw new Error("知识数据格式不正确");
      onLoad(data.spaceId,data.graph);dialog.current?.close();setMessage("");
    }catch(e){setMessage(e instanceof Error?e.message:"读取失败，请重试");}
    finally{setBusy(false)}
  }
  async function refresh(){
    setBusy(true);setMessage("正在读取已发布空间……");
    try{const data=await getJson<Archive>("/records/index.json");setItems(data.knowledge);setMessage(data.knowledge.length?"":"还没有 GitHub 版本。请先保存一个空间。");return data.knowledge;}
    catch{setMessage("读取失败，请检查网络后重试。");return []}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    if(autoOpened.current||!spaceId)return;
    autoOpened.current=true;
    const id=new URLSearchParams(window.location.search).get("cloud");
    if(id){setMode("load");dialog.current?.showModal();refresh().then(list=>{const item=list.find(k=>k.id===id);if(item)loadRecord(item);else setMessage("此空间暂未发布，或已从网站下架。")})}
  },[spaceId]);
  const beginSave=()=>{
    // Capture a stable snapshot; later canvas edits are not silently included.
    setMode("save");setPayload(JSON.stringify({version:1,spaceId,graph},null,2));setMessage("");dialog.current?.showModal();
  };
  const tooLarge=payload.length>55000;
  return <>
    <button className="cloud-primary" onClick={beginSave} disabled={!spaceId}>保存到 GitHub ↗</button>
    <button onClick={()=>{setMode("load");dialog.current?.showModal();refresh()}}>打开 GitHub 空间</button>
    <dialog ref={dialog} className="github-archive-dialog" aria-labelledby="github-archive-heading">
      <div className="github-archive-head"><h2 id="github-archive-heading">{mode==="save"?"保存这次思考":"我的 GitHub 空间"}</h2><button onClick={()=>dialog.current?.close()} aria-label="关闭 GitHub 面板">关闭 ×</button></div>
      {mode==="save"?<>
        <p>知识会提交到公开的 GitHub 仓库，发布成功后出现在成长记录中。只有 hulingjun 提交的记录会被收录。</p>
        <ol><li>复制下方完整数据。</li><li>打开 GitHub，粘贴到“知识数据”，勾选公开确认并提交。</li><li>等待自动回复确认保存成功。仅复制或打开 GitHub 不代表已保存。</li></ol>
        <textarea ref={textarea} readOnly value={payload} aria-label="待保存的知识数据" onFocus={e=>e.target.select()}/>
        {tooLarge?<p role="alert">这个空间超过单次网页提交容量。请先用“备份 JSON”保留完整数据，再拆分空间提交。当前没有保存到 GitHub。</p>:null}
        <div className="github-archive-actions"><button disabled={tooLarge} onClick={async()=>{try{await navigator.clipboard.writeText(payload);setMessage("已复制。请在 GitHub 粘贴并提交。")}catch{textarea.current?.focus();textarea.current?.select();setMessage("请手动复制选中的数据。")}}}>1. 复制知识数据</button>{!tooLarge&&<a href={NEW_KNOWLEDGE} target="_blank" rel="noreferrer">2. 打开 GitHub 提交 ↗</a>}</div>
        <p className="github-archive-small">同一空间的新提交会成为最新版本。浏览器仅保留恢复草稿；未提交的更改不会跨设备同步。请勿提交隐私、密码或密钥。</p>
      </>:<>
        <p>这里读取的是 GitHub 发布版本。打开时会创建独立草稿，保留当前编辑内容。</p>
        <button disabled={busy} onClick={refresh}>刷新列表</button>
        <div className="github-space-list">{items.map(item=><button key={item.id} disabled={busy} onClick={()=>loadRecord(item)}><b>{item.title}</b><span>{item.nodeCount} 个节点 · {item.date.slice(0,10)}</span></button>)}</div>
        <a href="https://github.com/hulingjun/hulingjun.github.io/tree/main/content/knowledge" target="_blank" rel="noreferrer">查看仓库中的知识文件 ↗</a>
      </>}
      <p role="status">{message}</p>
    </dialog>
  </>;
}
