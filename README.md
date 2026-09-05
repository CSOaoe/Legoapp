# BrickForge AI
**Turn a 3D model or photograph into a buildable brick design.**

Milestones 0–3.4 establish a modular monorepo, tested Parts Engine, real LDraw resolver, interactive multi-part assembly workspace, local multi-view photo-to-3D reconstruction, direct OBJ/STL mesh conversion, and an optional GPU-powered Stable Fast 3D companion.

## Product target
BrickForge will accept one or, preferably, several photographs of the same object from different angles. The reconstruction pipeline will isolate the subject, estimate a shared 3D volume, approximate it with available brick geometry at the chosen size/detail level, validate the structure, and produce:

- an editable 3D LEGO-style model;
- an exact grouped parts list with colours and quantities;
- collision and structural warnings;
- numbered, layer-aware building instructions; and
- portable project, LDraw, and instruction exports.

Multi-view photo sets with consistent lighting and front, rear, left, and right coverage give the strongest reconstruction input. Highly detailed sculptures are intentionally converted into buildable brick interpretations; output fidelity depends on target size, selected parts, and image coverage.

## Web setup
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
npm install
```

## Catalogue workflow
```bash
brickforge build-parts-db
brickforge import-rebrickable data/rebrickable
brickforge import-ldraw data/ldraw
brickforge validate-parts
```
Required Rebrickable files: `parts.csv`, `part_categories.csv`, and `colors.csv`. Colour availability is populated from `elements.csv` and/or `inventory_parts.csv`. Refresh by replacing CSVs and rerunning the importer.

## Run and test
```bash
uvicorn apps.api.main:app --reload --port 8000
npm run dev
pytest
npm test
```

`GET /parts/search?q=Brick%202%20x%204` returns a record with internal/external IDs, dimensions, category, available geometry and Core Set status. Interactive API documentation is at `http://localhost:8000/docs`.

## Optional local AI setup (Windows + NVIDIA)

