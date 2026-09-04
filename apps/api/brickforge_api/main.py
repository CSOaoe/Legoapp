from __future__ import annotations
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from .database import connect, initialise

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DB_PATH = Path(os.getenv('BRICKFORGE_DB_PATH', PROJECT_ROOT / 'data/generated/brickforge.db'))

@asynccontextmanager
async def lifespan(_: FastAPI):
    initialise(DB_PATH)
    yield

app = FastAPI(title='BrickForge Parts API', version='0.1.0', lifespan=lifespan)

def _part(row):
    item = dict(row); item['core'] = bool(item.pop('allowed_for_auto_generation')); item['active'] = bool(item['active']); return item
@app.get('/health')
def health(): return {'status': 'ok'}
@app.get('/parts')
def parts(q: str | None = None, width: int | None = None, length: int | None = None, core_only: bool = False):
    clauses, values = ['active=1'], []
    if q: clauses.append('lower(name) LIKE ?'); values.append(f'%{q.lower()}%')
    if width: clauses.append('width_studs=?'); values.append(width)
    if length: clauses.append('length_studs=?'); values.append(length)
    if core_only: clauses.append('allowed_for_auto_generation=1')
    with connect(DB_PATH) as db: rows = db.execute('SELECT * FROM parts WHERE ' + ' AND '.join(clauses) + ' ORDER BY name', values).fetchall()
    return [_part(row) for row in rows]
@app.get('/parts/core')
def core(width: int | None = None, length: int | None = None): return parts(width=width, length=length, core_only=True)
@app.get('/parts/search')
def search(q: str = Query(min_length=1)): return parts(q=q)
@app.get('/parts/{part_id}')
def part(part_id: str):
    with connect(DB_PATH) as db: row = db.execute('SELECT * FROM parts WHERE rebrickable_part_id=? OR internal_id=?', (part_id, part_id)).fetchone()
    if not row: raise HTTPException(404, 'Part not found')
    return _part(row)
@app.get('/parts/{part_id}/colours')
def colours(part_id: str):
    with connect(DB_PATH) as db:
        rows = db.execute('''SELECT c.colour_id,c.colour_name,c.rgb,c.available,c.rarity_score,c.estimated_cost_score FROM part_colours c JOIN parts p ON p.internal_id=c.part_id WHERE p.rebrickable_part_id=? OR p.internal_id=? ORDER BY c.colour_name''', (part_id, part_id)).fetchall()
    return [dict(row) for row in rows]
