"""
utils/mascot_image.py — Tự sinh ảnh thẻ thông báo mascot bằng Pillow.

v2.1 — Emoji-style expressive faces: mỗi emotion có mặt cảm xúc riêng
(vui vẻ, hype, sarcastic, urgent, fire_mode) được vẽ hoàn toàn bằng Pillow.
Không cần CDN, không cần upload thủ công.
Cache theo (event_value, emotion_value) — chỉ render 1 lần mỗi session.
"""
from __future__ import annotations

import io
import math
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mascot import MascotEmotion, MascotEvent

# ── Color palette theo emotion ────────────────────────────────────────────────

_EMOTION_PALETTE: dict[str, dict] = {
    "happy": {
        "header":     (40, 150, 80),
        "header2":    (80, 200, 120),
        "accent":     (20, 90, 45),
        "bg_card":    (230, 248, 235),
        "face":       (255, 215, 60),
        "face_line":  (180, 130, 0),
        "face_type":  "happy",
    },
    "hype": {
        "header":     (240, 100, 0),
        "header2":    (255, 170, 50),
        "accent":     (190, 55, 0),
        "bg_card":    (255, 242, 218),
        "face":       (255, 195, 55),
        "face_line":  (190, 100, 0),
        "face_type":  "hype",
    },
    "sarcastic": {
        "header":     (115, 25, 155),
        "header2":    (165, 60, 200),
        "accent":     (65, 10, 125),
        "bg_card":    (242, 226, 252),
        "face":       (216, 168, 250),
        "face_line":  (90, 15, 140),
        "face_type":  "sarcastic",
    },
    "urgent": {
        "header":     (190, 30, 30),
        "header2":    (235, 55, 55),
        "accent":     (110, 0, 0),
        "bg_card":    (255, 230, 232),
        "face":       (255, 158, 148),
        "face_line":  (150, 25, 25),
        "face_type":  "urgent",
    },
    "fire_mode": {
        "header":     (220, 65, 15),
        "header2":    (255, 105, 55),
        "accent":     (170, 35, 0),
        "bg_card":    (255, 234, 222),
        "face":       (255, 145, 75),
        "face_line":  (170, 45, 0),
        "face_type":  "fire_mode",
    },
}
_DEFAULT_PALETTE = _EMOTION_PALETTE["happy"]

# ── Event label ───────────────────────────────────────────────────────────────

_EVENT_LABEL: dict[str, str] = {
    "created":          "NHIEM VU MOI",
    "assigned":         "BAN CO NHIEM VU",
    "completed":        "NHIEM VU HOAN THANH",
    "deadline_warning": "CANH BAO DEADLINE",
    "level_up":         "LEN CAP!",
    "streak_active":    "STREAK ACTIVE",
    "reward_xgold":     "PHAN THUONG XP",
    "badge_unlocked":   "HUY HIEU MOI",
    "daily_summary":    "BAO CAO NGAY",
}

# ── Cache ─────────────────────────────────────────────────────────────────────

_cache: dict[tuple[str, str], bytes] = {}


def generate_mascot_card(event_value: str, emotion_value: str) -> bytes:
    key = (event_value, emotion_value)
    if key in _cache:
        return _cache[key]
    data = _render(event_value, emotion_value)
    _cache[key] = data
    return data


def generate_mascot_card_typed(event: "MascotEvent", emotion: "MascotEmotion") -> bytes:
    return generate_mascot_card(event.value, emotion.value)


# ── Core renderer ─────────────────────────────────────────────────────────────

