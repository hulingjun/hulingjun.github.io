import {Vector3} from "three";
import test from "node:test";
import assert from "node:assert/strict";
import {SEASONS,sampleSeason,SEASON_CYCLE_SECONDS} from "../app/garden/seasons.mjs";
import {buildGarden,updateGarden,setGardenStyle,disposeGarden,seeded} from "../app/garden/world.mjs";
test("88-second season clock holds, transitions and loops in sync",()=>{
 assert.equal(SEASON_CYCLE_SECONDS,88);
 for(let i=0;i<4;i++){
  for(const offset of [0,1,9,17.999]){
   assert.deepEqual(sampleSeason(i*22+offset),{from:i,to:i,mix:0,transitioning:false,label:SEASONS[i].name});
  }
  for(const [offset,mix] of [[18,0],[19,.15625],[20,.5],[21,.84375]]){
   assert.deepEqual(sampleSeason(i*22+offset),{from:i,to:(i+1)%4,mix,transitioning:true,label:SEASONS[i].name+" → "+SEASONS[(i+1)%4].name});
  }
  assert.equal(sampleSeason((i+1)*22).from,(i+1)%4);
  let prev=-1;for(let step=0;step<400;step++){const s=sampleSeason(i*22+18+step/100);assert.ok(s.mix>=prev&&s.mix<=1);prev=s.mix;}
 }
 for(const t of [0,88,176,-88,-176,-0])assert.deepEqual(sampleSeason(t),sampleSeason(0));
 assert.deepEqual(sampleSeason(-1),sampleSeason(87));
 for(const t of [Number.MAX_VALUE,-Number.MAX_VALUE,Number.MIN_VALUE,-Number.MIN_VALUE]){
  const s=sampleSeason(t);assert.ok(s.from>=0&&s.from<4&&s.mix>=0&&s.mix<=1);
 }
 for(const bad of [NaN,Infinity,-Infinity,null,undefined,"18",{},[],true])assert.throws(()=>sampleSeason(bad),TypeError);
});
test("seeded geometry and three genuinely different material systems",()=>{
 const a=seeded(42),b=seeded(42);for(let i=0;i<50;i++)assert.equal(a(),b());
 const low=buildGarden(true),full=buildGarden(false);
 const geometry=full.trees[0].bark.geometry,positions=geometry.attributes.position,normals=geometry.attributes.normal;
 for(let face=0;face<30;face++){
  const ids=[0,1,2].map(k=>geometry.index.getX(face*3+k));
  const [a,b,c]=ids.map(id=>new Vector3().fromBufferAttribute(positions,id));
  const outward=new Vector3().fromBufferAttribute(normals,ids[0]);
  assert.ok(b.sub(a).cross(c.sub(a)).dot(outward)>0,"Bark triangles must face outward");
 }
 assert.equal(full.trees.length,2);assert.ok(low.trees[0].leaves.count<full.trees[0].leaves.count);
 assert.ok(low.particleSeeds.length<full.particleSeeds.length);
 for(const style of ["real","anime","ink"]){
  setGardenStyle(low,style);
  assert.equal(low.style,style);assert.equal(low.sky.visible,style==="real");
  assert.equal(low.trees[0].bark.material.type,style==="real"?"MeshStandardMaterial":"MeshToonMaterial");
  for(const seconds of [0,18,20,22,42,44,64,66,86,88]){
   updateGarden(low,sampleSeason(seconds),12);
   for(const tree of low.trees)assert.ok(Array.from(tree.leaves.instanceMatrix.array).every(Number.isFinite));
   assert.ok(Array.from(low.positions).every(Number.isFinite));
  }
  updateGarden(low,sampleSeason(66),12);
  assert.equal(low.rainMat.opacity,0);assert.equal(low.falling.visible,false);
  assert.equal(Math.abs(low.trees[0].leaves.instanceMatrix.array[0]),0);
  updateGarden(low,sampleSeason(44),12);assert.equal(low.falling.visible,true);
 }
 let released=0;low.trees[0].leaves.geometry.addEventListener("dispose",()=>released++);
 disposeGarden(low);disposeGarden(full);assert.equal(released,1);
});
