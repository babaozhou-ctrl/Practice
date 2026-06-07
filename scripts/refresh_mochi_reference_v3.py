from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"E:/Temp/Cache/oPlusConnect/TempFiles/Screenshot_2026-06-06-12-29-06-50_439a3fec0400f8974d35eed09a31f914.jpg")
OUTPUT_DIR = ROOT / "pets" / "mochi"


def main() -> None:
    image = Image.open(SOURCE)

    board = image.crop((0, 820, 1440, 2810))
    hero = image.crop((120, 980, 1320, 2280))

    board_path = OUTPUT_DIR / "reference-user-board-v3.png"
    hero_path = OUTPUT_DIR / "reference-user-hero-crop-v3.png"

    board.save(board_path)
    hero.save(hero_path)

    print(f"wrote {board_path}")
    print(f"wrote {hero_path}")


if __name__ == "__main__":
    main()
