import {createServer} from "vite";
import {writeFile,mkdir,unlink,readFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
import assert from "node:assert/strict";
const require=createRequire(join(resolve(process.env.GALLERY_TOOLS_DIR),"perf.cjs"));
const {chromium}=require("playwright"),sharp=require("sharp");
const baselineCommit="4f28563b02b9afaa30ccd76eb0c3a5ce9c7fb1dc";
const baselinePath=resolve("scripts/.garden-perf-baseline.mjs"),output=resolve("garden-qa/performance");
await mkdir(output,{recursive:true});
await writeFile(baselinePath,execFileSync("git",["show",baselineCommit+":app/garden/world.mjs"]));
const server=await createServer({configFile:false,root:process.cwd(),publicDir:resolve("github-pages/public"),server:{host:"127.0.0.1",port:4174,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"]});
const results={},errors=[];
try{
 for(const [name,module] of [["before","/scripts/.garden-perf-baseline.mjs"],["after","/app/garden/world.mjs"]]){
  const context=await browser.newContext({viewport:{width:1000,height:700},deviceScaleFactor:1});
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:4174/scripts/garden-perf.html?model="+encodeURIComponent(module),{waitUntil:"networkidle"});
  await page.waitForFunction(()=>window.ready,{},{timeout:120000});
  const inventory=await page.evaluate(()=>window.inventory()),cpu=await page.evaluate(()=>window.cpuMeasure()),frames=[];
  for(const [label,view,season,mix] of [["summer-home","overview",1,0],["summer-detail","detail",1,0],["summer-edge","edge",1,0],["winter-detail","detail",3,0],["transition-detail","detail",0,.5]]){
   frames.push({label,...await page.evaluate(args=>window.measure(...args),[view,season,mix])});
   await page.screenshot({path:join(output,name+"-"+label+".png"),timeout:90000});
  }
  results[name]={inventory,cpu,frames};await context.close();
 }
 const comparisons=[];
 for(let i=0;i<results.before.frames.length;i++){
  const a=results.before.frames[i],b=results.after.frames[i],label=a.label;
  const imageA=await sharp(join(output,"before-"+label+".png")).removeAlpha().raw().toBuffer();
  const imageB=await sharp(join(output,"after-"+label+".png")).removeAlpha().raw().toBuffer();
  assert.equal(imageA.length,imageB.length);
  let sum=0,large=0;for(let j=0;j<imageA.length;j++){const d=Math.abs(imageA[j]-imageB[j]);sum+=d;if(d>12)large++;}
  const meanPixelDifference=sum/imageA.length,fractionOver12=large/imageA.length;
  comparisons.push({label,frameSpeedup:a.completedFrameMs.p50/b.completedFrameMs.p50,trianglesBefore:a.draw.triangles,trianglesAfter:b.draw.triangles,meanPixelDifference,fractionOver12});
  assert.ok(meanPixelDifference<1.2&&fractionOver12<.018,"No lost detail or shadows in "+label);
 }
 assert.deepEqual(results.after.inventory,results.before.inventory,"All allocated geometry, instances and quality settings are unchanged");
 assert.ok(results.after.cpu.paused.p50<results.before.cpu.paused.p50*.5,"Paused camera redraw skips simulation");
 assert.ok(comparisons.find(x=>x.label==="summer-detail").trianglesAfter<comparisons.find(x=>x.label==="summer-detail").trianglesBefore,"Close-up omits only frustum-invisible instances");
 assert.deepEqual(errors,[]);
 await writeFile(join(output,"report.json"),JSON.stringify({passed:true,baselineCommit,results,comparisons,errors},null,2));
 console.log(JSON.stringify({passed:true,comparisons,cpu:results.after.cpu},null,2));
}finally{
 await writeFile(join(output,"raw-results.json"),JSON.stringify({results,errors},null,2));
 await browser.close();await server.close();await unlink(baselinePath);
}
