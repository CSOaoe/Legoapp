from pathlib import Path
from fastapi.testclient import TestClient
from brickforge.api import create_app
from brickforge.importers import import_ldraw,import_rebrickable
from brickforge.repository import get_colours,search_parts,validate

ROOT=Path(__file__).resolve().parents[2]
def populated(tmp_path:Path)->Path:
    db=tmp_path/"parts.sqlite3"
    import_rebrickable(ROOT/"tests/fixtures/rebrickable",db,ROOT/"data/generated/core_parts.json")
    import_ldraw(ROOT/"tests/fixtures/ldraw",db)
    return db
def test_import_maps_dimensions_colours_and_ldraw(tmp_path):
    db=populated(tmp_path); result=search_parts(db,"Brick 2 x 4")
    assert len(result)==1
    part=result[0]
    assert (part["width_studs"],part["length_studs"],part["height_plates"])==(2,4,3)
    assert part["allowed_for_auto_generation"]==1
    assert part["ldraw_part_id"]=="3001.dat"
    assert {c["name"] for c in get_colours(db,part["internal_id"])}=={"Black","Red","White"}
def test_ldraw_reports_unmapped_without_guessing(tmp_path):
    db=tmp_path/"parts.sqlite3"
    import_rebrickable(ROOT/"tests/fixtures/rebrickable",db,ROOT/"data/generated/core_parts.json")
    report=import_ldraw(ROOT/"tests/fixtures/ldraw",db)
    assert report=={"detected":2,"mapped":1,"unmapped":1}
def test_refresh_is_idempotent(tmp_path):
    db=tmp_path/"parts.sqlite3"
    for _ in range(2): import_rebrickable(ROOT/"tests/fixtures/rebrickable",db,ROOT/"data/generated/core_parts.json")
    assert len(search_parts(db))==3
def test_api_search_core_and_colours(tmp_path):
    db=populated(tmp_path); client=TestClient(create_app(db))
    response=client.get("/parts/search",params={"q":"Brick 2 x 4"})
    assert response.status_code==200 and response.json()["items"][0]["rebrickable_part_id"]=="3001"
    core=client.get("/parts/core",params={"width":2,"length":4}).json()["items"]
    assert {p["rebrickable_part_id"] for p in core}=={"3001","3020"}
    part_id=next(p["internal_id"] for p in core if p["rebrickable_part_id"]=="3001")
    assert len(client.get(f"/parts/{part_id}/colours").json()["items"])==3
    assert client.get("/parts/99999").status_code==404
def test_validation(tmp_path):
    report=validate(populated(tmp_path))
    assert report["valid"] is True
    assert report["core_missing_dimensions"]==0
