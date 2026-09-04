"use client";
import {Canvas,useThree} from "@react-three/fiber";
import {useEffect,useMemo,useRef,useState} from "react";
import * as THREE from "three";
import type {LDrawModel} from "./ldraw";
import {trianglePositions} from "./ldraw";
import {COLOURS,type PartInstance} from "./assembly";

type Props={parts:PartInstance[];models:Map<string,LDrawModel>;selectedId:string;invalidIds:Set<string>;orthographic:boolean;wireframe:boolean;resetKey:number;onSelect:(id:string)=>void};

function PartMesh({part,model,selected,invalid,wireframe,onSelect}:{part:PartInstance;model:LDrawModel;selected:boolean;invalid:boolean;wireframe:boolean;onSelect:()=>void}){
 const geometry=useMemo(()=>{const value=new THREE.BufferGeometry();value.setAttribute("position",new THREE.BufferAttribute(trianglePositions(model),3));value.computeVertexNormals();return value},[model]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 const colour=COLOURS.find(value=>value.code===part.colour)?.hex??"#e8b63b";
 return <mesh geometry={geometry} position={part.position} rotation={[0,part.rotation*Math.PI/180,0]} onClick={event=>{event.stopPropagation();onSelect()}} castShadow receiveShadow>
  <meshStandardMaterial side={THREE.DoubleSide} color={colour} roughness={.42} metalness={.02} wireframe={wireframe} emissive={invalid?"#9b1c1c":selected?"#7a5b12":"#000000"} emissiveIntensity={invalid ? .55 : selected ? .32 : 0}/>
 </mesh>;
}

function Scene(props:Props){
 const group=useRef<THREE.Group>(null),drag=useRef<{x:number;y:number}|null>(null),{camera}=useThree();
 useEffect(()=>{camera.position.set(180,145,190);camera.lookAt(0,20,0);if(group.current)group.current.rotation.set(-.18,.55,0)},[camera,props.resetKey]);
 return <group ref={group} rotation={[-.18,.55,0]} onPointerMissed={()=>props.onSelect("")} onPointerDown={event=>{if(event.button!==0||event.intersections.length){return}drag.current={x:event.clientX,y:event.clientY}}} onPointerMove={event=>{if(!drag.current||!group.current)return;group.current.rotation.y+=(event.clientX-drag.current.x)*.008;group.current.rotation.x+=(event.clientY-drag.current.y)*.008;drag.current={x:event.clientX,y:event.clientY}}} onPointerUp={()=>drag.current=null}>
  {props.parts.map(part=>{const model=props.models.get(part.partNumber);return model&&<PartMesh key={part.id} part={part} model={model} selected={part.id===props.selectedId} invalid={props.invalidIds.has(part.id)} wireframe={props.wireframe} onSelect={()=>props.onSelect(part.id)}/>})}
 </group>;
}

export function AssemblyViewer(props:Props){
 const [zoom,setZoom]=useState(1);
 return <div className="canvas-wrap assembly-canvas" onWheel={event=>setZoom(value=>Math.min(2.3,Math.max(.45,value-event.deltaY*.001)))} onContextMenu={event=>event.preventDefault()}>
  <Canvas shadows orthographic={props.orthographic} camera={props.orthographic?{position:[180,145,190],zoom:3.3*zoom}:{position:[180,145,190],fov:40,zoom}} dpr={[1,2]}>
   <color attach="background" args={["#0d151a"]}/><ambientLight intensity={1.25}/><directionalLight castShadow position={[90,150,100]} intensity={2.8}/><directionalLight position={[-100,60,-80]} intensity={.7}/>
   <gridHelper args={[400,20,"#3e4c55","#202b32"]} position={[0,-.5,0]}/><Scene {...props}/>
  </Canvas><div className="viewer-help">Select a brick, then use the precise grid controls · Scroll to zoom</div>
 </div>;
}
