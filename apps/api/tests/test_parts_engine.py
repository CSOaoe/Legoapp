from pathlib import Path
from fastapi.testclient import TestClient
from typer.testing import CliRunner
from brickforge_api.cli import app as cli
from brickforge_api.database import initialise
from brickforge_api.importers import build_core_parts, import_ldraw, import_rebrickable

def test_core_parts_seed_and_api(tmp_path, monkeypatch):
    db = tmp_path / 'parts.db'; initialise(db); build_core_parts(db)
    monkeypatch.setattr('brickforge_api.main.DB_PATH', db)
    from brickforge_api.main import app
    client = TestClient(app)
    result = client.get('/parts/core', params={'width': 2, 'length': 4})
    assert result.status_code == 200 and result.json()[0]['rebrickable_part_id'] == '3001'
    assert len(client.get('/parts/3001/colours').json()) > 0

def test_csv_and_ldraw_import(tmp_path):
    db = tmp_path / 'parts.db'; initialise(db)
    source = tmp_path / 'rebrickable'; source.mkdir()
    (source / 'parts.csv').write_text('part_num,name,part_cat_id,is_printed\n3001,Brick 2 x 4,7,f\n', encoding='utf8')
    assert import_rebrickable(source, db)['parts'] == 1
    ldraw = tmp_path / 'ldraw' / 'parts'; ldraw.mkdir(parents=True); (ldraw / '3001.dat').write_text('0 Brick', encoding='utf8')
    assert import_ldraw(ldraw.parent, db)['mapped'] == 1

def test_cli_build_and_validate(tmp_path):
    database = tmp_path / 'parts.db'
    runner = CliRunner()
    assert runner.invoke(cli, ['build-parts-db', '--database', str(database)]).exit_code == 0
    result = runner.invoke(cli, ['validate-parts', '--database', str(database)])
    assert result.exit_code == 0 and 'VALID' in result.output
