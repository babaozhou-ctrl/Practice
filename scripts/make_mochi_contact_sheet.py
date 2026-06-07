from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_JSON = ROOT / "pets" / "mochi" / "production.json"
ATLAS_PATH = ROOT / "public" / "pets" / "mochi" / "sprite-atlas.png"
OUTPUT_PATH = ROOT / "pets" / "mochi" / "qa" / "contact-sheet.png"

BACKGROUND = "#fffaf0"
PANEL = "#fff7db"
PANEL_BORDER = "#83b7e4"
LABEL = "#5f98cf"
TEXT = "#466f96"
MUTED = "#7a9fbe"


def load_production_profile() -> dict:
    return json.loads(PRODUCTION_JSON.read_text(encoding="utf-8"))


def get_font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size=size)
    except OSError:
        return ImageFont.load_default()


def main() -> None:
    profile = load_production_profile()
    atlas_info = profile["atlas"]
    atlas = Image.open(ATLAS_PATH).convert("RGBA")

    cell_w = int(atlas_info["cellWidth"])
    cell_h = int(atlas_info["cellHeight"])
    row_order: list[str] = list(atlas_info["rowOrder"])
    frame_counts: dict[str, int] = dict(atlas_info["clipFrameCounts"])

    margin = 36
    gutter_x = 22
    gutter_y = 28
    label_h = 52
    summary_h = 84
    panel_radius = 16

    rows = len(row_order)
    columns = max(frame_counts.values())
    sheet_w = margin * 2 + columns * cell_w + (columns - 1) * gutter_x
    sheet_h = margin * 2 + summary_h + rows * (label_h + cell_h) + (rows - 1) * gutter_y

    sheet = Image.new("RGBA", (sheet_w, sheet_h), BACKGROUND)
    draw = ImageDraw.Draw(sheet)

    title_font = get_font(28)
    subtitle_font = get_font(15)
    row_font = get_font(18)
    meta_font = get_font(13)

    draw.text((margin, margin), "Mochi Contact Sheet", fill=TEXT, font=title_font)
    draw.text(
        (margin, margin + 38),
        "Current runtime atlas review for the floppy-ear companion package.",
        fill=MUTED,
        font=subtitle_font,
    )
    draw.text(
        (margin, margin + 60),
        f"Atlas {atlas.width}x{atlas.height}  |  Cell {cell_w}x{cell_h}  |  Rows {rows}",
        fill=MUTED,
        font=subtitle_font,
    )

    y = margin + summary_h
    for row_index, clip_name in enumerate(row_order):
        frame_count = int(frame_counts[clip_name])
        row_top = y + row_index * (label_h + cell_h + gutter_y)

        panel_left = margin - 10
        panel_top = row_top - 8
        panel_right = sheet_w - margin + 10
        panel_bottom = row_top + label_h + cell_h + 10
        draw.rounded_rectangle(
            (panel_left, panel_top, panel_right, panel_bottom),
            radius=panel_radius,
            fill=PANEL,
            outline=PANEL_BORDER,
            width=2,
        )

        draw.text((margin + 10, row_top), f"{row_index + 1:02d}. {clip_name}", fill=LABEL, font=row_font)
        draw.text(
            (margin + 10, row_top + 24),
            f"{frame_count} frames",
            fill=MUTED,
            font=meta_font,
        )

        for frame_index in range(columns):
            frame_x = margin + frame_index * (cell_w + gutter_x)
            frame_y = row_top + label_h

            draw.rounded_rectangle(
                (frame_x - 4, frame_y - 4, frame_x + cell_w + 4, frame_y + cell_h + 4),
                radius=10,
                fill="#fffdf6",
                outline="#d3e7f7",
                width=1,
            )

            if frame_index < frame_count:
                crop = atlas.crop(
                    (
                        frame_index * cell_w,
                        row_index * cell_h,
                        (frame_index + 1) * cell_w,
                        (row_index + 1) * cell_h,
                    )
                )
                sheet.alpha_composite(crop, (frame_x, frame_y))
                draw.text(
                    (frame_x + 8, frame_y + 8),
                    str(frame_index),
                    fill=MUTED,
                    font=meta_font,
                )
            else:
                draw.line(
                    (frame_x + 18, frame_y + 18, frame_x + cell_w - 18, frame_y + cell_h - 18),
                    fill="#e8eef4",
                    width=2,
                )
                draw.line(
                    (frame_x + cell_w - 18, frame_y + 18, frame_x + 18, frame_y + cell_h - 18),
                    fill="#e8eef4",
                    width=2,
                )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUTPUT_PATH)
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
