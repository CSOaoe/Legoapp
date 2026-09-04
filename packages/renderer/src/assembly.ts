export type QuarterTurn=0|90|180|270;
export type AssemblyPosition=[number,number,number];
export type PartDefinition={partNumber:string;name:string;widthStuds:number;lengthStuds:number;heightPlates:number;file:string};
export type PartInstance={id:string;partNumber:string;position:AssemblyPosition;rotation:QuarterTurn;colour:number};
export type AssemblyDocument={schemaVersion:1;name:string;parts:PartInstance[]};
export type ValidationIssue={kind:"collision"|"floating"|"off-grid"|"missing-part";partIds:string[];message:string};

export const STUD_LDU=20,PLATE_LDU=8;
export const CATALOGUE:PartDefinition[]=[
 {partNumber:"3001",name:"Brick 2 × 4",widthStuds:2,lengthStuds:4,heightPlates:3,file:"parts/3001.dat"},
 {partNumber:"3002",name:"Brick 2 × 3",widthStuds:2,lengthStuds:3,heightPlates:3,file:"parts/3002.dat"},
 {partNumber:"3003",name:"Brick 2 × 2",widthStuds:2,lengthStuds:2,heightPlates:3,file:"parts/3003.dat"},
 {partNumber:"3004",name:"Brick 1 × 2",widthStuds:1,lengthStuds:2,heightPlates:3,file:"parts/3004.dat"},
 {partNumber:"3005",name:"Brick 1 × 1",widthStuds:1,lengthStuds:1,heightPlates:3,file:"parts/3005.dat"},
 {partNumber:"3020",name:"Plate 2 × 4",widthStuds:2,lengthStuds:4,heightPlates:1,file:"parts/3020.dat"},
 {partNumber:"3021",name:"Plate 2 × 3",widthStuds:2,lengthStuds:3,heightPlates:1,file:"parts/3021.dat"},
 {partNumber:"3022",name:"Plate 2 × 2",widthStuds:2,lengthStuds:2,heightPlates:1,file:"parts/3022.dat"},
 {partNumber:"3023",name:"Plate 1 × 2",widthStuds:1,lengthStuds:2,heightPlates:1,file:"parts/3023.dat"},
 {partNumber:"3024",name:"Plate 1 × 1",widthStuds:1,lengthStuds:1,heightPlates:1,file:"parts/3024.dat"},
];
export const COLOURS=[
 {code:4,name:"Red",hex:"#c91a09"},{code:1,name:"Blue",hex:"#0055bf"},{code:2,name:"Green",hex:"#237841"},
 {code:14,name:"Yellow",hex:"#f2cd37"},{code:15,name:"White",hex:"#f4f4f4"},{code:0,name:"Black",hex:"#151515"},{code:71,name:"Light grey",hex:"#a0a5a9"},
] as const;

