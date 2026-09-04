from __future__ import annotations
import sqlite3
from pathlib import Path

SCHEMA = '''
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS parts (
 internal_id INTEGER PRIMARY KEY, rebrickable_part_id TEXT UNIQUE, ldraw_part_id TEXT,
 bricklink_part_id TEXT, lego_element_id TEXT, name TEXT NOT NULL, category TEXT,
 family TEXT, width_studs INTEGER, length_studs INTEGER, height_plates INTEGER,
 mesh_path TEXT, weight REAL, active INTEGER NOT NULL DEFAULT 1,
 generated_metadata_version TEXT NOT NULL DEFAULT '1', allowed_for_auto_generation INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS part_colours (
 part_id INTEGER NOT NULL REFERENCES parts(internal_id) ON DELETE CASCADE, colour_id INTEGER NOT NULL,
 colour_name TEXT NOT NULL, rgb TEXT, available INTEGER NOT NULL DEFAULT 1, rarity_score REAL, estimated_cost_score REAL,
 PRIMARY KEY(part_id, colour_id)
);
CREATE TABLE IF NOT EXISTS connection_points (
 id INTEGER PRIMARY KEY, part_id INTEGER NOT NULL REFERENCES parts(internal_id) ON DELETE CASCADE,
 type TEXT NOT NULL, position_x REAL, position_y REAL, position_z REAL, normal_x REAL, normal_y REAL, normal_z REAL,
 compatible_connection_types TEXT, rotation_constraints TEXT
);
CREATE TABLE IF NOT EXISTS part_engineering_profiles (
 part_id INTEGER PRIMARY KEY REFERENCES parts(internal_id) ON DELETE CASCADE, structural_strength_score REAL,
 internal_filler_score REAL, exterior_surface_score REAL, curve_score REAL, detail_score REAL, cost_score REAL,
 common_part_score REAL, recommended_usage TEXT, allowed_for_auto_generation INTEGER NOT NULL DEFAULT 0, support_role TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS ldraw_parts (ldraw_part_id TEXT PRIMARY KEY, mesh_path TEXT NOT NULL);
'''

def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    return db

def initialise(path: Path) -> None:
    with connect(path) as db:
        db.executescript(SCHEMA)
