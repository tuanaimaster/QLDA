"""
utils/mascot_image.py — Tự sinh ảnh thẻ thông báo mascot bằng Pillow.

Không cần CDN, không cần upload thủ công.
Mỗi (event, emotion) → ảnh PNG bytes gửi thẳng lên Telegram.

Cache trong memory theo key (event_value, emotion_value) để tránh render lại
trong cùng một session bot.
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
        "header": (56, 142, 60),
        "header2": (102, 187, 106),
        "accent": (27, 94, 32),
        "bg_card": (232, 245, 233),
        "symbol": "star",
    },
    "hype": {
        "header": (245, 124, 0),
        "header2": (255, 183, 77),
        "accent": (230, 81, 0),
        "bg_card": (255, 243, 224),
        "symbol": "bolt",
    },
    "sarcastic": {
        "header": (123, 31, 162),
        "header2": (171, 71, 188),
        "accent": (74, 20, 140),
        "bg_card": (243, 229, 245),
        "symbol": "circle",
    },
    "urgent": {
        "header": (198, 40, 40),
        "header2": (229, 57, 53),
        "accent": (127, 0, 0),
        "bg_card": (255, 235, 238),
        "symbol": "bang",
    },
    "fire_mode": {
        "header": (230, 74, 25),
        "header2": (255, 112, 67),
        "accent": (191, 54, 12),
        "bg_card": (251, 233, 231),
        "symbol": "star",
    },
}
_DEFAULT_PALETTE = _EMOTION_PALETTE["happy"]

# ── Event label mapping ───────────────────────────────────────────────────────

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

# ── In-memory cache ───────────────────────────────────────────────────────────

_cache: dict[tuple[str, str], bytes] = {}


def generate_mascot_card(event_value: str, emotion_value: str) -> bytes:
    """
    Trả về PNG bytes cho (event, emotion).
    Cached theo key — chỉ render 1 lần mỗi session.
    """
    key = (event_value, emotion_value)
    if key in _cache:
        return _cache[key]

    data = _render(event_value, emotion_value)
    _cache[key] = data
    return data


def generate_mascot_card_typed(event: "MascotEvent", emotion: "MascotEmotion") -> bytes:
    """Convenience wrapper cho MascotEvent / MascotEmotion enums."""
    return generate_mascot_card(event.value, emotion.value)


# ── Core renderer ─────────────────────────────────────────────────────────────

def _render(event_value: str, emotion_value: str) -> bytes:
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return _minimal_png()

    pal   = _EMOTION_PALETTE.get(emotion_value, _DEFAULT_PALETTE)
    label = _EVENT_LABEL.get(event_value, event_value.upper().replace("_", " "))

    W, H      = 560, 290
    HEADER_H  = 115
    CARD_TOP  = 80

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

    # ── White card ────────────────────────────────────────────────────────────
    draw.rounded_rectangle(
        [20, CARD_TOP, W - 20, H - 16],
        radius=18,
        fill="white",
    )

    # ── Icon circle (overlaps header/card boundary) ───────────────────────────
    cx, cy, cr = W // 2, HEADER_H - 10, 42
    # shadow
    draw.ellipse([cx - cr - 3, cy - cr - 3, cx + cr + 3, cy + cr + 3],
                 fill=(180, 180, 180))
    # white circle
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr],
                 fill="white", outline=pal["accent"], width=3)
    # drawn symbol inside circle
    sym = pal.get("symbol", "star")
    _draw_symbol(draw, cx, cy, cr - 10, sym, pal["accent"])

    # ── Event label (well below circle) ───────────────────────────────────────
    fnt_title, fnt_sub, fnt_footer = _load_fonts(21, 13, 12)
    text_top = cy + cr + 18          # always below circle bottom
    _draw_centered(draw, W, text_top, label, fnt_title, pal["accent"])

    # ── Emotion badge ─────────────────────────────────────────────────────────
    badge_text = emotion_value.upper().replace("_", " ")
    badge_y    = text_top + 34
    try:
        bbox = draw.textbbox((0, 0), badge_text, font=fnt_sub)
        bw   = bbox[2] - bbox[0] + 22
    except AttributeError:
        bw, _ = draw.textsize(badge_text, font=fnt_sub)
        bw   += 22
    bx = (W - bw) // 2
    draw.rounded_rectangle([bx, badge_y, bx + bw, badge_y + 22],
                            radius=11, fill=pal["header"])
    _draw_centered(draw, W, badge_y + 4, badge_text, fnt_sub, "white")

    # ── Decorative corner dots ────────────────────────────────────────────────
    for dx, dy in [(38, H - 40), (W - 38, H - 40)]:
        draw.ellipse([dx - 5, dy - 5, dx + 5, dy + 5], fill=pal["header"])
        draw.ellipse([dx - 3, dy + 12, dx + 3, dy + 18], fill=pal["header2"])

    # ── Footer ────────────────────────────────────────────────────────────────
    _draw_centered(draw, W, H - 22, "QLDA Notification System", fnt_footer, (190, 190, 190))

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return buf.getvalue()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_fonts(*sizes: int):
    try:
        from PIL import ImageFont
        candidates = [
            "C:/Windows/Fonts/calibrib.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        path = next((c for c in candidates if os.path.exists(c)), None)
        if path:
            return [ImageFont.truetype(path, s) for s in sizes]
        return [ImageFont.load_default(size=s) for s in sizes]
    except Exception:
        from PIL import ImageFont
        d = ImageFont.load_default()
        return [d] * len(sizes)


def _draw_symbol(draw, cx: float, cy: float, r: float, sym: str, fill):
    """Vẽ biểu tượng bên trong vòng tròn icon."""
    if sym == "star":
        _draw_star(draw, cx, cy, r, 5, fill)
    elif sym == "bolt":
        # Tia sét đơn giản
        pts = [
            (cx + r * 0.15, cy - r),
            (cx - r * 0.2, cy - r * 0.05),
            (cx + r * 0.25, cy - r * 0.05),
            (cx - r * 0.15, cy + r),
            (cx + r * 0.2, cy + r * 0.1),
            (cx - r * 0.2, cy + r * 0.1),
        ]
        draw.polygon(pts, fill=fill)
    elif sym == "bang":
        # Dấu chấm than: hình chữ nhật + chấm tròn
        bar_w = max(int(r * 0.35), 4)
        bar_h = int(r * 1.1)
        draw.rounded_rectangle(
            [cx - bar_w, cy - r, cx + bar_w, cy - r + bar_h],
            radius=bar_w, fill=fill,
        )
        dot_r = int(r * 0.28)
        dot_y = cy + int(r * 0.45)
        draw.ellipse([cx - dot_r, dot_y - dot_r, cx + dot_r, dot_y + dot_r], fill=fill)
    else:
        # circle
        draw.ellipse([cx - r * 0.55, cy - r * 0.55,
                      cx + r * 0.55, cy + r * 0.55], fill=fill)


def _draw_star(draw, cx: float, cy: float, r: float, points: int, fill):
    coords = []
    for i in range(points * 2):
        angle  = math.pi / points * i - math.pi / 2
        radius = r if i % 2 == 0 else r * 0.42
        coords.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    if len(coords) >= 3:
        draw.polygon(coords, fill=fill)


def _draw_centered(draw, W: int, y: int, text: str, font, fill):
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw   = bbox[2] - bbox[0]
    except AttributeError:
        tw, _ = draw.textsize(text, font=font)
    draw.text(((W - tw) // 2, y), text, font=font, fill=fill)


def _minimal_png() -> bytes:
    """1×1 transparent PNG fallback khi Pillow chưa cài."""
    return (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
        b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
        b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01'
        b'\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    )
