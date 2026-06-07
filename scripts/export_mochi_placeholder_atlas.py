from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

CELL_W = 192
CELL_H = 208
CELL_SCALE = 4
GRID_W = CELL_W // CELL_SCALE
GRID_H = CELL_H // CELL_SCALE
COLS = 8
ROWS = 16
ATLAS_W = CELL_W * COLS
ATLAS_H = CELL_H * ROWS

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "pets" / "mochi" / "sprite-atlas.png"
LEGACY_OUTPUT = ROOT / "public" / "pets" / "catgirl" / "sprite-atlas.png"

PALETTE = {
    "outline": "#84b9e6",
    "outline_dark": "#5f98cf",
    "outline_soft": "#a5d2f2",
    "fur": "#fdfefe",
    "fur_shadow": "#e8f4ff",
    "fur_lowlight": "#dbeeff",
    "cap": "#d8edff",
    "cap_shadow": "#b8daf6",
    "cap_trim": "#f7fcff",
    "ear_inner": "#ffd5e5",
    "ear_shadow": "#f3bcd2",
    "ear_glow": "#ffe7f0",
    "eye": "#7eaede",
    "eye_soft": "#97bee8",
    "eye_shine": "#ffffff",
    "blush": "#f5b4c9",
    "sleep": "#f0cf69",
    "accent": "#bfe0f8",
    "warm": "#f4df95",
    "ribbon": "#bddcf7",
    "ribbon_shadow": "#8fb8dd",
}


def px(draw: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    draw.point((x, y), fill=color)


def rect(
    draw: ImageDraw.ImageDraw,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    fill: str,
    outline: str | None = None,
) -> None:
    draw.rectangle((x1, y1, x2, y2), fill=fill, outline=outline)


def rounded(
    draw: ImageDraw.ImageDraw,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    fill: str,
    outline: str | None = None,
    radius: int = 3,
) -> None:
    draw.rounded_rectangle((x1, y1, x2, y2), radius=radius, fill=fill, outline=outline)


def polygon(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], fill: str, outline: str | None = None) -> None:
    draw.polygon(points, fill=fill, outline=outline)


