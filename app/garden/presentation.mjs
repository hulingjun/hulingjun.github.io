// A single physical-material scene. Direct rendering preserves ACES/output color
// management and avoids the former cartoon/ink full-screen shader passes.
export function createPresentation(renderer,scene,camera){
 return {resize(){},render(){renderer.render(scene,camera);},dispose(){}};
}
