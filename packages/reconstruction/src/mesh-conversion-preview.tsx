"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { ParsedMesh, Vector3, VoxelizedMesh } from "./mesh-import";
import { CATALOGUE, COLOURS, type PartInstance } from "../../renderer/src/assembly";

function orient(vertex: Vector3, axis: "x" | "y" | "z", flipped: boolean): Vector3 {
  const up = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const horizontal = [0, 1, 2].filter(index => index !== up);
  return [vertex[horizontal[0]], vertex[up] * (flipped ? -1 : 1), vertex[horizontal[1]]];
}

function Rotatable({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null), drag = useRef<{ x: number; y: number } | null>(null), { camera } = useThree();
  useEffect(() => { camera.position.set(5, 3.8, 6); camera.lookAt(0, 0, 0); }, [camera]);
  return <group ref={group} rotation={[-.18, .62, 0]}
    onPointerDown={event => { event.stopPropagation(); drag.current = { x: event.clientX, y: event.clientY }; (event.target as Element).setPointerCapture(event.pointerId); }}
    onPointerMove={event => { if (!drag.current || !group.current) return; group.current.rotation.y += (event.clientX - drag.current.x) * .009; group.current.rotation.x += (event.clientY - drag.current.y) * .009; drag.current = { x: event.clientX, y: event.clientY }; }}
    onPointerUp={() => { drag.current = null; }}>{children}</group>;
}

function SourceGeometry({ mesh, volume }: { mesh: ParsedMesh; volume: VoxelizedMesh }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(mesh.triangles.length * 9); let cursor = 0;
    for (const triangle of mesh.triangles) for (const vertex of triangle) for (const value of orient(vertex, volume.upAxis, volume.flipped)) positions[cursor++] = value;
    const result = new THREE.BufferGeometry(); result.setAttribute("position", new THREE.BufferAttribute(positions, 3)); result.computeVertexNormals(); result.center();
    result.computeBoundingBox(); const size = new THREE.Vector3(); result.boundingBox?.getSize(size); result.scale(3 / Math.max(size.x, size.y, size.z), 3 / Math.max(size.x, size.y, size.z), 3 / Math.max(size.x, size.y, size.z));
    return result;
  }, [mesh, volume.upAxis, volume.flipped]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry}><meshStandardMaterial color="#d39f35" roughness={.55} metalness={.08} side={THREE.DoubleSide} /></mesh>;
}

function VoxelGeometry({ volume }: { volume: VoxelizedMesh }) {
  const instance = useRef<THREE.InstancedMesh>(null);
  const cells = useMemo(() => volume.layers.flatMap((layer, y) => [...layer].map(key => { const [x, z] = key.split(":").map(Number); return { x, y, z }; })), [volume]);
  const scale = 3 / Math.max(volume.width, volume.depth, volume.height);
  useEffect(() => {
    if (!instance.current) return; const matrix = new THREE.Object3D();
    cells.forEach((cell, index) => { matrix.position.set((cell.x + .5 - volume.width / 2) * scale, (cell.y + .5 - volume.height / 2) * scale, (cell.z + .5 - volume.depth / 2) * scale); matrix.updateMatrix(); instance.current!.setMatrixAt(index, matrix.matrix); });
    instance.current.instanceMatrix.needsUpdate = true;
  }, [cells, scale, volume]);
  return <instancedMesh ref={instance} args={[undefined, undefined, cells.length]}><boxGeometry args={[scale * .93, scale * .93, scale * .93]} /><meshStandardMaterial color="#aeb7bd" roughness={.62} metalness={.02} /></instancedMesh>;
}

