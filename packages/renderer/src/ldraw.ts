export type Vec3=[number,number,number];
export type LDrawTriangle={colour:number;vertices:[Vec3,Vec3,Vec3]};
export type LDrawLine={colour:number;vertices:[Vec3,Vec3]};
export type LDrawReference={colour:number;file:string;matrix:number[]};
export type LDrawModel={name:string;triangles:LDrawTriangle[];lines:LDrawLine[];references:LDrawReference[];warnings:string[];bounds:{min:Vec3;max:Vec3}};
const nums=(items:string[])=>items.map(Number);
export function parseLDraw(text:string,fileName="model.dat"):LDrawModel{
  const triangles:LDrawTriangle[]=[],lines:LDrawLine[]=[],references:LDrawReference[]=[],warnings:string[]=[];
  let name=fileName; const points:Vec3[]=[];
  text.split(/\r?\n/).forEach((raw,index)=>{
    const line=raw.trim(); if(!line)return; const p=line.split(/\s+/); const type=Number(p[0]);
    if(type===0){if(p[1]==="Name:"&&p[2])name=p.slice(2).join(" ");return}
    try{
      if(type===1&&p.length>=15){references.push({colour:Number(p[1]),matrix:nums(p.slice(2,14)),file:p.slice(14).join(" ")});return}
      if(type===2&&p.length>=8){const n=nums(p.slice(2,8)); const a:[Vec3,Vec3]=[[n[0],-n[1],n[2]],[n[3],-n[4],n[5]]];lines.push({colour:Number(p[1]),vertices:a});points.push(...a);return}
      if(type===3&&p.length>=11){const n=nums(p.slice(2,11));const v:[Vec3,Vec3,Vec3]=[[n[0],-n[1],n[2]],[n[3],-n[4],n[5]],[n[6],-n[7],n[8]]];triangles.push({colour:Number(p[1]),vertices:v});points.push(...v);return}
      if(type===4&&p.length>=14){const n=nums(p.slice(2,14));const a:Vec3=[n[0],-n[1],n[2]],b:Vec3=[n[3],-n[4],n[5]],c:Vec3=[n[6],-n[7],n[8]],d:Vec3=[n[9],-n[10],n[11]];triangles.push({colour:Number(p[1]),vertices:[a,b,c]},{colour:Number(p[1]),vertices:[a,c,d]});points.push(a,b,c,d);return}
      if(![0,1,2,3,4,5].includes(type))warnings.push(`Line ${index+1}: unknown command ${p[0]}`);
    }catch{warnings.push(`Line ${index+1}: malformed geometry`)}
  });
  if(references.length)warnings.push(`${references.length} subfile reference(s) require an LDraw library resolver`);
  if(!triangles.length)warnings.push("No directly renderable triangles or quads found");
  const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
  points.forEach(v=>v.forEach((value,i)=>{min[i]=Math.min(min[i],value);max[i]=Math.max(max[i],value)}));
  if(!points.length){min.fill(0);max.fill(0)}
  const clean=(v:Vec3)=>v.map(n=>Object.is(n,-0)?0:n) as Vec3;
  return{name,triangles,lines,references,warnings,bounds:{min:clean(min),max:clean(max)}};
}
export function trianglePositions(model:LDrawModel):Float32Array{
  return new Float32Array(model.triangles.flatMap(t=>t.vertices.flat()));
}
