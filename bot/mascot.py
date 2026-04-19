"""
mascot.py — Mascot Notification Engine v2.0
Emotion-aware, behavior-driven notification system cho QLDA Telegram Bot.

Architecture:
  BehaviorContext → EmotionEngine.resolve()
    → MascotRegistry.get_url(event, emotion)   [random ảnh trong pool]
    → build_*(…, emotion)                       [dynamic personality text]
    → AntiSpamGuard.try_acquire(chat_id)
    → bot.send_photo / bot.send_message
"""

from __future__ import annotations

import json
import logging
import os
import random
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Config từ env var ─────────────────────────────────────────────────────────
_CDN = os.getenv("MASCOT_CDN", "https://cdn.example.com/qlda/mascots")
_CONFIG_PATH = os.getenv(
    "MASCOT_CONFIG",
    str(Path(__file__).parent / "mascot_config.json"),
)
_ANTISPAM_COOLDOWN = int(os.getenv("MASCOT_ANTISPAM_SEC", "10"))


# ══════════════════════════════════════════════════════════════════════════════
# 1. ENUMS
# ══════════════════════════════════════════════════════════════════════════════

class MascotEvent(str, Enum):
    TASK_CREATED     = "created"
    TASK_ASSIGNED    = "assigned"
    TASK_COMPLETED   = "completed"
    DEADLINE_WARNING = "deadline_warning"
    LEVEL_UP         = "level_up"
    STREAK_ACTIVE    = "streak_active"
    REWARD_XGOLD     = "reward_xgold"
    BADGE_UNLOCKED   = "badge_unlocked"
    DAILY_SUMMARY    = "daily_summary"


class MascotEmotion(str, Enum):
    HAPPY     = "happy"      # Bình thường, tích cực
    HYPE      = "hype"       # Phấn khích, làm nhanh, streak cao
    SARCASTIC = "sarcastic"  # Cà khịa nhẹ, task dễ mà làm lâu, trễ deadline
    URGENT    = "urgent"     # Deadline sắp đến, khẩn cấp
    FIRE_MODE = "fire_mode"  # Streak 30+, combo lớn, bùng cháy


# ══════════════════════════════════════════════════════════════════════════════
# 2. BEHAVIOR CONTEXT — dữ liệu hành vi user để engine phân tích
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class BehaviorContext:
    streak_days: int = 0
    tasks_done_today: int = 0
    days_until_deadline: Optional[int] = None  # None = không liên quan
    completed_early: bool = False
    completed_late: bool = False
    xp_earned: int = 0
    total_xp: int = 0


# ══════════════════════════════════════════════════════════════════════════════
# 3. EMOTION ENGINE — "Bộ não" quyết định tính cách mascot
# ══════════════════════════════════════════════════════════════════════════════

def resolve_emotion(event: MascotEvent, ctx: BehaviorContext) -> MascotEmotion:
    """
    Xác định emotion phù hợp từ event + hành vi user.
    Logic này chạy server-side, không cần config ngoài.
    """
    if event == MascotEvent.TASK_COMPLETED:
        if ctx.completed_late:
            return MascotEmotion.SARCASTIC
        if ctx.completed_early and ctx.tasks_done_today >= 3:
            return MascotEmotion.HYPE
        if ctx.streak_days >= 7:
            return MascotEmotion.FIRE_MODE
        return MascotEmotion.HAPPY

    if event in (MascotEvent.TASK_ASSIGNED, MascotEvent.TASK_CREATED):
        if ctx.tasks_done_today >= 5:
            return MascotEmotion.HYPE  # Đang trong combo streak
        return MascotEmotion.HAPPY

    if event == MascotEvent.STREAK_ACTIVE:
        if ctx.streak_days >= 30:
            return MascotEmotion.FIRE_MODE
        if ctx.streak_days >= 7:
            return MascotEmotion.HYPE
        return MascotEmotion.HAPPY

    if event == MascotEvent.DEADLINE_WARNING:
        if ctx.days_until_deadline is not None and ctx.days_until_deadline <= 1:
            return MascotEmotion.URGENT
        return MascotEmotion.SARCASTIC  # 3 ngày mà chưa làm → cà khịa

    if event == MascotEvent.LEVEL_UP:
        return MascotEmotion.HYPE

    if event == MascotEvent.REWARD_XGOLD:
        return MascotEmotion.FIRE_MODE if ctx.xp_earned > 60 else MascotEmotion.HAPPY

    if event == MascotEvent.BADGE_UNLOCKED:
        return MascotEmotion.HYPE

    return MascotEmotion.HAPPY