function SurfaceBody({ length, width, height, curved, colour }: { length: number; width: number; height: number; curved: boolean; colour: string }) {
  const geometry = useMemo(() => {
    const low = -height / 2 + (curved ? height * .16 : height * .08), x0 = -length / 2, x1 = length / 2, z0 = -width / 2, z1 = width / 2, y0 = -height / 2, y1 = height / 2;
    const vertices = new Float32Array([x0,y0,z0,x1,y0,z0,x1,y0,z1,x0,y0,z1,x0,low,z0,x1,y1,z0,x1,y1,z1,x0,low,z1]);
    const indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
    const result=new THREE.BufferGeometry();result.setAttribute("position",new THREE.BufferAttribute(vertices,3));result.setIndex(indices);result.computeVertexNormals();return result;
  },[curved,height,length,width]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={colour} roughness={.5} metalness={.02}/></mesh>;
}

function PreviewPart({ part }: { part: PartInstance }) {
  const definition=CATALOGUE.find(item=>item.partNumber===part.partNumber);if(!definition)return null;
  const length=definition.lengthStuds*20,width=definition.widthStuds*20,height=definition.heightPlates*8,colour=COLOURS.find(item=>item.code===part.colour)?.hex??"#d4aa37";
  const body=definition.surface==="flat"?<mesh castShadow receiveShadow><boxGeometry args={[length,height,width]}/><meshStandardMaterial color={colour} roughness={.5} metalness={.02}/></mesh>:<SurfaceBody length={length} width={width} height={height} curved={definition.surface==="curved"} colour={colour}/>;
  return <group position={[part.position[0],part.position[1]+height/2,part.position[2]]} rotation={[0,part.rotation*Math.PI/180,0]}>
    {body}
    {definition.topConnection==="studs"&&Array.from({length:definition.lengthStuds*definition.widthStuds},(_,index)=>{const sx=index%definition.lengthStuds,sz=Math.floor(index/definition.lengthStuds);return <mesh key={index} position={[(sx+.5-definition.lengthStuds/2)*20,height/2+2,(sz+.5-definition.widthStuds/2)*20]}><cylinderGeometry args={[6,6,4,12]}/><meshStandardMaterial color={colour} roughness={.46}/></mesh>})}
  </group>;
}

function BrickAssemblyGeometry({ parts }: { parts: PartInstance[] }) {
  const bounds=useMemo(()=>{
    if(!parts.length)return{center:new THREE.Vector3(),scale:1};
    const box=new THREE.Box3();for(const part of parts){const definition=CATALOGUE.find(item=>item.partNumber===part.partNumber);if(!definition)continue;const swapped=part.rotation===90||part.rotation===270,w=(swapped?definition.widthStuds:definition.lengthStuds)*20,d=(swapped?definition.lengthStuds:definition.widthStuds)*20,h=definition.heightPlates*8;box.expandByPoint(new THREE.Vector3(part.position[0]-w/2,part.position[1],part.position[2]-d/2));box.expandByPoint(new THREE.Vector3(part.position[0]+w/2,part.position[1]+h,part.position[2]+d/2))}
    const size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);return{center,scale:3/Math.max(size.x,size.y,size.z,1)};
  },[parts]);
  return <group scale={bounds.scale} position={[-bounds.center.x*bounds.scale,-bounds.center.y*bounds.scale,-bounds.center.z*bounds.scale]}>{parts.map(part=><PreviewPart key={part.id} part={part}/>)}</group>;
}

function PreviewCanvas({ children }: { children: ReactNode }) {
  return <Canvas camera={{ position: [5, 3.8, 6], fov: 38 }} dpr={[1, 1.5]}>
    <color attach="background" args={["#0b1217"]} /><ambientLight intensity={1.4} /><directionalLight position={[4, 7, 6]} intensity={2.5} /><directionalLight position={[-5, 1, -3]} intensity={.6} />
    <Rotatable>{children}</Rotatable>
  </Canvas>;
}

export function MeshConversionPreview({ mesh, volume, parts }: { mesh: ParsedMesh; volume: VoxelizedMesh; parts?: PartInstance[] }) {
  return <div className="conversion-preview">
    <div><span>SOURCE MESH</span><PreviewCanvas><SourceGeometry mesh={mesh} volume={volume} /></PreviewCanvas></div>
    <div><span>{parts?.length?"LEGO ASSEMBLY":"BRICK VOLUME"}</span><PreviewCanvas>{parts?.length?<BrickAssemblyGeometry parts={parts}/>:<VoxelGeometry volume={volume}/>}</PreviewCanvas></div>
    <small>Drag either model to rotate · Compare the source with the generated LEGO construction</small>
  </div>;
}
