"use client";

import {
  ArrowRight, Blocks, Box, Check, ChevronRight, Download, Eye,
  FileUp, ImagePlus, Layers3, LoaderCircle, ShieldCheck, Sparkles, Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { analyseImage, mergeProfiles, type AnalysedImage } from "../packages/reconstruction/src/image-analysis";
import { generateLocalAiObj, getLocalAiHealth, type LocalAiHealth } from "../packages/reconstruction/src/local-ai-client";
import { MeshConversionPreview } from "../packages/reconstruction/src/mesh-conversion-preview";
import { parseMeshFile, parseObj, voxelizeMesh, type ParsedMesh, type UpAxis, type VoxelizedMesh } from "../packages/reconstruction/src/mesh-import";
import { createPhotoMesh, exportMeshObj, exportMeshStl } from "../packages/reconstruction/src/photo-mesh";
import { reconstructFromVoxels, type ReconstructionResult } from "../packages/reconstruction/src/reconstruct";
import { billOfMaterials, CATALOGUE, COLOURS, exportLDraw, serializeAssembly, validateAssembly, type PartInstance } from "../packages/renderer/src/assembly";

type Angle = "Front" | "Right" | "Back" | "Left" | "Detail";
type Photo = { id: string; name: string; angle: Angle; analysis: AnalysedImage; file: File };
type SourceMode = "photos" | "mesh";
type PhotoEngine = "visual-hull" | "local-ai";
const ANGLES: Angle[] = ["Front", "Right", "Back", "Left", "Detail"];
const SIZES = {
  Study: { layers: 10, width: 10, depth: 8 },
  Balanced: { layers: 16, width: 16, depth: 12 },
  Display: { layers: 24, width: 24, depth: 18 },
  Sculpture: { layers: 48, width: 32, depth: 36 },
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
  const [mode, setMode] = useState<SourceMode>("photos"), [photos, setPhotos] = useState<Photo[]>([]);
  const [photoEngine, setPhotoEngine] = useState<PhotoEngine>("local-ai"), [aiHealth, setAiHealth] = useState<LocalAiHealth | null>(null);
  const [mesh, setMesh] = useState<ParsedMesh | null>(null), [photoMesh, setPhotoMesh] = useState<ParsedMesh | null>(null), [meshVolume, setMeshVolume] = useState<VoxelizedMesh | null>(null);
  const [analysing, setAnalysing] = useState(false), [generating, setGenerating] = useState(false), [aiProgress, setAiProgress] = useState(""), [error, setError] = useState("");
  const [size, setSize] = useState<keyof typeof SIZES>("Balanced"), [upAxis, setUpAxis] = useState<UpAxis>("auto"), [flipUp, setFlipUp] = useState(false), [colour, setColour] = useState(71);
  const [result, setResult] = useState<ReconstructionResult | null>(null), [step, setStep] = useState(0);
  const bom = useMemo(() => result ? billOfMaterials(result.document.parts) : [], [result]);
  const validationIssues = useMemo(() => result ? validateAssembly(result.document.parts) : [], [result]);
  const invalidate = () => { setResult(null); setPhotoMesh(null); setMeshVolume(null); };
  const chooseMode = (next: SourceMode) => { setMode(next); setError(""); invalidate(); };

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setAnalysing(true); setError(""); invalidate();
    try {
      const selected = Array.from(files).slice(0, 8), analysed = await Promise.all(selected.map(file => analyseImage(file)));
      setPhotos(current => [...current, ...analysed.map((analysis, index) => ({ id: `${Date.now()}-${index}`, name: selected[index].name, angle: ANGLES[(current.length + index) % ANGLES.length], analysis, file: selected[index] }))].slice(0, 8));
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

  async function checkAi() {
    setError(""); setAiProgress("Checking local AI companion…");
    try { const health = await getLocalAiHealth(); setAiHealth(health); return health; }
    catch (problem) { setAiHealth(null); throw new Error(problem instanceof Error ? `${problem.message}. Start scripts\\start-ai3d.ps1 on this computer.` : "Local AI companion is unavailable"); }
    finally { setAiProgress(""); }
  }

  async function generate() {
    setError(""); setGenerating(true); setAiProgress("");
    try {
      const settings = SIZES[size]; let generated: ReconstructionResult;
      if (mode === "mesh") {
        if (!mesh) throw new Error("Add an OBJ or STL model first");
        const volume = voxelizeMesh(mesh, { maxWidthStuds: settings.width, maxDepthStuds: settings.depth, maxHeightLayers: settings.layers, upAxis, flipUp });
        generated = reconstructFromVoxels(volume, { name: `${mesh.name} brick conversion`, colour }); setMeshVolume(volume);
      } else {
        if (!photos.length) throw new Error("Add at least one clear photo first");
        let createdMesh: ParsedMesh;
        if (photoEngine === "local-ai") {
          const health = await checkAi();
          if (!health.ready) throw new Error(health.reason ?? "Local AI companion is not ready");
          const source = photos.find(photo => photo.angle === "Front") ?? photos.find(photo => photo.angle === "Detail") ?? photos[0];
          const obj = await generateLocalAiObj(source.file, (message, progress) => setAiProgress(`${message} · ${progress}%`));
          createdMesh = parseObj(obj, `${source.name} AI reconstruction.obj`);
        } else {
          const frontPhotos = photos.filter(photo => photo.angle === "Front" || photo.angle === "Back" || photo.angle === "Detail"), sidePhotos = photos.filter(photo => photo.angle === "Left" || photo.angle === "Right");
          const front = mergeProfiles((frontPhotos.length ? frontPhotos : photos).map(photo => photo.analysis.profile)), rawSide = mergeProfiles((sidePhotos.length ? sidePhotos : photos).map(photo => photo.analysis.profile));
          const side = { ...rawSide, widths: rawSide.widths.map(value => sidePhotos.length ? value : value * .68), aspectRatio: sidePhotos.length ? rawSide.aspectRatio : (front.aspectRatio ?? .6) * .68 };
          createdMesh = createPhotoMesh(front, side);
        }
        const volume = voxelizeMesh(createdMesh, { maxWidthStuds: settings.width, maxDepthStuds: settings.depth, maxHeightLayers: settings.layers, upAxis: "y" });
        generated = reconstructFromVoxels(volume, { name: photoEngine === "local-ai" ? "Stable Fast 3D brick conversion" : "Photo-to-3D brick conversion", colour }); setPhotoMesh(createdMesh); setMeshVolume(volume);
      }
      setResult(generated); setStep(0); sessionStorage.setItem("brickforge.generatedAssembly", serializeAssembly(generated.document));
    } catch (problem) { setError(problem instanceof Error ? problem.message : "The model could not be generated"); }
    finally { setGenerating(false); setAiProgress(""); }
  }

  function openEditor() { if (result) { sessionStorage.setItem("brickforge.generatedAssembly", serializeAssembly(result.document)); window.location.assign("/assembly"); } }
  const ready = mode === "mesh" ? Boolean(mesh) : photos.length > 0, sourceLabel = mode === "mesh" ? "3D mesh conversion" : photoEngine === "local-ai" ? "Stable Fast 3D · local GPU" : "Photo-to-3D visual hull", previewMesh = mode === "mesh" ? mesh : photoMesh;
  const activeStage = result ? 2 : ready ? 1 : 0, currentSettings = SIZES[size];
  const progressMatch = aiProgress.match(/(\d+)%/), generationProgress = progressMatch ? Number(progressMatch[1]) : generating ? 18 : 0;

  return <main className="reconstruct-shell studio-shell">
    <header className="studio-topbar">
      <Link className="reconstruct-brand" href="/"><span><Blocks size={21} /></span><strong>BRICKFORGE <i>AI</i></strong></Link>
      <div className="project-crumb"><small>ACTIVE PROJECT</small><b>{mesh?.name ?? photos[0]?.name ?? "Untitled sculpture"}</b></div>
      <nav className="studio-stage-nav" aria-label="Creation stages">{["Create", "Refine", "Build"].map((label, index) => <span key={label} className={activeStage === index ? "active" : activeStage > index ? "complete" : ""}><i>{activeStage > index ? <Check size={12} /> : index + 1}</i>{label}</span>)}</nav>
      <div className="local-badge"><ShieldCheck size={15} /><span>Private workspace</span></div>
      <Link className="editor-link" href="/assembly"><Box size={15} />Assembly editor</Link>
    </header>

    <section className="studio-workspace">
      <aside className="studio-rail source-rail">
        <div className="rail-heading"><span>01</span><div><small>CREATE</small><h2>Choose your source</h2></div></div>
        <div className="source-tabs" role="tablist" aria-label="Source type"><button className={mode === "photos" ? "selected" : ""} onClick={() => chooseMode("photos")}><ImagePlus size={16} />Images</button><button className={mode === "mesh" ? "selected" : ""} onClick={() => chooseMode("mesh")}><Box size={16} />OBJ / STL</button></div>
        {mode === "mesh" ? <>
          <button className={`dropzone ${mesh ? "compact" : ""}`} onClick={() => meshInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addMesh(event.dataTransfer.files[0]); }}><input ref={meshInput} hidden type="file" accept=".obj,.stl,model/obj,model/stl" onChange={event => addMesh(event.target.files?.[0])} />{analysing ? <LoaderCircle className="spin" size={30} /> : <FileUp size={30} />}<b>{analysing ? "Reading geometry…" : mesh ? "Replace 3D model" : "Drop your 3D model"}</b><span>OBJ or STL · watertight meshes work best</span></button>
          {mesh && <article className="mesh-card"><Box size={31} /><div><b>{mesh.name}</b><span>{mesh.triangles.length.toLocaleString()} triangles · {mesh.vertexCount.toLocaleString()} vertices</span><small>{Math.round(mesh.closedConfidence * 100)}% mesh confidence</small></div><button aria-label="Remove 3D model" onClick={() => { setMesh(null); invalidate(); }}><Trash2 size={15} /></button></article>}
          <div className="capture-tips"><Eye size={17} /><div><b>Geometry gives the strongest match</b><span>Use a closed model with its base facing down. Surface textures are ignored during brick conversion.</span></div></div>
        </> : <>
          <div className="photo-engine-options" aria-label="Photo reconstruction engine"><button className={photoEngine === "local-ai" ? "selected" : ""} onClick={() => { setPhotoEngine("local-ai"); setAiHealth(null); invalidate(); }}><Sparkles size={16} /><span><b>Local AI</b><small>Maximum detail</small></span></button><button className={photoEngine === "visual-hull" ? "selected" : ""} onClick={() => { setPhotoEngine("visual-hull"); invalidate(); }}><Layers3 size={16} /><span><b>Multi-view</b><small>Fast fusion</small></span></button></div>
          <button className={`dropzone ${photos.length ? "compact" : ""}`} onClick={() => photoInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addPhotos(event.dataTransfer.files); }}><input ref={photoInput} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => addPhotos(event.target.files)} />{analysing ? <LoaderCircle className="spin" size={30} /> : <ImagePlus size={30} />}<b>{analysing ? "Reading your images…" : photos.length ? "Add another view" : "Drop images here"}</b><span>JPG, PNG or WebP · up to 8 views</span></button>
          <div className="photo-list">{photos.map(photo => <article key={photo.id}><Image src={photo.analysis.preview} alt={photo.name} width={64} height={52} unoptimized /><div><b>{photo.name}</b><small>{Math.round(photo.analysis.profile.confidence * 100)}% mask confidence</small><select aria-label={`View angle for ${photo.name}`} value={photo.angle} onChange={event => { const angle = event.target.value as Angle; setPhotos(current => current.map(item => item.id === photo.id ? { ...item, angle } : item)); invalidate(); }}>{ANGLES.map(angle => <option key={angle}>{angle}</option>)}</select></div><button aria-label={`Remove ${photo.name}`} onClick={() => removePhoto(photo.id)}><Trash2 size={15} /></button></article>)}</div>
          {photoEngine === "local-ai" ? <div className={`ai-companion ${aiHealth?.ready ? "ready" : ""}`}><Sparkles size={17} /><div><b>{aiHealth?.ready ? "AI engine ready" : "Local AI engine"}</b><span>{aiHealth?.ready ? `${aiHealth.gpu} · source stays here` : aiHealth?.reason ?? "Connect the companion before generation."}</span></div><button onClick={() => checkAi().catch(problem => setError(problem.message))}>Check</button></div> : <div className="capture-tips"><Eye size={17} /><div><b>Use four clear angles</b><span>Front, back and both sides on a plain background create the best fused shape.</span></div></div>}
        </>}
        {error && <div className="reconstruct-error">{error}</div>}
        <div className="rail-foot"><ShieldCheck size={15} /><span>Your files stay on this computer</span></div>
      </aside>

      <section className="forge-stage">
        <div className="forge-heading"><div><small>SHAPE WORKSPACE</small><h1>{result ? result.document.name : ready ? "Ready to forge" : "Start with an image or 3D file"}</h1></div><div className={`stage-status ${result ? "ready" : ""}`}><i />{result ? "BUILD READY" : generating ? "FORGING" : ready ? "SOURCE READY" : "WAITING FOR SOURCE"}</div></div>
        <div className={`forge-canvas ${result ? "populated" : ""}`}>
          <div className="canvas-grid" />
          <span className="hud-corner top-left">BF / VIEW 01</span><span className="hud-corner top-right">{currentSettings.width} × {currentSettings.depth} × {currentSettings.layers}</span>
          {generating ? <div className="forge-processing"><div className="forge-orbit"><Sparkles size={30} /></div><small>BRICKFORGE ENGINE</small><h2>{aiProgress ? aiProgress.split(" · ")[0] : "Analysing geometry"}</h2><div className="generation-track"><i style={{ width: `${generationProgress}%` }} /></div><span>{generationProgress}% · Keep this window open</span></div> : previewMesh && meshVolume ? <MeshConversionPreview mesh={previewMesh} volume={meshVolume} /> : <div className="forge-empty"><div className="empty-emblem"><Blocks size={39} /></div><small>YOUR MODEL WILL APPEAR HERE</small><h2>{ready ? "Source loaded. Choose the build settings and generate." : "Bring any object into bricks."}</h2><span>Rotate and compare the reconstructed shape with its brick volume before opening the full editor.</span><button onClick={() => mode === "photos" ? photoInput.current?.click() : meshInput.current?.click()}>{mode === "photos" ? <ImagePlus size={16} /> : <FileUp size={16} />}{mode === "photos" ? "Choose images" : "Choose 3D file"}</button></div>}
          <div className="canvas-readout"><span><i />ORBIT VIEW</span><span>{sourceLabel}</span><span>INTERLOCKED PARTS</span></div>
        </div>
        {result ? <div className="build-metrics"><div><small>BRICKS</small><b>{result.document.parts.length.toLocaleString()}</b><span>{bom.length} unique groups</span></div><div><small>BUILD HEIGHT</small><b>{result.instructions.length}</b><span>ordered layers</span></div><div><small>SHAPE COVERAGE</small><b>{result.shapeCoverage}%</b><span>{result.occupiedStuds.toLocaleString()} of {result.sourceStuds.toLocaleString()} source studs</span></div><div className={validationIssues.length ? "warning" : "valid"}><small>STRUCTURE</small><b>{validationIssues.length ? `${validationIssues.length} flags` : "Interlocked"}</b><span>{validationIssues.length ? "Open editor to review" : "connected to the base"}</span></div></div> : <div className="workflow-note"><span>01</span><b>Import source</b><i /><span>02</span><b>Shape the build</b><i /><span>03</span><b>Export instructions</b></div>}
      </section>

      <aside className="studio-rail refine-rail">
        <div className="rail-heading"><span>02</span><div><small>REFINE</small><h2>Shape the build</h2></div></div>
        <label className="setting-title">BUILD SCALE</label><div className="size-options">{Object.entries(SIZES).map(([name, value]) => <button key={name} className={size === name ? "selected" : ""} onClick={() => { setSize(name as keyof typeof SIZES); invalidate(); }}><span><b>{name}</b><small>{value.width} × {value.depth} studs</small></span><em>{value.layers}<small>layers</small></em></button>)}</div>
        {mode === "mesh" && <div className="advanced-settings"><label className="setting-title" htmlFor="up-axis">MODEL ORIENTATION</label><select id="up-axis" className="axis-select" value={upAxis} onChange={event => { setUpAxis(event.target.value as UpAxis); invalidate(); }}><option value="auto">Automatic up axis</option><option value="x">X axis up</option><option value="y">Y axis up</option><option value="z">Z axis up</option></select><label className="flip-toggle"><input type="checkbox" checked={flipUp} onChange={event => { setFlipUp(event.target.checked); invalidate(); }} /><span>Flip model vertically</span></label></div>}
        <label className="setting-title">BRICK PALETTE</label><div className="colour-options">{COLOURS.map(value => <button key={value.code} className={colour === value.code ? "selected" : ""} aria-label={value.name} title={value.name} style={{ background: value.hex }} onClick={() => { setColour(value.code); invalidate(); }} />)}</div>
        <div className="construction-method"><Blocks size={18} /><span><b>Instruction-book construction</b><small>Real parts only. Each layer crosses seams and locks to the assembly below—no generated filler columns.</small></span></div>
        <div className="build-estimate"><div><Sparkles size={17} /><span><small>CONVERSION ENGINE</small><b>{sourceLabel}</b></span></div><p>{photoEngine === "local-ai" && mode === "photos" ? "AI reconstructs the object first, then BrickForge packs its shape into connected, interlocking LEGO parts." : "The source geometry is sampled at brick scale and packed with connected, interlocking part IDs."}</p></div>
        <button className="generate-button" disabled={!ready || analysing || generating} onClick={generate}>{generating ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}<span>{generating ? "Forging your model…" : result ? "Rebuild with changes" : "Forge brick model"}<small>{ready ? `${currentSettings.layers} layers · ${currentSettings.width} × ${currentSettings.depth} studs` : "Add a source to continue"}</small></span><ArrowRight size={18} /></button>
      </aside>
    </section>

    {result && <section className="build-dock">
      <div className="dock-heading"><div><small>03 · BUILD</small><h2>Your build package</h2><span>{result.document.parts.length} bricks · {result.instructions.length} ordered layers · {validationIssues.length ? "Review recommended" : "Structurally connected"}</span></div><button className="open-editor" onClick={openEditor}>Open full 3D editor <ChevronRight size={16} /></button></div>
      <div className="dock-grid">
        <article className="instruction-card"><div className="step-heading"><button aria-label="Previous step" disabled={step === 0} onClick={() => setStep(value => value - 1)}>‹</button><span><small>STEP {step + 1} / {result.instructions.length}</small><b>{result.instructions[step].title}</b></span><button aria-label="Next step" disabled={step === result.instructions.length - 1} onClick={() => setStep(value => value + 1)}>›</button></div><LayerDiagram parts={result.document.parts.filter(part => result.instructions[step].partIds.includes(part.id))} /><ul>{result.instructions[step].summary.map(row => <li key={row.partNumber}><span>Part {row.partNumber}</span><b>× {row.quantity}</b></li>)}</ul></article>
        <article className="mini-bom"><div><span><small>INVENTORY</small><b>Complete parts list</b></span><em>{bom.length} groups</em></div>{bom.slice(0, 7).map(row => <p key={`${row.partNumber}-${row.colour}`}><i style={{ background: COLOURS.find(value => value.code === row.colour)?.hex }} /><span><b>{row.partNumber}</b>{row.name}</span><strong>×{row.quantity}</strong></p>)}</article>
        <article className="export-panel"><small>EXPORT</small><h3>Take the build anywhere</h3><p>Continue in BrickForge, open the model in LDraw-compatible tools, or keep a complete project package.</p><div className="result-actions"><button onClick={openEditor}><Box size={16} />Edit model</button>{photoMesh && <><button onClick={() => download("brickforge-photo-model.obj", exportMeshObj(photoMesh), "model/obj")}><Download size={16} />OBJ</button><button onClick={() => download("brickforge-photo-model.stl", exportMeshStl(photoMesh), "model/stl")}><Download size={16} />STL</button></>}<button onClick={() => download("brickforge-build.json", JSON.stringify({ assembly: result.document, instructions: result.instructions, source: meshVolume ?? "photographs" }, null, 2), "application/json")}><Download size={16} />Build package</button><button onClick={() => download("brickforge-build.ldr", exportLDraw(result.document), "text/plain")}><Download size={16} />LDraw</button></div></article>
      </div>
    </section>}
  </main>;
}
