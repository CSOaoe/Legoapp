import type {AssemblyDocument,PartInstance,QuarterTurn} from "../../renderer/src/assembly";

export type SilhouetteProfile={widths:number[];confidence:number};
export type ReconstructionOptions={name:string;heightLayers:number;maxWidthStuds:number;maxDepthStuds:number;colour:number;hollow:boolean};
export type InstructionStep={number:number;layer:number;title:string;partIds:string[];summary:{partNumber:string;quantity:number}[]};
export type ReconstructionResult={document:AssemblyDocument;instructions:InstructionStep[];occupiedStuds:number;confidence:number};
export type VoxelReconstruction={width:number;depth:number;height:number;layers:Set<string>[];confidence:number};

const PIECES=[
 {partNumber:"3001",x:4,z:2,rotation:0 as QuarterTurn},{partNumber:"3001",x:2,z:4,rotation:90 as QuarterTurn},
 {partNumber:"3002",x:3,z:2,rotation:0 as QuarterTurn},{partNumber:"3002",x:2,z:3,rotation:90 as QuarterTurn},
 {partNumber:"3003",x:2,z:2,rotation:0 as QuarterTurn},{partNumber:"3004",x:2,z:1,rotation:0 as QuarterTurn},
 {partNumber:"3004",x:1,z:2,rotation:90 as QuarterTurn},{partNumber:"3005",x:1,z:1,rotation:0 as QuarterTurn},
];

const sample=(values:number[],position:number)=>{if(!values.length)return 0;const scaled=Math.max(0,Math.min(values.length-1,position*(values.length-1))),low=Math.floor(scaled),high=Math.ceil(scaled),mix=scaled-low;return values[low]*(1-mix)+values[high]*mix};
const key=(x:number,z:number)=>`${x}:${z}`;

export function reconstructFromProfiles(front:SilhouetteProfile,side:SilhouetteProfile,options:ReconstructionOptions):ReconstructionResult{
 const parts:PartInstance[]=[],steps:InstructionStep[]=[];let occupiedStuds=0,serial=1,previousBoxes:{x0:number;x1:number;z0:number;z1:number}[]=[];
 for(let layer=0;layer<options.heightLayers;layer++){
  const heightPosition=options.heightLayers===1?0:layer/(options.heightLayers-1),frontRatio=sample(front.widths,heightPosition),sideRatio=sample(side.widths,heightPosition);
  const width=Math.max(1,Math.round(options.maxWidthStuds*Math.max(.06,frontRatio))),depth=Math.max(1,Math.round(options.maxDepthStuds*Math.max(.06,sideRatio))),cells=new Set<string>();
  for(let z=0;z<depth;z++)for(let x=0;x<width;x++){
   const nx=(x+.5-width/2)/(width/2),nz=(z+.5-depth/2)/(depth/2),inside=nx*nx+nz*nz<=1;
   const shell=options.hollow&&width>4&&depth>4?nx*nx+nz*nz>=.48:true;
   if(inside&&shell)cells.add(key(x,z));
  }
  const remaining=new Set(cells),layerParts:PartInstance[]=[],layerBoxes:{x0:number;x1:number;z0:number;z1:number}[]=[];
  const candidates=layer%2?[...PIECES.slice(1),PIECES[0]]:PIECES;
  for(let z=0;z<depth;z++)for(let x=0;x<width;x++)if(remaining.has(key(x,z))){
   const piece=candidates.find(item=>{for(let dz=0;dz<item.z;dz++)for(let dx=0;dx<item.x;dx++)if(!remaining.has(key(x+dx,z+dz)))return false;const box={x0:-width/2+x,x1:-width/2+x+item.x,z0:-depth/2+z,z1:-depth/2+z+item.z};return layer===0||previousBoxes.some(base=>Math.min(box.x1,base.x1)-Math.max(box.x0,base.x0)>0&&Math.min(box.z1,base.z1)-Math.max(box.z0,base.z0)>0)});
   if(!piece){remaining.delete(key(x,z));continue}
   for(let dz=0;dz<piece.z;dz++)for(let dx=0;dx<piece.x;dx++)remaining.delete(key(x+dx,z+dz));
   const part:PartInstance={id:`photo-${serial++}`,partNumber:piece.partNumber,position:[(-width/2+x+piece.x/2)*20,layer*24,(-depth/2+z+piece.z/2)*20],rotation:piece.rotation,colour:options.colour};
   parts.push(part);layerParts.push(part);
   layerBoxes.push({x0:-width/2+x,x1:-width/2+x+piece.x,z0:-depth/2+z,z1:-depth/2+z+piece.z});occupiedStuds+=piece.x*piece.z;
  }
  if(!layerParts.length){const support=previousBoxes[0]??{x0:-.5,x1:.5,z0:-.5,z1:.5},cx=(support.x0+support.x1)/2,cz=(support.z0+support.z1)/2;const fallback:PartInstance={id:`photo-${serial++}`,partNumber:"3005",position:[cx*20,layer*24,cz*20],rotation:0,colour:options.colour};parts.push(fallback);layerParts.push(fallback);layerBoxes.push({x0:cx-.5,x1:cx+.5,z0:cz-.5,z1:cz+.5});occupiedStuds++}
  previousBoxes=layerBoxes;
  const counts=new Map<string,number>();for(const part of layerParts)counts.set(part.partNumber,(counts.get(part.partNumber)??0)+1);
  steps.push({number:layer+1,layer,title:`Build layer ${layer+1} of ${options.heightLayers}`,partIds:layerParts.map(part=>part.id),summary:[...counts].map(([partNumber,quantity])=>({partNumber,quantity})).sort((a,b)=>a.partNumber.localeCompare(b.partNumber))});
 }
 return{document:{schemaVersion:1,name:options.name,parts},instructions:steps,occupiedStuds,confidence:Math.round(Math.min(front.confidence,side.confidence)*100)};
}

