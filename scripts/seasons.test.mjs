import {Vector3,Matrix4} from "three";
import test from "node:test";
import assert from "node:assert/strict";
import {SEASONS,sampleSeason,SEASON_CYCLE_SECONDS} from "../app/garden/seasons.mjs";
import {buildGarden,updateGarden,geometryForBranch,leafGeometry,disposeGarden,seeded} from "../app/garden/world.mjs";
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
test("realistic trees have coherent bark and attached foliage throughout the seasons",()=>{
 const a=seeded(42),b=seeded(42);for(let i=0;i<50;i++)assert.equal(a(),b());
 const low=buildGarden(true),full=buildGarden(false);
 assert.equal(full.trees.length,2);assert.ok(low.trees[0].leaves.count<full.trees[0].leaves.count);
 assert.ok(low.particleSeeds.length<full.particleSeeds.length);
 assert.equal(low.trees[0].bark.material.type,"MeshStandardMaterial");assert.equal(low.sky.visible,true);
 const geometry=full.trees[0].bark.geometry,positions=geometry.attributes.position,normals=geometry.attributes.normal;
 for(let face=0;face<30;face++){
  const ids=[0,1,2].map(k=>geometry.index.getX(face*3+k));
  const [a,b,c]=ids.map(id=>new Vector3().fromBufferAttribute(positions,id));
  const outward=new Vector3().fromBufferAttribute(normals,ids[0]);
  assert.ok(b.sub(a).cross(c.sub(a)).dot(outward)>0,"Bark triangles must face outward");
 }
 for(const seconds of [0,18,20,22,42,44,64,66,86,88]){
  updateGarden(low,sampleSeason(seconds),12);
  low.scene.updateMatrixWorld(true);
  for(const tree of low.trees){
   assert.ok(Array.from(tree.leaves.instanceMatrix.array).every(Number.isFinite));
   const leafMatrix=new Matrix4(),petioleMatrix=new Matrix4();
   for(let i=0;i<tree.seeds.length;i++){
    const seed=tree.seeds[i];tree.leaves.getMatrixAt(i,leafMatrix);tree.petioles.getMatrixAt(i,petioleMatrix);
    const base=new Vector3().applyMatrix4(leafMatrix);
    const petioleTip=new Vector3(0,.5,0).applyMatrix4(petioleMatrix);
    assert.ok(base.distanceTo(seed.petioleEnd)<1e-5,"Leaf base sits on its own petiole endpoint, including seasonal growth");
    assert.ok(petioleTip.distanceTo(base)<.0021,"Visible petiole overlaps the alpha stem");
    assert.ok(seed.anchor.distanceTo(seed.petioleEnd)>.04&&seed.anchor.distanceTo(seed.petioleEnd)<.081);
   }
  }
  assert.ok(Array.from(low.positions).every(Number.isFinite));
 }
 updateGarden(low,sampleSeason(66),12);assert.equal(low.rainMat.opacity,0);assert.equal(low.falling.visible,false);
 assert.equal(Math.abs(low.trees[0].leaves.instanceMatrix.array[0]),0);
 updateGarden(low,sampleSeason(0),12);assert.equal(low.falling.visible,false,"No loose spring leaves");
 updateGarden(low,sampleSeason(44),12);assert.equal(low.falling.visible,true);
 // Main and depth shaders share a strictly basal, zero-displacement wind origin.
 for(const material of [low.surfaces.leaf,low.leafDepth]){
  const shader={uniforms:{},vertexShader:"#include <begin_vertex>"};material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/float flex=uv.y\*uv.y/);assert.match(shader.vertexShader,/transformed.x.*\*flex/);
 }
 let released=0;low.trees[0].leaves.geometry.addEventListener("dispose",()=>released++);
 disposeGarden(low);disposeGarden(full);assert.equal(released,1);
});
test("bark grain has independent patches, metre-scale length and closed smooth seams",()=>{
 const points=[new Vector3(0,0,0),new Vector3(.15,2,.1),new Vector3(-.1,5,0)];
 const a=geometryForBranch(points,.29,.02,101),b=geometryForBranch(points,.29,.02,102);
 assert.notEqual(a.userData.uOffset,b.userData.uOffset);
 assert.notEqual(a.userData.vOffset,b.userData.vOffset);
 assert.ok(a.userData.metersPerTile>=1.9);
 const p=a.attributes.position,n=a.attributes.normal,stride=21;
 for(let i=0;i<p.count;i+=stride){
  assert.ok(new Vector3().fromBufferAttribute(p,i).distanceTo(new Vector3().fromBufferAttribute(p,i+20))<1e-6);
  assert.ok(new Vector3().fromBufferAttribute(n,i).distanceTo(new Vector3().fromBufferAttribute(n,i+20))<1e-6);
 }
 const leaf=leafGeometry(),lp=leaf.attributes.position,uv=leaf.attributes.uv;
 for(let i=0;i<lp.count;i++)if(uv.getY(i)===0){assert.ok(Math.abs(lp.getY(i))<1e-8);assert.ok(Math.abs(lp.getZ(i))<1e-8);}
 a.dispose();b.dispose();leaf.dispose();
});

test("fine twig UVs never fold or mirror their normal map",()=>{
 const points=[new Vector3(0,0,0),new Vector3(0,.5,0),new Vector3(.1,1,0)];
 for(const seed of [19,25,101,902]){
  const g=geometryForBranch(points,.008,.002,seed),uv=g.attributes.uv,stride=7;
  for(let i=0;i<uv.count;i+=stride)for(let j=1;j<stride;j++)assert.ok(uv.getX(i+j)>uv.getX(i+j-1),"Circumferential UV must be monotone");
  for(let i=stride;i<uv.count;i++)assert.ok(uv.getY(i)>uv.getY(i-stride),"Longitudinal grain must follow curve length");
  g.dispose();
 }
});
