import assert from "node:assert/strict";
import test from "node:test";
import {createPhotoMesh,exportMeshObj,exportMeshStl} from "../packages/reconstruction/src/photo-mesh.ts";
import {parseObj,parseStl,voxelizeMesh} from "../packages/reconstruction/src/mesh-import.ts";

const front={widths:[.2,.7,1,.8,.3],offsets:[0,.05,.1,.04,0],aspectRatio:.7,confidence:.91};
const side={widths:[.25,.6,.8,.65,.2],offsets:[0,-.03,0,.05,0],aspectRatio:.5,confidence:.86};

test("photo profiles create a closed, asymmetric 3D visual hull",()=>{
 const mesh=createPhotoMesh(front,side,"subject.obj",24,20);
 assert.equal(mesh.format,"OBJ");
 assert.equal(mesh.triangles.length,(24-1)*20*2+20*2);
 assert.equal(mesh.closedConfidence,.86);
 assert.ok(mesh.bounds.max[0]-mesh.bounds.min[0]>.6);
 assert.ok(mesh.bounds.max[2]-mesh.bounds.min[2]>.35);
 const volume=voxelizeMesh(mesh,{maxWidthStuds:16,maxDepthStuds:12,maxHeightLayers:20,upAxis:"y"});
 assert.ok(volume.occupiedVoxels>30);
});

test("generated photo meshes round-trip through OBJ and STL exports",()=>{
 const mesh=createPhotoMesh(front,side,"subject.obj",18,16),obj=parseObj(exportMeshObj(mesh),"roundtrip.obj"),stlText=exportMeshStl(mesh),bytes=new TextEncoder().encode(stlText),stl=parseStl(bytes.buffer,"roundtrip.stl");
 assert.equal(obj.triangles.length,mesh.triangles.length);
 assert.equal(stl.triangles.length,mesh.triangles.length);
 assert.equal(obj.closedConfidence,1);
 assert.equal(stl.closedConfidence,1);
});
