from __future__ import annotations
import csv,json
from pathlib import Path
from .db import transaction
def _rows(path:Path,required:bool=True)->list[dict[str,str]]:
    if not path.exists():
        if required: raise FileNotFoundError(f"Required catalogue file not found: {path}")
        return []
    with path.open(encoding="utf-8-sig",newline="") as handle: return list(csv.DictReader(handle))
def import_rebrickable(source:Path,db_path:Path,core_config:Path)->dict[str,int]:
    categories,colours,parts=_rows(source/"part_categories.csv"),_rows(source/"colors.csv"),_rows(source/"parts.csv")
    elements,inventory_parts=_rows(source/"elements.csv",False),_rows(source/"inventory_parts.csv",False)
    core_doc=json.loads(core_config.read_text()); core=core_doc["parts"]
    with transaction(db_path) as db:
        db.executemany("INSERT OR REPLACE INTO categories(id,name) VALUES(?,?)",[(int(r["id"]),r["name"]) for r in categories])
        db.executemany("INSERT OR REPLACE INTO colours(id,name,rgb,is_trans) VALUES(?,?,?,?)",[(int(r["id"]),r["name"],r["rgb"].lstrip("#"),int(r.get("is_trans","f").lower() in {"t","true","1"})) for r in colours])
        for r in parts:
            meta=core.get(r["part_num"],{})
            db.execute("""INSERT INTO parts(rebrickable_part_id,name,category_id,family,width_studs,length_studs,height_plates,allowed_for_auto_generation,generated_metadata_version)
            VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(rebrickable_part_id) DO UPDATE SET name=excluded.name,category_id=excluded.category_id,family=excluded.family,width_studs=excluded.width_studs,length_studs=excluded.length_studs,height_plates=excluded.height_plates,allowed_for_auto_generation=excluded.allowed_for_auto_generation,generated_metadata_version=excluded.generated_metadata_version""",(r["part_num"],r["name"],int(r["part_cat_id"]),meta.get("family"),meta.get("width_studs"),meta.get("length_studs"),meta.get("height_plates"),int(bool(meta)),core_doc["metadata_version"]))
        availability={(r["part_num"],int(r["color_id"])) for r in inventory_parts if r.get("part_num") and r.get("color_id")}
        for r in elements:
            key=(r["part_num"],int(r["color_id"])); availability.add(key)
            db.execute("""INSERT INTO part_colours(part_id,colour_id,lego_element_id) SELECT internal_id,?,? FROM parts WHERE rebrickable_part_id=? ON CONFLICT(part_id,colour_id) DO UPDATE SET lego_element_id=excluded.lego_element_id""",(key[1],r.get("element_id"),key[0]))
        for part_num,colour_id in availability: db.execute("INSERT OR IGNORE INTO part_colours(part_id,colour_id) SELECT internal_id,? FROM parts WHERE rebrickable_part_id=?",(colour_id,part_num))
        db.execute("INSERT INTO import_runs(source,source_path,records) VALUES('rebrickable',?,?)",(str(source),len(parts)))
    return {"categories":len(categories),"colours":len(colours),"parts":len(parts),"part_colours":len(availability)}
def import_ldraw(source:Path,db_path:Path)->dict[str,int]:
    files=[p for root in (source/"parts",source/"p") if root.exists() for p in root.rglob("*.dat")]
    if not files: raise FileNotFoundError(f"No LDraw .dat files found below {source}")
    mapped=0
    with transaction(db_path) as db:
        for path in files:
            cur=db.execute("UPDATE parts SET ldraw_part_id=?,mesh_path=? WHERE lower(rebrickable_part_id)=?",(path.name,str(path.resolve()),path.stem.lower())); mapped+=cur.rowcount
        db.execute("INSERT INTO import_runs(source,source_path,records) VALUES('ldraw',?,?)",(str(source),len(files)))
    return {"detected":len(files),"mapped":mapped,"unmapped":len(files)-mapped}
