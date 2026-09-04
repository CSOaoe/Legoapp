from brickforge.cli import parser
def test_cli_contract():
    assert parser().parse_args(["import-rebrickable","data/rebrickable"]).command=="import-rebrickable"
    assert parser().parse_args(["import-ldraw","data/ldraw"]).command=="import-ldraw"
    assert parser().parse_args(["build-parts-db"]).command=="build-parts-db"
    assert parser().parse_args(["validate-parts"]).command=="validate-parts"