def _render(event_value: str, emotion_value: str) -> bytes:
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return _minimal_png()

    pal   = _EMOTION_PALETTE.get(emotion_value, _DEFAULT_PALETTE)
    label = _EVENT_LABEL.get(event_value, event_value.upper().replace("_", " "))

    W, H      = 560, 315
    HEADER_H  = 155
    CARD_TOP  = 95

    img  = Image.new("RGB", (W, H), pal["bg_card"])
    draw = ImageDraw.Draw(img)

    # ── Gradient header ───────────────────────────────────────────────────────
    c1, c2 = pal["header"], pal["header2"]
    for y in range(HEADER_H):
        t = y / HEADER_H
        r = int(c1[0] + (c2[0] - c1[0]) * t)
        g = int(c1[1] + (c2[1] - c1[1]) * t)
        b = int(c1[2] + (c2[2] - c1[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # ── Sparkle dots trong header ────────────────────────────────────────────
    _draw_sparkles(draw, W, HEADER_H, pal["header2"])

    # ── White card ────────────────────────────────────────────────────────────
    draw.rounded_rectangle([18, CARD_TOP, W - 18, H - 14], radius=20, fill="white")

    # ── Emoji face (lớn, tràn lên header) ───────────────────────────────────
    face_r = 58
    fx, fy = W // 2, HEADER_H - 8
    _draw_emotion_face(draw, fx, fy, face_r, pal["face_type"], pal["face"], pal["face_line"])

    # ── Event label ───────────────────────────────────────────────────────────
    fnt_title, fnt_sub, fnt_footer = _load_fonts(20, 13, 11)
    text_top = fy + face_r + 14
    _draw_centered(draw, W, text_top, label, fnt_title, pal["accent"])

    # ── Emotion badge pill ────────────────────────────────────────────────────
    badge_text = emotion_value.upper().replace("_", " ")
    badge_y    = text_top + 32
    try:
        bbox = draw.textbbox((0, 0), badge_text, font=fnt_sub)
        bw   = bbox[2] - bbox[0] + 26
        bh   = bbox[3] - bbox[1] + 10
    except AttributeError:
        bw, bh_raw = draw.textsize(badge_text, font=fnt_sub)
        bw += 26
        bh  = bh_raw + 10
    bx = (W - bw) // 2
    draw.rounded_rectangle([bx, badge_y, bx + bw, badge_y + bh],
                            radius=bh // 2, fill=pal["header"])
    _draw_centered(draw, W, badge_y + 3, badge_text, fnt_sub, "white")

    # ── Footer ────────────────────────────────────────────────────────────────
    _draw_centered(draw, W, H - 20, "QLDA Notification System", fnt_footer, (185, 185, 185))

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return buf.getvalue()


# ── Emoji face drawing ────────────────────────────────────────────────────────

def _draw_emotion_face(draw, cx: float, cy: float, r: float,
                       face_type: str, face_col, face_line):
    """Vẽ mặt emoji cartoon lớn, biểu cảm theo emotion."""
    # Shadow
    draw.ellipse([cx - r - 3, cy - r, cx + r + 3, cy + r + 6], fill=(170, 170, 170))
    # Face circle
    lw = max(3, int(r * 0.065))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                 fill=face_col, outline=face_line, width=lw)

    eye_y  = cy - r * 0.18
    eye_lx = cx - r * 0.32
    eye_rx = cx + r * 0.32
    eye_r  = r * 0.13

    if face_type == "happy":
        _face_happy(draw, cx, cy, r, eye_lx, eye_rx, eye_y, eye_r, face_line, face_col)
    elif face_type == "hype":
        _face_hype(draw, cx, cy, r, eye_lx, eye_rx, eye_y, eye_r, face_line)
    elif face_type == "sarcastic":
        _face_sarcastic(draw, cx, cy, r, eye_lx, eye_rx, eye_y, eye_r, face_line, face_col)
    elif face_type == "urgent":
        _face_urgent(draw, cx, cy, r, eye_lx, eye_rx, eye_y, eye_r, face_line)
    elif face_type == "fire_mode":
        _face_fire_mode(draw, cx, cy, r, eye_lx, eye_rx, eye_y, eye_r, face_line)


def _face_happy(draw, cx, cy, r, elx, erx, ey, er, lc, face_col):
    """😊 Mắt cong ^, má hồng, cười tươi."""
    lw  = max(3, int(r * 0.07))
    ew  = er * 2.4
    # Arc eyes (^ shape)
    for ex in [elx, erx]:
        draw.arc([ex - ew, ey - er * 0.7, ex + ew, ey + er * 1.6],
                 200, 340, fill=lc, width=lw)
    # Rosy cheeks
    ck_r = r * 0.18
    draw.ellipse([elx - ck_r * 1.6, ey + er * 1.8, elx + ck_r * 0.8, ey + er * 1.8 + ck_r * 1.5],
                 fill=(250, 160, 155))
    draw.ellipse([erx - ck_r * 0.8, ey + er * 1.8, erx + ck_r * 1.6, ey + er * 1.8 + ck_r * 1.5],
                 fill=(250, 160, 155))
    # Big smile arc
    sr = r * 0.52
    draw.arc([cx - sr, cy + r * 0.08, cx + sr, cy + r * 0.85],
             12, 168, fill=lc, width=lw + 1)


def _face_hype(draw, cx, cy, r, elx, erx, ey, er, lc):
    """🤩 Mắt ngôi sao, miệng há to, má đỏ hype."""
    # Star eyes
    for ex in [elx, erx]:
        _draw_star(draw, ex, ey, er * 1.7, 5, (255, 200, 0))
        _draw_star(draw, ex, ey, er * 0.75, 5, lc)
    # Open mouth
    mw = r * 0.52
    my = cy + r * 0.22
    mh = r * 0.45
    draw.ellipse([cx - mw, my, cx + mw, my + mh * 2],
                 fill=(70, 15, 15), outline=lc, width=2)
    # Teeth bar
    draw.rounded_rectangle([cx - mw + 5, my, cx + mw - 5, my + mh * 0.85],
                            radius=5, fill=(245, 245, 245))
    # Tongue
    tongue_top = my + mh * 0.85
    draw.ellipse([cx - mw * 0.38, tongue_top, cx + mw * 0.38, tongue_top + mh * 0.7],
                 fill=(230, 90, 100))
    # Blush cheeks
    ck_r = r * 0.14
    draw.ellipse([elx - ck_r, ey + er * 2.4, elx + ck_r, ey + er * 2.4 + ck_r * 1.6],
                 fill=(250, 130, 75))
    draw.ellipse([erx - ck_r, ey + er * 2.4, erx + ck_r, ey + er * 2.4 + ck_r * 1.6],
                 fill=(250, 130, 75))


def _face_sarcastic(draw, cx, cy, r, elx, erx, ey, er, lc, face_col):
    """😏 Một mắt lim dim, lông mày nhướn, miệng lệch."""
    lw = max(3, int(r * 0.065))
    # Eyes: half-closed (oval flattened on top)
    for ex in [elx, erx]:
        draw.ellipse([ex - er * 1.35, ey - er * 0.9, ex + er * 1.35, ey + er * 1.2],
                     fill=lc)
        # Eyelid cover (top half) — same as face color
        draw.ellipse([ex - er * 1.35, ey - er * 0.9, ex + er * 1.35, ey + er * 0.1],
                     fill=face_col)
    # Left brow: dramatically raised + arched
    lbrow_y = ey - er * 3.0
    draw.arc([elx - er * 2.0, lbrow_y, elx + er * 2.0, lbrow_y + er * 2.4],
             200, 340, fill=lc, width=lw)
    draw.line([elx - er * 1.7, lbrow_y + er * 0.35, elx + er * 1.7, lbrow_y + er * 0.1],
              fill=lc, width=lw)
    # Right brow: flat / unimpressed
    draw.line([erx - er * 1.7, ey - er * 2.1, erx + er * 1.7, ey - er * 2.1],
              fill=lc, width=lw)
    # Smirk (right side only)
    draw.arc([cx + r * 0.04, cy + r * 0.18, cx + r * 0.62, cy + r * 0.65],
             185, 315, fill=lc, width=lw)
    # Flat left side
    draw.line([cx - r * 0.28, cy + r * 0.43, cx + r * 0.06, cy + r * 0.43],
              fill=lc, width=lw)


def _face_urgent(draw, cx, cy, r, elx, erx, ey, er, lc):
    """😱 Mắt tròn xoe ngạc nhiên, miệng chữ O, mồ hôi rơi."""
    lw = max(2, int(r * 0.055))
    # Wide open eyes
    ew = er * 1.55
    for ex in [elx, erx]:
        draw.ellipse([ex - ew, ey - ew, ex + ew, ey + ew],
                     fill="white", outline=lc, width=lw)
        draw.ellipse([ex - er * 0.9, ey - er * 0.9, ex + er * 0.9, ey + er * 0.9],
                     fill=lc)
        # Highlight
        draw.ellipse([ex - er * 0.35, ey - er * 0.75, ex + er * 0.1, ey - er * 0.35],
                     fill="white")
    # Shocked O mouth
    mo_r = r * 0.24
    my   = cy + r * 0.3
    draw.ellipse([cx - mo_r, my, cx + mo_r, my + mo_r * 2.1],
                 fill=(70, 15, 15), outline=lc, width=lw)
    # Sweat drop
    _draw_sweat_drop(draw, cx + r * 0.64, cy - r * 0.55, r * 0.10, (100, 175, 255))


def _face_fire_mode(draw, cx, cy, r, elx, erx, ey, er, lc):
    """😤 Lông mày V cáu, mắt dữ, cười quyết tâm."""
    lw = max(3, int(r * 0.075))
    # Intense eyes
    ew = er * 1.35
    for ex in [elx, erx]:
        draw.ellipse([ex - ew, ey - ew * 0.9, ex + ew, ey + ew],
                     fill=lc)
        draw.ellipse([ex - er * 0.4, ey - er * 0.4, ex + er * 0.15, ey + er * 0.15],
                     fill="white")
    # Angry V eyebrows (slant inward)
    brow_base = ey - er * 2.0
    draw.line([elx - er * 1.8, brow_base - er * 0.7,
               elx + er * 1.6, brow_base + er * 0.3],
              fill=lc, width=lw + 1)
    draw.line([erx - er * 1.6, brow_base + er * 0.3,
               erx + er * 1.8, brow_base - er * 0.7],
              fill=lc, width=lw + 1)
    # Determined smile (teeth showing)
    sr = r * 0.50
    mt = cy + r * 0.20
    mb = cy + r * 0.75
    draw.arc([cx - sr, mt, cx + sr, mb], 12, 168, fill=lc, width=lw)
    # Teeth divider line
    tw = sr * 0.7
    ty = mt + (mb - mt) * 0.28
    draw.line([cx - tw, ty, cx + tw, ty], fill=lc, width=max(2, lw - 1))
    # Fire emoji on cheek
    draw.ellipse([erx + er * 1.5, ey - er, erx + er * 2.8, ey + er * 2.0],
                 fill=(255, 120, 30))
    draw.ellipse([erx + er * 1.8, ey - er * 1.5, erx + er * 2.5, ey + er * 0.5],
                 fill=(255, 200, 50))


# ── Drawing helpers ───────────────────────────────────────────────────────────

def _draw_sweat_drop(draw, cx: float, cy: float, r: float, color):
    """Giọt mồ hôi hình giọt nước."""
    draw.ellipse([cx - r, cy + r * 0.5, cx + r, cy + r * 2.5], fill=color)
    pts = [(cx, cy - r * 1.2), (cx - r, cy + r * 0.8), (cx + r, cy + r * 0.8)]
    draw.polygon(pts, fill=color)


def _draw_sparkles(draw, W: int, header_h: int, color):
    """Chấm trang trí nhỏ trong header."""
    import random as _r
    _r.seed(99)
    bright = tuple(min(c + 55, 255) for c in color)
    for _ in range(10):
        x  = _r.randint(12, W - 12)
        y  = _r.randint(6, header_h - 70)
        sz = _r.randint(2, 5)
        draw.ellipse([x - sz, y - sz, x + sz, y + sz], fill=bright)


def _draw_star(draw, cx: float, cy: float, r: float, points: int, fill):
    coords = []
    for i in range(points * 2):
        angle  = math.pi / points * i - math.pi / 2
        radius = r if i % 2 == 0 else r * 0.42
        coords.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    if len(coords) >= 3:
        draw.polygon(coords, fill=fill)


def _load_fonts(*sizes: int):
    try:
        from PIL import ImageFont
        candidates = [
            "C:/Windows/Fonts/calibrib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        ]
        path = next((c for c in candidates if os.path.exists(c)), None)
        if path:
            return [ImageFont.truetype(path, s) for s in sizes]
        return [ImageFont.load_default(size=s) for s in sizes]
    except Exception:
        from PIL import ImageFont
        d = ImageFont.load_default()
        return [d] * len(sizes)


def _draw_centered(draw, W: int, y: int, text: str, font, fill):
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw   = bbox[2] - bbox[0]
    except AttributeError:
        tw, _ = draw.textsize(text, font=font)
    draw.text(((W - tw) // 2, y), text, font=font, fill=fill)


def _minimal_png() -> bytes:
    """1×1 PNG fallback khi Pillow chưa cài."""
    return (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
        b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
        b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
        b'\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    )
