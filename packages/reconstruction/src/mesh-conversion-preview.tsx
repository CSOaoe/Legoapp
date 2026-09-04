"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { ParsedMesh, Vector3, VoxelizedMesh } from "./mesh-import";

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

function PreviewCanvas({ children }: { children: ReactNode }) {
  return <Canvas camera={{ position: [5, 3.8, 6], fov: 38 }} dpr={[1, 1.5]}>
    <color attach="background" args={["#0b1217"]} /><ambientLight intensity={1.4} /><directionalLight position={[4, 7, 6]} intensity={2.5} /><directionalLight position={[-5, 1, -3]} intensity={.6} />
    <Rotatable>{children}</Rotatable>
  </Canvas>;
}

export function MeshConversionPreview({ mesh, volume }: { mesh: ParsedMesh; volume: VoxelizedMesh }) {
  return <div className="conversion-preview">
    <div><span>SOURCE MESH</span><PreviewCanvas><SourceGeometry mesh={mesh} volume={volume} /></PreviewCanvas></div>
    <div><span>BRICK VOLUME</span><PreviewCanvas><VoxelGeometry volume={volume} /></PreviewCanvas></div>
    <small>Drag either model to rotate · Compare the complete shape before opening individual build steps</small>
  </div>;
}
