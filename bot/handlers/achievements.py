"""
handlers/achievements.py — /achievements, /leaderboard
"""
from __future__ import annotations

import logging

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import CommandHandler, ContextTypes

from sheets import SheetsDB

logger = logging.getLogger(__name__)

BADGE_ICONS = {
    "FIRST_TASK": "🌟",
    "FAST_FINISHER": "⚡",
    "MILESTONE_10": "🥉",
    "MILESTONE_50": "🥇",
    "STREAK_3": "🔥",
    "STREAK_7": "🔥🔥",
}


async def cmd_achievements(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    linked = db.get_telegram_user(str(update.effective_user.id))
    if not linked:
        await update.effective_message.reply_text("❌ Chưa liên kết. Dùng /link &lt;Mã NV&gt;.",
                                         parse_mode=ParseMode.HTML)
        return

    staff_id = linked.get("Mã NV", "")
    staff_display = linked.get("Tên hiển thị", "")
    achievements = db.get_achievements_for_staff(staff_id)
    total = db.get_total_points(staff_id)

    if not achievements:
        await update.effective_message.reply_text(
            f"🏆 <b>Thành tích của {staff_display}</b>\n\n"
            "Bạn chưa có thành tích nào.\n"
            "Hoàn thành nhiệm vụ để nhận thành tích! 💪",
            parse_mode=ParseMode.HTML,
        )
        return

    ach = achievements[0]  # single computed entry
    text = (
        f"🏆 <b>Thành tích của {staff_display}</b>\n"
        f"⭐ <b>{total} XP</b> — {ach.get('Mô tả', '')}\n\n"
        f"{ach.get('Tên thành tích', '')}"
    )
    await update.effective_message.reply_text(text, parse_mode=ParseMode.HTML)


async def cmd_leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    board = db.get_leaderboard(top_n=10)

    if not board:
        await update.effective_message.reply_text("📊 Bảng xếp hạng chưa có dữ liệu.")
        return

    medals = ["🥇", "🥈", "🥉"] + ["🏅"] * 7
    lines = ["🏆 <b>Bảng xếp hạng thành tích</b>\n"]
    for i, entry in enumerate(board):
        medal = medals[i] if i < len(medals) else "🏅"
        level_icon = entry.get("level_icon", "")
        lines.append(f"{medal} {entry['name']} — <b>{entry['points']} XP</b> Lv.{entry.get('level',1)}{level_icon}")

    await update.effective_message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


def register(app) -> None:
    app.add_handler(CommandHandler("achievements", cmd_achievements))
    app.add_handler(CommandHandler("leaderboard", cmd_leaderboard))

