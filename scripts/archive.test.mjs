import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {CONSENT,OWNER_ID,MAX_BYTES,parseArtwork,safeAssetUrl,downloadImage} from "./gallery-model.mjs";
import {buildGallery,listIssues,transformImage} from "./build-gallery.mjs";
import {cleanGraph,parseRecord,RECORD_CONSENT,allowedContent} from "./record-model.mjs";
import {syncRecords} from "./sync-records.mjs";
const sharp=createRequire(path.join(process.env.GALLERY_TOOLS_DIR,"package.json"))("sharp");
const url="https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111";
const art=()=>({number:7,title:"[画作] 测试",state:"open",user:{id:OWNER_ID},body:"### 作品名称\n测试图片\n\n### 创作日期\n2026-09-05\n\n### 作品图片\n![photo]("+url+")\n\n### 作品故事\n文字不是 HTML：<script>alert(1)</script>\n\n### 公开确认\n- [x] "+CONSENT});
const graph=()=>({version:1,title:"阅读笔记",nodes:[{id:"n1",text:"事实",position:{x:1,y:2}},{id:"n2",text:"解释",position:{x:200,y:2}}],relations:[{id:"e",sourceId:"n1",targetId:"n2",label:"",sourceHandle:"right",targetHandle:"left"}]});
const knowledge=(number=20)=>({number,state:"open",title:"[知识] 测试",user:{id:OWNER_ID},updated_at:"2026-09-05T12:00:00Z",body:"### 知识数据\n"+JSON.stringify({version:1,spaceId:"test-space",graph:graph()})+"\n\n### 公开确认\n- [x] "+RECORD_CONSENT});
test("owner-only publication and consent",()=>{
  assert.equal(parseArtwork({...art(),user:{id:1}}),null);
  assert.equal(parseArtwork({...art(),state:"closed"}),null);
  assert.equal(parseArtwork({...art(),pull_request:{}}),null);
  assert.throws(()=>parseArtwork({...art(),body:art().body.replace("[x]","[ ]")}));
  assert.equal(parseArtwork(art()).id,7);
});
test("date validity, unknown date and HTML image markup",()=>{
  assert.throws(()=>parseArtwork({...art(),body:art().body.replace("2026-09-05","2026-02-30")}));
  assert.equal(parseArtwork({...art(),body:art().body.replace("2026-09-05","_No response_")}).date,null);
  assert.equal(parseArtwork({...art(),body:art().body.replace("![photo]("+url+")",'<img width="100" src="'+url+'" />')}).assetUrl,url);
});
test("reject SSRF, credentials, unexpected ports and hosts",()=>{
  for(const u of ["http://127.0.0.1","https://github.com.evil.test/a","https://github.com/login","https://user:password@github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111","https://github.com:444/user-attachments/assets/11111111-1111-1111-1111-111111111111"])assert.throws(()=>safeAssetUrl(u));
});
test("image download rejects external redirect, oversized and wrong mime",async()=>{
  await assert.rejects(()=>downloadImage(url,async()=>new Response(null,{status:302,headers:{location:"http://127.0.0.1"}})));
  await assert.rejects(()=>downloadImage(url,async()=>new Response("html",{headers:{"content-type":"text/html"}})));
  await assert.rejects(()=>downloadImage(url,async()=>new Response("x",{headers:{"content-type":"image/png","content-length":String(MAX_BYTES+1)}})));
  await assert.rejects(()=>downloadImage(url,async()=>new Response(new Uint8Array(MAX_BYTES+1),{headers:{"content-type":"image/png"}})));
});
test("API pagination and errors do not silently create empty gallery",async()=>{
  let calls=0;
  const result=await listIssues(async()=>new Response(JSON.stringify(++calls===1?Array.from({length:100},(_,i)=>({number:i})):[])),null);
  assert.equal(result.length,100);assert.equal(calls,2);
  await assert.rejects(()=>listIssues(async()=>new Response("",{status:500}),null));
});
test("real image pipeline preserves portrait / landscape / square and removes EXIF",async()=>{
  for(const [width,height] of [[600,1200],[1200,600],[600,600]]){
    const input=await sharp({create:{width,height,channels:3,background:"#123456"}}).jpeg().withMetadata().toBuffer();
    const out=await transformImage(input,sharp);
    assert.equal(out.full.info.width/out.full.info.height,width/height);
    const meta=await sharp(out.full.data).metadata();assert.equal(meta.exif,undefined);assert.equal(meta.format,"webp");
  }
});
test("gallery integration generates local assets and manifest, excludes strangers",async()=>{
  const output=await mkdtemp(path.join(os.tmpdir(),"gallery-test-"));
  const png=await sharp({create:{width:200,height:400,channels:3,background:"#123456"}}).png().toBuffer();
  const report=await buildGallery({issues:[art(),{...art(),number:8,user:{id:1}}],output,sharp,fetcher:async()=>new Response(png,{headers:{"content-type":"image/png"}})});
  const manifest=JSON.parse(await readFile(path.join(output,"manifest.json"),"utf8"));
  assert.equal(report.count,1);assert.equal(manifest.artworks[0].height,400);
  assert.ok(manifest.artworks[0].image.startsWith("/art-data/images/7-"));
  assert.ok(!("assetUrl" in manifest.artworks[0]));
});
test("graph validates references, finite positions and unique ids",()=>{
  assert.equal(cleanGraph(graph()).nodes.length,2);
  const g=graph();g.nodes[0].position.x=Infinity;assert.throws(()=>cleanGraph(g));
  const dup=graph();dup.nodes.push(dup.nodes[0]);assert.throws(()=>cleanGraph(dup));
  const bad=graph();bad.relations[0].targetId="missing";assert.throws(()=>cleanGraph(bad));
  assert.equal(parseRecord({...knowledge(),user:{id:1}}),null);
  assert.throws(()=>parseRecord({...knowledge(),body:knowledge().body.replace("test-space","../escape")}));
});
test("excluded projects are not included in public records",()=>{
  for(const term of ["贝贝","王洁","营养师","瑜伽","普拉提"])assert.equal(allowedContent(term),false);
  assert.throws(()=>parseRecord({...knowledge(),body:knowledge().body.replace("阅读笔记","普拉提")}));
});
test("knowledge is written to repository content and newest snapshot wins",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"records-test-"));
  const newer=knowledge(21);newer.body=newer.body.replace("阅读笔记","新的理解");
  await syncRecords([knowledge(20),newer],root);
  const saved=JSON.parse(await readFile(path.join(root,"content/knowledge/test-space.json"),"utf8"));
  assert.equal(saved.graph.title,"新的理解");assert.equal(saved.issue,21);
  const index=JSON.parse(await readFile(path.join(root,"github-pages/public/records/index.json"),"utf8"));
  assert.equal(index.knowledge.length,1);
  await syncRecords([{...knowledge(),state:"closed"}],root);
  const empty=JSON.parse(await readFile(path.join(root,"content/index.json"),"utf8"));
  assert.equal(empty.knowledge.length,0);
  assert.equal(JSON.parse(await readFile(path.join(root,"content/knowledge/test-space.json"),"utf8")).graph.title,"新的理解");
});
