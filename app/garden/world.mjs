import * as T from "three";
import {HDRLoader} from "three/addons/loaders/HDRLoader.js";
import {Sky} from "three/addons/objects/Sky.js";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
export function seeded(seed=19){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
const TAU=Math.PI*2;
const up=new T.Vector3(0,1,0);
const palette=[
  {sky:"#b3cdc2",fog:"#b8cbb4",leaf:"#a0b958",tip:"#d3dd9b",ground:"#89946c",sun:"#ffebcb"},
  {sky:"#a8d4e0",fog:"#b1cebf",leaf:"#5d9141",tip:"#a4bd5a",ground:"#668747",sun:"#fff5da"},
  {sky:"#e1bf9c",fog:"#c3b199",leaf:"#cb651c",tip:"#eabb41",ground:"#a58f58",sun:"#ffd39a"},
  {sky:"#c3d3df",fog:"#d5dfe2",leaf:"#bbc9cb",tip:"#e3e9e6",ground:"#dee5e4",sun:"#e3edf8"}
];
function terrainY(x,z){return -.25+.22*Math.sin(x*.29)*Math.cos(z*.31)+.13*Math.sin(x*.71+z*.24);}
// Smooth, seeded spatial variation: no repeated axial sine rings.
function noise3(x,y,z){
 const hash=(a,b,c)=>{let h=Math.imul(a,374761393)^Math.imul(b,668265263)^Math.imul(c,2147483647);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),smooth=t=>t*t*(3-2*t);
 const fx=smooth(x-ix),fy=smooth(y-iy),fz=smooth(z-iz),lerp=T.MathUtils.lerp;
 return lerp(lerp(lerp(hash(ix,iy,iz),hash(ix+1,iy,iz),fx),lerp(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),
  lerp(lerp(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx),lerp(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);
}
export function geometryForBranch(points,startRadius,endRadius,seed=19){
 const rng=seeded(seed),curve=new T.CatmullRomCurve3(points),length=curve.getLength();
 const steps=Math.max(6,points.length*3),radial=startRadius>.16?20:startRadius>.045?12:6;
 const frames=curve.computeFrenetFrames(steps,false),pos=[],uv=[],colors=[],indices=[];
 const uOffset=rng()*13,vOffset=rng()*17,metersPerTile=1.9+rng()*.65,phase=rng()*100;
 // Each limb receives a different patch, at approximately world-size grain scale.
 // Fine twigs sample a small part of the same map instead of wrapping a trunk texture.
 const physicalSpan=TAU*startRadius/metersPerTile;
 // Whole wraps close the visible trunk/limb seam; tiny twigs keep cropped grain.
 const uSpan=startRadius>.045?Math.max(1,Math.round(physicalSpan)):physicalSpan;
 for(let i=0;i<=steps;i++){
  const t=i/steps,p=curve.getPointAt(t);
  const radius=T.MathUtils.lerp(startRadius,endRadius,Math.pow(t,.83));
  for(let j=0;j<=radial;j++){
   const angle=j/radial*TAU,n=frames.normals[i].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i],Math.sin(angle));
   const irregular=noise3(Math.cos(angle)*1.9+phase,t*2.1,Math.sin(angle)*1.9)-.5;
   const fine=noise3(Math.cos(angle)*5.2,t*3.7+phase,Math.sin(angle)*5.2)-.5;
   const flare=startRadius>.2?.25*Math.exp(-t*18):0;
   const v=p.clone().addScaledVector(n,radius*(1+irregular*.22+fine*.07+flare));
   pos.push(v.x,v.y,v.z);
   const warp=(noise3(Math.cos(angle)+phase,t*1.7,Math.sin(angle))-.5)*Math.min(.04,uSpan*.025);
   uv.push(uOffset+j/radial*uSpan+warp,vOffset+t*length/metersPerTile);
   const shade=.78+noise3(v.x*.8+phase,v.y*.55,v.z*.8)*.26;
   colors.push(shade,shade*.985,shade*.96);
   if(i<steps&&j<radial){const a=i*(radial+1)+j,b=a+radial+1;indices.push(a,a+1,b,b,a+1,b+1);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
 g.setAttribute("color",new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
 // Share normals across the UV seam, not across separate natural branch collars.
 const normals=g.attributes.normal;
 for(let i=0;i<=steps;i++){const a=i*(radial+1),b=a+radial,n=new T.Vector3().fromBufferAttribute(normals,a).add(new T.Vector3().fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);}
 g.userData={length,uOffset,vOffset,uSpan,metersPerTile};return g;
}
export function leafGeometry(){
 // prepare-garden-assets normalizes the opaque petiole tip to bottom-center.
 // The entire leaf grows and flutters about that basal origin, never its centre.
 const g=new T.PlaneGeometry(.23,.4,4,6);g.translate(0,.2,0);
 const p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),t=y/.4;p.setZ(i,(.04*Math.sin(t*Math.PI)+Math.abs(x)*.12)*t);}
 g.computeVertexNormals();return g;
}
function surface(kind,assets){
 const common={side:kind==="leaf"?T.DoubleSide:T.FrontSide};
 const map=kind==="bark"?assets.bark:kind==="ground"?assets.ground:assets.leaf;
 const real=new T.MeshStandardMaterial({...common,map:map||null,roughness:kind==="leaf"?.78:.94,metalness:0,vertexColors:kind==="bark"});
 if(kind==="bark"&&assets.barkNormal){real.normalMap=assets.barkNormal;real.normalScale.set(.46,.46);}
 if(kind==="bark"&&assets.barkRoughness)real.roughnessMap=assets.barkRoughness;
 if(kind==="leaf"){real.alphaTest=.42;real.forceSinglePass=true;}
 return real;
}
function windShader(material,wind){
 material.onBeforeCompile=shader=>{
  shader.uniforms.gardenTime=wind;
  shader.vertexShader="uniform float gardenTime;\n"+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",`
   #include <begin_vertex>
   #ifdef USE_INSTANCING
    float seed=instanceMatrix[3].x*2.7+instanceMatrix[3].z*1.3;
    float wave=sin(gardenTime*1.7+seed)+sin(gardenTime*2.9+seed*1.8)*.35;
    float flex=uv.y*uv.y;
    transformed.z+=wave*.028*flex;
    transformed.x+=sin(gardenTime*.8+seed)*.014*flex;
   #endif
  `);
 };
 material.customProgramCacheKey=()=>"garden-leaf-basal-wind-v3";
}
export async function loadGardenAssets(){
 const loader=new T.TextureLoader();
 const names={bark:"bark.webp",barkNormal:"bark-normal.webp",barkRoughness:"bark-roughness.webp",ground:"ground.webp",leaf:"leaf.png"};
 const assets={};
 try{
  const loaded=await Promise.allSettled(Object.entries(names).map(async([key,file])=>{
   const texture=await loader.loadAsync("/garden-assets/"+file);assets[key]=texture;
   if(["bark","ground","leaf"].includes(key))texture.colorSpace=T.SRGBColorSpace;
   texture.anisotropy=4;
   if(key!=="leaf"){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(key==="ground"?55:1,key==="ground"?55:1);}
  }));
  const failed=loaded.find(r=>r.status==="rejected");if(failed)throw failed.reason;
  assets.environment=await new HDRLoader().loadAsync("/garden-assets/environment.hdr");
  assets.environment.mapping=T.EquirectangularReflectionMapping;
  return assets;
 }catch(error){Object.values(assets).forEach(t=>t.dispose());throw error;}
}
export function buildGarden(low=false,assets={}){
 const random=seeded(1337),scene=new T.Scene(),wind={value:0},snowWeight={value:0};
 scene.background=new T.Color("#b3cdc2");scene.fog=new T.Fog("#b8cbb4",28,110);
 const hemi=new T.HemisphereLight("#d8e8f8","#637348",2.1);scene.add(hemi);
 const light=new T.DirectionalLight("#ffebcb",3.1);light.position.set(-8,12,-6);light.castShadow=true;
 light.shadow.mapSize.set(low?1024:2048,low?1024:2048);
 Object.assign(light.shadow.camera,{left:-11,right:11,top:12,bottom:-9,near:1,far:42});
 light.shadow.bias=-.00035;light.shadow.normalBias=.04;scene.add(light);
 const fill=new T.DirectionalLight("#c6deef",.55);fill.position.set(6,4,8);scene.add(fill);
 const sky=new Sky();sky.scale.setScalar(180);scene.add(sky);
 sky.material.uniforms.turbidity.value=3.8;sky.material.uniforms.rayleigh.value=1.45;
 sky.material.uniforms.mieCoefficient.value=.006;sky.material.uniforms.mieDirectionalG.value=.83;
 const sunDirection=new T.Vector3(.32,.25,-.92).normalize();sky.material.uniforms.sunPosition.value.copy(sunDirection);light.position.copy(sunDirection).multiplyScalar(25);

 const surfaces={bark:surface("bark",assets),leaf:surface("leaf",assets),ground:surface("ground",assets)};
 scene.environment=assets.environment||null;scene.environmentIntensity=.3;light.intensity=2.6;hemi.intensity=1.05;
 surfaces.ground.onBeforeCompile=shader=>{
  shader.uniforms.gardenSnow=snowWeight;
  shader.fragmentShader="uniform float gardenSnow;\n"+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>","#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.90,.93),gardenSnow);");
 };
 windShader(surfaces.leaf,wind);
 const groundGeo=new T.PlaneGeometry(170,170,low?80:120,low?80:120);groundGeo.rotateX(-Math.PI/2);
 const gp=groundGeo.attributes.position;
 for(let i=0;i<gp.count;i++)gp.setY(i,terrainY(gp.getX(i),gp.getZ(i)));
 groundGeo.computeVertexNormals();
 const ground=new T.Mesh(groundGeo,surfaces.ground);ground.receiveShadow=true;scene.add(ground);
 const mountains=[];
 for(let ring=0;ring<3;ring++){
  const geo=new T.CylinderGeometry(1,1,1,100,18,true),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
   const angle=Math.atan2(p.getZ(i),p.getX(i)),height=(p.getY(i)+.5);
   const ridge=3+3*Math.pow(Math.sin(angle*3+ring*.8),2)+1.2*Math.sin(angle*7+ring)+.4*Math.sin(angle*23);
   const radius=48+ring*16;
   p.setXYZ(i,p.getX(i)*radius,(height*ridge-1)*(1+ring*.3),p.getZ(i)*radius);
  }
  geo.computeVertexNormals();const mat=new T.MeshStandardMaterial({color:0x799487,roughness:1,side:T.DoubleSide});
  const mountain=new T.Mesh(geo,mat);mountains.push(mountain);scene.add(mountain);
 }
 const trees=[],leafGeo=leafGeometry(),dummy=new T.Object3D(),color=new T.Color();
 const leafDepth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:assets.leaf||null,alphaTest:.42,side:T.DoubleSide});
 windShader(leafDepth,wind);
 for(let treeIndex=0;treeIndex<2;treeIndex++){
  const group=new T.Group();group.position.set(treeIndex===0?-2.7:2.8,terrainY(treeIndex===0?-2.7:2.8,0),treeIndex===0?0:.8);
  group.scale.setScalar(treeIndex===0?1:.79);group.rotation.y=treeIndex*1.6;scene.add(group);
  const branchParts=[],shoots=[],seeds=[];
  const wood=(points,a,b)=>branchParts.push(geometryForBranch(points,a,b,Math.floor(random()*0xffffffff)));
  const trunk=[new T.Vector3(0,0,0)],lean=new T.Vector3();
  for(let i=1;i<=8;i++){
   lean.x=lean.x*.65+(random()-.45)*.095;lean.z=lean.z*.65+(random()-.5)*.08;
   trunk.push(trunk.at(-1).clone().add(new T.Vector3(lean.x,.59+random()*.1,lean.z)));
  }
  wood(trunk,.29,.018);
  function branch(start,direction,length,radius,depth){
   const points=[start.clone()],dir=direction.clone();
   for(let j=1;j<=4;j++){
    dir.x+=(random()-.5)*.19;dir.z+=(random()-.5)*.19;dir.y+=.065+random()*.06;dir.normalize();
    points.push(points.at(-1).clone().addScaledVector(dir,length/4));
   }
   wood(points,radius,radius*.2);
   const curve=new T.CatmullRomCurve3(points);
   if(depth===0){
    // A real woody shoot, not a sphere of leaf-centre offsets.
    shoots.push({curve,radius:radius*.7});
    const count=low?2:3;
    for(let j=0;j<count;j++){
     const t=.3+(j+.2+random()*.25)/count*.62,origin=curve.getPointAt(t),tangent=curve.getTangentAt(t);
     const az=random()*TAU,lateral=new T.Vector3(Math.cos(az),.12+random()*.24,Math.sin(az));
     const heading=tangent.clone().multiplyScalar(.45).add(lateral).normalize(),len=.45+random()*.42;
     const middle=origin.clone().addScaledVector(heading,len*.52);
     const tip=origin.clone().addScaledVector(heading,len).add(new T.Vector3(0,.10+random()*.12,0));
     const twig=[origin,middle,tip];wood(twig,.008,.002);
     shoots.push({curve:new T.CatmullRomCurve3(twig),radius:.007});
    }
    return;
   }
   for(let j=0;j<3;j++){
    const t=.48+j*.22+random()*.05,at=curve.getPointAt(t),tangent=curve.getTangentAt(t),az=random()*TAU;
    const next=tangent.multiplyScalar(.8).add(new T.Vector3(Math.cos(az)*.64,.04+random()*.23,Math.sin(az)*.64)).normalize();
    branch(at,next,length*(.56+random()*.18),radius*.46,depth-1);
   }
  }
  const trunkCurve=new T.CatmullRomCurve3(trunk);
  for(let j=0;j<11;j++){
   const t=.25+j*.061+(random()-.5)*.018,start=trunkCurve.getPointAt(t);
   const az=j*2.399+treeIndex*.7+(random()-.5)*.44,dir=new T.Vector3(Math.cos(az),.25+t*.65,Math.sin(az)).normalize();
   branch(start,dir,(2.95-t*1.4)*(.9+random()*.24),.105*(1-t*.65),2);
  }
  for(let j=0;j<5;j++){
   const az=j/5*TAU+(random()-.5)*.6,r=.65+random()*.45;
   wood([new T.Vector3(Math.cos(az)*r,-.07,Math.sin(az)*r),new T.Vector3(Math.cos(az)*.35,.025,Math.sin(az)*.35),trunk[1].clone().multiplyScalar(.67)],.024+random()*.012,.11);
  }
  const bark=new T.Mesh(mergeGeometries(branchParts),surfaces.bark);branchParts.forEach(g=>g.dispose());
  bark.castShadow=true;bark.receiveShadow=true;group.add(bark);
  for(const shoot of shoots){
   const count=low?7:10,phase=random()*TAU;
   for(let j=0;j<count;j++){
    const t=.1+(j+.2+random()*.45)/count*.84,anchor=shoot.curve.getPointAt(t),tangent=shoot.curve.getTangentAt(t);
    const normal=new T.Vector3().crossVectors(tangent,Math.abs(tangent.y)>.92?new T.Vector3(1,0,0):up).normalize();
    const side=normal.applyAxisAngle(tangent,phase+j*2.399+(random()-.5)*.32);
    const direction=side.clone().multiplyScalar(.88).addScaledVector(tangent,.48).addScaledVector(up,.1).normalize();
    const petioleEnd=anchor.clone().addScaledVector(direction,.045+random()*.035);
    // Face mostly toward daylight, with modest natural roll instead of random tumbling.
    const face=up.clone().addScaledVector(side,.3+random()*.4);
    const xAxis=new T.Vector3().crossVectors(direction,face).normalize(),zAxis=new T.Vector3().crossVectors(xAxis,direction).normalize();
    const quaternion=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(xAxis,direction,zAxis));
    quaternion.multiply(new T.Quaternion().setFromAxisAngle(up,(random()-.5)*.5));
    seeds.push({anchor,petioleEnd,quaternion,scale:.72+random()*.54,tone:random(),drop:random()});
   }
  }
  const leaves=new T.InstancedMesh(leafGeo,surfaces.leaf,seeds.length);leaves.frustumCulled=false;leaves.castShadow=true;leaves.receiveShadow=true;leaves.customDepthMaterial=leafDepth;
  leaves.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(leaves);
  const petioles=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,5,1),new T.MeshStandardMaterial({color:"#6b7043",roughness:.92}),seeds.length);
  petioles.frustumCulled=false;petioles.castShadow=true;
  seeds.forEach((s,i)=>{
   const direction=s.petioleEnd.clone().sub(s.anchor),length=direction.length();
   dummy.position.copy(s.anchor).lerp(s.petioleEnd,.5);dummy.quaternion.setFromUnitVectors(up,direction.normalize());
   // Tiny overlap with the leaf's alpha stem eliminates the half-texel gap.
   dummy.scale.set(.0027,length+.004,.0027);dummy.updateMatrix();petioles.setMatrixAt(i,dummy.matrix);
  });
  group.add(petioles);
  // Full-size bounds are computed once and cover every later seasonal size.
  const baseMatrices=new Float64Array(seeds.length*16);
  seeds.forEach((s,i)=>{
   dummy.position.copy(s.petioleEnd);dummy.quaternion.copy(s.quaternion);dummy.scale.setScalar(s.scale);dummy.updateMatrix();
   leaves.setMatrixAt(i,dummy.matrix);dummy.matrix.toArray(baseMatrices,i*16);leaves.setColorAt(i,color.set("#ffffff"));
  });
  // One draw per tree, with fixed maximum-growth bounds; the shadow pass
  // tests these bounds against its own light frustum, not the viewer's.
  leaves.computeBoundingSphere();leaves.boundingSphere.radius+=.12;leaves.frustumCulled=true;
  petioles.computeBoundingSphere();petioles.frustumCulled=true;
  const snow=new T.Mesh(bark.geometry,new T.MeshStandardMaterial({color:"#e7edf0",roughness:1,transparent:true,opacity:0,polygonOffset:true,polygonOffsetFactor:-1}));
  snow.material.onBeforeCompile=shader=>{
   shader.vertexShader="varying float gardenUp;\n"+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace("#include <beginnormal_vertex>","#include <beginnormal_vertex>\n gardenUp=(mat3(modelMatrix)*objectNormal).y;");
   shader.fragmentShader="varying float gardenUp;\n"+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace("#include <alphatest_fragment>","#include <alphatest_fragment>\n diffuseColor.a*=smoothstep(.05,.55,gardenUp);if(diffuseColor.a<.02)discard;");
  };
  snow.material.depthWrite=false;
  snow.scale.setScalar(1.018);group.add(snow);
  trees.push({group,bark,leaves,petioles,seeds,shoots,snow,baseMatrices});
 }
 // Grass blades form the clearing, not a floating pedestal.
 const grassGeo=new T.PlaneGeometry(.045,.4,1,4);grassGeo.translate(0,.2,0);
 const blades=grassGeo.attributes.position;
 for(let i=0;i<blades.count;i++){const t=blades.getY(i)/.4;blades.setX(i,blades.getX(i)*(1-t));blades.setZ(i,t*t*.13);}
 grassGeo.computeVertexNormals();
 const grassMat=new T.MeshStandardMaterial({color:"#6f8d49",roughness:1,side:T.DoubleSide});
 const grass=new T.InstancedMesh(grassGeo,grassMat,low?4000:10000);grass.receiveShadow=true;grass.frustumCulled=false;
 for(let i=0;i<grass.count;i++){
  const az=random()*TAU,r=Math.sqrt(random())*12,x=Math.cos(az)*r,z=Math.sin(az)*r;
  dummy.position.set(x,terrainY(x,z),z);dummy.rotation.set((random()-.5)*.4,random()*TAU, (random()-.5)*.4);dummy.scale.setScalar(.3+random()*.9);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
 }
 grass.computeBoundingSphere();grass.frustumCulled=true;scene.add(grass);
 const count=low?180:440,seeds=[],positions=new Float32Array(count*3),rainPositions=new Float32Array(count*6);
 for(let i=0;i<count;i++)seeds.push({x:(random()-.5)*24,y:random()*13,z:(random()-.5)*18,phase:random()*TAU,speed:.5+random()});
 const particlesGeo=new T.BufferGeometry();particlesGeo.setAttribute("position",new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
 const particleMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{tint:{value:new T.Color("#ffe4d3")},size:{value:6},alpha:{value:.5}},vertexShader:`
  uniform float size;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*18./-p.z,1.,12.);gl_Position=projectionMatrix*p;}
 `,fragmentShader:`
  uniform vec3 tint;uniform float alpha;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.12,.5,d);gl_FragColor=vec4(tint,a*alpha);}
 `});
 const particles=new T.Points(particlesGeo,particleMat);particles.frustumCulled=false;scene.add(particles);
 const rainGeo=new T.BufferGeometry();rainGeo.setAttribute("position",new T.BufferAttribute(rainPositions,3).setUsage(T.DynamicDrawUsage));
 const rainMat=new T.LineBasicMaterial({color:"#b3d3df",transparent:true,opacity:0,depthWrite:false});
 const rain=new T.LineSegments(rainGeo,rainMat);rain.frustumCulled=false;scene.add(rain);
 const falling=new T.InstancedMesh(leafGeo,surfaces.leaf,low?14:26);falling.frustumCulled=false;scene.add(falling);
 const fallen=new T.InstancedMesh(leafGeo,surfaces.leaf,low?160:380);fallen.frustumCulled=false;scene.add(fallen);
 for(let i=0;i<fallen.count;i++){
  const az=random()*TAU,r=Math.sqrt(random())*3.1,x=(i%2===0?-2.7:2.8)+Math.cos(az)*r,z=Math.sin(az)*r;
  dummy.position.set(x,terrainY(x,z)+.025,z);dummy.rotation.set(-Math.PI/2,0,random()*TAU);dummy.scale.setScalar(.45+random()*.65);dummy.updateMatrix();fallen.setMatrixAt(i,dummy.matrix);color.set("#be6c29").lerp(new T.Color("#ddae54"),random());fallen.setColorAt(i,color);
 }
 return {scene,assets,wind,snowWeight,surfaces,trees,ground,grass,mountains,sky,light,hemi,fill,particles,particleMat,positions,rain,rainMat,rainPositions,particleSeeds:seeds,falling,fallen,leafDepth,seasonKey:"",lastTime:NaN,low,scratch:{sun:new T.Vector3(),origin:new T.Vector3(),dummy:new T.Object3D(),color:new T.Color()}};
}
export function updateGarden(w,state,time){
 const {from,to,mix}=state,a=palette[from],b=palette[to];
 const key=[from,to,mix.toFixed(3)].join(":");
 if(w.lastTime===time&&w.lastFrom===from&&w.lastTo===to&&w.lastMix===mix)return false;
 w.lastTime=time;w.lastFrom=from;w.lastTo=to;w.lastMix=mix;
 const blend=key=>new T.Color(a[key]).lerp(new T.Color(b[key]),mix);
 const weight=i=>(from===i?1-mix:0)+(to===i?mix:0);
 const spring=weight(0),summer=weight(1),autumn=weight(2),winter=weight(3);
 w.wind.value=time;w.snowWeight.value=winter;
 const sunshine=w.scratch.sun.set(.32,.25+summer*.035-winter*.07+Math.sin(time*.055)*.018,-.92).normalize();
 w.sky.material.uniforms.sunPosition.value.copy(sunshine);w.light.position.copy(sunshine).multiplyScalar(25);
 if(w.seasonKey!==key){
  w.seasonKey=key;w.scene.background.copy(blend("sky"));w.scene.fog.color.copy(blend("fog"));
  w.scene.fog.near=28;w.scene.fog.far=110;
  w.ground.material.color.copy(blend("ground"));
  w.grass.material.color.copy(blend("ground")).multiplyScalar(.72);
  w.grass.visible=winter<.95;
  w.light.color.copy(blend("sun"));
  w.sky.material.uniforms.rayleigh.value=1.4+autumn*.7-winter*.4;
  w.sky.material.uniforms.turbidity.value=3+spring*2+winter*4;
  w.surfaces.bark.color.set("#d0c2ae");
  const c1=blend("leaf"),c2=blend("tip");
  for(const tree of w.trees){
   tree.snow.material.opacity=winter*.9;tree.snow.visible=winter>.01;tree.petioles.visible=winter<.99;
   tree.leaves.visible=winter<1;
   const matrices=tree.leaves.instanceMatrix.array,colors=tree.leaves.instanceColor.array,base=tree.baseMatrices;
   for(let i=0;i<tree.seeds.length;i++){
    const s=tree.seeds[i],growth=Math.max(0,1-winter-autumn*s.drop*.58)*(.82+summer*.18),m=i*16,c=i*3;
    // Same basal transform as before, without rebuilding 7,920 quaternions.
    for(let column=0;column<3;column++)for(let row=0;row<3;row++){const j=column*4+row;matrices[m+j]=base[m+j]*growth;}
    colors[c]=c1.r+(c2.r-c1.r)*s.tone;colors[c+1]=c1.g+(c2.g-c1.g)*s.tone;colors[c+2]=c1.b+(c2.b-c1.b)*s.tone;
   }
   tree.leaves.instanceMatrix.needsUpdate=true;tree.leaves.instanceColor.needsUpdate=true;
  }
  w.mountains.forEach((m,i)=>m.material.color.set("#728b78").lerp(w.scene.fog.color,.2+i*.18));
  w.falling.visible=autumn>.01;w.fallen.visible=autumn>.01;
  w.particleMat.uniforms.tint.value.set(winter>.5?"#ffffff":"#fff4bd");
 }
 w.trees.forEach((tree,i)=>{tree.group.rotation.z=Math.sin(time*.65+i)*.006+Math.sin(time*.31)*.004;});
 w.particleMat.uniforms.alpha.value=winter*.95+summer*.10+autumn*.05;
 w.particleMat.uniforms.size.value=3+winter*4;
 w.rainMat.opacity=(spring*.11+summer*.19)*(.65+Math.sin(time*.19)*.35);
 for(let i=0;i<w.particleSeeds.length;i++){
  const s=w.particleSeeds[i],j=i*3,k=i*6;
  w.positions[j]=s.x+Math.sin(time*.28+s.phase)*.7;
  w.positions[j+1]=((s.y-time*(.2+winter*.8)*s.speed)%13+13)%13-.1;w.positions[j+2]=s.z;
  const y=((s.y-time*8*s.speed)%13+13)%13;
  w.rainPositions[k]=s.x;w.rainPositions[k+1]=y;w.rainPositions[k+2]=s.z;w.rainPositions[k+3]=s.x+.07;w.rainPositions[k+4]=y+.35;w.rainPositions[k+5]=s.z;
 }
 w.particles.visible=w.particleMat.uniforms.alpha.value>0;w.rain.visible=w.rainMat.opacity>0;
 if(w.particles.visible)w.particles.geometry.attributes.position.needsUpdate=true;if(w.rain.visible)w.rain.geometry.attributes.position.needsUpdate=true;
 const {dummy,color,origin}=w.scratch;
 if(w.falling.visible){
 for(const tree of w.trees)tree.group.updateWorldMatrix(true,false);
 for(let i=0;i<w.falling.count;i++){
  const tree=w.trees[i%2],s=tree.seeds[(i*137)%tree.seeds.length];
  const speed=.12+s.drop*.055,life=((time*speed+s.tone)%1+1)%1;
  origin.copy(s.petioleEnd).applyMatrix4(tree.group.matrixWorld);
  const duration=1/speed,age=life*duration;
  const floor=terrainY(origin.x,origin.z)+.03;
  // Shed from actual canopy attachments, then descend; no spring leaf confetti.
  dummy.position.set(origin.x+Math.sin(age*1.2+s.tone*TAU)*life*.65,Math.max(floor,origin.y-age*age*.16),origin.z+Math.sin(age*.7)*life*.42);
  dummy.quaternion.copy(tree.group.quaternion).multiply(s.quaternion);
  dummy.rotateX(age*.7);dummy.rotateZ(age*.5);
  dummy.scale.setScalar(autumn*s.scale*.85*(1-T.MathUtils.smoothstep(life,.9,1)));dummy.updateMatrix();w.falling.setMatrixAt(i,dummy.matrix);
  color.set("#c68832");w.falling.setColorAt(i,color);
 }
 w.falling.instanceMatrix.needsUpdate=true;w.falling.instanceColor.needsUpdate=true;
 }
 return true;
}
export function disposeGarden(w){
 const geometries=new Set(),materials=new Set(),textures=new Set(Object.values(w.assets));
 w.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
 for(const m of Object.values(w.surfaces))materials.add(m);
 for(const tree of w.trees){materials.add(tree.petioles.material);geometries.add(tree.petioles.geometry);}
 materials.add(w.leafDepth);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
