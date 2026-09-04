# Catalogue sources

Download CSV exports from Rebrickable's downloads page and unpack them in `data/rebrickable`. The importer accepts standard `parts.csv`, `colors.csv`, and optional `part_colors.csv` exports. LDraw files are kept separately in `data/ldraw`, normally with part files in `parts/`.

Do not commit large downloaded catalogues by default. They are ignored by Git and can be replaced safely on refresh.
