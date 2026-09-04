from __future__ import annotations
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
SCHEMA="""
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS colours(id INTEGER PRIMARY KEY,name TEXT NOT NULL,rgb TEXT NOT NULL,is_trans INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS parts(internal_id INTEGER PRIMARY KEY AUTOINCREMENT,rebrickable_part_id TEXT NOT NULL UNIQUE,ldraw_part_id TEXT,bricklink_part_id TEXT,lego_element_id TEXT,name TEXT NOT NULL,category_id INTEGER,family TEXT,width_studs INTEGER,length_studs INTEGER,height_plates INTEGER,bounding_box TEXT,mesh_path TEXT,weight REAL,active INTEGER NOT NULL DEFAULT 1,generated_metadata_version TEXT,allowed_for_auto_generation INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(category_id) REFERENCES categories(id));
CREATE INDEX IF NOT EXISTS idx_parts_name ON parts(name);
CREATE INDEX IF NOT EXISTS idx_parts_dims ON parts(width_studs,length_studs,height_plates);
CREATE TABLE IF NOT EXISTS part_colours(part_id INTEGER NOT NULL,colour_id INTEGER NOT NULL,lego_element_id TEXT,available INTEGER NOT NULL DEFAULT 1,rarity_score REAL,estimated_cost_score REAL,PRIMARY KEY(part_id,colour_id),FOREIGN KEY(part_id) REFERENCES parts(internal_id),FOREIGN KEY(colour_id) REFERENCES colours(id));
CREATE TABLE IF NOT EXISTS connection_points(id INTEGER PRIMARY KEY AUTOINCREMENT,part_id INTEGER NOT NULL,type TEXT NOT NULL,position_x REAL,position_y REAL,position_z REAL,normal_x REAL,normal_y REAL,normal_z REAL,compatible_connection_types TEXT,rotation_constraints TEXT,FOREIGN KEY(part_id) REFERENCES parts(internal_id));
CREATE TABLE IF NOT EXISTS engineering_profiles(part_id INTEGER PRIMARY KEY,structural_strength_score REAL,internal_filler_score REAL,exterior_surface_score REAL,curve_score REAL,detail_score REAL,cost_score REAL,common_part_score REAL,recommended_usage TEXT,support_role TEXT,notes TEXT,FOREIGN KEY(part_id) REFERENCES parts(internal_id));
CREATE TABLE IF NOT EXISTS import_runs(id INTEGER PRIMARY KEY AUTOINCREMENT,source TEXT NOT NULL,source_path TEXT NOT NULL,imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,records INTEGER NOT NULL DEFAULT 0);
"""
def connect(path:Path)->sqlite3.Connection:
    path.parent.mkdir(parents=True,exist_ok=True); conn=sqlite3.connect(path); conn.row_factory=sqlite3.Row; conn.executescript(SCHEMA); return conn
@contextmanager
def transaction(path:Path)->Iterator[sqlite3.Connection]:
    conn=connect(path)
    try:
        with conn: yield conn
    finally: conn.close()
