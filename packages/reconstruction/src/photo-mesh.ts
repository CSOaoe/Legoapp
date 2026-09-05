import type {MeshTriangle,ParsedMesh,Vector3} from "./mesh-import";
import type {SilhouetteProfile} from "./reconstruct";

const sample=(values:number[]|undefined,position:number,fallback=0)=>{if(!values?.length)return fallback;const scaled=Math.max(0,Math.min(values.length-1,position*(values.length-1))),low=Math.floor(scaled),high=Math.ceil(scaled),mix=scaled-low;return(values[low]??fallback)*(1-mix)+(values[high]??fallback)*mix};
const vertexKey=(vertex:Vector3)=>vertex.map(value=>Number(value.toPrecision(7))).join(",");

function boundsOf(triangles:MeshTriangle[]){const min:Vector3=[Infinity,Infinity,Infinity],max:Vector3=[-Infinity,-Infinity,-Infinity];for(const triangle of triangles)for(const vertex of triangle)for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],vertex[axis]);max[axis]=Math.max(max[axis],vertex[axis])}return{min,max}}

export function createPhotoMesh(front:SilhouetteProfile,side:SilhouetteProfile,name="Photo reconstruction.obj",ringCount=64,radialSegments=32):ParsedMesh{
 const rings=Math.max(12,Math.min(96,ringCount)),segments=Math.max(12,Math.min(64,radialSegments)),vertices:Vector3[][]=[];
 const frontAspect=Math.max(.08,front.aspectRatio??.6),sideAspect=Math.max(.08,side.aspectRatio??.6);
 for(let ring=0;ring<rings;ring++){
  const y=ring/(rings-1),frontWidth=Math.max(.004,sample(front.widths,y,.2)*frontAspect),sideWidth=Math.max(.004,sample(side.widths,y,.2)*sideAspect),centreX=sample(front.offsets,y)*frontAspect,centreZ=sample(side.offsets,y)*sideAspect,row:Vector3[]=[];
  for(let segment=0;segment<segments;segment++){const angle=segment/segments*Math.PI*2;row.push([centreX+Math.cos(angle)*frontWidth/2,y,centreZ+Math.sin(angle)*sideWidth/2])}vertices.push(row);
 }
 const triangles:MeshTriangle[]=[];
 for(let ring=0;ring<rings-1;ring++)for(let segment=0;segment<segments;segment++){const next=(segment+1)%segments,a=vertices[ring][segment],b=vertices[ring][next],c=vertices[ring+1][segment],d=vertices[ring+1][next];triangles.push([a,c,b],[b,c,d])}
 const bottom:Vector3=[sample(front.offsets,0)*frontAspect,0,sample(side.offsets,0)*sideAspect],top:Vector3=[sample(front.offsets,1)*frontAspect,1,sample(side.offsets,1)*sideAspect];
 for(let segment=0;segment<segments;segment++){const next=(segment+1)%segments;triangles.push([bottom,vertices[0][next],vertices[0][segment]],[top,vertices[rings-1][segment],vertices[rings-1][next]])}
 return{name,format:"OBJ",triangles,vertexCount:new Set(triangles.flat().map(vertexKey)).size,bounds:boundsOf(triangles),closedConfidence:Math.min(front.confidence,side.confidence)};
}

export function exportMeshObj(mesh:ParsedMesh){const vertices:Vector3[]=[],indices=new Map<string,number>(),faces:string[]=[];for(const triangle of mesh.triangles){const face=triangle.map(vertex=>{const key=vertexKey(vertex);let index=indices.get(key);if(!index){vertices.push(vertex);index=vertices.length;indices.set(key,index)}return index});faces.push(`f ${face.join(" ")}`)}return[`# BrickForge AI photo-to-3D mesh`,`o ${mesh.name.replace(/\.[^.]+$/,"").replace(/\s+/g,"_")}`,...vertices.map(vertex=>`v ${vertex.join(" ")}`),...faces,""].join("\n")}

export function exportMeshStl(mesh:ParsedMesh){const normal=(triangle:MeshTriangle)=>{const[a,b,c]=triangle,ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...cross)||1;return cross.map(value=>value/length)};const lines=[`solid brickforge_photo_mesh`];for(const triangle of mesh.triangles){lines.push(`  facet normal ${normal(triangle).join(" ")}`,"    outer loop",...triangle.map(vertex=>`      vertex ${vertex.join(" ")}`),"    endloop","  endfacet")}lines.push("endsolid brickforge_photo_mesh","");return lines.join("\n")}