# ══════════════════════════════════════════════════════════════════════════════
# 4. MASCOT REGISTRY — Map Event + Emotion → URL ảnh
# ══════════════════════════════════════════════════════════════════════════════

# Type alias: { "event_value": { "emotion_value": ["url1", "url2"] } }
_MascotMap = dict[str, dict[str, list[str]]]


def _default_map() -> _MascotMap:
    """
    Hardcoded fallback. Thay thế URL bằng CDN thật hoặc dùng mascot_config.json.
    Mỗi emotion có 1–3 URL để random → tránh nhàm.
    """
    return {
        MascotEvent.TASK_CREATED: {
            MascotEmotion.HAPPY: [f"{_CDN}/tasky_new.png"],
        },
        MascotEvent.TASK_ASSIGNED: {
            MascotEmotion.HAPPY: [f"{_CDN}/tasky_wave.png",  f"{_CDN}/tasky_mail.png"],
            MascotEmotion.HYPE:  [f"{_CDN}/tasky_rocket.png"],
        },
        MascotEvent.TASK_COMPLETED: {
            MascotEmotion.HAPPY:     [f"{_CDN}/tasky_smile.png",   f"{_CDN}/tasky_happy.png"],
            MascotEmotion.HYPE:      [f"{_CDN}/tasky_party.png",   f"{_CDN}/tasky_jump.png"],
            MascotEmotion.SARCASTIC: [f"{_CDN}/tasky_sus.png",     f"{_CDN}/tasky_eyeroll.png"],
            MascotEmotion.FIRE_MODE: [f"{_CDN}/tasky_fire.png",    f"{_CDN}/tasky_burst.png"],
        },
        MascotEvent.DEADLINE_WARNING: {
            MascotEmotion.SARCASTIC: [f"{_CDN}/clocky_stare.png"],
            MascotEmotion.URGENT:    [f"{_CDN}/clocky_alarm.png",  f"{_CDN}/clocky_sweat.png"],
        },
        MascotEvent.LEVEL_UP: {
            MascotEmotion.HYPE:      [f"{_CDN}/levelup_burst.png", f"{_CDN}/levelup_crown.png"],
            MascotEmotion.FIRE_MODE: [f"{_CDN}/levelup_explosion.png"],
        },
        MascotEvent.STREAK_ACTIVE: {
            MascotEmotion.HAPPY:     [f"{_CDN}/streaky_glow.png"],
            MascotEmotion.HYPE:      [f"{_CDN}/streaky_fire_v1.png", f"{_CDN}/streaky_fire_v2.png"],
            MascotEmotion.FIRE_MODE: [f"{_CDN}/streaky_inferno.png"],
        },
        MascotEvent.REWARD_XGOLD: {
            MascotEmotion.HAPPY:     [f"{_CDN}/goldy_reward.png"],
            MascotEmotion.FIRE_MODE: [f"{_CDN}/goldy_rain.png",    f"{_CDN}/goldy_swim.png"],
        },
        MascotEvent.BADGE_UNLOCKED: {
            MascotEmotion.HAPPY: [f"{_CDN}/badgy_shine.png"],
            MascotEmotion.HYPE:  [f"{_CDN}/badgy_flex.png"],
        },
        MascotEvent.DAILY_SUMMARY: {
            MascotEmotion.HAPPY:     [f"{_CDN}/reporty_morning.png"],
            MascotEmotion.SARCASTIC: [f"{_CDN}/reporty_yawn.png"],
        },
    }


