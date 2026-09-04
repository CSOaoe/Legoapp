"use client";

import {
  ArrowRight, Blocks, Box, Check, ChevronRight, Download, Eye,
  FileUp, ImagePlus, Layers3, LoaderCircle, ShieldCheck, Sparkles, Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { analyseImage, mergeProfiles, type AnalysedImage } from "../packages/reconstruction/src/image-analysis";
import { parseMeshFile, voxelizeMesh, type ParsedMesh, type UpAxis, type VoxelizedMesh } from "../packages/reconstruction/src/mesh-import";
import { reconstructFromProfiles, reconstructFromVoxels, type ReconstructionResult } from "../packages/reconstruction/src/reconstruct";
import { billOfMaterials, CATALOGUE, COLOURS, exportLDraw, serializeAssembly, type PartInstance } from "../packages/renderer/src/assembly";

type Angle = "Front" | "Right" | "Back" | "Left" | "Detail";
type Photo = { id: string; name: string; angle: Angle; analysis: AnalysedImage };
type SourceMode = "photos" | "mesh";
const ANGLES: Angle[] = ["Front", "Right", "Back", "Left", "Detail"];
const SIZES = {
  Study: { layers: 10, width: 10, depth: 8 },
  Balanced: { layers: 16, width: 16, depth: 12 },
  Display: { layers: 24, width: 24, depth: 18 },
} as const;

const download = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type })), link = document.createElement("a");
  link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
};

function LayerDiagram({ parts }: { parts: PartInstance[] }) {
  const boxes = parts.map(part => {
    const definition = CATALOGUE.find(item => item.partNumber === part.partNumber)!;
    const rotated = part.rotation === 90 || part.rotation === 270;
    const x = (rotated ? definition.widthStuds : definition.lengthStuds) * 20;
    const z = (rotated ? definition.lengthStuds : definition.widthStuds) * 20;
    return { part, x, z, minX: part.position[0] - x / 2, maxX: part.position[0] + x / 2, minZ: part.position[2] - z / 2, maxZ: part.position[2] + z / 2 };
  });
  const minX = Math.min(...boxes.map(box => box.minX)), maxX = Math.max(...boxes.map(box => box.maxX));
  const minZ = Math.min(...boxes.map(box => box.minZ)), maxZ = Math.max(...boxes.map(box => box.maxZ));
  const width = Math.max(20, maxX - minX), depth = Math.max(20, maxZ - minZ);
  return <div className="layer-map" aria-label="Top view of this instruction layer">{boxes.map(box => <i key={box.part.id} title={`${box.part.partNumber} at X ${box.part.position[0]}, Z ${box.part.position[2]}`} style={{ left: `${(box.minX - minX) / width * 86 + 7}%`, top: `${(box.minZ - minZ) / depth * 78 + 11}%`, width: `${box.x / width * 86}%`, height: `${box.z / depth * 78}%`, background: COLOURS.find(value => value.code === box.part.colour)?.hex }}><span>{box.part.partNumber}</span></i>)}</div>;
}

