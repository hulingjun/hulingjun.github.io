import * as T from "three";
import {HDRLoader} from "three/addons/loaders/HDRLoader.js";
import {Sky} from "three/addons/objects/Sky.js";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
export function seeded(seed=19){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
const TAU=Math.PI*2;
const up=new T.Vector3(0,1,0);
const palettes={
 real:[
  {sky:"#b3cdc2",fog:"#b8cbb4",leaf:"#a0b958",tip:"#d3dd9b",ground:"#89946c",sun:"#ffebcb"},
  {sky:"#a8d4e0",fog:"#b1cebf",leaf:"#5d9141",tip:"#a4bd5a",ground:"#668747",sun:"#fff5da"},
  {sky:"#e1bf9c",fog:"#c3b199",leaf:"#cb651c",tip:"#eabb41",ground:"#a58f58",sun:"#ffd39a"},
  {sky:"#c3d3df",fog:"#d5dfe2",leaf:"#bbc9cb",tip:"#e3e9e6",ground:"#dee5e4",sun:"#e3edf8"}
 ],
 anime:[
  {sky:"#a8deed",fog:"#cce8db",leaf:"#edacca",tip:"#ffe5eb",ground:"#98bf76",sun:"#ffedc5"},
  {sky:"#7cceeb",fog:"#b9e0c5",leaf:"#55a45d",tip:"#b9db67",ground:"#74ad69",sun:"#fff0a4"},
  {sky:"#eac49a",fog:"#e3c5a9",leaf:"#e98b42",tip:"#ffce66",ground:"#c5a769",sun:"#ffce88"},
  {sky:"#b8d5ed",fog:"#d4e4ee",leaf:"#b6c6df",tip:"#ffffff",ground:"#e7eef3",sun:"#f5efeb"}
 ],
 ink:[
  {sky:"#eee9db",fog:"#e8e4d8",leaf:"#687b66",tip:"#a9b59b",ground:"#cbcebc",sun:"#b7624e"},
  {sky:"#eee9db",fog:"#e3e3d5",leaf:"#405c52",tip:"#8b9c7c",ground:"#b8c4b2",sun:"#bb614e"},
  {sky:"#eee9db",fog:"#e5ded0",leaf:"#856447",tip:"#b99a67",ground:"#c9baa0",sun:"#aa5949"},
  {sky:"#eee9df",fog:"#e8e7df",leaf:"#5c6562",tip:"#aab1ac",ground:"#e3e4dc",sun:"#a75b50"}
 ]
};
function terrainY(x,z){return -.25+.22*Math.sin(x*.29)*Math.cos(z*.31)+.13*Math.sin(x*.71+z*.24);}
function geometryForBranch(points,startRadius,endRadius){
 const curve=new T.CatmullRomCurve3(points),steps=points.length*3,radial=8;
 const frames=curve.computeFrenetFrames(steps,false),pos=[],normal=[],uv=[],indices=[];
 for(let i=0;i<=steps;i++){
  const p=curve.getPointAt(i/steps),radius=T.MathUtils.lerp(startRadius,endRadius,i/steps);
  for(let j=0;j<=radial;j++){
   const angle=j/radial*TAU,n=frames.normals[i].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i],Math.sin(angle));
   const v=p.clone().addScaledVector(n,radius*(1+.065*Math.sin(j*4+i*.7)));
   pos.push(v.x,v.y,v.z);normal.push(n.x,n.y,n.z);uv.push(j/radial,i/steps*points[0].distanceTo(points.at(-1))*1.3);
   if(i<steps&&j<radial){const a=i*(radial+1)+j,b=a+radial+1;indices.push(a,a+1,b,b,a+1,b+1);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("normal",new T.Float32BufferAttribute(normal,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(indices);return g;
}
function leafGeometry(){
 const g=new T.PlaneGeometry(.18,.32,2,4),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,.045*Math.sin((y/.32+.5)*Math.PI)+Math.abs(x)*.2);}
 g.computeVertexNormals();return g;
}
function gradient(){
 const map=new T.DataTexture(new Uint8Array([65,130,195,255]),4,1,T.RedFormat);
 map.minFilter=map.magFilter=T.NearestFilter;map.needsUpdate=true;return map;
}
function surface(kind,assets,grad){
 const common={side:kind==="leaf"?T.DoubleSide:T.FrontSide};
 const map=kind==="bark"?assets.bark:kind==="ground"?assets.ground:assets.leaf;
 const real=new T.MeshStandardMaterial({...common,map:map||null,roughness:kind==="leaf"?.68:.94,metalness:0});
 if(kind==="bark"&&assets.barkNormal){real.normalMap=assets.barkNormal;real.normalScale.set(.7,.7);}
 if(kind==="bark"&&assets.barkRoughness)real.roughnessMap=assets.barkRoughness;
 const toon=new T.MeshToonMaterial({...common,gradientMap:grad});
 const ink=new T.MeshLambertMaterial({...common});
 if(kind==="leaf"){
  // The extracted leaf is RGBA, shared by shadow depth and all three styles.
  for(const material of [real,toon,ink]){
   material.map=(material===real?assets.leaf:assets.leafSilhouette)||null;material.alphaTest=.42;
   material.forceSinglePass=true;
  }
 }
 return {real,anime:toon,ink};
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
    transformed.z+=wave*.035*(uv.y+.2);
    transformed.x+=sin(gardenTime*.8+seed)*.018;
   #endif
  `);
 };
 material.customProgramCacheKey=()=>"garden-leaf-wind-v2";
}
export async function loadGardenAssets(){
 const loader=new T.TextureLoader();
 const names={bark:"bark.webp",barkNormal:"bark-normal.webp",barkRoughness:"bark-roughness.webp",ground:"ground.webp",leaf:"leaf.png",leafSilhouette:"leaf-silhouette.png"};
 const assets={};
 try{
  const loaded=await Promise.allSettled(Object.entries(names).map(async([key,file])=>{
   const texture=await loader.loadAsync("/garden-assets/"+file);assets[key]=texture;
   if(["bark","ground","leaf"].includes(key))texture.colorSpace=T.SRGBColorSpace;
   texture.anisotropy=4;
   if(key!=="leaf"&&key!=="leafSilhouette"){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(key==="ground"?55:1,key==="ground"?55:2);}
  }));
  const failed=loaded.find(r=>r.status==="rejected");if(failed)throw failed.reason;
  assets.environment=await new HDRLoader().loadAsync("/garden-assets/environment.hdr");
  assets.environment.mapping=T.EquirectangularReflectionMapping;
  return assets;
 }catch(error){Object.values(assets).forEach(t=>t.dispose());throw error;}
}
export function buildGarden(low=false,assets={}){
 const random=seeded(1337),scene=new T.Scene(),wind={value:0},snowWeight={value:0},grad=gradient();
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
 const disc=new T.Mesh(new T.SphereGeometry(1.45,32,24),new T.MeshBasicMaterial({color:"#bb614e",fog:false}));disc.position.copy(sunDirection).multiplyScalar(55);scene.add(disc);disc.visible=false;

 const surfaces={bark:surface("bark",assets,grad),leaf:surface("leaf",assets,grad),ground:surface("ground",assets,grad)};
 surfaces.ground.real.onBeforeCompile=shader=>{
  shader.uniforms.gardenSnow=snowWeight;
  shader.fragmentShader="uniform float gardenSnow;\n"+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>","#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.90,.93),gardenSnow);");
 };
 Object.values(surfaces.leaf).forEach(m=>windShader(m,wind));
 const groundGeo=new T.PlaneGeometry(170,170,low?80:120,low?80:120);groundGeo.rotateX(-Math.PI/2);
 const gp=groundGeo.attributes.position;
 for(let i=0;i<gp.count;i++)gp.setY(i,terrainY(gp.getX(i),gp.getZ(i)));
 groundGeo.computeVertexNormals();
 const ground=new T.Mesh(groundGeo,surfaces.ground.real);ground.receiveShadow=true;scene.add(ground);
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
  const branchParts=[],tips=[];
  const trunk=[];
  for(let i=0;i<=8;i++)trunk.push(new T.Vector3(Math.sin(i*.53)*.16,i*.65,Math.sin(i*.44)*.12));
  branchParts.push(geometryForBranch(trunk,.3,.018));
  function branch(start,direction,length,radius,depth){
   const points=[start.clone()];const dir=direction.clone();
   for(let j=1;j<=4;j++){
    dir.x+= (random()-.5)*.13;dir.z+=(random()-.5)*.13;dir.y+=.12;dir.normalize();
    points.push(points.at(-1).clone().addScaledVector(dir,length/4));
   }
   branchParts.push(geometryForBranch(points,radius,radius*.22));
   if(depth===1)tips.push({point:points[3],direction:dir});
   if(depth===0){tips.push({point:points.at(-1),direction:dir});tips.push({point:points[3],direction:dir});return;}
   for(let j=0;j<3;j++){
    const at=j===0?points[3]:points[4],az=random()*TAU;
    const next=dir.clone().multiplyScalar(1.05).add(new T.Vector3(Math.cos(az)*.43,.12+random()*.3,Math.sin(az)*.43)).normalize();
    branch(at,next,length*(.53+random()*.17),radius*.48,depth-1);
   }
  }
  for(let j=0;j<11;j++){
   const t=.24+j*.063,idx=Math.floor(t*8),start=trunk[idx].clone().lerp(trunk[idx+1],t*8-idx);
   const az=j*2.399+treeIndex*.7,dir=new T.Vector3(Math.cos(az),.32+t*.8,Math.sin(az)).normalize();
   branch(start,dir,(2.65-t*1.25)*(1+random()*.2),.115*(1-t*.65),2);
  }
  for(let j=0;j<6;j++){
   const az=j/6*TAU;
   branchParts.push(geometryForBranch([new T.Vector3(Math.cos(az)*.95,-.05,Math.sin(az)*.95),new T.Vector3(Math.cos(az)*.36,.05,Math.sin(az)*.36),new T.Vector3(0,.45,0)],.035,.13));
  }
  const bark=new T.Mesh(mergeGeometries(branchParts),surfaces.bark.real);branchParts.forEach(g=>g.dispose());
  bark.castShadow=true;bark.receiveShadow=true;group.add(bark);
  const seeds=[],leavesPerTip=low?18:34;
  for(const tip of tips)for(let j=0;j<leavesPerTip;j++){
   const spread=.1+random()*.46,az=random()*TAU,y=random()-.3;
   seeds.push({x:tip.point.x+Math.cos(az)*spread,y:tip.point.y+y*.4,z:tip.point.z+Math.sin(az)*spread,
    rx:random()*TAU,ry:random()*TAU,rz:random()*TAU,scale:.6+random()*.9,tone:random(),drop:random()});
  }
  const leaves=new T.InstancedMesh(leafGeo,surfaces.leaf.real,seeds.length);leaves.frustumCulled=false;leaves.castShadow=true;leaves.receiveShadow=true;leaves.customDepthMaterial=leafDepth;
  leaves.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(leaves);
  const snow=new T.Mesh(bark.geometry,new T.MeshStandardMaterial({color:"#e7edf0",roughness:1,transparent:true,opacity:0,polygonOffset:true,polygonOffsetFactor:-1}));
  snow.material.onBeforeCompile=shader=>{
   shader.vertexShader="varying float gardenUp;\n"+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace("#include <beginnormal_vertex>","#include <beginnormal_vertex>\n gardenUp=(mat3(modelMatrix)*objectNormal).y;");
   shader.fragmentShader="varying float gardenUp;\n"+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace("#include <alphatest_fragment>","#include <alphatest_fragment>\n diffuseColor.a*=smoothstep(.05,.55,gardenUp);if(diffuseColor.a<.02)discard;");
  };
  snow.material.depthWrite=false;
  snow.scale.setScalar(1.018);group.add(snow);
  trees.push({group,bark,leaves,seeds,snow});
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
 scene.add(grass);
 const count=low?180:440,seeds=[],positions=new Float32Array(count*3),rainPositions=new Float32Array(count*6);
 for(let i=0;i<count;i++)seeds.push({x:(random()-.5)*24,y:random()*13,z:(random()-.5)*18,phase:random()*TAU,speed:.5+random()});
 const particlesGeo=new T.BufferGeometry();particlesGeo.setAttribute("position",new T.BufferAttribute(positions,3));
 const particleMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{tint:{value:new T.Color("#ffe4d3")},size:{value:6},alpha:{value:.5}},vertexShader:`
  uniform float size;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*18./-p.z,1.,12.);gl_Position=projectionMatrix*p;}
 `,fragmentShader:`
  uniform vec3 tint;uniform float alpha;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.12,.5,d);gl_FragColor=vec4(tint,a*alpha);}
 `});
 const particles=new T.Points(particlesGeo,particleMat);particles.frustumCulled=false;scene.add(particles);
 const rainGeo=new T.BufferGeometry();rainGeo.setAttribute("position",new T.BufferAttribute(rainPositions,3));
 const rainMat=new T.LineBasicMaterial({color:"#b3d3df",transparent:true,opacity:0,depthWrite:false});
 const rain=new T.LineSegments(rainGeo,rainMat);rain.frustumCulled=false;scene.add(rain);
 const falling=new T.InstancedMesh(leafGeo,surfaces.leaf.real,low?45:95);falling.frustumCulled=false;scene.add(falling);
 const fallen=new T.InstancedMesh(leafGeo,surfaces.leaf.real,low?160:380);fallen.frustumCulled=false;scene.add(fallen);
 for(let i=0;i<fallen.count;i++){
  const az=random()*TAU,r=Math.sqrt(random())*3.1,x=(i%2===0?-2.7:2.8)+Math.cos(az)*r,z=Math.sin(az)*r;
  dummy.position.set(x,terrainY(x,z)+.025,z);dummy.rotation.set(-Math.PI/2,0,random()*TAU);dummy.scale.setScalar(.45+random()*.65);dummy.updateMatrix();fallen.setMatrixAt(i,dummy.matrix);color.set("#be6c29").lerp(new T.Color("#ddae54"),random());fallen.setColorAt(i,color);
 }
 return {scene,assets,grad,wind,snowWeight,surfaces,trees,ground,grass,mountains,sky,disc,light,hemi,fill,particles,particleMat,positions,rain,rainMat,rainPositions,particleSeeds:seeds,falling,fallen,leafDepth,style:"",seasonKey:"",low};
}
export function setGardenStyle(w,style){
 if(!palettes[style])style="real";
 w.style=style;w.seasonKey="";w.scene.environment=style==="real"?(w.assets.environment||null):null;w.scene.environmentIntensity=.3;
 for(const tree of w.trees){tree.bark.material=w.surfaces.bark[style];tree.leaves.material=w.surfaces.leaf[style];}
 w.ground.material=w.surfaces.ground[style];w.falling.material=w.fallen.material=w.surfaces.leaf[style];
 w.sky.visible=style==="real";w.disc.visible=style!=="real";
 w.light.intensity=style==="real"?2.6:2.2;w.hemi.intensity=style==="ink"?2.8:style==="real"?1.05:1.6;
 w.grass.count=style==="ink"?(w.low?160:350):style==="anime"?(w.low?1500:3500):(w.low?4000:10000);
}
export function updateGarden(w,state,time){
 const {from,to,mix}=state,style=w.style||"real",palette=palettes[style],a=palette[from],b=palette[to];
 const blend=key=>new T.Color(a[key]).lerp(new T.Color(b[key]),mix);
 const weight=i=>(from===i?1-mix:0)+(to===i?mix:0);
 const spring=weight(0),summer=weight(1),autumn=weight(2),winter=weight(3);
 w.wind.value=time;w.snowWeight.value=winter;
 const sunshine=new T.Vector3(.32,.25+summer*.035-winter*.07+Math.sin(time*.055)*.018,-.92).normalize();
 w.sky.material.uniforms.sunPosition.value.copy(sunshine);w.light.position.copy(sunshine).multiplyScalar(25);w.disc.position.copy(sunshine).multiplyScalar(55);
 const key=[style,from,to,mix.toFixed(3)].join(":");
 if(w.seasonKey!==key){
  w.seasonKey=key;w.scene.background.copy(blend("sky"));w.scene.fog.color.copy(blend("fog"));
  w.scene.fog.near=style==="ink"?24:28;w.scene.fog.far=style==="ink"?92:110;
  w.ground.material.color.copy(blend("ground"));
  w.grass.material.color.copy(blend("ground")).multiplyScalar(style==="real"?.72:.9);
  w.grass.visible=winter<.95;
  w.light.color.copy(blend("sun"));w.disc.material.color.copy(blend("sun"));
  w.sky.material.uniforms.rayleigh.value=1.4+autumn*.7-winter*.4;
  w.sky.material.uniforms.turbidity.value=3+spring*2+winter*4;
  w.surfaces.bark[style].color.set(style==="ink"?"#414b47":style==="anime"?"#775750":"#c0ada0");
  const c1=blend("leaf"),c2=blend("tip"),dummy=new T.Object3D(),color=new T.Color();
  for(const tree of w.trees){
   tree.snow.material.opacity=winter*.9;tree.snow.visible=winter>.01;
   for(let i=0;i<tree.seeds.length;i++){
    const s=tree.seeds[i];
    // Individual leaf shedding exposes the full twig structure in winter.
    const density=Math.max(0,1-winter-autumn*s.drop*.58);
    const size=s.scale*density*(.82+summer*.18);
    dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(s.rx,s.ry,s.rz);dummy.scale.setScalar(size);dummy.updateMatrix();tree.leaves.setMatrixAt(i,dummy.matrix);
    color.copy(c1).lerp(c2,s.tone);tree.leaves.setColorAt(i,color);
   }
   tree.leaves.instanceMatrix.needsUpdate=true;tree.leaves.instanceColor.needsUpdate=true;
  }
  w.mountains.forEach((m,i)=>m.material.color.set(style==="ink"?"#62716a":"#728b78").lerp(w.scene.fog.color,.2+i*.18));
  w.falling.visible=autumn>.01||spring>.01;w.fallen.visible=autumn>.01;w.fallen.scale.set(1,Math.max(.01,autumn),1);
  w.particleMat.uniforms.tint.value.set(style==="ink"?"#8d9282":winter>.5?"#ffffff":spring>.5?"#ffdbe6":"#fff4bd");
 }
 w.trees.forEach((tree,i)=>{tree.group.rotation.z=Math.sin(time*.65+i)*.006+Math.sin(time*.31)*.004;});
 w.particleMat.uniforms.alpha.value=winter*.95+spring*.5+summer*.2+autumn*.12;
 w.particleMat.uniforms.size.value=3+winter*4+spring*2;
 w.rainMat.opacity=(spring*.11+summer*.19)*(.65+Math.sin(time*.19)*.35);
 for(let i=0;i<w.particleSeeds.length;i++){
  const s=w.particleSeeds[i],j=i*3,k=i*6;
  w.positions[j]=s.x+Math.sin(time*.28+s.phase)*.7;
  w.positions[j+1]=((s.y-time*(.2+winter*.8)*s.speed)%13+13)%13-.1;w.positions[j+2]=s.z;
  const y=((s.y-time*8*s.speed)%13+13)%13;
  w.rainPositions[k]=s.x;w.rainPositions[k+1]=y;w.rainPositions[k+2]=s.z;w.rainPositions[k+3]=s.x+.07;w.rainPositions[k+4]=y+.35;w.rainPositions[k+5]=s.z;
 }
 w.particles.geometry.attributes.position.needsUpdate=true;w.rain.geometry.attributes.position.needsUpdate=true;
 const dummy=new T.Object3D(),color=new T.Color();
 for(let i=0;i<w.falling.count;i++){
  const s=w.particleSeeds[i],life=((time*.21*s.speed+s.phase)%1+1)%1;
  dummy.position.set((i%2===0?-2.7:2.8)+Math.sin(s.phase)*2+Math.sin(time*.7+s.phase)*life,5.5*(1-life),Math.cos(s.phase)*2+Math.sin(time*.3)*life);
  dummy.rotation.set(time+s.phase,time*.7+s.phase,time*.5+s.phase);
  dummy.scale.setScalar((autumn*.8+spring*.38)*(.6+s.speed*.3));dummy.updateMatrix();w.falling.setMatrixAt(i,dummy.matrix);
  color.set(spring>autumn?"#efced0":"#c68832");w.falling.setColorAt(i,color);
 }
 w.falling.instanceMatrix.needsUpdate=true;w.falling.instanceColor.needsUpdate=true;
}
export function disposeGarden(w){
 const geometries=new Set(),materials=new Set(),textures=new Set([w.grad,...Object.values(w.assets)]);
 w.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
 for(const variants of Object.values(w.surfaces))for(const m of Object.values(variants))materials.add(m);
 materials.add(w.leafDepth);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
