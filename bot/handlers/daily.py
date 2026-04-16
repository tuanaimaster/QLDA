"""
handlers/daily.py — /daily (manual) + send_daily_summary (scheduled job)
"""
from __future__ import annotations

import logging
from datetime import date

from telegram import Bot
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import CommandHandler, ContextTypes

from config import T_NAME, T_ID
from sheets import SheetsDB

logger = logging.getLogger(__name__)


def _build_personal_summary(assignee: str, tasks: list[dict], team_total: int) -> str:
    today = date.today().strftime("%d/%m/%Y")
    lines = [
        f"📊 <b>Tổng kết nhiệm vụ ngày {today}</b>\n",
        f"Xin chào <b>{assignee}</b>! 👋",
        f"\n✅ <b>Nhiệm vụ bạn hoàn thành hôm nay ({len(tasks)})</b>:",
    ]
    for t in tasks:
        lines.append(f"  • <code>{t.get(T_ID, '')}</code> {t.get(T_NAME, '')}")

    lines.append(f"\n👥 Toàn đội hoàn thành: <b>{team_total}</b> nhiệm vụ")
    lines.append("\nGiỏi lắm! Tiếp tục phát huy nhé 💪")
    return "\n".join(lines)


async def cmd_daily(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Manual daily summary command — shows summary for the caller."""
    db = SheetsDB.get()
    linked = db.get_telegram_user(str(update.effective_user.id))
    if not linked:
        await update.message.reply_text("❌ Chưa liên kết. Dùng /link &lt;Mã NV&gt;.",
                                         parse_mode=ParseMode.HTML)
        return

    summaries = db.get_daily_summary()
    my_name = linked.get("Tên hiển thị", "")
    team_total = sum(s["count"] for s in summaries)
    my_summary = next((s for s in summaries if s["assignee"] == my_name), None)

    if not my_summary or my_summary["count"] == 0:
        today = date.today().strftime("%d/%m/%Y")
        await update.message.reply_text(
            f"📊 <b>Tổng kết ngày {today}</b>\n\n"
            f"Bạn chưa hoàn thành nhiệm vụ nào hôm nay.\n"
            f"👥 Toàn đội hoàn thành: <b>{team_total}</b> nhiệm vụ",
            parse_mode=ParseMode.HTML,
        )
        return

    msg = _build_personal_summary(my_name, my_summary["tasks"], team_total)
    await update.message.reply_text(msg, parse_mode=ParseMode.HTML)


async def send_daily_summary(bot: Bot) -> None:
    """Scheduled job — sends individual summary to each registered user with tasks done."""
    db = SheetsDB.get()
    summaries = db.get_daily_summary()
    if not summaries:
        logger.info("Daily summary: no completed tasks today")
        return

    team_total = sum(s["count"] for s in summaries)
    sent = 0
    for summary in summaries:
        telegram_id = summary.get("telegram_id", "")
        if not telegram_id:
            logger.debug("No telegram_id for %s, skipping", summary["assignee"])
            continue
        if summary["count"] == 0:
            continue
        try:
            msg = _build_personal_summary(summary["assignee"], summary["tasks"], team_total)
            await bot.send_message(chat_id=telegram_id, text=msg, parse_mode=ParseMode.HTML)
            sent += 1
        except Exception as exc:
            logger.warning("Failed to send daily to %s: %s", summary["assignee"], exc)

    logger.info("Daily summary sent to %d user(s)", sent)


def register(app) -> None:
    app.add_handler(CommandHandler("daily", cmd_daily))
