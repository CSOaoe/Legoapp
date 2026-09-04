from __future__ import annotations
from pathlib import Path
from typing import Any
from .db import connect
def search_parts(db_path:Path,query:str|None=None,core:bool|None=None,width:int|None=None,length:int|None=None,limit:int=50)->list[dict[str,Any]]:
    clauses,values=["p.active=1"],[]
    if query: clauses.append("(p.name LIKE ? OR p.rebrickable_part_id LIKE ?)"); values += [f"%{query}%",f"%{query}%"]
    if core is not None: clauses.append("p.allowed_for_auto_generation=?"); values.append(int(core))
    if width is not None: clauses.append("p.width_studs=?"); values.append(width)
    if length is not None: clauses.append("p.length_studs=?"); values.append(length)
    values.append(min(max(limit,1),200))
    with connect(db_path) as db:
        rows=db.execute(f"SELECT p.*,c.name category FROM parts p LEFT JOIN categories c ON c.id=p.category_id WHERE {' AND '.join(clauses)} ORDER BY p.name LIMIT ?",values).fetchall()
        return [dict(r) for r in rows]
def get_part(db_path:Path,internal_id:int)->dict[str,Any]|None:
    with connect(db_path) as db:
        row=db.execute("SELECT p.*,c.name category FROM parts p LEFT JOIN categories c ON c.id=p.category_id WHERE p.internal_id=?",(internal_id,)).fetchone(); return dict(row) if row else None
def get_colours(db_path:Path,internal_id:int)->list[dict[str,Any]]:
    with connect(db_path) as db: return [dict(r) for r in db.execute("SELECT c.id,c.name,c.rgb,c.is_trans,pc.lego_element_id,pc.available FROM part_colours pc JOIN colours c ON c.id=pc.colour_id WHERE pc.part_id=? ORDER BY c.name",(internal_id,))]
def validate(db_path:Path)->dict[str,Any]:
    with connect(db_path) as db:
        total=db.execute("SELECT count(*) FROM parts").fetchone()[0]; core=db.execute("SELECT count(*) FROM parts WHERE allowed_for_auto_generation=1").fetchone()[0]; bad=db.execute("SELECT count(*) FROM parts WHERE allowed_for_auto_generation=1 AND (width_studs IS NULL OR length_studs IS NULL OR height_plates IS NULL)").fetchone()[0]; mapped=db.execute("SELECT count(*) FROM parts WHERE ldraw_part_id IS NOT NULL").fetchone()[0]
    return {"valid":total>0 and bad==0,"parts":total,"core_parts":core,"mapped_ldraw":mapped,"core_missing_dimensions":bad}
