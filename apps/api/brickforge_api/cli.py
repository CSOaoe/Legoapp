from __future__ import annotations
from pathlib import Path
import typer
from .database import initialise, connect
from .importers import build_core_parts, import_ldraw, import_rebrickable
app = typer.Typer(help='BrickForge catalogue tools')
DEFAULT_DB = Path(__file__).resolve().parents[3] / 'data/generated/brickforge.db'
@app.command('build-parts-db')
def build_parts_db(database: Path = typer.Option(DEFAULT_DB)):
    initialise(database); count = build_core_parts(database); typer.echo(f'Initialised {database}; seeded {count} core parts.')
@app.command('import-rebrickable')
def rebrickable(directory: Path, database: Path = typer.Option(DEFAULT_DB)):
    initialise(database); typer.echo(import_rebrickable(directory, database))
@app.command('import-ldraw')
def ldraw(directory: Path, database: Path = typer.Option(DEFAULT_DB)):
    initialise(database); typer.echo(import_ldraw(directory, database))
@app.command('validate-parts')
def validate(database: Path = typer.Option(DEFAULT_DB)):
    with connect(database) as db:
        core = db.execute('SELECT count(*) FROM parts WHERE allowed_for_auto_generation=1').fetchone()[0]
        bad = db.execute('SELECT count(*) FROM parts WHERE allowed_for_auto_generation=1 AND (width_studs IS NULL OR length_studs IS NULL OR height_plates IS NULL)').fetchone()[0]
    if bad: raise typer.Exit(code=1)
    typer.echo(f'VALID: {core} core parts have dimensions.')
