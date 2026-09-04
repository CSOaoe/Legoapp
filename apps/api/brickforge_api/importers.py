from __future__ import annotations
import csv
from pathlib import Path
from .core_parts import CORE_PARTS, DEFAULT_COLOURS
from .database import connect

def _file(directory: Path, name: str) -> Path | None:
    return next((p for p in directory.rglob('*') if p.is_file() and p.name.lower() == name), None)

def import_rebrickable(directory: Path, database: Path) -> dict[str, int]:
    parts_file = _file(directory, 'parts.csv')
    if not parts_file: raise FileNotFoundError('parts.csv was not found in the Rebrickable directory')
    imported = colours = 0
    with connect(database) as db, parts_file.open(encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            part_id = row.get('part_num') or row.get('part_id')
            if not part_id: continue
            db.execute('''INSERT INTO parts(rebrickable_part_id,name,category,active) VALUES(?,?,?,?)
             ON CONFLICT(rebrickable_part_id) DO UPDATE SET name=excluded.name, category=excluded.category, active=excluded.active''',
             (part_id, row.get('name', part_id), row.get('part_cat_id') or row.get('category'), int(row.get('is_printed','f').lower() not in ('1','true'))))
            imported += 1
        colour_file = _file(directory, 'part_colors.csv')
        if colour_file:
            for row in csv.DictReader(colour_file.open(encoding='utf-8-sig', newline='')):
                key = row.get('part_num'); colour_id = row.get('color_id')
                if not key or colour_id is None: continue
                result = db.execute('SELECT internal_id FROM parts WHERE rebrickable_part_id=?', (key,)).fetchone()
                if result:
                    db.execute('INSERT OR IGNORE INTO part_colours(part_id,colour_id,colour_name,available) VALUES(?,?,?,1)', (result['internal_id'], int(colour_id), f'Colour {colour_id}'))
                    colours += 1
    return {'parts': imported, 'colours': colours}

def import_ldraw(directory: Path, database: Path) -> dict[str, int]:
    files = [p for p in directory.rglob('*.dat') if p.is_file()]
    mapped = 0
    with connect(database) as db:
        for file in files:
            ldraw_id = file.stem.lower(); relative = str(file.relative_to(directory)).replace('\\', '/')
            db.execute('INSERT INTO ldraw_parts(ldraw_part_id,mesh_path) VALUES(?,?) ON CONFLICT(ldraw_part_id) DO UPDATE SET mesh_path=excluded.mesh_path', (ldraw_id, relative))
            result = db.execute('SELECT internal_id FROM parts WHERE lower(rebrickable_part_id)=?', (ldraw_id,)).fetchone()
            if result:
                db.execute('UPDATE parts SET ldraw_part_id=?,mesh_path=? WHERE internal_id=?', (ldraw_id, relative, result['internal_id'])); mapped += 1
    return {'scanned': len(files), 'mapped': mapped}

def build_core_parts(database: Path) -> int:
    with connect(database) as db:
        for part in CORE_PARTS:
            db.execute('''INSERT INTO parts(rebrickable_part_id,name,category,family,width_studs,length_studs,height_plates,active,allowed_for_auto_generation)
              VALUES(?,?,?,?,?,?,?,?,1) ON CONFLICT(rebrickable_part_id) DO UPDATE SET name=excluded.name,category=excluded.category,family=excluded.family,width_studs=excluded.width_studs,length_studs=excluded.length_studs,height_plates=excluded.height_plates,allowed_for_auto_generation=1''',
              (part.rebrickable_part_id,part.name,part.category,part.family,part.width_studs,part.length_studs,part.height_plates,1))
            part_id = db.execute('SELECT internal_id FROM parts WHERE rebrickable_part_id=?', (part.rebrickable_part_id,)).fetchone()['internal_id']
            db.execute('INSERT OR REPLACE INTO part_engineering_profiles(part_id,structural_strength_score,common_part_score,recommended_usage,allowed_for_auto_generation) VALUES(?,?,?,?,1)', (part_id, 0.8, 0.9, 'core catalogue'))
            for colour_id, name, rgb in DEFAULT_COLOURS:
                db.execute('INSERT OR IGNORE INTO part_colours(part_id,colour_id,colour_name,rgb) VALUES(?,?,?,?)', (part_id, colour_id, name, rgb))
    return len(CORE_PARTS)
