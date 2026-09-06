// Keep full-quality frames, but never queue stale camera views behind a busy
// GPU. A zero-timeout fence poll yields to input without blocking the CPU.
export function createPresentation(renderer,scene,camera){
 const gl=renderer.getContext();let fence=null;
 const supported=typeof gl.fenceSync==="function";
 return {
  resize(){},
  ready(){
   if(!fence)return true;
   const status=gl.clientWaitSync(fence,0,0);
   if(status===gl.TIMEOUT_EXPIRED)return false;
   gl.deleteSync(fence);fence=null;return true;
  },
  render(){
   renderer.render(scene,camera);
   if(supported){fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();}
  },
  dispose(){if(fence)gl.deleteSync(fence);fence=null;}
 };
}