def draw_eye_open(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    rect(draw, x - 1, y - 1, x, y + 1, PALETTE["eye"], PALETTE["outline_dark"])
    px(draw, x - 2, y, PALETTE["outline_soft"])
    px(draw, x, y - 1, PALETTE["eye_shine"])


def draw_eye_half(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    rect(draw, x - 1, y, x, y + 1, PALETTE["eye_soft"], PALETTE["outline_dark"])
    px(draw, x - 2, y, PALETTE["outline_soft"])
    px(draw, x, y, PALETTE["eye_shine"])


def draw_eye_closed(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    rect(draw, x - 1, y, x, y, PALETTE["eye_soft"])
    px(draw, x - 2, y, PALETTE["outline_soft"])
    px(draw, x + 1, y, PALETTE["outline_soft"])


def draw_eye_wide(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    rect(draw, x - 1, y - 2, x, y + 1, PALETTE["eye"], PALETTE["outline_dark"])
    px(draw, x - 2, y - 1, PALETTE["outline_soft"])
    px(draw, x, y - 1, PALETTE["eye_shine"])
    px(draw, x, y, PALETTE["eye_shine"])


def draw_mouth(draw: ImageDraw.ImageDraw, x: int, y: int, mood: str = "soft") -> None:
    if mood == "w":
        px(draw, x - 2, y, PALETTE["outline_dark"])
        px(draw, x - 1, y + 1, PALETTE["outline_dark"])
        px(draw, x, y, PALETTE["outline_dark"])
        px(draw, x + 1, y + 1, PALETTE["outline_dark"])
        px(draw, x + 2, y, PALETTE["outline_dark"])
        return
    if mood == "happy":
        px(draw, x - 2, y, PALETTE["outline_dark"])
        px(draw, x - 1, y + 1, PALETTE["outline_dark"])
        px(draw, x, y, PALETTE["outline_dark"])
        px(draw, x + 1, y + 1, PALETTE["outline_dark"])
        px(draw, x + 2, y, PALETTE["outline_dark"])
        return
    if mood == "chat":
        px(draw, x - 2, y, PALETTE["outline_dark"])
        px(draw, x - 1, y + 1, PALETTE["outline_dark"])
        px(draw, x, y + 2, PALETTE["outline_dark"])
        px(draw, x + 1, y + 1, PALETTE["outline_dark"])
        px(draw, x + 2, y, PALETTE["outline_dark"])
        return
    if mood == "o":
        px(draw, x, y, PALETTE["outline_dark"])
        px(draw, x - 1, y + 1, PALETTE["outline_dark"])
        px(draw, x + 1, y + 1, PALETTE["outline_dark"])
        px(draw, x, y + 2, PALETTE["outline_dark"])
        return
    if mood == "flat":
        rect(draw, x - 1, y, x + 1, y, PALETTE["outline_dark"])
        return

    px(draw, x - 2, y, PALETTE["outline_dark"])
    px(draw, x - 1, y + 1, PALETTE["outline_dark"])
    px(draw, x, y, PALETTE["outline_dark"])
    px(draw, x + 1, y + 1, PALETTE["outline_dark"])
    px(draw, x + 2, y, PALETTE["outline_dark"])


def draw_nose(draw: ImageDraw.ImageDraw, x: int, y: int, style: str = "dot") -> None:
    if style == "dot":
        px(draw, x - 1, y, PALETTE["outline_dark"])
        px(draw, x, y, PALETTE["outline_dark"])
        return
    rect(draw, x - 1, y, x + 1, y, PALETTE["outline_dark"])


def draw_cheek(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    px(draw, x, y, PALETTE["blush"])
    px(draw, x + 1, y, PALETTE["ear_glow"])


def draw_forehead_stripes(draw: ImageDraw.ImageDraw, center_x: int, head_top: int, head_tilt: int = 0) -> None:
    stripe_y = head_top + 5
    rect(draw, center_x - 4 + head_tilt, stripe_y, center_x - 3 + head_tilt, stripe_y + 1, PALETTE["accent"])
    rect(draw, center_x - 1 + head_tilt, stripe_y - 1, center_x + head_tilt, stripe_y + 2, PALETTE["accent"])
    rect(draw, center_x + 3 + head_tilt, stripe_y, center_x + 4 + head_tilt, stripe_y + 1, PALETTE["accent"])
    px(draw, center_x + head_tilt, stripe_y, PALETTE["cap_trim"])


def draw_face_shadow(draw: ImageDraw.ImageDraw, center_x: int, head_top: int, head_tilt: int = 0) -> None:
    rect(draw, center_x - 11 + head_tilt, head_top + 12, center_x + 11 + head_tilt, head_top + 12, PALETTE["fur_shadow"])
    rect(draw, center_x - 8 + head_tilt, head_top + 13, center_x + 8 + head_tilt, head_top + 14, PALETTE["fur_lowlight"])
    px(draw, center_x - 9 + head_tilt, head_top + 11, PALETTE["fur_shadow"])
    px(draw, center_x + 9 + head_tilt, head_top + 11, PALETTE["fur_shadow"])


def draw_caplet(draw: ImageDraw.ImageDraw, center_x: int, head_top: int, head_tilt: int = 0) -> None:
    rounded(draw, center_x - 7 + head_tilt, head_top - 1, center_x + 7 + head_tilt, head_top + 1, PALETTE["cap"], PALETTE["outline"], radius=2)
    rect(draw, center_x - 4 + head_tilt, head_top - 2, center_x + 4 + head_tilt, head_top - 1, PALETTE["cap_trim"])
    rect(draw, center_x - 5 + head_tilt, head_top + 1, center_x + 5 + head_tilt, head_top + 1, PALETTE["cap_shadow"])


def draw_ribbon_charm(draw: ImageDraw.ImageDraw, center_x: int, top_y: int) -> None:
    px(draw, center_x, top_y, PALETTE["ribbon_shadow"])
    polygon(
        draw,
        [
            (center_x - 3, top_y + 1),
            (center_x - 1, top_y + 4),
            (center_x + 1, top_y + 1),
            (center_x + 3, top_y + 4),
            (center_x + 1, top_y + 7),
            (center_x - 1, top_y + 7),
        ],
        PALETTE["ribbon"],
        PALETTE["outline"],
    )
    px(draw, center_x, top_y + 4, PALETTE["cap_trim"])


def draw_star(draw: ImageDraw.ImageDraw, x: int, y: int, color: str | None = None) -> None:
    shade = color or PALETTE["sleep"]
    px(draw, x, y - 2, shade)
    px(draw, x - 1, y - 1, shade)
    px(draw, x, y - 1, shade)
    px(draw, x + 1, y - 1, shade)
    rect(draw, x - 2, y, x + 2, y, shade)
    px(draw, x - 1, y + 1, shade)
    px(draw, x, y + 1, shade)
    px(draw, x + 1, y + 1, shade)
    px(draw, x, y + 2, shade)


def draw_heart(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    px(draw, x - 1, y, PALETTE["blush"])
    px(draw, x + 1, y, PALETTE["blush"])
    rect(draw, x - 2, y + 1, x + 2, y + 1, PALETTE["blush"])
    px(draw, x - 1, y + 2, PALETTE["blush"])
    px(draw, x, y + 3, PALETTE["blush"])
    px(draw, x + 1, y + 2, PALETTE["blush"])


def draw_music(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    rect(draw, x, y - 4, x, y, PALETTE["accent"])
    rect(draw, x, y - 4, x + 2, y - 4, PALETTE["accent"])
    px(draw, x + 2, y - 3, PALETTE["accent"])
    rect(draw, x - 1, y, x + 1, y + 1, PALETTE["accent"])


def draw_sleep_mark(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    rect(draw, x - 1, y - 2, x + 2, y - 2, PALETTE["sleep"])
    px(draw, x + 2, y - 1, PALETTE["sleep"])
    rect(draw, x, y, x + 3, y, PALETTE["sleep"])
    px(draw, x, y + 1, PALETTE["sleep"])
    rect(draw, x - 1, y + 2, x + 2, y + 2, PALETTE["sleep"])


def draw_signal(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    px(draw, x, y - 1, PALETTE["accent"])
    px(draw, x - 1, y, PALETTE["accent"])
    px(draw, x + 1, y, PALETTE["accent"])
    px(draw, x - 2, y + 1, PALETTE["accent"])
    px(draw, x + 2, y + 1, PALETTE["accent"])


def draw_lantern(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    rect(draw, x, y - 4, x, y - 1, PALETTE["warm"])
    rect(draw, x - 2, y - 1, x + 2, y + 3, PALETTE["warm"], PALETTE["outline_dark"])
    rect(draw, x - 1, y, x + 1, y + 2, PALETTE["blush"])


def draw_small_paw(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    rounded(draw, x - 1, y, x + 1, y + 2, PALETTE["fur"], PALETTE["outline"], radius=1)


def draw_foot(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    rounded(draw, x - 2, y, x + 1, y + 3, PALETTE["fur"], PALETTE["outline"], radius=1)


def draw_mascot(pose: dict) -> Image.Image:
    img = Image.new("RGBA", (GRID_W, GRID_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    x_shift = int(pose.get("x_shift", 0))
    y_shift = int(pose.get("y_shift", 0))
    float_bob = int(pose.get("float_bob", 0))
    head_tilt = int(pose.get("head_tilt", 0))
    body_shift = int(pose.get("body_shift", 0))
    head_widen = int(pose.get("head_widen", 0))
    head_flatten = int(pose.get("head_flatten", 0))
    face_drop = int(pose.get("face_drop", 0))
    blink = bool(pose.get("blink", False))
    sleepy = bool(pose.get("sleepy", False))
    half_lidded = bool(pose.get("half_lidded", False))
    left_ear_drop = int(pose.get("left_ear_drop", 0))
    right_ear_drop = int(pose.get("right_ear_drop", 0))
    left_ear_out = int(pose.get("left_ear_out", 0))
    right_ear_out = int(pose.get("right_ear_out", 0))
    left_paw_up = int(pose.get("left_paw_up", 0))
    right_paw_up = int(pose.get("right_paw_up", 0))
    feet_spread = int(pose.get("feet_spread", 0))
    mouth = str(pose.get("mouth", "soft"))
    nose_style = str(pose.get("nose_style", "dot"))
    eye_style = str(pose.get("eye_style", "open"))
    eye_y_shift = int(pose.get("eye_y_shift", 0))
    cheek_boost = bool(pose.get("cheek_boost", False))
    loaf_mode = bool(pose.get("loaf_mode", False))
    loaf_drop = int(pose.get("loaf_drop", 0))
    body_width = int(pose.get("body_width", 0))
    body_height = int(pose.get("body_height", 0))
    loaf_width = int(pose.get("loaf_width", 0))
    loaf_height = int(pose.get("loaf_height", 0))
    hide_feet = bool(pose.get("hide_feet", False))
    hide_charm = bool(pose.get("hide_charm", loaf_mode))

    cx = 24 + x_shift
    head_top = 10 + y_shift + float_bob
    head_left = cx - 17 - head_widen + head_tilt
    head_right = cx + 17 + head_widen + head_tilt
    head_bottom = head_top + 11 - head_flatten

    body_top = head_bottom - 1
    body_left = cx - 4 - body_width + body_shift
    body_right = cx + 4 + body_width + body_shift
    body_bottom = body_top + 7 + body_height

    left_ear = [
        (head_left + 7, head_top + 4),
        (head_left + 2 - left_ear_out, head_top + 5),
        (head_left - 4 - left_ear_out, head_top + 9 + left_ear_drop),
        (head_left - 8 - left_ear_out, head_top + 18 + left_ear_drop),
        (head_left - 6 - left_ear_out, head_top + 26 + left_ear_drop),
        (head_left - 1 - left_ear_out, head_top + 29 + left_ear_drop),
        (head_left + 4, head_top + 26 + left_ear_drop),
        (head_left + 8, head_top + 12),
    ]
    right_ear = [
        (head_right - 7, head_top + 4),
        (head_right - 2 + right_ear_out, head_top + 5),
        (head_right + 4 + right_ear_out, head_top + 9 + right_ear_drop),
        (head_right + 8 + right_ear_out, head_top + 18 + right_ear_drop),
        (head_right + 6 + right_ear_out, head_top + 26 + right_ear_drop),
        (head_right + 1 + right_ear_out, head_top + 29 + right_ear_drop),
        (head_right - 4, head_top + 26 + right_ear_drop),
        (head_right - 8, head_top + 12),
    ]
    polygon(draw, left_ear, PALETTE["fur"], PALETTE["outline"])
    polygon(draw, right_ear, PALETTE["fur"], PALETTE["outline"])
    polygon(
        draw,
        [
            (head_left + 4, head_top + 8),
            (head_left + 1 - left_ear_out, head_top + 9),
            (head_left - 2 - left_ear_out, head_top + 13 + left_ear_drop),
            (head_left - 3 - left_ear_out, head_top + 21 + left_ear_drop),
            (head_left - 1 - left_ear_out, head_top + 24 + left_ear_drop),
            (head_left + 3, head_top + 12),
        ],
        PALETTE["ear_inner"],
    )
    px(draw, head_left - 2 - left_ear_out, head_top + 18 + left_ear_drop, PALETTE["ear_glow"])
    px(draw, head_left - 1 - left_ear_out, head_top + 22 + left_ear_drop, PALETTE["ear_glow"])
    polygon(
        draw,
        [
            (head_right - 4, head_top + 8),
            (head_right - 1 + right_ear_out, head_top + 9),
            (head_right + 2 + right_ear_out, head_top + 13 + right_ear_drop),
            (head_right + 3 + right_ear_out, head_top + 21 + right_ear_drop),
            (head_right + 1 + right_ear_out, head_top + 24 + right_ear_drop),
            (head_right - 3, head_top + 12),
        ],
        PALETTE["ear_inner"],
    )
    px(draw, head_right + 2 + right_ear_out, head_top + 18 + right_ear_drop, PALETTE["ear_glow"])
    px(draw, head_right + 1 + right_ear_out, head_top + 22 + right_ear_drop, PALETTE["ear_glow"])
    px(draw, head_left - 4 - left_ear_out, head_top + 19 + left_ear_drop, PALETTE["ear_shadow"])
    px(draw, head_right + 4 + right_ear_out, head_top + 19 + right_ear_drop, PALETTE["ear_shadow"])

    rounded(draw, head_left, head_top, head_right, head_bottom, PALETTE["fur"], PALETTE["outline"], radius=6)
    rect(draw, head_left + 3, head_top + 3, head_left + 6, head_top + 4, PALETTE["cap_trim"])
    rect(draw, head_right - 6, head_top + 3, head_right - 3, head_top + 4, PALETTE["cap_trim"])
    draw_caplet(draw, cx, head_top, head_tilt)
    draw_forehead_stripes(draw, cx, head_top, head_tilt)
    draw_face_shadow(draw, cx, head_top, head_tilt)

    if loaf_mode:
        loaf_top = body_top + 2 + loaf_drop
        loaf_left = cx - 13 - loaf_width + body_shift
        loaf_right = cx + 13 + loaf_width + body_shift
        loaf_bottom = loaf_top + 7 + loaf_height
        rounded(draw, loaf_left, loaf_top, loaf_right, loaf_bottom, PALETTE["fur"], PALETTE["outline"], radius=4)
        rounded(draw, loaf_left + 2, loaf_top + 3, loaf_right - 2, loaf_bottom - 1, PALETTE["fur_shadow"], radius=4)
        rounded(draw, loaf_left + 5, loaf_top + 4, loaf_right - 5, loaf_bottom - 1, PALETTE["fur_lowlight"], radius=4)
        draw_small_paw(draw, loaf_left + 7, loaf_top + 3 - min(1, left_paw_up))
        draw_small_paw(draw, loaf_right - 7, loaf_top + 3 - min(1, right_paw_up))
    else:
        rounded(draw, body_left, body_top, body_right, body_bottom, PALETTE["fur"], PALETTE["outline"], radius=4)
        rounded(draw, cx - 2 + body_shift, body_top + 3, cx + 2 + body_shift, body_bottom - 1, PALETTE["fur_shadow"], radius=3)
        rounded(draw, cx - 1 + body_shift, body_top + 4, cx + 1 + body_shift, body_bottom - 1, PALETTE["fur_lowlight"], radius=2)

        left_paw_x = body_left
        right_paw_x = body_right
        left_paw_y = body_top + 3 - left_paw_up
        right_paw_y = body_top + 3 - right_paw_up
        draw_small_paw(draw, left_paw_x, left_paw_y)
        draw_small_paw(draw, right_paw_x, right_paw_y)

        left_foot_x = cx - 3 - feet_spread + body_shift
        right_foot_x = cx + 2 + feet_spread + body_shift
        if not hide_feet:
            draw_foot(draw, left_foot_x, body_bottom - 1)
            draw_foot(draw, right_foot_x, body_bottom - 1)
        if not hide_charm:
            draw_ribbon_charm(draw, cx + body_shift, body_top + 1)

    eye_y = head_top + 10 + face_drop + eye_y_shift
    left_eye_x = cx - 4 + head_tilt + int(pose.get("eye_shift_left", 0))
    right_eye_x = cx + 4 + head_tilt + int(pose.get("eye_shift_right", 0))
    if blink or sleepy or eye_style == "closed":
        draw_eye_closed(draw, left_eye_x, eye_y)
        draw_eye_closed(draw, right_eye_x, eye_y)
    elif eye_style == "wide":
        draw_eye_wide(draw, left_eye_x, eye_y)
        draw_eye_wide(draw, right_eye_x, eye_y)
    elif half_lidded or eye_style == "half":
        draw_eye_half(draw, left_eye_x, eye_y)
        draw_eye_half(draw, right_eye_x, eye_y)
    else:
        draw_eye_open(draw, left_eye_x, eye_y)
        draw_eye_open(draw, right_eye_x, eye_y)

    draw_cheek(draw, cx - 10 + head_tilt, head_top + 13 + face_drop)
    draw_cheek(draw, cx + 9 + head_tilt, head_top + 13 + face_drop)
    if cheek_boost:
        px(draw, cx - 9 + head_tilt, head_top + 14 + face_drop, PALETTE["blush"])
        px(draw, cx + 10 + head_tilt, head_top + 14 + face_drop, PALETTE["blush"])
    draw_nose(draw, cx + head_tilt, head_top + 11 + face_drop, nose_style)
    draw_mouth(draw, cx + head_tilt, head_top + 12 + face_drop, mouth)

    if pose.get("star"):
        draw_star(draw, cx + 13, head_top + 4)
    if pose.get("heart"):
        draw_heart(draw, cx + 13, head_top + 4)
    if pose.get("music"):
        draw_music(draw, cx + 12, head_top + 6)
    if pose.get("sleep_mark"):
        draw_sleep_mark(draw, cx + 12, head_top + 4)
    if pose.get("signal"):
        draw_signal(draw, cx + 13, head_top + 4)
    if pose.get("lantern"):
        draw_lantern(draw, cx + 13, head_top + 6)

    return img.resize((CELL_W, CELL_H), Image.Resampling.NEAREST)


def idle_frames() -> list[dict]:
    return [
        {"left_ear_drop": 4, "right_ear_drop": 5, "mouth": "w", "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"float_bob": 1, "x_shift": -1, "left_ear_drop": 5, "right_ear_drop": 4, "body_shift": -1, "mouth": "w", "eye_y_shift": 1, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"left_ear_drop": 6, "right_ear_drop": 5, "half_lidded": True, "mouth": "flat", "eye_style": "half", "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"blink": True, "left_ear_drop": 5, "right_ear_drop": 5, "mouth": "w", "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"float_bob": -1, "x_shift": 1, "left_ear_drop": 4, "right_ear_drop": 6, "body_shift": 1, "mouth": "w", "eye_y_shift": -1, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"left_ear_drop": 4, "right_ear_drop": 5, "mouth": "flat", "eye_style": "half", "head_widen": 1, "face_drop": 1, "body_width": -1},
    ]


def thinking_frames() -> list[dict]:
    return [
        {"head_tilt": -1, "left_paw_up": 4, "right_paw_up": 1, "left_ear_drop": 3, "right_ear_drop": 6, "star": True, "mouth": "flat", "eye_shift_left": 1, "eye_shift_right": 1, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"head_tilt": -1, "left_paw_up": 3, "right_paw_up": 1, "left_ear_drop": 4, "right_ear_drop": 5, "mouth": "flat", "eye_style": "half", "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"head_tilt": 0, "left_paw_up": 3, "right_paw_up": 2, "blink": True, "left_ear_drop": 5, "right_ear_drop": 4, "star": True, "mouth": "flat", "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"head_tilt": 1, "left_paw_up": 2, "right_paw_up": 3, "left_ear_drop": 6, "right_ear_drop": 3, "mouth": "w", "eye_shift_left": -1, "eye_shift_right": -1, "head_widen": 1, "face_drop": 1, "body_width": -1},
    ]


def coding_frames() -> list[dict]:
    return [
        {"head_tilt": -1, "left_paw_up": 3, "right_paw_up": 1, "left_ear_drop": 4, "right_ear_drop": 6, "half_lidded": True, "mouth": "flat", "eye_style": "half", "body_shift": -1, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"head_tilt": -1, "left_paw_up": 2, "right_paw_up": 3, "left_ear_drop": 5, "right_ear_drop": 5, "body_shift": -1, "mouth": "flat", "eye_y_shift": 1, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"head_tilt": 0, "left_paw_up": 1, "right_paw_up": 1, "blink": True, "left_ear_drop": 6, "right_ear_drop": 6, "mouth": "flat", "eye_y_shift": 1, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"head_tilt": 1, "left_paw_up": 3, "right_paw_up": 2, "left_ear_drop": 5, "right_ear_drop": 4, "body_shift": 1, "mouth": "flat", "eye_style": "half", "head_widen": 1, "face_drop": 1, "body_width": -1},
    ]


def watching_frames() -> list[dict]:
    return [
        {"head_tilt": -2, "left_ear_drop": 7, "right_ear_drop": 4, "eye_shift_left": 1, "eye_shift_right": 1, "mouth": "w", "cheek_boost": True, "body_shift": -1, "head_widen": 2, "face_drop": 1, "body_width": -1, "loaf_mode": True, "loaf_drop": 1, "loaf_width": 1},
        {"head_tilt": -1, "left_paw_up": 1, "left_ear_drop": 8, "right_ear_drop": 5, "eye_shift_left": 1, "eye_shift_right": 1, "mouth": "chat", "cheek_boost": True, "head_widen": 2, "face_drop": 1, "body_width": -1, "loaf_mode": True, "loaf_drop": 2, "loaf_width": 1},
        {"head_tilt": 0, "blink": True, "left_ear_drop": 8, "right_ear_drop": 8, "music": True, "mouth": "flat", "float_bob": 0, "loaf_mode": True, "loaf_drop": 2, "loaf_width": 2, "head_widen": 2, "face_drop": 2},
        {"head_tilt": 2, "left_ear_drop": 5, "right_ear_drop": 8, "eye_shift_left": -1, "eye_shift_right": -1, "mouth": "w", "cheek_boost": True, "body_shift": 1, "head_widen": 2, "face_drop": 1, "body_width": -1, "loaf_mode": True, "loaf_drop": 1, "loaf_width": 1},
    ]


def chatting_frames() -> list[dict]:
    return [
        {"float_bob": -1, "left_paw_up": 4, "right_paw_up": 1, "left_ear_drop": 2, "right_ear_drop": 5, "mouth": "chat", "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"float_bob": 0, "left_paw_up": 5, "right_paw_up": 2, "left_ear_drop": 2, "right_ear_drop": 4, "heart": True, "mouth": "happy", "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"float_bob": -1, "blink": True, "left_paw_up": 4, "right_paw_up": 4, "left_ear_drop": 3, "right_ear_drop": 3, "mouth": "chat", "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"float_bob": 0, "left_paw_up": 2, "right_paw_up": 2, "left_ear_drop": 3, "right_ear_drop": 3, "mouth": "w", "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
    ]


def gaming_frames() -> list[dict]:
    return [
        {"float_bob": -1, "left_paw_up": 2, "right_paw_up": 4, "left_ear_drop": 2, "right_ear_drop": 5, "mouth": "o", "eye_style": "wide", "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"float_bob": -2, "x_shift": 1, "left_paw_up": 3, "right_paw_up": 5, "left_ear_drop": 1, "right_ear_drop": 4, "signal": True, "mouth": "o", "eye_style": "wide", "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"float_bob": -1, "x_shift": -1, "left_paw_up": 5, "right_paw_up": 2, "left_ear_drop": 4, "right_ear_drop": 1, "mouth": "happy", "eye_style": "wide", "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"float_bob": 0, "left_paw_up": 2, "right_paw_up": 2, "left_ear_drop": 4, "right_ear_drop": 4, "mouth": "flat", "eye_style": "half", "head_widen": 1, "face_drop": 1, "body_width": -1},
    ]


def sleep_frames() -> list[dict]:
    return [
        {"sleepy": True, "y_shift": 4, "left_ear_drop": 12, "right_ear_drop": 13, "left_ear_out": 1, "right_ear_out": 1, "sleep_mark": True, "mouth": "flat", "loaf_mode": True, "loaf_drop": 3, "loaf_width": 3, "loaf_height": 1, "head_widen": 2, "face_drop": 2, "hide_charm": True},
        {"sleepy": True, "y_shift": 5, "head_tilt": -1, "left_ear_drop": 13, "right_ear_drop": 12, "left_ear_out": 2, "sleep_mark": True, "mouth": "flat", "loaf_mode": True, "loaf_drop": 4, "loaf_width": 3, "loaf_height": 1, "head_widen": 2, "face_drop": 2, "hide_charm": True},
        {"sleepy": True, "y_shift": 5, "head_tilt": 1, "left_ear_drop": 12, "right_ear_drop": 13, "right_ear_out": 2, "sleep_mark": True, "mouth": "flat", "loaf_mode": True, "loaf_drop": 4, "loaf_width": 3, "loaf_height": 1, "head_widen": 2, "face_drop": 2, "hide_charm": True},
        {"sleepy": True, "y_shift": 6, "left_ear_drop": 13, "right_ear_drop": 13, "left_ear_out": 2, "right_ear_out": 2, "sleep_mark": True, "mouth": "flat", "loaf_mode": True, "loaf_drop": 5, "loaf_width": 4, "loaf_height": 1, "head_widen": 2, "face_drop": 2, "hide_charm": True},
    ]


def happy_frames() -> list[dict]:
    return [
        {"mouth": "happy", "float_bob": -1, "left_paw_up": 4, "right_paw_up": 4, "left_ear_drop": 1, "right_ear_drop": 2, "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"mouth": "o", "float_bob": -2, "left_paw_up": 6, "right_paw_up": 6, "left_ear_drop": 0, "right_ear_drop": 0, "eye_style": "wide", "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"mouth": "happy", "float_bob": -2, "blink": True, "left_paw_up": 5, "right_paw_up": 5, "left_ear_drop": 1, "right_ear_drop": 0, "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"mouth": "w", "float_bob": 0, "left_paw_up": 2, "right_paw_up": 2, "left_ear_drop": 2, "right_ear_drop": 2, "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
    ]


def excited_frames() -> list[dict]:
    return [
        {"mouth": "happy", "float_bob": -2, "left_paw_up": 5, "right_paw_up": 5, "left_ear_drop": 0, "right_ear_drop": 1, "signal": True, "eye_style": "wide", "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"mouth": "o", "float_bob": -3, "left_paw_up": 7, "right_paw_up": 7, "left_ear_drop": -1, "right_ear_drop": -1, "eye_style": "wide", "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"mouth": "happy", "float_bob": -3, "x_shift": 1, "left_paw_up": 6, "right_paw_up": 6, "left_ear_drop": 0, "right_ear_drop": 1, "heart": True, "eye_style": "wide", "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
        {"mouth": "happy", "float_bob": -1, "x_shift": -1, "left_paw_up": 4, "right_paw_up": 5, "left_ear_drop": 1, "right_ear_drop": 1, "cheek_boost": True, "head_widen": 1, "face_drop": 1, "body_width": -1},
    ]


def drag_frames() -> list[dict]:
    return [
        {"x_shift": -3, "body_shift": -2, "head_tilt": -2, "left_ear_drop": 5, "right_ear_drop": 10, "right_ear_out": 3, "feet_spread": 1, "mouth": "flat", "eye_style": "half", "left_paw_up": 1, "right_paw_up": 2, "head_widen": 1, "face_drop": 1, "body_width": -1, "body_height": -1, "hide_feet": True},
        {"x_shift": -1, "body_shift": -1, "head_tilt": -1, "left_ear_drop": 5, "right_ear_drop": 8, "right_ear_out": 2, "feet_spread": 1, "mouth": "flat", "left_paw_up": 1, "right_paw_up": 2, "head_widen": 1, "face_drop": 1, "body_width": -1, "body_height": -1, "hide_feet": True},
        {"x_shift": 1, "body_shift": 1, "head_tilt": 1, "left_ear_drop": 8, "right_ear_drop": 5, "left_ear_out": 2, "feet_spread": 1, "mouth": "w", "left_paw_up": 2, "right_paw_up": 1, "head_widen": 1, "face_drop": 1, "body_width": -1, "body_height": -1, "hide_feet": True},
        {"x_shift": 3, "body_shift": 2, "head_tilt": 2, "left_ear_drop": 10, "right_ear_drop": 5, "left_ear_out": 3, "feet_spread": 1, "mouth": "w", "eye_style": "half", "left_paw_up": 2, "right_paw_up": 1, "head_widen": 1, "face_drop": 1, "body_width": -1, "body_height": -1, "hide_feet": True},
    ]


def idle_to_thinking_frames() -> list[dict]:
    return [
        {"left_ear_drop": 3, "right_ear_drop": 4, "mouth": "w"},
        {"head_tilt": -1, "left_paw_up": 2, "right_paw_up": 1, "left_ear_drop": 3, "right_ear_drop": 3, "mouth": "flat"},
        {"head_tilt": -1, "left_paw_up": 4, "right_paw_up": 1, "left_ear_drop": 3, "right_ear_drop": 2, "half_lidded": True, "mouth": "flat"},
        {"head_tilt": -1, "left_paw_up": 5, "right_paw_up": 1, "left_ear_drop": 3, "right_ear_drop": 2, "star": True, "mouth": "flat"},
    ]


def thinking_to_idle_frames() -> list[dict]:
    return [
        {"head_tilt": -1, "left_paw_up": 5, "right_paw_up": 1, "left_ear_drop": 3, "right_ear_drop": 2, "star": True, "mouth": "flat"},
        {"head_tilt": 0, "left_paw_up": 3, "right_paw_up": 2, "left_ear_drop": 3, "right_ear_drop": 3, "mouth": "w"},
        {"float_bob": 0, "left_ear_drop": 4, "right_ear_drop": 4, "half_lidded": True, "mouth": "w"},
        {"left_ear_drop": 3, "right_ear_drop": 3, "mouth": "w"},
    ]


def thinking_to_sleep_frames() -> list[dict]:
    return [
        {"head_tilt": -1, "left_paw_up": 4, "right_paw_up": 1, "left_ear_drop": 3, "right_ear_drop": 2, "mouth": "flat"},
        {"half_lidded": True, "y_shift": 1, "left_ear_drop": 5, "right_ear_drop": 5, "mouth": "flat"},
        {"sleepy": True, "y_shift": 3, "left_ear_drop": 7, "right_ear_drop": 7, "mouth": "flat"},
        {"sleepy": True, "y_shift": 4, "left_ear_drop": 8, "right_ear_drop": 8, "sleep_mark": True, "mouth": "flat"},
    ]


def idle_to_happy_frames() -> list[dict]:
    return [
        {"left_ear_drop": 3, "right_ear_drop": 3, "mouth": "w", "eye_style": "half"},
        {"float_bob": -1, "left_paw_up": 3, "right_paw_up": 3, "left_ear_drop": 2, "right_ear_drop": 2, "mouth": "happy", "cheek_boost": True},
        {"float_bob": -3, "left_paw_up": 7, "right_paw_up": 7, "left_ear_drop": 0, "right_ear_drop": 0, "heart": True, "mouth": "happy", "eye_style": "wide", "cheek_boost": True},
        {"float_bob": -1, "left_paw_up": 5, "right_paw_up": 5, "left_ear_drop": 1, "right_ear_drop": 1, "mouth": "happy", "cheek_boost": True},
    ]


def welcome_back_frames() -> list[dict]:
    return [
        {"head_tilt": -1, "left_ear_drop": 4, "right_ear_drop": 5, "eye_style": "half", "mouth": "w"},
        {"float_bob": -1, "left_paw_up": 3, "right_paw_up": 2, "left_ear_drop": 2, "right_ear_drop": 3, "mouth": "happy", "cheek_boost": True},
        {"float_bob": -2, "left_paw_up": 5, "right_paw_up": 5, "left_ear_drop": 1, "right_ear_drop": 1, "eye_style": "wide", "mouth": "happy", "cheek_boost": True},
        {"float_bob": -1, "left_paw_up": 2, "right_paw_up": 2, "left_ear_drop": 2, "right_ear_drop": 2, "mouth": "w", "cheek_boost": True},
    ]


def tap_affection_frames() -> list[dict]:
    return [
        {"head_tilt": -1, "left_ear_drop": 4, "right_ear_drop": 4, "mouth": "w", "eye_style": "half", "cheek_boost": True},
        {"float_bob": -1, "head_tilt": -1, "left_paw_up": 4, "right_paw_up": 2, "left_ear_drop": 2, "right_ear_drop": 3, "mouth": "happy", "cheek_boost": True},
        {"float_bob": -2, "left_paw_up": 6, "right_paw_up": 5, "left_ear_drop": 1, "right_ear_drop": 1, "mouth": "happy", "eye_style": "wide", "cheek_boost": True, "heart": True},
        {"float_bob": -1, "left_paw_up": 2, "right_paw_up": 2, "left_ear_drop": 2, "right_ear_drop": 2, "mouth": "w", "eye_style": "half", "cheek_boost": True},
    ]


ROWS_DEF = [
    ("idle_loop", idle_frames()),
    ("thinking_loop", thinking_frames()),
    ("coding_loop", coding_frames()),
    ("watching_loop", watching_frames()),
    ("chatting_loop", chatting_frames()),
    ("gaming_loop", gaming_frames()),
    ("sleep_loop", sleep_frames()),
    ("happy_react", happy_frames()),
    ("excited_loop", excited_frames()),
    ("drag", drag_frames()),
    ("idle_to_thinking", idle_to_thinking_frames()),
    ("thinking_to_idle", thinking_to_idle_frames()),
    ("thinking_to_sleep", thinking_to_sleep_frames()),
    ("idle_to_happy", idle_to_happy_frames()),
    ("welcome_back", welcome_back_frames()),
    ("tap_affection", tap_affection_frames()),
]


def build_atlas() -> Image.Image:
    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))

    for row_index, (_, frames) in enumerate(ROWS_DEF):
        for frame_index, pose in enumerate(frames):
            frame = draw_mascot(pose)
            atlas.alpha_composite(frame, (frame_index * CELL_W, row_index * CELL_H))

    return atlas


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    LEGACY_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    atlas = build_atlas()
    atlas.save(OUTPUT)
    atlas.save(LEGACY_OUTPUT)
    print(f"wrote {OUTPUT}")
    print(f"mirrored {LEGACY_OUTPUT}")


if __name__ == "__main__":
    main()
