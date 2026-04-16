"""
utils/medal_image.py — Tạo ảnh huy chương chúc mừng lên cấp
"""
from __future__ import annotations

import io
import math


# Màu nền (bg) và màu chủ đạo (fg) theo cấp độ
_LEVEL_CONF: dict[str, dict] = {
    "Đồng":         {"fg": (180, 100, 30),  "bg": (255, 245, 210), "label": "DONG"},
    "Bạc":          {"fg": (110, 118, 135), "bg": (242, 246, 250), "label": "BAC"},
    "Vàng":         {"fg": (210, 130, 0),   "bg": (255, 251, 220), "label": "VANG"},
    "Bạch Kim":     {"fg": (95, 35, 190),   "bg": (242, 238, 255), "label": "BACH KIM"},
    "Kim Cương":    {"fg": (0, 155, 185),   "bg": (228, 252, 255), "label": "KIM CUONG"},
    "Huyền Thoại":  {"fg": (215, 70, 10),   "bg": (255, 243, 228), "label": "HUYEN THOAI"},
}
_DEFAULT = {"fg": (99, 102, 241), "bg": (238, 240, 255), "label": "???"}


def generate_level_up_image(
    user_name: str,
    level_label: str,
    total_points: int,
) -> bytes:
    """
    Generate a congratulatory PNG image for a level-up event.
    Returns raw PNG bytes suitable for bot.send_photo().
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        # Pillow not installed — return a minimal 1×1 transparent PNG
        return b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

    conf = _LEVEL_CONF.get(level_label, _DEFAULT)
    fg   = conf["fg"]
    bg   = conf["bg"]

    W, H = 560, 330
    img  = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)

    # ── Header strip ──────────────────────────────────────────────────────────
    HEADER_H = 120
    for y in range(HEADER_H):
        ratio = y / HEADER_H
        r = int(fg[0] + (bg[0] - fg[0]) * ratio * 0.4)
        g = int(fg[1] + (bg[1] - fg[1]) * ratio * 0.4)
        b = int(fg[2] + (bg[2] - fg[2]) * ratio * 0.4)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # ── White content card ────────────────────────────────────────────────────
    CARD_TOP = 85
    draw.rounded_rectangle([24, CARD_TOP, W - 24, H - 20], radius=20, fill="white")

    # ── Medal circle (overlaps header + card) ─────────────────────────────────
    cx, cy, cr = W // 2, HEADER_H - 5, 46
    # Shadow
    draw.ellipse([cx - cr - 2, cy - cr - 2, cx + cr + 2, cy + cr + 2], fill=(0, 0, 0, 30))
    # Circle
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill="white", outline=fg, width=4)
    # Star inside
    _draw_star(draw, cx, cy, cr - 10, 5, fill=fg)
    # Small star in center
    _draw_star(draw, cx, cy, (cr - 10) * 0.38, 5, fill="white")

    # ── Fonts ─────────────────────────────────────────────────────────────────
    fnt_title, fnt_name, fnt_level, fnt_pts = _load_fonts(36, 22, 18, 15)

    # ── Text ──────────────────────────────────────────────────────────────────
    y_text = CARD_TOP + 72
    _draw_centered(draw, W, y_text, "LEN CAP!", fnt_title, fg)

    y_text += 48
    safe_name = _safe_ascii(user_name[:22])
    _draw_centered(draw, W, y_text, safe_name, fnt_name, (30, 30, 30))

    y_text += 35
    level_text = conf["label"]
    _draw_centered(draw, W, y_text, level_text, fnt_level, (70, 70, 70))

    y_text += 30
    pts_text = f"Tong diem: {total_points}"
    _draw_centered(draw, W, y_text, pts_text, fnt_pts, (140, 140, 140))

    # ── Decorative dots ────────────────────────────────────────────────────────
    for dx, dy in [(40, H - 55), (520, H - 55), (40, H - 40), (520, H - 40)]:
        draw.ellipse([dx - 5, dy - 5, dx + 5, dy + 5], fill=fg)
    for dx, dy in [(60, H - 45), (500, H - 45)]:
        draw.ellipse([dx - 3, dy - 3, dx + 3, dy + 3], fill=(*fg, 160))

    # ── Footer label ──────────────────────────────────────────────────────────
    _draw_centered(draw, W, H - 22, "QLDA Achievement System", fnt_pts, (190, 190, 190))

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return buf.getvalue()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_fonts(*sizes: int):
    """Try system fonts, fall back to PIL default."""
    try:
        from PIL import ImageFont
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/calibrib.ttf",
        ]
        path = None
        for c in candidates:
            import os
            if os.path.exists(c):
                path = c
                break

        if path:
            return [ImageFont.truetype(path, s) for s in sizes]
        # Pillow 10+ supports size=
        return [ImageFont.load_default(size=s) for s in sizes]
    except Exception:
        from PIL import ImageFont
        d = ImageFont.load_default()
        return [d] * len(sizes)


def _draw_centered(draw, W: int, y: int, text: str, font, fill):
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
    except AttributeError:
        tw, _ = draw.textsize(text, font=font)
    draw.text(((W - tw) // 2, y), text, font=font, fill=fill)


def _draw_star(draw, cx: float, cy: float, r: float, points: int, fill):
    coords = []
    for i in range(points * 2):
        angle  = math.pi / points * i - math.pi / 2
        radius = r if i % 2 == 0 else r * 0.42
        coords.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    if len(coords) >= 3:
        draw.polygon(coords, fill=fill)


def _safe_ascii(text: str) -> str:
    """Keep printable ASCII; drop other characters."""
    result = []
    for ch in text:
        if ord(ch) < 128 and ch.isprintable():
            result.append(ch)
        else:
            result.append('?')
    return ''.join(result).strip() or "User"
