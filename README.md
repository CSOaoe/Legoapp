# BrickForge AI

BrickForge AI is a web-first toolkit for designing buildable brick models. This repository delivers Milestones 0–1: a catalogue-backed Parts Engine, REST API, import CLI, SQLite database, and minimal Next.js workspace shell.

## Quick start

### API and CLI

Requires Python 3.11+.

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
brickforge build-parts-db --database ../../data/generated/brickforge.db
brickforge import-rebrickable ../../data/rebrickable --database ../../data/generated/brickforge.db
brickforge import-ldraw ../../data/ldraw --database ../../data/generated/brickforge.db
brickforge validate-parts --database ../../data/generated/brickforge.db
uvicorn brickforge_api.main:app --reload
```

The API is available at `http://127.0.0.1:8000/docs`. Set `BRICKFORGE_DB_PATH` to use a different database path.

### Web shell

```powershell
cd apps/web
npm install
npm run dev
```

## Catalogue refresh

Download the Rebrickable CSV export into `data/rebrickable/`; the importer discovers `parts.csv`, `colors.csv`, and `part_relationships.csv` case-insensitively. Place official LDraw `.dat` files under `data/ldraw/parts/`. Run the imports again; they are idempotent.

See [architecture.md](docs/architecture.md), [catalogue-sources.md](docs/catalogue-sources.md), and [THIRD_PARTY.md](docs/THIRD_PARTY.md).

## Current limitations

- The MVP uses declarative dimensions for a curated core set; arbitrary LDraw geometry is scanned but not geometrically interpreted.
- Rebrickable colour availability is imported when a `part_colors.csv` file is provided; otherwise standard core colours are seeded for core parts.
- Brick placement, mesh processing, rendering of LDraw geometry, and instructions are deliberately out of scope until Milestone 2+.
