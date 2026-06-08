from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_JSON = ROOT / "pets" / "mochi" / "production.json"
ATLAS_PATH = ROOT / "public" / "pets" / "mochi" / "sprite-atlas.png"
OUTPUT_PATH = ROOT / "public" / "pets" / "mochi" / "preview.png"

PREVIEW_SIZE = 96
PREVIEW_PADDING = 10
CLIP_PRIORITY = [
    "idle_loop",
    "happy_react",
    "thinking_loop",
    "chatting_loop",
    "excited_loop",
    "coding_loop",
    "watching_loop",
    "gaming_loop",
    "sleep_loop",
    "drag",
]


def load_production_profile() -> dict:
    return json.loads(PRODUCTION_JSON.read_text(encoding="utf-8"))


def main() -> None:
    profile = load_production_profile()
    atlas_info = profile["atlas"]
    atlas = Image.open(ATLAS_PATH).convert("RGBA")

    row_order: list[str] = list(atlas_info["rowOrder"])
    clip_frame_counts: dict[str, int] = dict(atlas_info["clipFrameCounts"])
    cell_w = int(atlas_info["cellWidth"])
    cell_h = int(atlas_info["cellHeight"])

    clip_name = next((name for name in CLIP_PRIORITY if name in row_order), row_order[0])
    row_index = row_order.index(clip_name)
    frame_count = max(1, int(clip_frame_counts.get(clip_name, 1)))
    frame_index = select_frame_index(frame_count)

    cell = atlas.crop(
        (
            frame_index * cell_w,
            row_index * cell_h,
            (frame_index + 1) * cell_w,
            (row_index + 1) * cell_h,
        )
    )

    bounds = cell.getbbox()
    if not bounds:
        raise RuntimeError(f"No visible pixels found for {clip_name} frame {frame_index}.")

    subject = cell.crop(bounds)
    subject_w, subject_h = subject.size

    scale = max(
        1,
        min(
            max(1, (PREVIEW_SIZE - PREVIEW_PADDING * 2) // max(subject_w, 1)),
            max(1, (PREVIEW_SIZE - PREVIEW_PADDING * 2) // max(subject_h, 1)),
        ),
    )

    scaled = subject.resize(
        (subject_w * scale, subject_h * scale),
        Image.Resampling.NEAREST,
    )

    preview = Image.new("RGBA", (PREVIEW_SIZE, PREVIEW_SIZE), (0, 0, 0, 0))
    offset_x = (PREVIEW_SIZE - scaled.width) // 2
    offset_y = (PREVIEW_SIZE - scaled.height) // 2
    preview.alpha_composite(scaled, (offset_x, offset_y))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    preview.save(OUTPUT_PATH)
    print(f"wrote {OUTPUT_PATH}")


def select_frame_index(frame_count: int) -> int:
    if frame_count <= 1:
        return 0
    return min(frame_count - 1, frame_count // 2)


if __name__ == "__main__":
    main()
