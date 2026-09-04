import assert from "node:assert/strict";
import test from "node:test";
import {billOfMaterials,createPart,defaultAssembly,exportLDraw,parseAssembly,serializeAssembly,snapPosition,validateAssembly} from "../packages/renderer/src/assembly.ts";

test("creates deterministic, snapped part instances",()=>{
 const part=createPart([{id:"brick-1",partNumber:"3001",position:[0,0,0],rotation:0,colour:4}],"3021",[11,9,-11],1);
 assert.equal(part.id,"brick-2");assert.deepEqual(part.position,[20,8,-20]);
 assert.deepEqual(snapPosition([-9,3,29]),[0,0,20]);
});

test("the interlocking reference assembly is connected and collision-free",()=>{
 const document=defaultAssembly();
 assert.equal(document.parts.length,4);assert.deepEqual(validateAssembly(document.parts),[]);
});

test("detects collisions, off-grid placement, and floating parts",()=>{
 const collision=defaultAssembly().parts.slice(0,2).map(part=>({...part,position:[0,0,0]}));
 assert.equal(validateAssembly(collision).filter(issue=>issue.kind==="collision").length,1);
 const floating=[{id:"brick-1",partNumber:"3005",position:[1,24,0],rotation:0,colour:4}];
 const kinds=validateAssembly(floating).map(issue=>issue.kind).sort();assert.deepEqual(kinds,["floating","off-grid"]);
});

test("round-trips versioned JSON and rejects unsupported parts",()=>{
 const document=defaultAssembly();assert.deepEqual(parseAssembly(serializeAssembly(document)),document);
 assert.throws(()=>parseAssembly('{"schemaVersion":1,"name":"bad","parts":[{"id":"x","partNumber":"9999","position":[0,0,0],"rotation":0,"colour":4}]}'),/Invalid part/);
});

test("groups the BOM and exports LDraw type-1 references",()=>{
 const document=defaultAssembly(),bom=billOfMaterials(document.parts);
 assert.deepEqual(bom.map(row=>[row.partNumber,row.colour,row.quantity]),[["3001",4,2],["3001",14,2]]);
 const ldraw=exportLDraw(document);assert.match(ldraw,/1 4 -40 0 0 1 0 0 0 1 0 0 0 1 3001\.dat/);assert.equal(ldraw.split("\n").filter(line=>line.startsWith("1 ")).length,4);
});
