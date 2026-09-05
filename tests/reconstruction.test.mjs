import assert from "node:assert/strict";
import test from "node:test";
import {reconstructFromProfiles} from "../packages/reconstruction/src/reconstruct.ts";
import {billOfMaterials,validateAssembly} from "../packages/renderer/src/assembly.ts";

const profile={widths:[.45,.7,1,.8,.35],confidence:.88};
test("turns paired silhouettes into a layered brick assembly",()=>{
 const result=reconstructFromProfiles(profile,{...profile,widths:[.5,.8,.75,.55,.3]},{name:"Photo sculpture",heightLayers:8,maxWidthStuds:10,maxDepthStuds:8,colour:71});
 assert.ok(result.document.parts.length>8);assert.equal(result.instructions.length,8);assert.equal(result.instructions[0].layer,0);assert.equal(result.document.parts.every(part=>part.position[1]%24===0),true);assert.equal(result.confidence,88);
 assert.ok(result.detailParts>0);assert.ok(result.partFamilies.includes("slope")||result.partFamilies.includes("curved-slope"));
 assert.equal(billOfMaterials(result.document.parts).reduce((sum,row)=>sum+row.quantity,0),result.document.parts.length);
 assert.deepEqual(validateAssembly(result.document.parts),[]);
});

test("profile conversion produces connected interlocked layers without filler parts",()=>{
 const result=reconstructFromProfiles(profile,profile,{name:"Interlocked",heightLayers:6,maxWidthStuds:12,maxDepthStuds:10,colour:4});
 assert.ok(result.document.parts.length>0);assert.ok(result.shapeCoverage>0);assert.ok(result.shapeCoverage<=100);
 assert.deepEqual(validateAssembly(result.document.parts),[]);
});
