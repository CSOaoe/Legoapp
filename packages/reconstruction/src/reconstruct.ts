import {CATALOGUE,type AssemblyDocument,type PartInstance,type QuarterTurn} from "../../renderer/src/assembly.ts";

export type SilhouetteProfile={widths:number[];offsets?:number[];aspectRatio?:number;confidence:number};
export type ReconstructionOptions={name:string;heightLayers:number;maxWidthStuds:number;maxDepthStuds:number;colour:number};
export type InstructionStep={number:number;layer:number;title:string;partIds:string[];summary:{partNumber:string;quantity:number}[]};
export type ReconstructionResult={document:AssemblyDocument;instructions:InstructionStep[];occupiedStuds:number;sourceStuds:number;shapeCoverage:number;confidence:number;detailParts:number;partFamilies:string[]};
export type VoxelReconstruction={width:number;depth:number;height:number;layers:Set<string>[];confidence:number};

type Piece={partNumber:string;x:number;z:number;rotation:QuarterTurn};
type Placed={part:PartInstance;layer:number;x:number;z:number;width:number;depth:number};

const PIECES:Piece[]=[
 {partNumber:"3001",x:4,z:2,rotation:0},{partNumber:"3001",x:2,z:4,rotation:90},
 {partNumber:"3002",x:3,z:2,rotation:0},{partNumber:"3002",x:2,z:3,rotation:90},
 {partNumber:"3003",x:2,z:2,rotation:0},{partNumber:"3004",x:2,z:1,rotation:0},
 {partNumber:"3004",x:1,z:2,rotation:90},{partNumber:"3005",x:1,z:1,rotation:0},
];

const sample=(values:number[],position:number)=>{if(!values.length)return 0;const scaled=Math.max(0,Math.min(values.length-1,position*(values.length-1))),low=Math.floor(scaled),high=Math.ceil(scaled),mix=scaled-low;return values[low]*(1-mix)+values[high]*mix};
const key=(x:number,z:number)=>`${x}:${z}`;

function surfacePart(piece:Piece,x:number,z:number,layer:number,voxels:VoxelReconstruction):{partNumber:string;rotation:QuarterTurn}{
 const current=voxels.layers[layer],above=voxels.layers[layer+1];let boundaryEdges=0,left=0,right=0,front=0,back=0;
 for(let dz=0;dz<piece.z;dz++)for(let dx=0;dx<piece.x;dx++){
  const px=x+dx,pz=z+dz;if(above?.has(key(px,pz)))return{partNumber:piece.partNumber,rotation:piece.rotation};
  if(!current.has(key(px-1,pz))){left++;boundaryEdges++}if(!current.has(key(px+1,pz))){right++;boundaryEdges++}
  if(!current.has(key(px,pz-1))){front++;boundaryEdges++}if(!current.has(key(px,pz+1))){back++;boundaryEdges++}
 }
 if(!boundaryEdges)return{partNumber:piece.partNumber,rotation:piece.rotation};
 const area=piece.x*piece.z,curved=layer%2===0;
 const partNumber=area===8?"3037":area===6?"3038":area===4?(curved?"15068":"3039"):area===2?(curved?"11477":"3040b"):"54200";
 let rotation=piece.rotation;
 if(piece.x>=piece.z)rotation=left>right?180:0;else rotation=front>back?270:90;
 return{partNumber,rotation};
}

