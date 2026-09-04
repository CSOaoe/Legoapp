import assert from "node:assert/strict";
import test from "node:test";
import {parseLDraw,trianglePositions} from "../packages/renderer/src/ldraw.ts";
test("parses triangles, quads and coordinate orientation",()=>{
 const model=parseLDraw("0 Name: sample.dat\n3 16 0 0 0 10 0 0 0 10 0\n4 4 0 0 0 0 10 0 0 10 10 0 0 10");
 assert.equal(model.name,"sample.dat");assert.equal(model.triangles.length,3);assert.equal(trianglePositions(model).length,27);assert.deepEqual(model.bounds.min,[0,-10,0]);assert.deepEqual(model.bounds.max,[10,0,10]);
});
test("reports subfile references without pretending to resolve them",()=>{
 const model=parseLDraw("1 16 0 0 0 1 0 0 0 1 0 0 0 1 stud.dat","3001.dat");
 assert.equal(model.references[0].file,"stud.dat");assert.match(model.warnings.join(" "),/require an LDraw library resolver/);assert.equal(model.triangles.length,0);
});
test("ignores comments and reports unknown commands",()=>{
 const model=parseLDraw("0 comment\n9 16 0 0 0","odd.dat");
 assert.match(model.warnings.join(" "),/unknown command 9/);
});