Stable Fast 3D is deliberately a companion process: the hosted web app cannot run
a multi-gigabyte CUDA model, while the companion keeps images and model inference
on the user's computer.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-ai3d.ps1
powershell -ExecutionPolicy Bypass -File scripts\login-ai3d.ps1
powershell -ExecutionPolicy Bypass -File scripts\start-ai3d.ps1
```

Before login, request access and accept the licence on the
[Stable Fast 3D model page](https://huggingface.co/stabilityai/stable-fast-3d).
The runtime, model cache, and generated meshes stay under ignored local tooling
and user-cache directories; credentials must never be committed.

## Known limitations
- The reviewed Core Set contains 20 common bricks, plates, slopes, curved slopes, tiles, and a SNOT brick; reaching the 300–500 target remains a deliberate metadata review task.
- LDraw aliases/decorated variants are not guessed.
- Dimensions are curated rather than inferred from meshes.
- The deployed web shell uses representative Milestone 1 data; production FastAPI hosting and live frontend wiring remain separate.

## Milestone 2 viewer
The web workspace includes a React Three Fiber viewer with orbit, pan, zoom, perspective/orthographic cameras, wireframe mode, reset and an LDraw file picker. The parser renders direct Type 3 triangles and Type 4 quads, tracks Type 2 edges, and explicitly warns when Type 1 subfiles need a library resolver. The initial object is a BrickForge-authored LDraw reference fixture, not official catalogue geometry.

## Milestone 2.1 resolver
The viewer can load an installed LDraw directory, index top-level official parts and recursively resolve Type 1 references from both `parts/` and `p/`. Nested affine transforms and colour 16 inheritance are applied. Missing files, cycles and excessive reference depth are reported as validation warnings.

## Milestone 2.3 assembly workspace
The web workspace now builds real multi-part models from a controlled catalogue of standard bricks (`3001`–`3005`) and plates (`3020`–`3024`). Load an official LDraw folder once and the resolver caches each selected part's geometry for reuse across instances.

The editor supports add, select, grid movement, 90-degree rotation, colour changes, duplication, deletion, and reset. Its live validator reports collisions, off-grid positions, and floating components. A grouped bill of materials updates alongside the build, and complete assemblies round-trip through versioned JSON or export as LDraw Type 1 references.

## Milestone 3.1 photo reconstruction
The root workspace accepts up to eight JPG, PNG, or WebP references and lets each image be identified as front, rear, left, right, or detail coverage. Processing stays in the browser. BrickForge estimates a foreground silhouette against the image background, merges opposing views, constructs a shared volumetric profile, and greedily tiles each stable layer with supported standard brick sizes.

Study, Balanced, and Display targets trade part count for silhouette resolution. BrickForge uses source-only, instruction-book construction: it alternates brick direction, prefers pieces that bridge seams, and keeps each generated part connected to the assembly below. Every generated result includes shape-coverage reporting, an exact BOM, a layer-by-layer instruction sequence, a downloadable build package, LDraw export, and a handoff to the full 3D assembly editor.

This is deliberately an honest silhouette milestone: it captures proportion and outline but does not yet infer concave hidden geometry, curved surface detail, texture, or semantic features. Those require calibrated multi-view correspondence, depth estimation, and a broader slope/hinge/curved-parts catalogue.

## Milestone 3.2 OBJ/STL conversion
The reconstruction workspace accepts triangulated OBJ and binary or ASCII STL files. Mesh parsing, watertightness analysis, supersampled volume conversion, and interlocking brick packing all run locally in the browser. The converter does not add filler columns outside the source shape. The selected Study, Balanced, or Display envelope scales the mesh uniformly into a LEGO stud-and-layer volume, and the user can override the detected vertical axis when the source model has a different orientation.

The volumetric result is packed with controlled real brick IDs and feeds the same exact BOM, layer diagrams, JSON/LDraw exports, validation rules, and 3D editor used by photo reconstruction. Closed, watertight models produce the strongest conversion. Surface texture, colour materials, movable joints, and sub-stud sculpting are not yet represented, and the current controlled palette intentionally favours standard rectangular bricks.

Mesh conversion includes a rotatable side-by-side comparison of the complete source and brick volume. Automatic orientation follows format conventions (Y-up for OBJ and Z-up for STL), with manual axis and upside-down controls. Internal reinforcement is constrained to the original solid volume so overhang supports cannot expand the model's outer silhouette. A Sculpture target provides a higher-resolution 48-layer envelope, and structural warnings are reported honestly when the current rectangular-brick palette cannot support an appendage without altering its shape.

## Milestone 3.3 image to 3D
Photograph mode now fuses labelled front/back and left/right silhouettes into a closed, asymmetric visual-hull mesh before brick conversion. The generated source mesh is shown beside the voxel result and can be downloaded as OBJ or ASCII STL for reuse or refinement in other 3D tools. Everything runs in the browser, so uploaded source images remain on the device.

This deterministic visual hull preserves the measured outline, proportions, and row-by-row centre shifts from the supplied views. It cannot infer occluded surface detail like a cloud neural 3D model, so multiple clean views and a plain contrasting background remain important.

## Milestone 3.4 local AI image to 3D

Photograph mode now offers a Stable Fast 3D option backed by a local FastAPI
companion. The web app verifies the companion and GPU, submits the selected front
view to a single-job CUDA queue, polls real progress, imports the resulting OBJ,
and runs it through the existing watertight voxel, brick packing, BOM, instruction,
and editor pipeline. The deterministic multi-view visual hull remains available
without any model download.

Stable Fast 3D estimates one mesh per image; it does not fuse BrickForge's labelled
views. Its gated weights are downloaded only after the user accepts Stability AI's
terms and authenticates with Hugging Face. Output quality remains an estimate and
should be reviewed in the source-versus-brick preview before buying parts.

## Milestone 5 sculpted construction

The controlled catalogue now records part families, surface profiles, top-stud
availability, and bottom connections. The reconstruction engine automatically
selects and orients straight and curved slopes for exposed source surfaces while
keeping ordinary bricks wherever another layer must connect above. Validation
uses the connection metadata, so a studless slope cannot incorrectly support a
later brick.

Generated results now report sculpted-part usage and active part families. The
source comparison replaces the abstract voxel view with an immediate studded
LEGO assembly preview after conversion, including procedural slope silhouettes,
without requiring an LDraw library to judge the result.

Validate the controlled catalogue against a local official library with:
```bash
node scripts/validate-official-ldraw.mjs data/ldraw/official/ldraw
```

Next milestones: add SNOT and Technic subassembly solving, colour-material mapping, stronger structural optimisation, manual shape cleanup, a true multi-view neural engine, and printable illustrated instruction pages.
