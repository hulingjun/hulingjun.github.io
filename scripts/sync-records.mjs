import {mkdir,writeFile,readFile,copyFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {listIssues} from "./build-gallery.mjs";
import {parseRecord} from "./record-model.mjs";
export async function syncRecords(issues,root="."){
  const content=path.join(root,"content"),publicDir=path.join(root,"github-pages/public/records");
  for(const dir of [content,path.join(content,"knowledge"),path.join(content,"journal"),publicDir,path.join(publicDir,"knowledge")])await mkdir(dir,{recursive:true});
  const knowledge=new Map(),journal=[],errors=[];
  for(const issue of issues){
    let r;try{r=parseRecord(issue)}catch(e){errors.push({id:issue.number,message:e.message});continue}
    if(!r)continue;
    if(r.kind==="knowledge"){if(!knowledge.has(r.id)||knowledge.get(r.id).issue<r.issue)knowledge.set(r.id,r)}
    else journal.push(r);
  }
  const index={version:1,knowledge:[],journal:[]};
  for(const r of [...knowledge.values()].sort((a,b)=>a.id.localeCompare(b.id))){
    const name=r.id+".json";const document={version:1,spaceId:r.id,graph:r.graph,issue:r.issue,updatedAt:r.date};
    await writeFile(path.join(content,"knowledge",name),JSON.stringify(document,null,2)+"\n");
    await copyFile(path.join(content,"knowledge",name),path.join(publicDir,"knowledge",name));
    index.knowledge.push({id:r.id,title:r.graph.title,nodeCount:r.graph.nodes.length,date:r.date,issue:r.issue,path:"/records/knowledge/"+name});
  }
  for(const r of journal.sort((a,b)=>b.id-a.id)){
    const {kind,...record}=r;
    await writeFile(path.join(content,"journal",r.id+".json"),JSON.stringify(record,null,2)+"\n");index.journal.push(record);
  }
  await writeFile(path.join(content,"index.json"),JSON.stringify(index,null,2)+"\n");
  await writeFile(path.join(publicDir,"index.json"),JSON.stringify(index,null,2)+"\n");
  const report={errors,publishedIds:[...knowledge.values()].map(r=>r.issue).concat(journal.map(r=>r.id))};
  await writeFile(path.join(root,"records-report.json"),JSON.stringify(report,null,2));
  return report;
}
async function main(){
  const issues=process.env.GALLERY_FIXTURE?JSON.parse(await readFile(process.env.GALLERY_FIXTURE,"utf8")):await listIssues();
  const result=await syncRecords(issues);
  if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,"\n## 成长档案\n"+result.publishedIds.length+" 份记录已准备。\n"+result.errors.map(e=>"- #"+e.id+"："+e.message).join("\n"),{flag:"a"});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))main().catch(e=>{console.error(e.message);process.exitCode=1});
