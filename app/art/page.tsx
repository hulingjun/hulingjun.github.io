import {useEffect,useRef,useState} from "react";
import {Artwork,getJson,UPLOAD_ART} from "../shared/archive";
import ArchiveNav from "../shared/ArchiveNav";
import "../shared/archive.css";

function ArtImage({art}:{art:Artwork}) {
  const [error,setError]=useState(false);
  return error?<span className="art-image-error">图片暂时无法显示，请刷新重试</span>:<img src={art.thumbnail} alt={art.title} width={art.width} height={art.height} loading="lazy" decoding="async" onError={()=>setError(true)}/>;
}
export default function ArtGallery() {
  const [artworks,setArtworks]=useState<Artwork[]>([]);
  const [status,setStatus]=useState("loading");
  const [year,setYear]=useState("all");
  const [selected,setSelected]=useState<Artwork|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setStatus("loading");
    getJson<{artworks:Artwork[]}>("/art-data/manifest.json",controller.signal).then(data=>{setArtworks(data.artworks);setStatus("ready");}).catch(e=>{if(e.name!=="AbortError")setStatus("error")});
    return ()=>controller.abort();
  },[retry]);
  useEffect(()=>{if(selected)dialog.current?.showModal();else dialog.current?.close()},[selected]);
  const years=[...new Set(artworks.map(a=>a.date?.slice(0,4)).filter(Boolean))].sort().reverse();
  const visible=artworks.filter(a=>year==="all"||a.date?.startsWith(year));
  return <div className="archive-page"><ArchiveNav active="art"/><main className="archive-main">
    <header className="archive-intro"><div><p className="a-kicker">HER GROWTH / ARTWORKS</p><h1>她眼中的世界。</h1><p>把每一次落笔，留在成长的时间里。</p></div><a className="a-button primary" href={UPLOAD_ART}>＋ 上传作品</a></header>
    <details className="art-help"><summary>怎样上传、修改和下架作品？</summary><ol><li>先用手机拍下画作，再点击“上传作品”，在 GitHub 登录 hulingjun 账号。</li><li>填写标题、日期，在“作品图片”中选择相册照片，勾选公开确认后提交。一次提交一幅画。</li><li>通常几分钟后会自动发布。记录下方的回复会告诉你发布结果。</li><li>编辑原记录可修改作品，关闭原记录可下架，重新打开可恢复。</li></ol><p>支持 JPG、PNG、WebP、GIF（首帧），最大 10 MB；HEIC 请先转为 JPG。作品保持原比例，不裁切。</p><p>GitHub 原始附件是公开的，请先裁掉姓名、学校、住址，并移除照片位置。网站处理版会清除元数据；下架不等于删除原始附件。</p><a href="https://github.com/hulingjun/hulingjun.github.io/issues?q=is%3Aissue+author%3Ahulingjun+%22%5B%E7%94%BB%E4%BD%9C%5D%22">管理我的作品 ↗</a></details>
    <div className="archive-section-heading"><h2>绘画作品 <span className="a-kicker">{artworks.length ? String(artworks.length).padStart(2,"0") : ""}</span></h2><div className="archive-filters" aria-label="按年份查看"><button aria-pressed={year==="all"} onClick={()=>setYear("all")}>全部</button>{years.map(y=><button key={y} aria-pressed={year===y} onClick={()=>setYear(y!)}>{y}</button>)}</div></div>
    {status==="loading"?<p className="archive-status" role="status">正在打开画展……</p>:status==="error"?<div className="archive-status" role="alert"><p>画展暂时无法载入，作品不会因此丢失。</p><button onClick={()=>setRetry(r=>r+1)}>重试</button></div>:visible.length?<div className="art-grid">{visible.map(art=><article className="art-card" key={art.id}><button className="art-open" aria-label={"放大查看："+art.title} onClick={()=>setSelected(art)}><ArtImage art={art}/></button><h2>{art.title}</h2><time dateTime={art.date??undefined}>{art.date??"创作日期未记录"}</time>{art.story&&<p>{art.story}</p>}</article>)}</div>:<div className="archive-empty"><h3>{artworks.length?"这一年还没有作品":"第一幅画，从这里留下。"}</h3><p>不需要画得完美，每一幅都值得留存。</p><a className="a-button primary" href={UPLOAD_ART}>上传第一幅作品 ↗</a></div>}
    <dialog className="art-dialog" ref={dialog} onClose={()=>setSelected(null)} onClick={e=>{if(e.target===e.currentTarget)setSelected(null)}} aria-labelledby="art-title">
      {selected&&<><div className="art-dialog-head"><div><h2 id="art-title">{selected.title}</h2><time>{selected.date??"创作日期未记录"}</time></div><button autoFocus aria-label="关闭大图" onClick={()=>setSelected(null)}>关闭 ×</button></div><img src={selected.image} alt={selected.title} width={selected.width} height={selected.height}/>{selected.story&&<p>{selected.story}</p>}<a href={selected.sourceUrl}>查看 / 管理作品记录 ↗</a></>}
    </dialog>
  </main><div className="archive-foot"><span>HJ / 她的成长档案</span><a href="/">返回成长记录 ↗</a></div></div>;
}
