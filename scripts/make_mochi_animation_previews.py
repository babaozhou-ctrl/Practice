from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ANIMATIONS_JSON = ROOT / "pets" / "mochi" / "animations.json"
PRODUCTION_JSON = ROOT / "pets" / "mochi" / "production.json"
ATLAS_PATH = ROOT / "public" / "pets" / "mochi" / "sprite-atlas.png"
OUTPUT_DIR = ROOT / "pets" / "mochi" / "qa" / "previews"
MANIFEST_PATH = ROOT / "pets" / "mochi" / "qa" / "preview-manifest.json"


def load_production_profile() -> dict:
    return json.loads(PRODUCTION_JSON.read_text(encoding="utf-8"))


def load_animation_profile() -> dict:
    return json.loads(ANIMATIONS_JSON.read_text(encoding="utf-8"))


def main() -> None:
    profile = load_production_profile()
    animation_profile = load_animation_profile()
    atlas_info = profile["atlas"]
    atlas = Image.open(ATLAS_PATH).convert("RGBA")

    cell_w = int(atlas_info["cellWidth"])
    cell_h = int(atlas_info["cellHeight"])
    row_order: list[str] = list(atlas_info["rowOrder"])
    frame_counts: dict[str, int] = dict(atlas_info["clipFrameCounts"])

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []

    for row_index, clip_name in enumerate(row_order):
        frames: list[Image.Image] = []
        for frame_index in range(int(frame_counts[clip_name])):
            frame = atlas.crop(
                (
                    frame_index * cell_w,
                    row_index * cell_h,
                    (frame_index + 1) * cell_w,
                    (row_index + 1) * cell_h,
                )
            )
            frames.append(frame)

        if not frames:
            continue

        clip = animation_profile["clips"][clip_name]
        fps = max(1, int(clip["fps"]))
        durations = normalize_frame_durations(
            clip.get("frameDurationsMs"),
            len(frames),
            max(16, round(1000 / fps)),
        )
        output_path = OUTPUT_DIR / f"{row_index + 1:02d}-{clip_name}.gif"
        frames[0].save(
            output_path,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            disposal=2,
        )
        manifest.append({
            "row": row_index + 1,
            "clipName": clip_name,
            "frameCount": len(frames),
            "fps": fps,
            "frameDurationsMs": durations,
            "loop": bool(clip["loop"]),
            "output": str(output_path.relative_to(ROOT)).replace("\\", "/"),
        })
        print(f"wrote {output_path}")

    MANIFEST_PATH.write_text(json.dumps({"previews": manifest}, indent=2), encoding="utf-8")
    print(f"wrote {MANIFEST_PATH}")


def normalize_frame_durations(raw: object, frame_count: int, fallback: int) -> list[int]:
    if not isinstance(raw, list):
        return [fallback] * frame_count

    normalized: list[int] = []
    for index in range(frame_count):
        value = raw[index] if index < len(raw) else fallback
        if not isinstance(value, (int, float)):
            normalized.append(fallback)
            continue
        normalized.append(max(16, round(float(value))))

    return normalized


if __name__ == "__main__":
    main()
