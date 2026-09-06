import {mkdir,readFile,writeFile,mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
const require=createRequire(join(resolve(process.env.GALLERY_TOOLS_DIR||"node_modules"),"garden-loader.cjs"));
const sharp=require("sharp");
const output=resolve("github-pages/public/garden-assets");
await mkdir(output,{recursive:true});
const assets=[
 {name:"bark",file:"bark_brown_01_diff_1k.jpg",folder:"bark_brown_01",hash:"b6d5dcde10b7cd1b36d70cd33a34724a"},
 {name:"bark-normal",file:"bark_brown_01_nor_gl_1k.jpg",folder:"bark_brown_01",hash:"8ae9907be7ce562c11aab619615d30d4"},
 {name:"bark-roughness",file:"bark_brown_01_rough_1k.jpg",folder:"bark_brown_01",hash:"b7a1aa42ecf0b30aba7f587769d13910"},
 {name:"ground",file:"grass_path_2_diff_1k.jpg",folder:"grass_path_2",hash:"48cebe95af233211c9469a9bfe2f42f2"},
];
async function download(url,hash,algorithm="md5"){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
   if(!response.ok)throw Error("Asset HTTP "+response.status);
   const buffer=Buffer.from(await response.arrayBuffer());
   if(buffer.length>12000000)throw Error("Oversize asset");
   if(createHash(algorithm).update(buffer).digest("hex")!==hash)throw Error("Asset checksum mismatch: "+url);
   return buffer;
  }catch(e){if(attempt===2)throw e;}
 }
}
await Promise.all(assets.map(async a=>{
 const buffer=await download("https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/"+a.folder+"/"+a.file,a.hash);
 await sharp(buffer).webp({quality:a.name==="bark-normal"?95:87}).toFile(join(output,a.name+".webp"));
}));
const zip=await download("https://ambientcg.com/get?file=LeafSet022_1K-JPG.zip","41f9ac9ba8df754dc7612f48c6178d14f6edca6b","sha1");
const temp=await mkdtemp(join(tmpdir(),"garden-leaf-")),archive=join(temp,"leaf.zip");
await writeFile(archive,zip);
const color=execFileSync("unzip",["-p",archive,"LeafSet022_1K-JPG_Color.jpg"],{maxBuffer:4000000});
const opacity=execFileSync("unzip",["-p",archive,"LeafSet022_1K-JPG_Opacity.jpg"],{maxBuffer:4000000});
const rect={left:384,top:16,width:256,height:480};
const alpha=await sharp(opacity).extract(rect).greyscale().raw().toBuffer();
const rawOptions={raw:{width:rect.width,height:rect.height,channels:1}};
await sharp(color).extract(rect).modulate({saturation:0,brightness:1.65}).joinChannel(alpha,rawOptions).png().toFile(join(output,"leaf.png"));
await sharp({create:{width:rect.width,height:rect.height,channels:3,background:"#ffffff"}}).joinChannel(alpha,rawOptions).png().toFile(join(output,"leaf-silhouette.png"));
const credits={license:"CC0-1.0",assets:[
 {name:"Bark Brown 01",author:"Rob Tuytel",source:"https://polyhaven.com/a/bark_brown_01",license:"https://polyhaven.com/license",use:"PBR bark color, OpenGL normal, roughness; converted to WebP"},
 {name:"Grass Path 2",author:"Rob Tuytel",source:"https://polyhaven.com/a/grass_path_2",license:"https://polyhaven.com/license",use:"Meadow terrain color; converted to WebP"},
 {name:"Leaf Set 022",author:"ambientCG",source:"https://ambientcg.com/a/LeafSet022",license:"https://docs.ambientcg.com/license/",use:"Single complete leaf crop with opacity; luminance detail and silhouette variants"},
 {name:"Analytic sky and scene rendering",author:"three.js contributors",source:"https://github.com/mrdoob/three.js",license:"MIT"}
]};
await writeFile(join(output,"credits.json"),JSON.stringify(credits,null,2)+"\n");
for(const file of ["leaf.png","leaf-silhouette.png"]){
 const m=await sharp(join(output,file)).metadata();
 if(!m.hasAlpha||m.width!==256||m.height!==480)throw Error("Invalid leaf RGBA");
}
console.log("Prepared six verified same-origin garden textures with credits.");
