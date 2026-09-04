from __future__ import annotations
import argparse,json
from pathlib import Path
from .config import CORE_CONFIG,DEFAULT_DB
from .importers import import_ldraw,import_rebrickable
from .repository import validate
def parser()->argparse.ArgumentParser:
    p=argparse.ArgumentParser(prog="brickforge"); p.add_argument("--db",type=Path,default=DEFAULT_DB); sub=p.add_subparsers(dest="command",required=True)
    a=sub.add_parser("import-rebrickable"); a.add_argument("source",type=Path); a.add_argument("--core-config",type=Path,default=CORE_CONFIG)
    b=sub.add_parser("import-ldraw"); b.add_argument("source",type=Path)
    sub.add_parser("build-parts-db"); sub.add_parser("validate-parts"); return p
def main()->None:
    args=parser().parse_args()
    if args.command=="import-rebrickable": result=import_rebrickable(args.source,args.db,args.core_config)
    elif args.command=="import-ldraw": result=import_ldraw(args.source,args.db)
    elif args.command=="build-parts-db":
        from .db import connect
        with connect(args.db): pass
        result={"database":str(args.db),"created":True}
    else: result=validate(args.db)
    print(json.dumps(result,indent=2))
    if args.command=="validate-parts" and not result["valid"]: raise SystemExit(1)
if __name__=="__main__": main()
