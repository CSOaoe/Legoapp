import assert from "node:assert/strict";
import test from "node:test";
import {reconstructFromProfiles} from "../packages/reconstruction/src/reconstruct.ts";
import {billOfMaterials,validateAssembly} from "../packages/renderer/src/assembly.ts";

const profile={widths:[.45,.7,1,.8,.35],confidence:.88};
test("turns paired silhouettes into a layered brick assembly",()=>{
 const result=reconstructFromProfiles(profile,{...profile,widths:[.5,.8,.75,.55,.3]},{name:"Photo sculpture",heightLayers:8,maxWidthStuds:10,maxDepthStuds:8,colour:71,hollow:false});
 assert.ok(result.document.parts.length>8);assert.equal(result.instructions.length,8);assert.equal(result.instructions[0].layer,0);assert.equal(result.document.parts.every(part=>part.position[1]%24===0),true);assert.equal(result.confidence,88);
 assert.equal(billOfMaterials(result.document.parts).reduce((sum,row)=>sum+row.quantity,0),result.document.parts.length);
 assert.deepEqual(validateAssembly(result.document.parts),[]);
});

test("hollow mode uses fewer bricks while preserving every build layer",()=>{
 const solid=reconstructFromProfiles(profile,profile,{name:"Solid",heightLayers:6,maxWidthStuds:12,maxDepthStuds:10,colour:4,hollow:false});
 const hollow=reconstructFromProfiles(profile,profile,{name:"Hollow",heightLayers:6,maxWidthStuds:12,maxDepthStuds:10,colour:4,hollow:true});
 assert.ok(hollow.document.parts.length<solid.document.parts.length);assert.equal(hollow.instructions.every(step=>step.partIds.length>0),true);
});