class MascotRegistry:
    """
    Quản lý mapping Event+Emotion → danh sách URL ảnh.
    Hỗ trợ external JSON config + hot-reload không cần restart bot.
    """

    def __init__(self) -> None:
        self._map: _MascotMap = _default_map()
        self._load_external()

    def get_url(self, event: MascotEvent, emotion: MascotEmotion) -> str | None:
        """
        Lấy ngẫu nhiên 1 URL cho event+emotion.
        Fallback: HAPPY → first available → None (gửi text thay vì ảnh).
        """
        em_map = self._map.get(event) or self._map.get(event.value)
        if not em_map:
            return None

        urls = (
            em_map.get(emotion)
            or em_map.get(emotion.value)
            or em_map.get(MascotEmotion.HAPPY)
            or em_map.get(MascotEmotion.HAPPY.value)
            or next(iter(em_map.values()), None)
        )
        if not urls:
            return None
        # Lọc placeholder URLs chưa được cấu hình thật
        real_urls = [u for u in urls if u and "cdn.example.com" not in u]
        if not real_urls:
            return None
        return random.choice(real_urls)

    def reload(self) -> None:
        """Hot-reload: áp lại default rồi merge external config."""
        self._map = _default_map()
        self._load_external()
        logger.info("MascotRegistry: config reloaded from %s", _CONFIG_PATH)

    def _load_external(self) -> None:
        path = Path(_CONFIG_PATH)
        if not path.exists():
            return
        try:
            with path.open(encoding="utf-8") as f:
                ext: _MascotMap = json.load(f)
            for ev_key, emotions in ext.items():
                if ev_key.startswith("_") or not isinstance(emotions, dict):
                    continue  # bỏ qua comment/metadata keys
                if ev_key not in self._map:
                    self._map[ev_key] = {}
                self._map[ev_key].update(emotions)
            logger.info("MascotRegistry: loaded %d event overrides from %s", len(ext), path)
        except Exception as exc:
            logger.warning("MascotRegistry: cannot load %s — %s (using default)", path, exc)


# Module-level singleton
registry = MascotRegistry()


# ══════════════════════════════════════════════════════════════════════════════
# 5. ANTI-SPAM GUARD
# ══════════════════════════════════════════════════════════════════════════════

class AntiSpamGuard:
    """
    Rate-limit per chatId: tối thiểu COOLDOWN giây giữa 2 lần gửi.
    Thread-safe đủ dùng cho single-process async bot.
    """

    def __init__(self, cooldown_sec: int = _ANTISPAM_COOLDOWN) -> None:
        self._last: dict[str, float] = {}
        self._cooldown = cooldown_sec

    def try_acquire(self, chat_id: str) -> bool:
        """True = được phép gửi. False = đang trong cooldown."""
        now = time.monotonic()
        last = self._last.get(chat_id, 0.0)
        if now - last < self._cooldown:
            logger.debug(
                "AntiSpam: skip %s — %.0fs remaining",
                chat_id, self._cooldown - (now - last),
            )
            return False
        self._last[chat_id] = now
        return True

    def bypass(self, chat_id: str) -> None:
        """Reset cooldown — dùng cho URGENT (deadline hôm nay, overdue)."""
        self._last.pop(chat_id, None)


# Module-level singleton
spam_guard = AntiSpamGuard()


# ══════════════════════════════════════════════════════════════════════════════
# 6. DYNAMIC MESSAGE BUILDER — tính cách thay đổi theo emotion
# ══════════════════════════════════════════════════════════════════════════════

def _esc(text: str) -> str:
    """Escape HTML để tránh lỗi Telegram parse_mode."""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _pick(emotion: MascotEmotion, options: dict[MascotEmotion, list[str]]) -> str:
    """Chọn ngẫu nhiên 1 string theo emotion, fallback về HAPPY."""
    pool = (
        options.get(emotion)
        or options.get(MascotEmotion.HAPPY)
        or next(iter(options.values()))
    )
    return random.choice(pool)


