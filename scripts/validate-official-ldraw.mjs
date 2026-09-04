import {mkdir,readdir,readFile,copyFile} from "node:fs/promises";
import path from "node:path";
import {CATALOGUE} from "../packages/renderer/src/assembly.ts";
import {resolveLDraw,sourceMap} from "../packages/renderer/src/ldraw-resolver.ts";

const root=path.resolve(process.argv[2]??"data/ldraw/official/ldraw"),output=process.argv[3]?path.resolve(process.argv[3]):null;
const normalize=value=>value.replaceAll("\\","/").replace(/^\.\//,"").toLowerCase();
const diskFiles=new Map();
async function index(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const full=path.join(directory,entry.name);if(entry.isDirectory())await index(full);else if(entry.name.toLowerCase().endsWith(".dat"))diskFiles.set(normalize(path.relative(root,full)),full)}}
await index(root);
const loaded=new Map(),queue=CATALOGUE.map(part=>part.file);
while(queue.length){const request=normalize(queue.shift()),key=diskFiles.has(request)?request:diskFiles.has(`parts/${request}`)?`parts/${request}`:diskFiles.has(`p/${request}`)?`p/${request}`:null;if(!key||loaded.has(key))continue;const text=await readFile(diskFiles.get(key),"utf8");loaded.set(key,text);for(const line of text.split(/\r?\n/)){const fields=line.trim().split(/\s+/);if(fields[0]==="1"&&fields.length>=15)queue.push(fields.slice(14).join(" "))}}
if(output)for(const [key] of loaded){const destination=path.join(output,...key.split("/"));await mkdir(path.dirname(destination),{recursive:true});await copyFile(diskFiles.get(key),destination)}
const files=sourceMap(loaded),results=CATALOGUE.map(part=>{const model=resolveLDraw(files,part.file);return{part:part.partNumber,triangles:model.triangles.length,warnings:model.warnings}});
console.log(JSON.stringify({indexed:diskFiles.size,loaded:loaded.size,output,results},null,2));
if(results.some(result=>!result.triangles||result.warnings.length))process.exitCode=1;
