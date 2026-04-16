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
        await update.message.reply_text("❌ Chưa liên kết. Dùng /link &lt;Mã NV&gt;.",
                                         parse_mode=ParseMode.HTML)
        return

    staff_name = linked.get("Tên hiển thị", "")
    achievements = db.get_achievements_for_staff(staff_name)
    total = db.get_total_points(staff_name)

    if not achievements:
        await update.message.reply_text(
            f"🏆 <b>Thành tích của {staff_name}</b>\n\n"
            "Bạn chưa có thành tích nào.\n"
            "Hoàn thành nhiệm vụ để nhận thành tích! 💪",
            parse_mode=ParseMode.HTML,
        )
        return

    lines = [f"🏆 <b>Thành tích của {staff_name}</b>\n⭐ Tổng điểm: <b>{total}</b>\n"]
    for ach in achievements[-10:]:  # latest 10
        ach_type = str(ach.get("Loại", ""))
        icon = BADGE_ICONS.get(ach_type, "🏅")
        lines.append(
            f"{icon} <b>{ach.get('Tên thành tích', '')}</b> (+{ach.get('Điểm', 0)} điểm)\n"
            f"   {ach.get('Mô tả', '')} — <i>{ach.get('Ngày đạt', '')}</i>"
        )

    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


async def cmd_leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    board = db.get_leaderboard(top_n=10)

    if not board:
        await update.message.reply_text("📊 Bảng xếp hạng chưa có dữ liệu.")
        return

    medals = ["🥇", "🥈", "🥉"] + ["🏅"] * 7
    lines = ["🏆 <b>Bảng xếp hạng thành tích</b>\n"]
    for i, entry in enumerate(board):
        medal = medals[i] if i < len(medals) else "🏅"
        lines.append(f"{medal} {entry['name']} — <b>{entry['points']}</b> điểm")

    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


def register(app) -> None:
    app.add_handler(CommandHandler("achievements", cmd_achievements))
    app.add_handler(CommandHandler("leaderboard", cmd_leaderboard))
