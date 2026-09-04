# BrickForge architecture
Milestone 1 separates the catalogue engine from the interface. `services/parts_engine` owns ingestion, SQLite persistence, validation and queries. `apps/api` is a thin FastAPI adapter. The Next.js app is the web workspace and contains no geometry rules.

Source catalogues stay under `data/rebrickable` and `data/ldraw`; generated databases stay under `data/generated` and are ignored. Upserts allow refreshes without importer rewrites. Direct identifier equality is the only automatic Rebrickable-to-LDraw mapping in V0.1. Ambiguous aliases are left unmapped.
