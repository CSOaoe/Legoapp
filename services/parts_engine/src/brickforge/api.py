from pathlib import Path
from fastapi import FastAPI,HTTPException,Query
from .config import DEFAULT_DB
from .repository import get_colours,get_part,search_parts
def create_app(db_path:Path=DEFAULT_DB)->FastAPI:
    app=FastAPI(title="BrickForge Parts API",version="0.1.0")
    @app.get("/health")
    def health(): return {"status":"ok","service":"parts-engine"}
    @app.get("/parts")
    def parts(q:str|None=None,core:bool|None=None,width:int|None=None,length:int|None=None,limit:int=Query(50,ge=1,le=200)): return {"items":search_parts(db_path,q,core,width,length,limit)}
    @app.get("/parts/search")
    def part_search(q:str=Query(min_length=1),limit:int=Query(50,ge=1,le=200)): return {"items":search_parts(db_path,q,limit=limit)}
    @app.get("/parts/core")
    def core_parts(width:int|None=None,length:int|None=None): return {"items":search_parts(db_path,core=True,width=width,length=length)}
    @app.get("/parts/{internal_id}")
    def part(internal_id:int):
        item=get_part(db_path,internal_id)
        if not item: raise HTTPException(404,"Part not found")
        return item
    @app.get("/parts/{internal_id}/colours")
    def part_colours(internal_id:int):
        if not get_part(db_path,internal_id): raise HTTPException(404,"Part not found")
        return {"items":get_colours(db_path,internal_id)}
    return app
app=create_app()
