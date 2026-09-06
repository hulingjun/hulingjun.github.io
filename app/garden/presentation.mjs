import * as T from "three";
import {EffectComposer} from "three/addons/postprocessing/EffectComposer.js";
import {RenderPass} from "three/addons/postprocessing/RenderPass.js";
import {ShaderPass} from "three/addons/postprocessing/ShaderPass.js";
import {OutputPass} from "three/addons/postprocessing/OutputPass.js";
export const STYLES=[
 {id:"real",name:"写实",description:"自然光 · 真实纹理"},
 {id:"anime",name:"动漫",description:"赛璐璐 · 明快色层"},
 {id:"ink",name:"水墨",description:"淡墨远山 · 宣纸留白"},
];
const vertexShader="varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
const fragmentShader=`
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float mode;
varying vec2 vUv;
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec3 c=texture2D(tDiffuse,vUv).rgb;
 vec2 px=1./resolution;
 float l=lum(c);
 float dx=lum(texture2D(tDiffuse,vUv+vec2(px.x,0.)).rgb)-lum(texture2D(tDiffuse,vUv-vec2(px.x,0.)).rgb);
 float dy=lum(texture2D(tDiffuse,vUv+vec2(0.,px.y)).rgb)-lum(texture2D(tDiffuse,vUv-vec2(0.,px.y)).rgb);
 float edge=smoothstep(.045,.3,length(vec2(dx,dy)));
 if(mode>.5&&mode<1.5){
   c=mix(c,vec3(.09,.14,.17),edge*.38);
   c=mix(vec3(l),c,1.13);
 }else if(mode>1.5){
   vec3 base=c;
   float grain=hash(floor(vUv*resolution))-.5;
   float fibers=sin(vUv.x*resolution.x*.85+sin(vUv.y*resolution.y*.19));
   vec3 paper=vec3(.94,.914,.845);
   float wash=smoothstep(.04,.85,l);
   c=mix(vec3(.12,.16,.155),paper,wash);
   c-=edge*.035;
   c+=(grain*.022+fibers*.004);
   float vermilion=step(base.g*1.15,base.r)*step(base.b*1.25,base.r)*step(.3,base.r);
   c=mix(c,vec3(.61,.27,.20),vermilion*.7);
 }
 gl_FragColor=vec4(c,1.);
}`;
export function createPresentation(renderer,scene,camera){
 const composer=new EffectComposer(renderer);
 composer.addPass(new RenderPass(scene,camera));
 const pass=new ShaderPass({uniforms:{tDiffuse:{value:null},resolution:{value:new T.Vector2(1,1)},mode:{value:0}},vertexShader,fragmentShader});
 composer.addPass(new OutputPass());composer.addPass(pass);
 return {
  setStyle(id){pass.uniforms.mode.value=id==="ink"?2:id==="anime"?1:0;},
  resize(w,h){composer.setSize(w,h);pass.uniforms.resolution.value.set(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());},
  render(){composer.render();},
  dispose(){for(const p of composer.passes)p.dispose?.();composer.dispose();}
 };
}
