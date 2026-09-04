# Architecture

`apps/api` contains the independently testable Parts Engine. It owns SQLite persistence, external catalogue importers, the curated core set, and FastAPI routes. `apps/web` is a deliberately thin Next.js workspace shell; it consumes the API and contains no catalogue or geometry logic.

Core data flows: Rebrickable CSV → `rebrickable_parts` / colours → unified `parts`; LDraw `.dat` files → `ldraw_parts` → `parts.ldraw_part_id` where mappings exist. The importer is discovery-based, so source data stays outside source code and can be refreshed without changing import code.

Future engines belong under `services/` and should consume a versioned `.brickforge.json` project schema rather than frontend state.