export default function Reconstruction() {
  const photoInput = useRef<HTMLInputElement>(null), meshInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<SourceMode>("mesh"), [photos, setPhotos] = useState<Photo[]>([]);
  const [mesh, setMesh] = useState<ParsedMesh | null>(null), [meshVolume, setMeshVolume] = useState<VoxelizedMesh | null>(null);
  const [analysing, setAnalysing] = useState(false), [error, setError] = useState("");
  const [size, setSize] = useState<keyof typeof SIZES>("Balanced"), [hollow, setHollow] = useState(true);
  const [supports, setSupports] = useState(true), [upAxis, setUpAxis] = useState<UpAxis>("auto"), [colour, setColour] = useState(71);
  const [result, setResult] = useState<ReconstructionResult | null>(null), [step, setStep] = useState(0);
  const bom = useMemo(() => result ? billOfMaterials(result.document.parts) : [], [result]);
  const invalidate = () => { setResult(null); setMeshVolume(null); };
  const chooseMode = (next: SourceMode) => { setMode(next); setError(""); invalidate(); };

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setAnalysing(true); setError(""); invalidate();
    try {
      const selected = Array.from(files).slice(0, 8), analysed = await Promise.all(selected.map(file => analyseImage(file)));
      setPhotos(current => [...current, ...analysed.map((analysis, index) => ({ id: `${Date.now()}-${index}`, name: selected[index].name, angle: ANGLES[(current.length + index) % ANGLES.length], analysis }))].slice(0, 8));
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Those images could not be analysed"); }
    finally { setAnalysing(false); }
  }

  async function addMesh(file: File | undefined) {
    if (!file) return;
    setAnalysing(true); setError(""); setMesh(null); invalidate();
    try { setMesh(await parseMeshFile(file)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "That 3D file could not be read"); }
    finally { setAnalysing(false); }
  }

  function removePhoto(id: string) {
    setPhotos(current => { const removed = current.find(photo => photo.id === id); if (removed) URL.revokeObjectURL(removed.analysis.preview); return current.filter(photo => photo.id !== id); });
    invalidate();
  }

  function generate() {
    setError("");
    try {
      const settings = SIZES[size]; let generated: ReconstructionResult;
      if (mode === "mesh") {
        if (!mesh) throw new Error("Add an OBJ or STL model first");
        const volume = voxelizeMesh(mesh, { maxWidthStuds: settings.width, maxDepthStuds: settings.depth, maxHeightLayers: settings.layers, upAxis, hollow, addSupports: supports });
        generated = reconstructFromVoxels(volume, { name: `${mesh.name} brick conversion`, colour }); setMeshVolume(volume);
      } else {
        if (!photos.length) throw new Error("Add at least one clear photo first");
        const frontPhotos = photos.filter(photo => photo.angle === "Front" || photo.angle === "Back" || photo.angle === "Detail"), sidePhotos = photos.filter(photo => photo.angle === "Left" || photo.angle === "Right");
        const front = mergeProfiles((frontPhotos.length ? frontPhotos : photos).map(photo => photo.analysis.profile)), rawSide = mergeProfiles((sidePhotos.length ? sidePhotos : photos).map(photo => photo.analysis.profile));
        const side = { ...rawSide, widths: rawSide.widths.map(value => sidePhotos.length ? value : value * .68) };
        generated = reconstructFromProfiles(front, side, { name: "Photo reconstruction", heightLayers: settings.layers, maxWidthStuds: settings.width, maxDepthStuds: settings.depth, colour, hollow });
      }
      setResult(generated); setStep(0); sessionStorage.setItem("brickforge.generatedAssembly", serializeAssembly(generated.document));
    } catch (problem) { setError(problem instanceof Error ? problem.message : "The model could not be generated"); }
  }

  function openEditor() { if (result) { sessionStorage.setItem("brickforge.generatedAssembly", serializeAssembly(result.document)); window.location.assign("/assembly"); } }
  const ready = mode === "mesh" ? Boolean(mesh) : photos.length > 0, sourceLabel = mode === "mesh" ? "3D mesh conversion" : "Multi-view reconstruction";

  return <main className="reconstruct-shell">
    <header className="reconstruct-top"><Link className="reconstruct-brand" href="/"><span><Blocks size={20} /></span><strong>BRICKFORGE <i>AI</i></strong></Link><nav><Link className="active" href="/"><FileUp size={15} />Reconstruction</Link><Link href="/assembly"><Box size={15} />Assembly editor</Link></nav><div className="local-badge"><ShieldCheck size={15} />Files processed locally</div></header>
    <section className="reconstruct-main">
      <div className="reconstruct-title"><div><p>3D MESH CONVERSION · M3.2</p><h1>Convert real 3D models into buildable brick designs</h1><span>Import an OBJ or STL for accurate volume and depth, or use photographs for a quick shape study. BrickForge creates an editable model, inventory, and ordered build layers.</span></div><div className="pipeline"><span className="done"><Check />Source</span><i /><span className={ready ? "done" : ""}><Check />Volume</span><i /><span className={result ? "done" : ""}><Check />Build</span></div></div>
      <div className="reconstruct-grid">
        <section className="photo-column">
          <div className="section-label"><span>01</span><div><b>Source model</b><small>3D files give the strongest shape match</small></div></div>
          <div className="source-tabs" role="tablist"><button className={mode === "mesh" ? "selected" : ""} onClick={() => chooseMode("mesh")}><Box size={15} />OBJ or STL</button><button className={mode === "photos" ? "selected" : ""} onClick={() => chooseMode("photos")}><ImagePlus size={15} />Photographs</button></div>
          {mode === "mesh" ? <>
            <button className={`dropzone ${mesh ? "compact" : ""}`} onClick={() => meshInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addMesh(event.dataTransfer.files[0]); }}><input ref={meshInput} hidden type="file" accept=".obj,.stl,model/obj,model/stl" onChange={event => addMesh(event.target.files?.[0])} />{analysing ? <LoaderCircle className="spin" size={29} /> : <FileUp size={29} />}<b>{analysing ? "Reading mesh geometry…" : mesh ? "Choose a different 3D model" : "Choose or drop an OBJ / STL"}</b><span>Closed, watertight meshes work best · up to 250,000 triangles</span></button>
            {mesh && <article className="mesh-card"><Box size={34} /><div><b>{mesh.name}</b><span>{mesh.format} · {mesh.triangles.length.toLocaleString()} triangles · {mesh.vertexCount.toLocaleString()} vertices</span><small>{Math.round(mesh.closedConfidence * 100)}% closed-edge confidence</small></div><button aria-label="Remove 3D model" onClick={() => { setMesh(null); invalidate(); }}><Trash2 size={15} /></button></article>}
            <div className="capture-tips"><Eye size={17} /><div><b>Why this matches better</b><span>A mesh contains the object’s actual depth and contours. Export as a closed STL or triangulated OBJ; detailed textures do not affect brick geometry.</span></div></div>
          </> : <>
            <button className={`dropzone ${photos.length ? "compact" : ""}`} onClick={() => photoInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addPhotos(event.dataTransfer.files); }}><input ref={photoInput} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => addPhotos(event.target.files)} />{analysing ? <LoaderCircle className="spin" size={29} /> : <ImagePlus size={29} />}<b>{analysing ? "Analysing silhouettes…" : photos.length ? "Add another angle" : "Choose or drop photographs"}</b><span>JPG, PNG, or WebP · up to 8 views</span></button>
            <div className="photo-list">{photos.map(photo => <article key={photo.id}><Image src={photo.analysis.preview} alt={photo.name} width={58} height={47} unoptimized /><div><b>{photo.name}</b><small>{photo.analysis.width} × {photo.analysis.height} · {Math.round(photo.analysis.profile.confidence * 100)}% mask confidence</small><select aria-label={`View angle for ${photo.name}`} value={photo.angle} onChange={event => { const angle = event.target.value as Angle; setPhotos(current => current.map(item => item.id === photo.id ? { ...item, angle } : item)); invalidate(); }}>{ANGLES.map(angle => <option key={angle}>{angle}</option>)}</select></div><button aria-label={`Remove ${photo.name}`} onClick={() => removePhoto(photo.id)}><Trash2 size={15} /></button></article>)}</div>
            <div className="capture-tips"><Eye size={17} /><div><b>Photograph mode is approximate</b><span>It estimates shared silhouettes, not hidden depth. Use a 3D scan exported as OBJ or STL when likeness matters.</span></div></div>
          </>}
          {error && <div className="reconstruct-error">{error}</div>}
        </section>
        <section className="settings-column">
          <div className="section-label"><span>02</span><div><b>Build target</b><small>Choose fidelity and construction style</small></div></div>
          <label className="setting-title">MODEL SIZE</label><div className="size-options">{Object.entries(SIZES).map(([name, value]) => <button key={name} className={size === name ? "selected" : ""} onClick={() => { setSize(name as keyof typeof SIZES); invalidate(); }}><b>{name}</b><span>{value.layers} layers</span><small>up to {value.width} × {value.depth} studs</small></button>)}</div>
          {mode === "mesh" && <><label className="setting-title" htmlFor="up-axis">VERTICAL / UP AXIS</label><select id="up-axis" className="axis-select" value={upAxis} onChange={event => { setUpAxis(event.target.value as UpAxis); invalidate(); }}><option value="auto">Auto-detect longest axis</option><option value="x">X axis</option><option value="y">Y axis</option><option value="z">Z axis</option></select></>}
          <label className="setting-title">PRIMARY BRICK COLOUR</label><div className="colour-options">{COLOURS.map(value => <button key={value.code} className={colour === value.code ? "selected" : ""} aria-label={value.name} title={value.name} style={{ background: value.hex }} onClick={() => { setColour(value.code); invalidate(); }} />)}</div>
          <label className="hollow-toggle"><input type="checkbox" checked={hollow} onChange={event => { setHollow(event.target.checked); invalidate(); }} /><span><b>Hollow large sections</b><small>Uses fewer parts while preserving the outer shape.</small></span></label>
          {mode === "mesh" && <label className="hollow-toggle"><input type="checkbox" checked={supports} onChange={event => { setSupports(event.target.checked); invalidate(); }} /><span><b>Add hidden structural supports</b><small>Builds columns beneath overhangs so every generated layer is connected.</small></span></label>}
          <div className="estimate-card"><Sparkles size={18} /><div><b>{sourceLabel}</b><span>{mode === "mesh" ? "The mesh is voxelised at LEGO scale, reinforced, then packed with controlled real brick IDs." : "Photographs estimate the outline only; fine depth and hidden cavities remain simplified."}</span></div></div>
          <button className="generate-button" disabled={!ready || analysing} onClick={generate}><Sparkles size={17} />{result ? "Regenerate model" : "Generate brick model"}<ArrowRight size={17} /></button>
        </section>
        <section className={`result-column ${result ? "has-result" : ""}`}>
          <div className="section-label"><span>03</span><div><b>Build package</b><small>Model, inventory, and instructions</small></div></div>
          {!result ? <div className="result-empty"><Layers3 size={34} /><b>Your build will appear here</b><span>{mode === "mesh" ? "Add a closed OBJ or STL, choose the build scale, and convert its real 3D volume." : "Add photographs, choose a size, and generate a quick brick study."}</span></div> : <>
            <div className="result-summary"><div><small>PARTS</small><b>{result.document.parts.length}</b></div><div><small>LAYERS</small><b>{result.instructions.length}</b></div><div><small>{mode === "mesh" ? "MESH QUALITY" : "SHAPE CONFIDENCE"}</small><b>{result.confidence}%</b></div></div>
            <div className="result-valid"><ShieldCheck size={18} /><div><b>Editable build generated</b><span>{hollow ? "Hollow-shell" : "Solid"} construction · {result.occupiedStuds} occupied studs{meshVolume ? ` · ${meshVolume.addedSupportVoxels} support voxels` : ""}</span></div></div>
            {meshVolume && <div className="mesh-volume"><span>Converted volume</span><b>{meshVolume.width} × {meshVolume.depth} studs · {meshVolume.height} layers · {meshVolume.upAxis.toUpperCase()} up</b></div>}
            <div className="result-tabs"><button className="selected">Instructions</button><button onClick={openEditor}>Open 3D editor</button></div>
            <div className="instruction-card"><div className="step-heading"><button disabled={step === 0} onClick={() => setStep(value => value - 1)}>‹</button><span><small>STEP {step + 1} OF {result.instructions.length}</small><b>{result.instructions[step].title}</b></span><button disabled={step === result.instructions.length - 1} onClick={() => setStep(value => value + 1)}>›</button></div><LayerDiagram parts={result.document.parts.filter(part => result.instructions[step].partIds.includes(part.id))} /><ul>{result.instructions[step].summary.map(row => <li key={row.partNumber}><span>Part {row.partNumber}</span><b>× {row.quantity}</b></li>)}</ul></div>
            <div className="mini-bom"><div><b>Complete parts list</b><span>{bom.length} part/colour groups</span></div>{bom.slice(0, 5).map(row => <p key={`${row.partNumber}-${row.colour}`}><i style={{ background: COLOURS.find(value => value.code === row.colour)?.hex }} /><span>{row.partNumber} · {row.name}</span><b>×{row.quantity}</b></p>)}</div>
            <div className="result-actions"><button onClick={openEditor}>Edit model <ChevronRight size={15} /></button><button onClick={() => download("brickforge-build.json", JSON.stringify({ assembly: result.document, instructions: result.instructions, source: meshVolume ?? "photographs" }, null, 2), "application/json")}><Download size={15} />Build package</button><button onClick={() => download("brickforge-build.ldr", exportLDraw(result.document), "text/plain")}><Download size={15} />LDraw</button></div>
          </>}
        </section>
      </div>
    </section>
  </main>;
}
