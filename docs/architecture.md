# BrickForge architecture
Milestone 1 separates the catalogue engine from the interface. `services/parts_engine` owns ingestion, SQLite persistence, validation and queries. `apps/api` is a thin FastAPI adapter. The Next.js app is the web workspace and contains no geometry rules.

Source catalogues stay under `data/rebrickable` and `data/ldraw`; generated databases stay under `data/generated` and are ignored. Upserts allow refreshes without importer rewrites. Direct identifier equality is the only automatic Rebrickable-to-LDraw mapping in V0.1. Ambiguous aliases are left unmapped.

The optional `services/image_to_3d` companion is a separate loopback-only process.
It owns CUDA inference and temporary neural mesh output; it never runs in the Sites
worker. The browser sends one selected image to `127.0.0.1:8787`, receives an OBJ,
and then resumes the same browser-side mesh-to-brick pipeline used for imported
OBJ/STL files. The companion serialises GPU work through a one-worker queue and
does not expose a network-wide listening socket.
