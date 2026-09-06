import * as T from "three";
// Spatial batches retain every instance and use THREE's separate camera/light
// frustum tests. Never toggle visibility based on the viewer's camera.
export function batchInstances(source,cellSize,padding=0){
 const cells=new Map(),matrix=new T.Matrix4();
 for(let i=0;i<source.count;i++){
  source.getMatrixAt(i,matrix);
  const e=matrix.elements,key=[Math.floor(e[12]/cellSize),Math.floor(e[13]/cellSize),Math.floor(e[14]/cellSize)].join(":");
  if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
 }
 const group=new T.Group(),batches=[];
 for(const indices of cells.values()){
  const mesh=new T.InstancedMesh(source.geometry,source.material,indices.length);
  mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.customDepthMaterial=source.customDepthMaterial;
  mesh.instanceMatrix.setUsage(source.instanceMatrix.usage);
  if(source.instanceColor)mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(indices.length*3),3);
  indices.forEach((index,i)=>{
   mesh.instanceMatrix.array.set(source.instanceMatrix.array.subarray(index*16,index*16+16),i*16);
   if(source.instanceColor)mesh.instanceColor.array.set(source.instanceColor.array.subarray(index*3,index*3+3),i*3);
  });
  mesh.computeBoundingSphere();mesh.boundingSphere.radius+=padding;
  mesh.frustumCulled=true;mesh.updateMatrix();mesh.matrixAutoUpdate=false;
  group.add(mesh);batches.push({mesh,indices});
 }
 group.updateMatrix();group.matrixAutoUpdate=false;
 return {group,batches,source};
}
export function syncBatches(batch,colors=true){
 const source=batch.source;
 for(const {mesh,indices} of batch.batches){
  const m=mesh.instanceMatrix.array,c=mesh.instanceColor?.array,sm=source.instanceMatrix.array,sc=source.instanceColor?.array;
  for(let i=0;i<indices.length;i++){
   const index=indices[i],a=index*16,b=i*16;
   for(let j=0;j<16;j++)m[b+j]=sm[a+j];
   if(colors&&c&&sc){const a=index*3,b=i*3;c[b]=sc[a];c[b+1]=sc[a+1];c[b+2]=sc[a+2];}
  }
  mesh.instanceMatrix.needsUpdate=true;if(colors&&mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 }
}
