import {useEffect,useRef,useState} from "react";
import {NEW_NOTE} from "../shared/archive";
import {SEASONS,SEASON_DURATION_SECONDS,sampleSeason} from "./seasons.mjs";
import "./garden.css";
const STYLES=[{id:"real",name:"写实",description:"自然光 · 真实纹理"},{id:"anime",name:"动漫",description:"赛璐璐 · 明快色层"},{id:"ink",name:"水墨",description:"淡墨远山 · 宣纸留白"}];
export default function SeasonGarden(){
 const host=useRef<HTMLDivElement>(null);
 const control=useRef({elapsed:0,automatic:true,paused:false,style:"real",revision:0,reset:0});
 const [season,setSeason]=useState(sampleSeason(0));
 const [automatic,setAutomatic]=useState(true),[paused,setPaused]=useState(false),[style,setStyle]=useState("real");
 const [status,setStatus]=useState("loading"),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let disposed=false,cleanup=()=>{};
  const reduce=matchMedia("(prefers-reduced-motion: reduce)");
  if(reduce.matches){control.current.paused=true;setPaused(true);}
  async function initialize(){
   const [T,model,{OrbitControls},{createPresentation}]=await Promise.all([
    import("three"),import("./world.mjs"),import("three/addons/controls/OrbitControls.js"),import("./presentation.mjs")
   ]);
   const assets=await model.loadGardenAssets();
   if(disposed||!host.current){Object.values(assets).forEach((t:any)=>t.dispose());return;}
   const element=host.current,low=matchMedia("(max-width: 700px)").matches;
   let renderer:any,world:any,orbit:any,presentation:any;
   let frame=0,last=0,time=0,dirty=true,inFrame=false,inView=true,visible=!document.hidden,lostContext=false;
   let previousRevision=-1,previousReset=control.current.reset,previousLabel="",lastRender=0;
   const listeners:Array<()=>void>=[];
   cleanup=()=>{
    cancelAnimationFrame(frame);listeners.forEach(fn=>fn());
    orbit?.dispose();presentation?.dispose();
    if(world)model.disposeGarden(world);else Object.values(assets).forEach((t:any)=>t.dispose());
    renderer?.dispose();renderer?.domElement.remove();
   };
   renderer=new T.WebGLRenderer({antialias:!low,alpha:false,powerPreference:"high-performance"});
   renderer.setPixelRatio(Math.min(devicePixelRatio,low?1.25:1.75));
   renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
   const canvas=renderer.domElement;
   canvas.tabIndex=0;canvas.setAttribute("role","img");canvas.setAttribute("aria-label","可交互四季花园。拖动旋转，滚轮缩放，双指缩放和平移。");
   element.appendChild(canvas);
   const camera=new T.PerspectiveCamera(40,1,.2,250);
   world=model.buildGarden(low,assets);
   orbit=new OrbitControls(camera,canvas);orbit.enableDamping=!control.current.paused;orbit.dampingFactor=.16;
   orbit.rotateSpeed=.55;orbit.zoomSpeed=.75;orbit.panSpeed=.55;orbit.screenSpacePanning=false;
   orbit.minDistance=7;orbit.maxDistance=38;orbit.minPolarAngle=.25;orbit.maxPolarAngle=Math.PI*.485;
   orbit.cursor.set(0,2.4,0);orbit.maxTargetRadius=4;orbit.target.copy(orbit.cursor);
   orbit.listenToKeyEvents(canvas);
   presentation=createPresentation(renderer,world.scene,camera);
   const home=()=>{
    const damping=orbit.enableDamping;orbit.enableDamping=false;orbit.update();
    const distance=Math.max(19,11/(2*Math.tan(Math.PI/9)*camera.aspect));
    orbit.target.set(0,2.4,0);camera.position.set(distance*.12,2.4+distance*.15,distance);
    orbit.update();orbit.saveState();orbit.enableDamping=damping;dirty=true;
   };
   const resize=()=>{
    const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);presentation.resize(w,h);
    dirty=true;start();
   };
   function start(){if(!frame&&!disposed&&!lostContext&&visible&&inView)frame=requestAnimationFrame(render);}
   function wake(){dirty=true;if(!inFrame)start();}
   function render(now:number){
    frame=0;if(disposed||lostContext||!visible||!inView)return;inFrame=true;
    const c=control.current,dt=last?Math.min((now-last)/1000,.05):0;last=now;
    if(!c.paused){time+=dt;if(c.automatic)c.elapsed+=dt;}
    if(c.revision!==previousRevision){
     previousRevision=c.revision;dirty=true;
     if(world.style!==c.style){model.setGardenStyle(world,c.style);presentation.setStyle(c.style);}
     if(c.reset!==previousReset){previousReset=c.reset;home();}
    }
    orbit.enableDamping=!c.paused&&!reduce.matches;
    renderer.shadowMap.autoUpdate=!c.paused;
    if(dirty)renderer.shadowMap.needsUpdate=true;
    const changed=orbit.update();
    if(changed)dirty=true;
    if(dirty||(!c.paused&&now-lastRender>(low?33:24))){
     const sampled=sampleSeason(c.elapsed);
     model.updateGarden(world,sampled,time);
     presentation.render();
     const labelKey=sampled.from+":"+sampled.to;
     if(labelKey!==previousLabel){previousLabel=labelKey;setSeason(sampled);}
     element.dataset.season=sampled.label;
     element.dataset.seasonMix=sampled.mix.toFixed(4);
     element.dataset.weatherTime=time.toFixed(3);
     element.dataset.camera=camera.position.toArray().concat(orbit.target.toArray()).map((n:number)=>n.toFixed(3)).join(",");
     dirty=false;lastRender=now;
    }
    inFrame=false;
    if(!c.paused||changed||dirty)start();
   }
   resize();home();
   const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(element);listeners.push(()=>sizeObserver.disconnect());
   const intersection=new IntersectionObserver(entries=>{
    inView=entries[0].isIntersecting;
    if(inView){last=0;wake();}else{cancelAnimationFrame(frame);frame=0;}
   },{threshold:.01});intersection.observe(element);listeners.push(()=>intersection.disconnect());
   const visibility=()=>{visible=!document.hidden;if(visible){last=0;wake();}else{cancelAnimationFrame(frame);frame=0;}};
   const motion=()=>{if(reduce.matches){control.current.paused=true;setPaused(true);wake();}};
   const lost=(event:Event)=>{event.preventDefault();lostContext=true;cancelAnimationFrame(frame);frame=0;setStatus("fallback");};
   const focus=()=>canvas.focus({preventScroll:true});
   document.addEventListener("visibilitychange",visibility);reduce.addEventListener("change",motion);
   canvas.addEventListener("webglcontextlost",lost);canvas.addEventListener("pointerdown",focus);
   orbit.addEventListener("change",wake);element.addEventListener("garden-control",wake);
   listeners.push(()=>document.removeEventListener("visibilitychange",visibility),()=>reduce.removeEventListener("change",motion),
    ()=>canvas.removeEventListener("webglcontextlost",lost),()=>canvas.removeEventListener("pointerdown",focus),
    ()=>orbit.removeEventListener("change",wake),()=>element.removeEventListener("garden-control",wake));
   start();setStatus("ready");
  }
  initialize().catch(error=>{cleanup();if(!disposed){console.error("Garden initialization failed",error);setStatus("fallback");}});
  return()=>{disposed=true;cleanup();};
 },[retry]);
 function change(values:Partial<typeof control.current>){Object.assign(control.current,values);control.current.revision++;host.current?.dispatchEvent(new Event("garden-control"));}
 function select(i:number){const elapsed=i*SEASON_DURATION_SECONDS;setSeason(sampleSeason(elapsed));setAutomatic(false);change({elapsed,automatic:false});}
 function chooseStyle(id:string){setStyle(id);change({style:id});}
 return <><section className={"season-garden garden-"+style} aria-label="四季成长花园" data-status={status}>
  <div className="garden-canvas" ref={host}/>
  <div className="garden-vignette" aria-hidden="true"/>
  <header className="garden-heading"><p>THE ART OF GROWING</p><h1>一起生长，穿过四季。</h1><span>我的思考，她的世界。</span></header>
  <div className="garden-season" aria-live="polite"><span>{season.transitioning?"SEASON IN TRANSITION":SEASONS[season.from].en}</span><strong>{season.label}</strong><p>{season.transitioning?"四季，正在交接。":SEASONS[season.from].note}</p></div>
  <div className="garden-style-switch" role="group" aria-label="选择画风">{STYLES.map(s=><button key={s.id} aria-pressed={style===s.id} onClick={()=>chooseStyle(s.id)}><span>{s.name}</span><small>{s.description}</small></button>)}</div>
  {status!=="ready"&&<div className="garden-fallback" role="status"><p>{status==="loading"?"正在载入树木材质与自然光……":"3D 场景暂时无法载入，成长记录仍可正常使用。"}</p>{status==="fallback"&&<button onClick={()=>{setStatus("loading");setRetry(v=>v+1);}}>重新载入场景</button>}</div>}
  <div className="garden-bottom">
   <p className="garden-gesture">拖动旋转 · 滚轮缩放 · 右键平移<span>手机：单指旋转 · 双指缩放 / 平移</span></p>
   <div className="garden-toolbar"><div role="group" aria-label="选择季节">{SEASONS.map((s,i)=><button key={s.id} aria-pressed={season.from===i&&!season.transitioning} onClick={()=>select(i)}>{s.name}</button>)}</div>
    <button aria-pressed={automatic} onClick={()=>{setAutomatic(!automatic);change({automatic:!automatic});}}>四季流转</button>
    <button aria-pressed={paused} onClick={()=>{setPaused(!paused);change({paused:!paused});}}>{paused?"播放天气":"暂停天气"}</button>
    <button onClick={()=>change({reset:control.current.reset+1})}>恢复视角</button>
   </div>
   <div className="garden-footnote"><span>两棵树，两段持续生长的人生。</span><a href="/garden-assets/credits.json" target="_blank" rel="noreferrer">材质来源 ↗</a></div>
  </div>
 </section>
 <div className="garden-record-actions"><a className="a-button primary" href={NEW_NOTE}>＋ 记录此刻</a><a className="a-button" href="/art/">走进她的画展 ↗</a><a className="garden-timeline-link" href="#timeline">查看成长记录 ↓</a></div>
 </>;
}
