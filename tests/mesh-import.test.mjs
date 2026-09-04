import assert from "node:assert/strict";
import test from "node:test";
import {parseObj,parseStl,voxelizeMesh} from "../packages/reconstruction/src/mesh-import.ts";
import {reconstructFromVoxels} from "../packages/reconstruction/src/reconstruct.ts";
import {validateAssembly} from "../packages/renderer/src/assembly.ts";

const cubeObj=`
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
v 0 0 1
v 1 0 1
v 1 1 1
v 0 1 1
f 1 4 3 2
f 5 6 7 8
f 1 2 6 5
f 4 8 7 3
f 1 5 8 4
f 2 3 7 6`;

test("parses an OBJ solid, voxelises it, and creates a valid brick assembly",()=>{
 const mesh=parseObj(cubeObj,"cube.obj");
 assert.equal(mesh.triangles.length,12);assert.equal(mesh.vertexCount,8);assert.equal(mesh.closedConfidence,1);
 const voxels=voxelizeMesh(mesh,{maxWidthStuds:8,maxDepthStuds:8,maxHeightLayers:8,upAxis:"y",hollow:false,addSupports:true});
 assert.equal(voxels.width,8);assert.equal(voxels.height,8);assert.ok(voxels.occupiedVoxels>100);
 const result=reconstructFromVoxels(voxels,{name:"Cube",colour:71});
 assert.ok(result.document.parts.length>20);assert.deepEqual(validateAssembly(result.document.parts),[]);
});

test("parses ASCII STL triangles",()=>{
 const stl=`solid sample
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 1 0 0
vertex 0 1 0
endloop
endfacet
endsolid sample`;
 const bytes=new TextEncoder().encode(stl);
 const mesh=parseStl(bytes.buffer,"sample.stl");
 assert.equal(mesh.format,"STL");assert.equal(mesh.triangles.length,1);assert.equal(mesh.vertexCount,3);
});
