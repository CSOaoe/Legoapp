from __future__ import annotations

from dataclasses import dataclass

@dataclass(frozen=True)
class CorePart:
    rebrickable_part_id: str
    name: str
    width_studs: int
    length_studs: int
    height_plates: int = 3
    category: str = "Bricks"
    family: str = "standard_brick"

CORE_PARTS = (
    CorePart("3005", "Brick 1 x 1", 1, 1), CorePart("3004", "Brick 1 x 2", 1, 2),
    CorePart("3622", "Brick 1 x 3", 1, 3), CorePart("3010", "Brick 1 x 4", 1, 4),
    CorePart("3009", "Brick 1 x 6", 1, 6), CorePart("3008", "Brick 1 x 8", 1, 8),
    CorePart("3003", "Brick 2 x 2", 2, 2), CorePart("3002", "Brick 2 x 3", 2, 3),
    CorePart("3001", "Brick 2 x 4", 2, 4), CorePart("2456", "Brick 2 x 6", 2, 6),
    CorePart("3007", "Brick 2 x 8", 2, 8),
    CorePart("3024", "Plate 1 x 1", 1, 1, 1, "Plates", "plate"),
    CorePart("3023", "Plate 1 x 2", 1, 2, 1, "Plates", "plate"),
    CorePart("3710", "Plate 1 x 4", 1, 4, 1, "Plates", "plate"),
    CorePart("3020", "Plate 2 x 4", 2, 4, 1, "Plates", "plate"),
    CorePart("3069b", "Tile 1 x 2", 1, 2, 1, "Tiles", "tile"),
    CorePart("2431", "Tile 1 x 4", 1, 4, 1, "Tiles", "tile"),
)

DEFAULT_COLOURS = ((1, "White", "FFFFFF"), (4, "Red", "C91A09"), (14, "Yellow", "F2CD37"), (15, "Blue", "0055BF"), (71, "Light Bluish Gray", "A0A5A9"), (85, "Dark Bluish Gray", "6C6E68"), (0, "Black", "05131D"))
