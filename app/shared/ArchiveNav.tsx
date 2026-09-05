export default function ArchiveNav({active="home"}:{active?:"home"|"art"}) {
  return <div className="archive-nav"><a className="archive-brand" href="/">HJ / GROWTH ARCHIVE</a><nav aria-label="主导航"><a href="/" aria-current={active==="home"?"page":undefined}>成长记录</a><a href="/art/" aria-current={active==="art"?"page":undefined}>她的画展</a><a href="/knowledge/">知识空间</a></nav></div>;
}