function packInterlocked(voxels:VoxelReconstruction,options:{name:string;colour:number}):ReconstructionResult{
 const parts:PartInstance[]=[],steps:InstructionStep[]=[];
 let occupiedStuds=0,serial=1,previousCells=new Set<string>(),previousOwners=new Map<string,string>();
 const sourceStuds=voxels.layers.reduce((total,layer)=>total+layer.size,0);

 for(let layer=0;layer<voxels.height;layer++){
  const remaining=new Set(voxels.layers[layer]),layerPlaced:Placed[]=[];
  while(remaining.size){
   let best:{piece:Piece;x:number;z:number;score:number}|undefined;
   for(let z=0;z<voxels.depth;z++)for(let x=0;x<voxels.width;x++)for(const piece of PIECES){
    let fits=true,overlap=0;const owners=new Set<string>();
    for(let dz=0;dz<piece.z&&fits;dz++)for(let dx=0;dx<piece.x;dx++){
     const cell=key(x+dx,z+dz);if(!remaining.has(cell)){fits=false;break}
     if(previousCells.has(cell)){overlap++;const owner=previousOwners.get(cell);if(owner)owners.add(owner)}
    }
    if(!fits||(layer>0&&!overlap))continue;
    const area=piece.x*piece.z,preferredDirection=layer%2===0?piece.x>=piece.z:piece.z>=piece.x;
    // Once a legal stud connection exists, favour a brick that carries the
    // silhouette outward. Otherwise a greedy pack consumes only the area
    // directly above the prior layer and strands perfectly buildable overhangs.
    const carriedStuds=layer===0?0:area-overlap;
    const score=area*100+carriedStuds*28+owners.size*35+overlap*2+(preferredDirection?6:0);
    if(!best||score>best.score)best={piece,x,z,score};
   }
   if(!best)break;
   const {piece,x,z}=best;
   for(let dz=0;dz<piece.z;dz++)for(let dx=0;dx<piece.x;dx++)remaining.delete(key(x+dx,z+dz));
   const surface=surfacePart(piece,x,z,layer,voxels);
   const part:PartInstance={id:`brick-${serial++}`,partNumber:surface.partNumber,position:[(-voxels.width/2+x+piece.x/2)*20,layer*24,(-voxels.depth/2+z+piece.z/2)*20],rotation:surface.rotation,colour:options.colour};
   layerPlaced.push({part,layer,x,z,width:piece.x,depth:piece.z});parts.push(part);occupiedStuds+=piece.x*piece.z;
  }
  if(!layerPlaced.length){previousCells=new Set<string>();previousOwners=new Map<string,string>();continue}
  previousCells=new Set<string>();previousOwners=new Map<string,string>();
  for(const item of layerPlaced)for(let dz=0;dz<item.depth;dz++)for(let dx=0;dx<item.width;dx++){const cell=key(item.x+dx,item.z+dz);previousCells.add(cell);previousOwners.set(cell,item.part.id)}
  const counts=new Map<string,number>();for(const item of layerPlaced)counts.set(item.part.partNumber,(counts.get(item.part.partNumber)??0)+1);
  steps.push({number:steps.length+1,layer,title:`Interlock layer ${layer+1} of ${voxels.height}`,partIds:layerPlaced.map(item=>item.part.id),summary:[...counts].map(([partNumber,quantity])=>({partNumber,quantity})).sort((a,b)=>a.partNumber.localeCompare(b.partNumber))});
 }
 const shapeCoverage=sourceStuds?Math.round(occupiedStuds/sourceStuds*100):0;
 const families=[...new Set(parts.map(part=>CATALOGUE.find(item=>item.partNumber===part.partNumber)?.family).filter((family):family is string=>Boolean(family)))];
 const detailParts=parts.filter(part=>CATALOGUE.find(item=>item.partNumber===part.partNumber)?.surface!=="flat").length;
 return{document:{schemaVersion:1,name:options.name,parts},instructions:steps,occupiedStuds,sourceStuds,shapeCoverage,confidence:voxels.confidence,detailParts,partFamilies:families};
}

export function reconstructFromProfiles(front:SilhouetteProfile,side:SilhouetteProfile,options:ReconstructionOptions):ReconstructionResult{
 const layers=Array.from({length:options.heightLayers},(_,layer)=>{
  const heightPosition=options.heightLayers===1?0:layer/(options.heightLayers-1),frontRatio=sample(front.widths,heightPosition),sideRatio=sample(side.widths,heightPosition);
  const width=Math.max(1,Math.round(options.maxWidthStuds*Math.max(.06,frontRatio))),depth=Math.max(1,Math.round(options.maxDepthStuds*Math.max(.06,sideRatio))),cells=new Set<string>();
  const offsetX=Math.floor((options.maxWidthStuds-width)/2),offsetZ=Math.floor((options.maxDepthStuds-depth)/2);
  for(let z=0;z<depth;z++)for(let x=0;x<width;x++){const nx=(x+.5-width/2)/(width/2),nz=(z+.5-depth/2)/(depth/2);if(nx*nx+nz*nz<=1)cells.add(key(offsetX+x,offsetZ+z))}
  return cells;
 });
 return packInterlocked({width:options.maxWidthStuds,depth:options.maxDepthStuds,height:options.heightLayers,layers,confidence:Math.round(Math.min(front.confidence,side.confidence)*100)},options);
}

export function reconstructFromVoxels(voxels:VoxelReconstruction,options:{name:string;colour:number}):ReconstructionResult{return packInterlocked(voxels,options)}