export function reconstructFromVoxels(voxels:VoxelReconstruction,options:{name:string;colour:number}):ReconstructionResult{
 const parts:PartInstance[]=[],steps:InstructionStep[]=[];let occupiedStuds=0,serial=1;
 for(let layer=0;layer<voxels.height;layer++){
  const remaining=new Set(voxels.layers[layer]),layerParts:PartInstance[]=[];
  const candidates=layer%2?[...PIECES.slice(1),PIECES[0]]:PIECES;
  for(let z=0;z<voxels.depth;z++)for(let x=0;x<voxels.width;x++)if(remaining.has(key(x,z))){
   const piece=candidates.find(item=>{for(let dz=0;dz<item.z;dz++)for(let dx=0;dx<item.x;dx++)if(!remaining.has(key(x+dx,z+dz)))return false;return true});
   if(!piece){remaining.delete(key(x,z));continue}
   for(let dz=0;dz<piece.z;dz++)for(let dx=0;dx<piece.x;dx++)remaining.delete(key(x+dx,z+dz));
   const part:PartInstance={id:`mesh-${serial++}`,partNumber:piece.partNumber,position:[(-voxels.width/2+x+piece.x/2)*20,layer*24,(-voxels.depth/2+z+piece.z/2)*20],rotation:piece.rotation,colour:options.colour};
   parts.push(part);layerParts.push(part);occupiedStuds+=piece.x*piece.z;
  }
  if(!layerParts.length)continue;
  const counts=new Map<string,number>();for(const part of layerParts)counts.set(part.partNumber,(counts.get(part.partNumber)??0)+1);
  steps.push({number:steps.length+1,layer,title:`Build mesh layer ${layer+1} of ${voxels.height}`,partIds:layerParts.map(part=>part.id),summary:[...counts].map(([partNumber,quantity])=>({partNumber,quantity})).sort((a,b)=>a.partNumber.localeCompare(b.partNumber))});
 }
 return{document:{schemaVersion:1,name:options.name,parts},instructions:steps,occupiedStuds,confidence:voxels.confidence};
}
