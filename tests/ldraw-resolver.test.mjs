import assert from "node:assert/strict";
import test from "node:test";
import {resolveLDraw,sourceMap} from "../packages/renderer/src/ldraw-resolver.ts";
test("resolves nested references, transforms and inherited colour",()=>{
 const files=sourceMap([
  ["parts/root.dat","0 Name: root.dat\n1 4 10 0 0 1 0 0 0 1 0 0 0 1 sub.dat"],
  ["parts/sub.dat","1 16 0 5 0 1 0 0 0 1 0 0 0 1 s/face.dat"],
  ["parts/s/face.dat","3 16 0 0 0 2 0 0 0 2 0"]
 ]);
 const model=resolveLDraw(files,"parts/root.dat");
 assert.equal(model.triangles.length,1);assert.equal(model.triangles[0].colour,4);
 assert.deepEqual(model.triangles[0].vertices,[[10,-5,0],[12,-5,0],[10,-7,0]]);
 assert.deepEqual(model.warnings,[]);
});
test("resolves primitives from the p directory",()=>{
 const files=sourceMap([["parts/a.dat","1 16 0 0 0 1 0 0 0 1 0 0 0 1 prim.dat"],["p/prim.dat","3 16 0 0 0 1 0 0 0 1 0"]]);
 assert.equal(resolveLDraw(files,"parts/a.dat").triangles.length,1);
});
test("reports missing and circular references safely",()=>{
 const missing=resolveLDraw(sourceMap([["parts/a.dat","1 16 0 0 0 1 0 0 0 1 0 0 0 1 absent.dat"]]),"parts/a.dat");
 assert.match(missing.warnings[0],/Missing reference/);
 const cycle=resolveLDraw(sourceMap([["parts/a.dat","1 16 0 0 0 1 0 0 0 1 0 0 0 1 b.dat"],["parts/b.dat","1 16 0 0 0 1 0 0 0 1 0 0 0 1 a.dat"]]),"parts/a.dat");
 assert.match(cycle.warnings[0],/Circular reference/);
});
