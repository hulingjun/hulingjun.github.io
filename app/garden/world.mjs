import * as T from "three";
import {SEASONS} from "./seasons.mjs";
export {SEASONS} from "./seasons.mjs";
export function seeded(seed=19){let s=seed;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
export function phaseAt(time){return ((time/24)%4+4)%4}
const glowVertex="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
const glowFragment="varying vec2 vUv;uniform vec3 tint;uniform float strength;void main(){float d=length(vUv-.5)*2.;float a=pow(max(0.,1.-d),3.0)*strength;gl_FragColor=vec4(tint,a);}";
export function buildGarden(low=false){
 const scene=new T.Scene();scene.background=new T.Color(SEASONS[0].sky);scene.fog=new T.FogExp2(SEASONS[0].sky,.035);
 const hemi=new T.HemisphereLight(0xb5e7ff,0x172918,2.2);scene.add(hemi);
 const light=new T.DirectionalLight(0xffe1b0,3);light.position.set(-3,7,2);scene.add(light);
 const rim=new T.DirectionalLight(0x6ccfff,2.5);rim.position.set(4,3,-4);scene.add(rim);
 const groundMat=new T.MeshStandardMaterial({color:SEASONS[0].ground,roughness:.9,flatShading:true});
 const island=new T.Mesh(new T.SphereGeometry(5,48,16),groundMat);island.scale.set(1,.105,.56);island.position.y=-1.43;scene.add(island);
 const rock=new T.Mesh(new T.IcosahedronGeometry(4.9,1),new T.MeshStandardMaterial({color:0x142b32,metalness:.55,roughness:.55,flatShading:true}));
 rock.scale.set(1,.32,.56);rock.position.y=-2.22;scene.add(rock);
 const orbit=new T.Group();scene.add(orbit);
 for(let i=0;i<3;i++){
  const ring=new T.Mesh(new T.TorusGeometry(5.3+i*.48,.007,4,160),new T.MeshBasicMaterial({color:i===1?0x72b7ed:0x78f4db,transparent:true,opacity:.22-i*.04}));
  ring.rotation.x=Math.PI/2-.05*i;ring.rotation.y=.06*i;ring.position.y=-1.62-i*.27;orbit.add(ring);
 }
 const trees=[];const rng=seeded();const dummy=new T.Object3D();
 const leafGeo=new T.SphereGeometry(1,5,3); // Faceted, elongated 3D leaves.
 for(let treeIndex=0;treeIndex<2;treeIndex++){
  const group=new T.Group();group.position.set(treeIndex===0?-1.95:2.1,-1.13,treeIndex===0?0:.35);const scale=treeIndex===0?1:.76;group.scale.setScalar(scale);scene.add(group);
  const bark=new T.MeshStandardMaterial({color:0x745e66,roughness:.85,flatShading:true});
  const tips=[];
  function branch(start,dir,length,radius,depth){
   const end=start.clone().addScaledVector(dir,length);
   const mesh=new T.Mesh(new T.CylinderGeometry(radius*.62,radius,length,6),bark);
   mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir);group.add(mesh);
   if(depth===0){tips.push(end);return;}
   const count=depth===3?3:2;
   for(let k=0;k<count;k++){
    const angle=rng()*Math.PI*2;
    const spread=.5+rng()*.55;
    const next=new T.Vector3(dir.x*.45+Math.cos(angle)*spread,.65+rng()*.65,dir.z*.45+Math.sin(angle)*spread).normalize();
    branch(end,next,length*(.64+rng()*.12),radius*.57,depth-1);
   }
  }
  branch(new T.Vector3(),new T.Vector3(-.05,1,.03).normalize(),1.48,.19,3);
  const n=low?520:1100;
  const leafMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.55,metalness:.12,emissive:0x142b1f,emissiveIntensity:.22});
  const leaves=new T.InstancedMesh(leafGeo,leafMat,n);leaves.instanceMatrix.setUsage(T.DynamicDrawUsage);leaves.frustumCulled=false;group.add(leaves);
  const seeds=[];
  for(let i=0;i<n;i++){
   const tip=tips[i%tips.length],theta=rng()*Math.PI*2,cos=2*rng()-1,sin=Math.sqrt(1-cos*cos),r=Math.cbrt(rng())*.95;
   seeds.push({x:tip.x+Math.cos(theta)*sin*r,y:tip.y+cos*r*.8,z:tip.z+Math.sin(theta)*sin*r,size:.05+rng()*.09,phase:rng()*6.28,tone:rng(),drop:rng()});
   leaves.setColorAt(i,new T.Color().setHSL(.36,.6,.4+rng()*.3));
  }
  trees.push({group,leaves,seeds,bark});
 }
 // An atmospheric disc and halo instead of a heavy post-processing pass.
 const sunMat=new T.MeshBasicMaterial({color:SEASONS[0].sun});
 const sun=new T.Mesh(new T.SphereGeometry(.6,32,24),sunMat);sun.position.set(3.7,4.8,-4.5);scene.add(sun);
 const haloMat=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(SEASONS[0].sun)},strength:{value:.7}},vertexShader:glowVertex,fragmentShader:glowFragment,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 const halo=new T.Mesh(new T.PlaneGeometry(7,7),haloMat);halo.position.copy(sun.position);scene.add(halo);
 const starCount=low?160:400,starPos=new Float32Array(starCount*3);
 for(let i=0;i<starCount;i++){starPos[i*3]=(rng()-.5)*35;starPos[i*3+1]=rng()*15-1;starPos[i*3+2]=-8-rng()*16}
 const starGeo=new T.BufferGeometry();starGeo.setAttribute("position",new T.BufferAttribute(starPos,3));
 const stars=new T.Points(starGeo,new T.PointsMaterial({color:0xb9dfed,size:.028,transparent:true,opacity:.55,depthWrite:false}));scene.add(stars);
 const particleCount=low?180:500;const positions=new Float32Array(particleCount*3);const rainPos=new Float32Array(particleCount*6);const particleSeeds=[];
 for(let i=0;i<particleCount;i++)particleSeeds.push({x:(rng()-.5)*13,y:rng()*9,z:(rng()-.5)*7,phase:rng()*6.28,speed:.5+rng()});
 const pGeo=new T.BufferGeometry();pGeo.setAttribute("position",new T.BufferAttribute(positions,3));
 const pMat=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(0xffd7db)},size:{value:5},alpha:{value:.85}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  vertexShader:"uniform float size;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*14./-p.z,1.,12.);gl_Position=projectionMatrix*p;}",
  fragmentShader:"uniform vec3 tint;uniform float alpha;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(tint,(1.-d*d)*alpha);}"});
 const particles=new T.Points(pGeo,pMat);particles.frustumCulled=false;scene.add(particles);
 const rainGeo=new T.BufferGeometry();rainGeo.setAttribute("position",new T.BufferAttribute(rainPos,3));
 const rainMat=new T.LineBasicMaterial({color:0x9dcde8,transparent:true,opacity:0,depthWrite:false});
 const rain=new T.LineSegments(rainGeo,rainMat);rain.frustumCulled=false;scene.add(rain);
 const fallCount=low?55:140;
 const falling=new T.InstancedMesh(leafGeo,new T.MeshStandardMaterial({color:0xf8a352,roughness:.6,metalness:.1}),fallCount);falling.frustumCulled=false;scene.add(falling);
 const fallen=new T.InstancedMesh(leafGeo,new T.MeshStandardMaterial({color:0xb97c43,roughness:.8}),low?70:160);fallen.frustumCulled=false;scene.add(fallen);
 for(let i=0;i<fallen.count;i++){
  const a=rng()*6.28,r=Math.sqrt(rng())*4.6;dummy.position.set(Math.cos(a)*r,-1.12,Math.sin(a)*r*.45);dummy.rotation.set(rng(),rng()*6.28,rng());dummy.scale.set(.1,.016,.055);dummy.updateMatrix();fallen.setMatrixAt(i,dummy.matrix);
 }
 return{scene,trees,groundMat,light,orbit,sun,sunMat,halo,haloMat,particles,pMat,positions,rain,rainMat,rainPos,particleSeeds,falling,fallen,stars,low};
}
export function updateGarden(world,phase,time,camera){
 const p=((phase%4)+4)%4,index=Math.floor(p),mix=T.MathUtils.smoothstep(p-index,0,1),a=SEASONS[index],b=SEASONS[(index+1)%4];
 const blend=(key)=>new T.Color(a[key]).lerp(new T.Color(b[key]),mix);
 const weight=(i)=>index===i?1-mix:(index+1)%4===i?mix:0;
 const winter=weight(3),autumn=weight(2),spring=weight(0),summer=weight(1);
 world.scene.background.copy(blend("sky"));world.scene.fog.color.copy(world.scene.background);world.groundMat.color.copy(blend("ground"));
 world.sunMat.color.copy(blend("sun"));world.haloMat.uniforms.tint.value.copy(world.sunMat.color);world.halo.quaternion.copy(camera.quaternion);
 world.light.color.copy(blend("sun"));world.light.intensity=2.7+Math.sin(time*.12)*.25-winter*.6;
 world.sun.position.y=4.7+Math.sin(time*.1)*.25;world.halo.position.copy(world.sun.position);
 const c1=blend("leaf"),c2=blend("second"),dummy=new T.Object3D(),color=new T.Color();
 world.trees.forEach((tree,treeIndex)=>{
  tree.bark.color.set(0x745e66).lerp(new T.Color(0xb3c8dc),winter*.8);
  tree.group.rotation.z=Math.sin(time*.55+treeIndex)*.012;
  tree.seeds.forEach((s,i)=>{
   let density=T.MathUtils.lerp(a.foliage,b.foliage,mix);
   if(autumn>.1)density*=s.drop<.28?1-autumn:.95;
   dummy.position.set(s.x+Math.sin(time*1.2+s.phase)*.035,s.y,s.z+Math.cos(time*.8+s.phase)*.025);
   dummy.rotation.set(s.phase+Math.sin(time+s.phase)*.12,s.phase*2,time*.08+s.phase);
   dummy.scale.set(s.size*density,s.size*.22*density,s.size*.6*density);dummy.updateMatrix();tree.leaves.setMatrixAt(i,dummy.matrix);
   color.copy(c1).lerp(c2,s.tone*.85);tree.leaves.setColorAt(i,color);
  });
  tree.leaves.instanceMatrix.needsUpdate=true;tree.leaves.instanceColor.needsUpdate=true;
 });
 world.rainMat.opacity=(spring*.2+summer*.48)*(Math.sin(time*.32)*.5+.5);
 world.pMat.uniforms.tint.value.set(winter>.5?0xe2f2ff:spring>.5?0xffc1de:0xb9fcd6);
 world.pMat.uniforms.size.value=2+spring*3+winter*4;world.pMat.uniforms.alpha.value=.35+spring*.35+winter*.5;
 world.particleSeeds.forEach((s,i)=>{
  const y=((s.y-time*(winter*.42+spring*.22+.08)*s.speed)%9+9)%9-1;
  world.positions[i*3]=s.x+Math.sin(time*.35+s.phase)*.6;world.positions[i*3+1]=y;world.positions[i*3+2]=s.z;
  const rainY=((s.y-time*7*s.speed)%9+9)%9-1,j=i*6;
  world.rainPos[j]=s.x;world.rainPos[j+1]=rainY;world.rainPos[j+2]=s.z;world.rainPos[j+3]=s.x-.045;world.rainPos[j+4]=rainY+.28;world.rainPos[j+5]=s.z;
 });
 world.particles.geometry.attributes.position.needsUpdate=true;world.rain.geometry.attributes.position.needsUpdate=true;
 world.falling.visible=autumn>.02;world.fallen.visible=autumn>.15;
 world.fallen.scale.setScalar(.3+autumn*.7);
 for(let i=0;i<world.falling.count;i++){
  const s=world.particleSeeds[i],tree=i%2===0?-1.95:2.1,y=((s.y-time*.75*s.speed)%5+5)%5-1;
  dummy.position.set(tree+Math.sin(s.phase)*1.5+Math.sin(time*.7+s.phase)*.5,y,s.z*.35);
  dummy.rotation.set(time*.8+s.phase,time*.6+s.phase,Math.sin(time+s.phase));
  dummy.scale.set(.12*autumn,.025*autumn,.07*autumn);dummy.updateMatrix();world.falling.setMatrixAt(i,dummy.matrix);
 }
 world.falling.instanceMatrix.needsUpdate=true;world.orbit.rotation.y=time*.025;
}
export function disposeGarden(world){
 const geometries=new Set(),materials=new Set();
 world.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
