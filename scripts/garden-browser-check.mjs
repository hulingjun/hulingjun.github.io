import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {join,resolve,extname} from "node:path";
import {createRequire} from "node:module";
import assert from "node:assert/strict";
const require=createRequire(join(resolve(process.env.GALLERY_TOOLS_DIR),"browser.cjs"));
const {chromium}=require("playwright");
const root=resolve("github-dist"),output=resolve("garden-qa");await mkdir(output,{recursive:true});
const types={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".webp":"image/webp"};
const server=createServer(async(req,res)=>{
 try{
  let path=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  if(path.endsWith("/"))path+="index.html";
  const file=resolve(root,"."+path);if(!file.startsWith(root+"/"))throw Error("path");
  const data=await readFile(file);res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream"});res.end(data);
 }catch{res.writeHead(404);res.end("Not found");}
});
await new Promise(r=>server.listen(4173,"127.0.0.1",r));
const browser=await chromium.launch({headless:true,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"]});
const errors=[],results=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1080},deviceScaleFactor:1,reducedMotion:"reduce"});
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error"&&!m.text().includes("favicon"))errors.push(m.text());});
 await page.goto("http://127.0.0.1:4173/",{waitUntil:"networkidle"});
 await page.locator('.season-garden[data-status="ready"]').waitFor({timeout:90000});
 const scene=page.locator(".garden-canvas");
 assert.equal(await page.getByRole("button",{name:"播放天气",exact:true}).count(),1);
 for(const style of ["写实","动漫","水墨"]){
  await page.getByRole("group",{name:"选择画风"}).getByRole("button",{name:style}).click();
  for(const [i,season] of ["春","夏","秋","冬"].entries()){
   await page.getByRole("group",{name:"选择季节"}).getByRole("button",{name:season,exact:true}).click();
   await page.waitForFunction(s=>document.querySelector(".garden-canvas")?.dataset.season===s,season);
   await page.waitForTimeout(300);
   assert.equal(await scene.getAttribute("data-season-mix"),"0.0000");
   assert.equal(await page.locator(".garden-season strong").textContent(),season);
   await page.screenshot({path:join(output,style+"-"+i+".png")});
   results.push(style+" / "+season+" label and scene agree");
  }
 }
 await page.getByRole("group",{name:"选择画风"}).getByRole("button",{name:"写实"}).click();
 await page.getByRole("group",{name:"选择季节"}).getByRole("button",{name:"秋",exact:true}).click();
 const box=await scene.boundingBox(),x=box.x+box.width*.54,y=box.y+box.height*.48;
 const camera=()=>scene.getAttribute("data-camera");
 const before=await camera(),weather=await scene.getAttribute("data-weather-time");
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+180,y+45,{steps:16});await page.mouse.up();await page.waitForTimeout(800);
 assert.notEqual(await camera(),before,"Mouse drag rotates camera while weather paused");
 const rotated=await camera();await page.mouse.wheel(0,-380);await page.waitForTimeout(800);assert.notEqual(await camera(),rotated,"Wheel zoom");
 const zoomed=await camera();await page.mouse.move(x,y);await page.mouse.down({button:"right"});await page.mouse.move(x+70,y+20,{steps:8});await page.mouse.up({button:"right"});await page.waitForTimeout(800);
 assert.notEqual(await camera(),zoomed,"Right-drag pans");
 assert.equal(await scene.getAttribute("data-weather-time"),weather,"Pause freezes weather but not camera");
 await page.getByRole("button",{name:"恢复视角",exact:true}).click();await page.waitForTimeout(800);
 await page.screenshot({path:join(output,"camera-reset.png")});
 assert.equal(await camera(),before,"Reset returns to exact home view");
 results.push("Desktop: drag rotate, wheel zoom, right pan, exact reset, paused interaction");
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // Mobile uses real Chromium touch events, not synthetic mouse aliases.
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:"reduce"});
 const mp=await mobile.newPage();mp.on("pageerror",e=>errors.push(e.message));
 await mp.goto("http://127.0.0.1:4173/",{waitUntil:"networkidle"});
 await mp.locator('.season-garden[data-status="ready"]').waitFor({timeout:90000});
 const ms=mp.locator(".garden-canvas"),mb=await ms.boundingBox(),client=await mobile.newCDPSession(mp);
 const mx=mb.x+195,my=mb.y+350;
 const mbefore=await ms.getAttribute("data-camera");
 await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:mx,y:my,id:1}]});
 for(let i=1;i<=8;i++)await client.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:mx+i*10,y:my+i*2,id:1}]});
 await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await mp.waitForTimeout(800);
 assert.notEqual(await ms.getAttribute("data-camera"),mbefore,"Mobile single finger rotation");
 const mrotated=await ms.getAttribute("data-camera");
 await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:mx-35,y:my,id:1},{x:mx+35,y:my,id:2}]});
 for(let i=1;i<=7;i++)await client.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:mx-35-i*6,y:my,id:1},{x:mx+35+i*6,y:my,id:2}]});
 await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await mp.waitForTimeout(800);
 assert.notEqual(await ms.getAttribute("data-camera"),mrotated,"Mobile pinch zoom");
 await mp.getByRole("button",{name:"恢复视角",exact:true}).click();await mp.waitForTimeout(800);
 for(const style of ["写实","动漫","水墨"]){
  await mp.getByRole("group",{name:"选择画风"}).getByRole("button",{name:style}).click();
  await mp.waitForTimeout(400);await mp.screenshot({path:join(output,"mobile-"+style+".png")});
 }
 assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,"No horizontal overflow");
 results.push("Mobile: touch rotation, pinch zoom, all styles, no horizontal overflow");
 assert.deepEqual(errors,[],"No runtime or WebGL shader errors");
 await writeFile(join(output,"report.json"),JSON.stringify({passed:true,results,errors},null,2));
 console.log(JSON.stringify({passed:true,results},null,2));
}finally{
 await writeFile(join(output,"errors.json"),JSON.stringify(errors,null,2));
 await browser.close();await new Promise(r=>server.close(r));
}
