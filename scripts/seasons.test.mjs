import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {SEASONS,buildGarden,updateGarden,disposeGarden,phaseAt,seeded} from "../app/garden/world.mjs";
test("four seasons cycle deterministically",()=>{
 assert.equal(SEASONS.length,4);assert.equal(phaseAt(0),0);assert.equal(phaseAt(24),1);assert.equal(phaseAt(96),0);
 const a=seeded(42),b=seeded(42);for(let i=0;i<50;i++)assert.equal(a(),b());
});
test("two 3D trees, adaptive particle budget and seasonal transitions",()=>{
 const low=buildGarden(true),full=buildGarden(false),camera=new T.PerspectiveCamera(40,1,.1,80);camera.position.set(0,3.5,12.5);camera.lookAt(0,1,0);
 assert.equal(full.trees.length,2);assert.ok(low.trees[0].leaves.count<full.trees[0].leaves.count);
 assert.ok(low.particleSeeds.length<full.particleSeeds.length);
 for(const p of [0,.5,1,1.5,2,2.5,3,3.5,3.99,4,8]){
  updateGarden(low,p,12,camera);
  for(const tree of low.trees)assert.ok(Array.from(tree.leaves.instanceMatrix.array).every(Number.isFinite));
  assert.ok(Array.from(low.positions).every(Number.isFinite));
  assert.ok(Array.from(low.rainPos).every(Number.isFinite));
 }
 updateGarden(low,2,10,camera);assert.equal(low.falling.visible,true);
 updateGarden(low,3,10,camera);assert.equal(low.falling.visible,false);assert.equal(low.rainMat.opacity,0);
 let released=0;low.trees[0].leaves.geometry.addEventListener("dispose",()=>released++);
 disposeGarden(low);disposeGarden(full);assert.equal(released,1);
});
