"use client";
import {Canvas,useThree} from "@react-three/fiber";
import {useEffect,useMemo,useRef,useState} from "react";
import * as THREE from "three";
import {LDrawModel,trianglePositions} from "./ldraw";
type Props={model:LDrawModel;orthographic:boolean;wireframe:boolean;resetKey:number};
function Geometry({model,wireframe,resetKey}:Props){
  const group=useRef<THREE.Group>(null); const drag=useRef<{x:number;y:number;button:number}|null>(null); const {camera}=useThree();
  const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(trianglePositions(model),3));g.computeVertexNormals();g.center();return g},[model]);
  useEffect(()=>{camera.position.set(115,85,120);camera.lookAt(0,0,0);if(group.current){group.current.rotation.set(-.35,.65,0);group.current.position.set(0,0,0)}},[camera,resetKey]);
  return <group ref={group} rotation={[-.35,.65,0]} onPointerDown={e=>{e.stopPropagation();drag.current={x:e.clientX,y:e.clientY,button:e.button};(e.target as Element).setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current||!group.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(drag.current.button===2||e.shiftKey){group.current.position.x+=dx*.12;group.current.position.y-=dy*.12}else{group.current.rotation.y+=dx*.009;group.current.rotation.x+=dy*.009}drag.current={...drag.current,x:e.clientX,y:e.clientY}}} onPointerUp={()=>drag.current=null}>
    <mesh geometry={geometry}><meshStandardMaterial side={THREE.DoubleSide} color="#e8b63b" roughness={.4} metalness={.03} wireframe={wireframe}/></mesh>
  </group>
}
export function PartViewer(props:Props){
  const [zoom,setZoom]=useState(1);
  return <div className="canvas-wrap" onWheel={e=>setZoom(v=>Math.min(2.5,Math.max(.45,v-e.deltaY*.001))) } onContextMenu={e=>e.preventDefault()}>
    <Canvas orthographic={props.orthographic} camera={props.orthographic?{position:[115,85,120],zoom:5*zoom}:{position:[115,85,120],fov:38,zoom}} dpr={[1,2]}>
      <color attach="background" args={["#10181e"]}/><ambientLight intensity={1.4}/><directionalLight position={[60,100,80]} intensity={3}/><directionalLight position={[-80,20,-50]} intensity={.8}/>
      <gridHelper args={[240,24,"#2f3b43","#202a31"]} position={[0,-24,0]}/><Geometry {...props}/>
    </Canvas><div className="viewer-help">Drag to orbit · Shift-drag to pan · Scroll to zoom</div>
  </div>
}
