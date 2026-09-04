import type {LDrawLine,LDrawModel,LDrawTriangle,Vec3} from "./ldraw";
type Transform={m:number[];t:Vec3};
const IDENTITY:Transform={m:[1,0,0,0,1,0,0,0,1],t:[0,0,0]};
const mul=(a:number[],b:number[])=>Array.from({length:9},(_,i)=>{const r=Math.floor(i/3),c=i%3;return a[r*3]*b[c]+a[r*3+1]*b[c+3]+a[r*3+2]*b[c+6]});
const point=(tr:Transform,v:Vec3):Vec3=>[tr.m[0]*v[0]+tr.m[1]*v[1]+tr.m[2]*v[2]+tr.t[0],tr.m[3]*v[0]+tr.m[4]*v[1]+tr.m[5]*v[2]+tr.t[1],tr.m[6]*v[0]+tr.m[7]*v[1]+tr.m[8]*v[2]+tr.t[2]];
const compose=(parent:Transform,local:Transform):Transform=>({m:mul(parent.m,local.m),t:point(parent,local.t)});
const display=(v:Vec3):Vec3=>[v[0],v[1]===0?0:-v[1],v[2]];
const key=(name:string)=>name.replaceAll("\\","/").replace(/^\.\//,"").toLowerCase();
export type LDrawSourceMap=Map<string,string>;
export function sourceMap(entries:Iterable<[string,string]>):LDrawSourceMap{
 const result=new Map<string,string>();
 for(const [path,text] of entries){const normalized=key(path);result.set(normalized,text);const marker=normalized.match(/(?:^|\/)(parts|p)\/(.+)$/);if(marker)result.set(`${marker[1]}/${marker[2]}`,text)}
 return result;
}
function findSource(files:LDrawSourceMap,name:string):string|undefined{
 const n=key(name);return files.get(n)??files.get(`parts/${n}`)??files.get(`p/${n}`);
}
export function resolveLDraw(files:LDrawSourceMap,rootName:string,maxDepth=64):LDrawModel{
 const triangles:LDrawTriangle[]=[],lines:LDrawLine[]=[],warnings:string[]=[],references:LDrawModel["references"]=[];const points:Vec3[]=[];let title=rootName;
 function walk(name:string,tr:Transform,parentColour:number,stack:string[],depth:number){
  const normalized=key(name);const text=findSource(files,normalized);
  if(!text){warnings.push(`Missing reference: ${name}`);return}
  if(stack.includes(normalized)){warnings.push(`Circular reference: ${[...stack,normalized].join(" → ")}`);return}
  if(depth>maxDepth){warnings.push(`Maximum reference depth exceeded at ${name}`);return}
  text.split(/\r?\n/).forEach((raw,index)=>{
   const p=raw.trim().split(/\s+/);if(!p[0])return;const type=Number(p[0]);
   if(type===0){if(depth===0&&p[1]==="Name:"&&p[2])title=p.slice(2).join(" ");return}
   const colour=Number(p[1])===16?parentColour:Number(p[1]);
   try{
    if(type===1&&p.length>=15){const n=p.slice(2,14).map(Number);const local:Transform={t:[n[0],n[1],n[2]],m:n.slice(3,12)};walk(p.slice(14).join(" "),compose(tr,local),colour,[...stack,normalized],depth+1);return}
    if(type===2&&p.length>=8){const n=p.slice(2,8).map(Number),v:[Vec3,Vec3]=[display(point(tr,[n[0],n[1],n[2]])),display(point(tr,[n[3],n[4],n[5]]))];lines.push({colour,vertices:v});points.push(...v);return}
    if(type===3&&p.length>=11){const n=p.slice(2,11).map(Number),v:[Vec3,Vec3,Vec3]=[display(point(tr,[n[0],n[1],n[2]])),display(point(tr,[n[3],n[4],n[5]])),display(point(tr,[n[6],n[7],n[8]]))];triangles.push({colour,vertices:v});points.push(...v);return}
    if(type===4&&p.length>=14){const n=p.slice(2,14).map(Number),a=display(point(tr,[n[0],n[1],n[2]])),b=display(point(tr,[n[3],n[4],n[5]])),c=display(point(tr,[n[6],n[7],n[8]])),d=display(point(tr,[n[9],n[10],n[11]]));triangles.push({colour,vertices:[a,b,c]},{colour,vertices:[a,c,d]});points.push(a,b,c,d)}
   }catch{warnings.push(`${name} line ${index+1}: malformed geometry`)}
  })
 }
 walk(rootName,IDENTITY,16,[],0);
 const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];points.forEach(v=>v.forEach((n,i)=>{min[i]=Math.min(min[i],n);max[i]=Math.max(max[i],n)}));if(!points.length){min.fill(0);max.fill(0)}
 return{name:title,triangles,lines,references,warnings:[...new Set(warnings)],bounds:{min,max}};
}