def build_task_assigned(task_name: str, task_id: str, project_name: str,
                        creator: str, emotion: MascotEmotion) -> str:
    opening = _pick(emotion, {
        MascotEmotion.HAPPY: [
            "📬 <b>BẠN CÓ NHIỆM VỤ MỚI ĐƯỢC GIAO!</b>",
            "📋 <b>NHIỆM VỤ MỚI ĐÃ ĐẾN!</b>",
        ],
        MascotEmotion.HYPE: [
            "🔥 <b>THÊM NHIỆM VỤ! CHUẨN BỊ CHIẾN THÔI!</b>",
        ],
    })
    tip = _pick(emotion, {
        MascotEmotion.HAPPY: [
            "💡 Hoàn thành sớm nhận <b>×1.5 XP bonus</b>! 🚀",
            "📈 Cập nhật tiến độ thường xuyên để team đồng bộ nhé!",
        ],
        MascotEmotion.HYPE: [
            "⚡ Đang trong streak — cày nhiệm vụ này nhanh lên để giữ combo XP!",
        ],
    })
    from_line = f"\n👤 Người giao: <b>{_esc(creator)}</b>" if creator else ""
    return (
        f"{opening}\n\n"
        f"📋 Nhiệm vụ: <b>{_esc(task_name)}</b>\n"
        f"🆔 Mã: <code>{_esc(task_id)}</code>\n"
        f"📁 Dự án: {_esc(project_name)}"
        f"{from_line}\n\n"
        f"{tip}\n\n"
        f"Dùng /mytasks để xem tất cả nhiệm vụ."
    )


def build_task_created(task_name: str, task_id: str, project_name: str,
                       creator: str, emotion: MascotEmotion) -> str:
    from_line = f"\n👤 Người tạo: <b>{_esc(creator)}</b>" if creator else ""
    return (
        f"📋 <b>NHIỆM VỤ MỚI ĐÃ ĐƯỢC TẠO!</b>\n\n"
        f"📋 <b>{_esc(task_name)}</b>\n"
        f"🆔 Mã: <code>{_esc(task_id)}</code>\n"
        f"📁 Dự án: {_esc(project_name)}"
        f"{from_line}\n\n"
        f"⭐ <b>+10 XP</b> được ghi nhận!\n\n"
        f"Dùng /mytasks để xem nhiệm vụ."
    )


def build_task_completed(task_name: str, task_id: str, project_name: str,
                         confirmed_by: str, emotion: MascotEmotion) -> str:
    opening = _pick(emotion, {
        MascotEmotion.HAPPY: [
            "✅ <b>NHIỆM VỤ HOÀN THÀNH!</b>",
            "✅ <b>XONG RỒI!</b>",
        ],
        MascotEmotion.HYPE: [
            "🎉 <b>QUÁ ĐỈNH!!!</b>",
            "🔥 <b>BOOM! XONG RỒI ĐÓ!</b>",
        ],
        MascotEmotion.SARCASTIC: [
            "😏 <b>Ồ, cuối cùng cũng xong à?</b>",
            "🙄 <b>Mất bao lâu vậy bạn ơi...</b>",
        ],
        MascotEmotion.FIRE_MODE: [
            "💥 <b>KHÔNG THỂ DỪNG ĐƯỢC!</b>",
        ],
    })
    closing = _pick(emotion, {
        MascotEmotion.HAPPY: [
            "Tiếp tục phấn đấu nhé! 💪",
            "Sắp lên cấp rồi, cố lên! ⭐",
        ],
        MascotEmotion.HYPE: [
            "Cày tiếp đi! Hôm nay quá máu! 🔥",
            "Đội mình cần người như bạn! 👑",
        ],
        MascotEmotion.SARCASTIC: [
            "Lần sau nhanh hơn nha 😄",
            "Không trễ là được rồi 😌",
        ],
        MascotEmotion.FIRE_MODE: [
            "BẠN ĐANG BÙNG CHÁY! 🔥🔥🔥 KHÔNG DỪNG LẠI!",
        ],
    })
    by_line = f"\n👤 Xác nhận bởi: <b>{_esc(confirmed_by)}</b>" if confirmed_by else ""
    return (
        f"{opening}\n\n"
        f"📋 <i>{_esc(task_name)}</i>\n"
        f"🆔 <code>{_esc(task_id)}</code>\n"
        f"📁 {_esc(project_name)}"
        f"{by_line}\n\n"
        f"🌟 <b>+XP điểm thưởng được cộng vào tài khoản!</b>\n\n"
        f"{closing}"
    )