const definition=(partNumber:string)=>CATALOGUE.find(part=>part.partNumber===partNumber);
export const snap=(value:number,step:number)=>{const result=Math.round(value/step)*step;return Object.is(result,-0)?0:result};
export function snapPosition(position:AssemblyPosition):AssemblyPosition{return[snap(position[0],STUD_LDU/2),snap(position[1],PLATE_LDU),snap(position[2],STUD_LDU/2)]}
export function nextPartId(parts:PartInstance[]){let index=1;const ids=new Set(parts.map(part=>part.id));while(ids.has(`brick-${index}`))index++;return `brick-${index}`}
export function createPart(parts:PartInstance[],partNumber="3001",position:AssemblyPosition=[0,0,0],colour=4):PartInstance{
 if(!definition(partNumber))throw new Error(`Unknown controlled part: ${partNumber}`);
 return{id:nextPartId(parts),partNumber,position:snapPosition(position),rotation:0,colour};
}
export function defaultAssembly():AssemblyDocument{
 const parts:PartInstance[]=[
  {id:"brick-1",partNumber:"3001",position:[-40,0,0],rotation:0,colour:4},
  {id:"brick-2",partNumber:"3001",position:[40,0,0],rotation:0,colour:4},
  {id:"brick-3",partNumber:"3001",position:[-20,24,0],rotation:0,colour:14},
  {id:"brick-4",partNumber:"3001",position:[60,24,0],rotation:0,colour:14},
 ];
 return{schemaVersion:1,name:"Interlocking two-layer test assembly",parts};
}
type Box={minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number};
export function partBox(part:PartInstance):Box|undefined{
 const item=definition(part.partNumber);if(!item)return;
 const swapped=part.rotation===90||part.rotation===270;
 const width=(swapped?item.widthStuds:item.lengthStuds)*STUD_LDU,length=(swapped?item.lengthStuds:item.widthStuds)*STUD_LDU,height=item.heightPlates*PLATE_LDU;
 return{minX:part.position[0]-width/2,maxX:part.position[0]+width/2,minY:part.position[1],maxY:part.position[1]+height,minZ:part.position[2]-length/2,maxZ:part.position[2]+length/2};
}
const overlap=(a0:number,a1:number,b0:number,b1:number)=>Math.min(a1,b1)-Math.max(a0,b0)>0;
const footprintOverlap=(a:Box,b:Box)=>overlap(a.minX,a.maxX,b.minX,b.maxX)&&overlap(a.minZ,a.maxZ,b.minZ,b.maxZ);
export function validateAssembly(parts:PartInstance[]):ValidationIssue[]{
 const issues:ValidationIssue[]=[],boxes=new Map(parts.map(part=>[part.id,partBox(part)]));
 for(const part of parts){
  if(!definition(part.partNumber))issues.push({kind:"missing-part",partIds:[part.id],message:`${part.id} uses unsupported part ${part.partNumber}`});
  if(part.position[0]%(STUD_LDU/2)||part.position[1]%PLATE_LDU||part.position[2]%(STUD_LDU/2))issues.push({kind:"off-grid",partIds:[part.id],message:`${part.id} is off the brick grid`});
 }
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
  const a=boxes.get(parts[i].id),b=boxes.get(parts[j].id);if(a&&b&&footprintOverlap(a,b)&&overlap(a.minY,a.maxY,b.minY,b.maxY))issues.push({kind:"collision",partIds:[parts[i].id,parts[j].id],message:`${parts[i].id} overlaps ${parts[j].id}`});
 }
 const supported=new Set(parts.filter(part=>(boxes.get(part.id)?.minY??1)===0).map(part=>part.id));let changed=true;
 // Connectivity is undirected: a lower brick can be tied into the grounded
 // structure by a later brick placed above it. Walking only upward incorrectly
 // labelled valid interlocked sculptures as almost entirely floating.
 while(changed){changed=false;for(const part of parts){if(supported.has(part.id))continue;const box=boxes.get(part.id);if(!box)continue;const connected=parts.some(base=>{const baseBox=boxes.get(base.id);return supported.has(base.id)&&baseBox&&((baseBox.maxY===box.minY)||(box.maxY===baseBox.minY))&&footprintOverlap(baseBox,box)});if(connected){supported.add(part.id);changed=true}}}
 for(const part of parts)if(!supported.has(part.id)&&boxes.has(part.id))issues.push({kind:"floating",partIds:[part.id],message:`${part.id} is not connected to a grounded part`});
 return issues;
}
export function billOfMaterials(parts:PartInstance[]){
 const counts=new Map<string,{partNumber:string;name:string;colour:number;colourName:string;quantity:number}>();
 for(const part of parts){const item=definition(part.partNumber);if(!item)continue;const colour=COLOURS.find(value=>value.code===part.colour);const key=`${part.partNumber}:${part.colour}`,row=counts.get(key);if(row)row.quantity++;else counts.set(key,{partNumber:part.partNumber,name:item.name,colour:part.colour,colourName:colour?.name??`Colour ${part.colour}`,quantity:1})}
 return[...counts.values()].sort((a,b)=>a.partNumber.localeCompare(b.partNumber)||a.colour-b.colour);
}
export function serializeAssembly(document:AssemblyDocument){return JSON.stringify(document,null,2)}
export function parseAssembly(text:string):AssemblyDocument{
 const value=JSON.parse(text) as Partial<AssemblyDocument>;if(value.schemaVersion!==1||typeof value.name!=="string"||!Array.isArray(value.parts))throw new Error("Unsupported BrickForge assembly file");
 const ids=new Set<string>();const parts=value.parts.map(raw=>{if(!raw||typeof raw.id!=="string"||ids.has(raw.id)||!definition(raw.partNumber)||!Array.isArray(raw.position)||raw.position.length!==3||![0,90,180,270].includes(raw.rotation)||!Number.isInteger(raw.colour))throw new Error("Invalid part instance in assembly file");ids.add(raw.id);return{...raw,position:snapPosition(raw.position as AssemblyPosition)} as PartInstance});
 return{schemaVersion:1,name:value.name,parts};
}
export function exportLDraw(document:AssemblyDocument){
 const lines=[`0 ${document.name}`,"0 Name: brickforge-assembly.ldr","0 Author: BrickForge AI"];
 for(const part of document.parts){const angle=part.rotation*Math.PI/180,c=Math.round(Math.cos(angle)),s=Math.round(Math.sin(angle));lines.push(`1 ${part.colour} ${part.position[0]} ${-part.position[1]} ${part.position[2]} ${c} 0 ${s} 0 1 0 ${-s} 0 ${c} ${part.partNumber}.dat`)}
 return `${lines.join("\n")}\n`;
}
