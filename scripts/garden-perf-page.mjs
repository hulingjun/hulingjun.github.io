import * as T from "three";
const query=new URLSearchParams(location.search),model=await import(query.get("model"));
const assets=await model.loadGardenAssets(),world=model.buildGarden(false,assets);
const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
renderer.setSize(1000,700);renderer.setPixelRatio(1);
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
document.body.style.margin="0";document.body.appendChild(renderer.domElement);
const camera=new T.PerspectiveCamera(40,1000/700,.2,250),gl=renderer.getContext();
const stats=values=>{const s=values.toSorted((a,b)=>a-b);return {p50:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.floor(s.length*.95))]};};
const state=(season,mix=0)=>({from:season,to:mix?(season+1)%4:season,mix});
function pose(view){
 if(view==="overview"){camera.position.set(2.28,5.25,19);camera.lookAt(0,2.4,0);}
 if(view==="detail"){camera.position.set(-2.6,4.9,7);camera.lookAt(-2.6,4,0);}
 if(view==="edge"){camera.position.set(-6,4,5.5);camera.lookAt(-6,4,0);}
 camera.updateMatrixWorld();camera.updateProjectionMatrix();
}
window.measure=async(view,season,mix=0)=>{
 pose(view);const sample=state(season,mix);
 const cpu=[],completed=[],counts=[];
 for(let i=0;i<12;i++){
  const time=12+i/60,start=performance.now();model.updateGarden(world,sample,time);const simulated=performance.now();
  renderer.info.autoReset=false;renderer.info.reset();renderer.render(world.scene,camera);
  gl.finish();const end=performance.now();
  if(i>=4){cpu.push(simulated-start);completed.push(end-start);counts.push({...renderer.info.render});}
 }
 // A deterministic frame for image equivalence, independent of timing.
 model.updateGarden(world,sample,12);renderer.render(world.scene,camera);gl.finish();
 return {view,season,mix,cpuMs:stats(cpu),completedFrameMs:stats(completed),draw:counts.at(-1)};
};
window.cpuMeasure=()=>{
 const results={};
 for(const [name,step] of [["hold",0],["transition",.003],["paused",null]]){
  const values=[];model.updateGarden(world,state(0),12);
  for(let round=0;round<6;round++){
   const start=performance.now();
   for(let i=0;i<120;i++)model.updateGarden(world,state(0,step===null?0:step*i),step===null?12:12+i/60);
   if(round)values.push((performance.now()-start)/120);
  }results[name]=stats(values);
 }
 return results;
};
window.inventory=()=>{
 const geometries=[];
 world.scene.traverse(o=>{if(o.isMesh){const vertices=o.geometry.attributes.position.count,triangles=o.geometry.index?o.geometry.index.count/3:vertices/3;geometries.push({vertices,triangles,count:o.isInstancedMesh?o.count:1});}});
 return {leaves:world.trees.reduce((sum,t)=>sum+t.leaves.count,0),petioles:world.trees.reduce((sum,t)=>sum+t.petioles.count,0),grass:world.grass.count,
  allocatedTriangles:geometries.reduce((sum,g)=>sum+g.triangles*g.count,0),shadowSize:world.light.shadow.mapSize.toArray(),pixelRatio:renderer.getPixelRatio()};
};
window.ready=true;