def build_deadline_warning(user_name: str, task_name: str, task_id: str,
                           project_name: str, days_remaining: int,
                           emotion: MascotEmotion) -> str:
    if days_remaining == 0:
        urgency      = "🔴 <b>HÔM NAY LÀ HẠN CHÓT!</b>"
        deadline_str = "⚡ Nhiệm vụ đến hạn <b>HÔM NAY</b> — hoàn thành ngay!"
    elif days_remaining == 1:
        urgency      = "🟠 <b>CÒN 1 NGÀY!</b>"
        deadline_str = "⏰ Còn <b>1 ngày</b> đến hạn chót — đừng để trễ!"
    else:
        urgency      = f"🟡 <b>CÒN {days_remaining} NGÀY</b>"
        deadline_str = f"📅 Còn <b>{days_remaining} ngày</b> đến hạn chót."

    taunt = _pick(emotion, {
        MascotEmotion.SARCASTIC: [
            "😏 Biết vậy làm sớm hơn không? Còn kịp đó...",
            "🙄 Deadline không đến trước đâu nhé...",
        ],
        MascotEmotion.URGENT: [
            "🚨 KHẨN CẤP! Không xong sẽ mất streak + bị phạt XP!",
            "⚠️ Làm NGAY hoặc mất tất cả streak bonus!",
        ],
        MascotEmotion.HAPPY: [
            "💡 Hoàn thành đúng hạn nhận <b>×1.2 XP bonus</b>!",
        ],
    })
    return (
        f"⚠️ <b>NHẮC NHỞ DEADLINE!</b> {urgency}\n\n"
        f"👤 <b>{_esc(user_name)}</b>\n"
        f"📋 <i>{_esc(task_name)}</i>\n"
        f"🆔 <code>{_esc(task_id)}</code>\n"
        f"📁 {_esc(project_name)}\n\n"
        f"{deadline_str}\n\n"
        f"{taunt}"
    )


def build_level_up(user_name: str, level_label: str, level_emoji: str,
                   total_points: int, emotion: MascotEmotion) -> str:
    hype = _pick(emotion, {
        MascotEmotion.HYPE: [
            "💥 <b>KHÔNG THỂ TIN ĐƯỢC!</b>",
            "🎆 <b>BẠN ĐÃ BẬT CẤP!!!</b>",
        ],
        MascotEmotion.FIRE_MODE: [
            "🔥 <b>POWER UP! SỨC MẠNH MỚI! 🔥</b>",
        ],
        MascotEmotion.HAPPY: [
            "🎊 Bạn đã đạt cấp độ mới!",
        ],
    })
    return (
        f"🎉 <b>CHÚC MỪNG LÊN CẤP!</b>\n\n"
        f"{hype}\n"
        f"✨ <b>{_esc(user_name)}</b> vừa đạt:\n"
        f"{level_emoji} <b>{_esc(level_label)}</b>\n\n"
        f"⭐ Tổng XP: <b>{total_points:,}</b>\n\n"
        f"Hành trình chưa kết thúc... 🚀"
    )


def build_streak(user_name: str, streak_days: int, emotion: MascotEmotion) -> str:
    bonus = (
        "+50% XP bonus 🔥🔥🔥" if streak_days >= 30 else
        "+20% XP bonus 🔥🔥"   if streak_days >= 7  else
        "+10% XP bonus 🔥"     if streak_days >= 3  else
        "Đang tích lũy..."
    )
    cheer = _pick(emotion, {
        MascotEmotion.HAPPY:     ["Cứ tiếp tục nhé! 😊"],
        MascotEmotion.HYPE:      ["UNSTOPPABLE! Bạn không thể bị dừng lại! ⚡"],
        MascotEmotion.FIRE_MODE: ["🔥 BẠN ĐANG BÙNG CHÁY! KHÔNG AI THEO KỊP! 🔥"],
    })
    return (
        f"🔥 <b>STREAK × {streak_days} NGÀY LIÊN TIẾP!</b>\n\n"
        f"⚡ <b>{_esc(user_name)}</b>\n"
        f"  Streak bonus hiện tại: <b>{bonus}</b>\n\n"
        f"{cheer}"
    )
