import {useEffect,useRef,useState} from "react";
import {NEW_NOTE} from "../shared/archive";
import {SEASONS} from "./seasons.mjs";
import "./garden.css";
export default function SeasonGarden(){
 const host=useRef<HTMLDivElement>(null);
 const control=useRef({season:0,automatic:true,paused:false,revision:0});
 const [season,setSeason]=useState(0),[automatic,setAutomatic]=useState(true),[paused,setPaused]=useState(false),[status,setStatus]=useState("loading");
 useEffect(()=>{
  let disposed=false,cleanup=()=>{};
  const reduce=matchMedia("(prefers-reduced-motion: reduce)");
  if(reduce.matches){control.current.paused=true;setPaused(true)}
  Promise.all([import("three"),import("./world.mjs")]).then(([T,model])=>{
   if(disposed||!host.current)return;
   const element=host.current;
   let renderer;
   try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"low-power"});}
   catch{setStatus("fallback");return;}
   const low=matchMedia("(max-width: 700px)").matches;
   renderer.setPixelRatio(Math.min(devicePixelRatio,low?1.25:1.65));
   renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
   element.appendChild(renderer.domElement);renderer.domElement.setAttribute("aria-hidden","true");
   const camera=new T.PerspectiveCamera(40,1,.1,80);
   const world=model.buildGarden(low);
   let frame=0,last=0,time=0,current=0,previousRevision=-1,visible=true,inView=true,dirty=true,lastRender=0;
   const pointer={x:0,y:0};
   const resize=()=>{const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.position.set(0,3.5,Math.max(12.5,8.6/(2*Math.tan(Math.PI/9)*camera.aspect)));camera.lookAt(0,1,0);camera.updateProjectionMatrix();dirty=true;};
   const observer=new ResizeObserver(resize);observer.observe(element);resize();
   const intersection=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView){last=0;dirty=true;start()}else{cancelAnimationFrame(frame);frame=0}},{threshold:.02});intersection.observe(element);
   const onVisibility=()=>{visible=!document.hidden;if(visible){last=0;start()}else{cancelAnimationFrame(frame);frame=0}};
   const onPointer=(e:PointerEvent)=>{if(e.pointerType!=="mouse"||control.current.paused)return;const rect=element.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width-.5)*.85;pointer.y=((e.clientY-rect.top)/rect.height-.5)*.3;};
   const lost=(e:Event)=>{e.preventDefault();cancelAnimationFrame(frame);frame=0;setStatus("fallback")};
   const motion=()=>{if(reduce.matches){control.current.paused=true;control.current.revision++;setPaused(true)}};
   document.addEventListener("visibilitychange",onVisibility);element.addEventListener("pointermove",onPointer);renderer.domElement.addEventListener("webglcontextlost",lost);reduce.addEventListener("change",motion);
   function render(now:number){
    frame=0;if(disposed||!visible||!inView)return;
    const c=control.current;const delta=last?Math.min((now-last)/1000,.06):0;last=now;
    if(!c.paused)time+=delta;
    if(c.revision!==previousRevision){previousRevision=c.revision;dirty=true;}
    if(c.automatic&&!c.paused){current+=delta/24;const i=Math.floor(current)%4;if(i!==c.season){c.season=i;setSeason(i)}}
    else if(!c.automatic){const target=c.season;current=c.paused?target:current+(target-current)*Math.min(1,delta*2.5)}
    if(dirty||(!c.paused&&now-lastRender>(low?33:20))){
     const z=Math.max(12.5,8.6/(2*Math.tan(Math.PI/9)*camera.aspect));
     camera.position.x+=(pointer.x-camera.position.x)*.025;camera.position.y+=(3.5+pointer.y-camera.position.y)*.025;camera.position.z=z;camera.lookAt(0,1,0);
     model.updateGarden(world,current,time,camera);renderer.render(world.scene,camera);dirty=false;lastRender=now;
    }
    if(!c.paused)frame=requestAnimationFrame(render);
   }
   function start(){if(!frame&&!disposed&&visible&&inView)frame=requestAnimationFrame(render)}
   const wake=()=>{dirty=true;last=0;start()};
   element.addEventListener("garden-control",wake);
   // Resize and restored context are handled without losing the rest of the page.
   const resizeWake=new ResizeObserver(wake);resizeWake.observe(element);
   start();setStatus("ready");
   cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();resizeWake.disconnect();intersection.disconnect();document.removeEventListener("visibilitychange",onVisibility);element.removeEventListener("pointermove",onPointer);element.removeEventListener("garden-control",wake);renderer.domElement.removeEventListener("webglcontextlost",lost);reduce.removeEventListener("change",motion);model.disposeGarden(world);renderer.dispose();renderer.domElement.remove();};
  }).catch(()=>{if(!disposed)setStatus("fallback")});
  return()=>{disposed=true;cleanup()};
 },[]);
 function change(values:Partial<typeof control.current>){Object.assign(control.current,values);control.current.revision++;host.current?.dispatchEvent(new Event("garden-control"))}
 function select(i:number){setSeason(i);setAutomatic(false);change({season:i,automatic:false})}
 return <section className="season-garden" aria-label="四季成长花园">
  <div className="garden-canvas" ref={host}/>
  <div className="garden-vignette" aria-hidden="true"/>
  <div className="garden-heading"><p>GROWTH IS A LIVING UNIVERSE</p><h1>一起生长，<br/>穿过四季。</h1><span>我的思考，她的世界。<br/>在同一段时光里，慢慢长成自己的模样。</span></div>
  <div className="garden-season"><span className="garden-season-number">0{season+1} / 04</span><strong>{SEASONS[season].en}</strong><p>{SEASONS[season].note}</p></div>
  {status!=="ready"&&<p className="garden-fallback" role="status">{status==="loading"?"正在唤醒四季花园……":"此设备暂不能显示 3D 场景，成长记录仍可正常使用。"}</p>}
  <div className="garden-bottom"><div className="garden-caption"><span>01 / 我的成长</span><i aria-hidden="true"/><span>02 / 她的成长</span></div>
   <div className="garden-toolbar"><div role="group" aria-label="选择季节">{SEASONS.map((s,i)=><button key={s.en} aria-pressed={season===i&&!automatic} onClick={()=>select(i)}>{s.name}</button>)}</div><button aria-pressed={automatic} onClick={()=>{setAutomatic(!automatic);change({automatic:!automatic})}}>四季流转</button><button aria-pressed={paused} onClick={()=>{setPaused(!paused);change({paused:!paused})}}>{paused?"播放场景":"暂停场景"}</button></div>
   <div className="garden-actions"><a className="a-button primary" href={NEW_NOTE}>＋ 记录此刻</a><a className="a-button" href="/art/">走进她的画展 ↗</a><a className="garden-scroll" href="#timeline">沿着时间往下看 ↓</a></div>
  </div>
 </section>;
}
