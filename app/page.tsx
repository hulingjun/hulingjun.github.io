import {lazy,Suspense,useEffect,useState} from "react";
const SeasonGarden=lazy(()=>import("./garden/SeasonGarden"));
import ArchiveNav from "./shared/ArchiveNav";
import {Archive,Artwork,EMPTY_ARCHIVE,getJson,NEW_NOTE} from "./shared/archive";
import "./shared/archive.css";
type Entry={key:string;title:string;date:string;scope:"mine"|"daughter";kind:string;content?:string;href:string;image?:Artwork};
export default function GrowthHome(){
  const [archive,setArchive]=useState<Archive>(EMPTY_ARCHIVE);
  const [art,setArt]=useState<Artwork[]>([]);
  const [scope,setScope]=useState("all");
  const [state,setState]=useState("loading");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{const c=new AbortController();setState("loading");
    Promise.all([getJson<Archive>("/records/index.json",c.signal),getJson<{artworks:Artwork[]}>("/art-data/manifest.json",c.signal)]).then(([a,b])=>{setArchive(a);setArt(b.artworks);setState("ready")}).catch(e=>{if(e.name!=="AbortError")setState("error")});return ()=>c.abort();
  },[retry]);
  const entries:Entry[]=[
    ...archive.journal.map(j=>({key:"j"+j.id,title:j.title,date:j.date,scope:j.scope,kind:j.scope==="mine"?"成长随记":"她的成长",content:j.content,href:j.sourceUrl} as Entry)),
    ...archive.knowledge.map(k=>({key:"k"+k.id,title:k.title,date:k.date.slice(0,10),scope:"mine",kind:"知识沉淀 · "+k.nodeCount+" 个节点",href:"/knowledge/?cloud="+encodeURIComponent(k.id)} as Entry)),
    ...art.map(a=>({key:"a"+a.id,title:a.title,date:a.date??"",scope:"daughter",kind:"绘画作品",content:a.story,href:"/art/",image:a} as Entry))
  ].filter(e=>scope==="all"||e.scope===scope).sort((a,b)=>b.date.localeCompare(a.date));
  return <div className="archive-page"><ArchiveNav/><main className="archive-main">
    <Suspense fallback={<div style={{minHeight:620,display:"grid",placeItems:"center"}}>正在唤醒四季花园……</div>}><SeasonGarden/></Suspense>

    <div className="archive-lanes"><a className="archive-lane" href="#timeline" onClick={()=>setScope("mine")}><small>01 / MY EVOLUTION</small><h2>我的成长</h2><p>阅读、思考与知识的连接。</p><span className="lane-arrow" aria-hidden="true">↗</span></a><a className="archive-lane" href="/art/"><small>02 / HER UNIVERSE</small><h2>她的成长</h2><p>一幅画，一个故事，一次新的发现。</p><span className="lane-arrow" aria-hidden="true">↗</span></a></div>
    <section id="timeline" aria-labelledby="timeline-heading"><div className="archive-section-heading"><h2 id="timeline-heading">留下的足迹</h2><div className="archive-filters" aria-label="记录分类">{[["all","全部"],["mine","我的成长"],["daughter","她的成长"]].map(([id,label])=><button key={id} aria-pressed={scope===id} onClick={()=>setScope(id)}>{label}</button>)}</div></div>
    {state==="loading"?<p className="archive-status" role="status">正在读取成长档案……</p>:state==="error"?<div className="archive-status" role="alert"><p>记录暂时无法载入，请稍后重试。</p><button onClick={()=>setRetry(r=>r+1)}>重试</button></div>:entries.length?<div className="archive-timeline">{entries.map(e=><article className="archive-entry" key={e.key}><time dateTime={e.date||undefined}>{e.date||"日期未记录"}</time><div><span className="entry-type">{e.kind}</span><h3><a href={e.href}>{e.title}</a></h3>{e.content&&(e.content.length>220?<details><summary>阅读这段记录</summary><p>{e.content}</p></details>:<p>{e.content}</p>)}{e.image&&<a href={e.href}><img src={e.image.thumbnail} width={e.image.width} height={e.image.height} alt={e.title} loading="lazy"/></a>}<a className="entry-link" href={e.href}>{e.kind.startsWith("知识")?"打开知识空间":"查看记录"} ↗</a></div></article>)}</div>:<div className="archive-empty"><h3>从今天开始，留下第一条记录。</h3><p>旧的知识草稿仍在原浏览器中。进入知识空间，提交到 GitHub 后，就会出现在这里。</p><a className="a-button" href={NEW_NOTE}>写一条成长随记 ↗</a></div>}
    </section>
  </main><div className="archive-foot"><span>HJ / GROWTH ARCHIVE · 记录，而非赶路。</span><a href="/knowledge/">我的知识空间 ↗</a></div></div>;
}
