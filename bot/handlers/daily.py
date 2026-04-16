"""
handlers/daily.py — /daily (manual) + send_daily_summary (scheduled job)
"""
from __future__ import annotations

import logging
from datetime import date

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes

from config import T_NAME, T_ID, T_ASSIGNEE, T_PRIORITY
from sheets import SheetsDB

logger = logging.getLogger(__name__)

PRIORITY_EMOJI = {"Cao": "🔴", "Trung bình": "🟡", "Thấp": "🟢"}


def _build_report_text(
    subtitle: str,
    team_stats: dict,
    personal_stats: dict | None = None,
) -> str:
    today = date.today().strftime("%d/%m/%Y")
    lines = [f"📊 <b>Báo cáo hôm nay — {today}</b>"]
    if subtitle:
        lines.append(f"📁 <i>{subtitle}</i>")
    lines.append("")

    # Personal section
    if personal_stats:
        lines.append("👤 <b>Của bạn:</b>")
        lines.append(f"  ➕ Thêm mới hôm nay: <b>{personal_stats['added_today']}</b>")
        lines.append(f"  🔵 Đang thực hiện: <b>{personal_stats['in_progress']}</b>")
        lines.append(f"  ✅ Hoàn thành hôm nay: <b>{personal_stats['completed_today']}</b>")
        lines.append(f"  ⚪ Chưa bắt đầu: <b>{personal_stats['pending']}</b>")
        lines.append(f"  📋 Tổng nhiệm vụ: <b>{personal_stats['total']}</b>")
        lines.append("")

    # Team section
    lines.append("👥 <b>Toàn đội:</b>")
    lines.append(f"  ➕ Thêm mới hôm nay: <b>{team_stats['added_today']}</b>")
    lines.append(f"  🔵 Đang thực hiện: <b>{team_stats['in_progress']}</b>")
    lines.append(f"  ✅ Hoàn thành hôm nay: <b>{team_stats['completed_today']}</b>")
    lines.append(f"  ⚪ Chưa bắt đầu: <b>{team_stats['pending']}</b>")
    lines.append(f"  ⏸️ Tạm dừng: <b>{team_stats['paused']}</b>")
    lines.append(f"  📋 Tổng: <b>{team_stats['total']}</b>")

    # Completed today list
    ct = team_stats.get("completed_today_tasks", [])
    if ct:
        lines.append("\n✅ <b>Hoàn thành hôm nay:</b>")
        for t in ct[:5]:
            ep = PRIORITY_EMOJI.get(t.get(T_PRIORITY, ""), "")
            lines.append(
                f"  {ep} <code>{t.get(T_ID, '')}</code> {t.get(T_NAME, '')} "
                f"— {t.get(T_ASSIGNEE, 'Chưa gán')}"
            )
        if len(ct) > 5:
            lines.append(f"  … và {len(ct) - 5} nhiệm vụ khác")

    # Added today list
    at = team_stats.get("added_today_tasks", [])
    if at:
        lines.append("\n➕ <b>Nhiệm vụ mới hôm nay:</b>")
        for t in at[:5]:
            ep = PRIORITY_EMOJI.get(t.get(T_PRIORITY, ""), "")
            lines.append(
                f"  {ep} <code>{t.get(T_ID, '')}</code> {t.get(T_NAME, '')} "
                f"— {t.get(T_ASSIGNEE, 'Chưa gán')}"
            )
        if len(at) > 5:
            lines.append(f"  … và {len(at) - 5} nhiệm vụ khác")

    return "\n".join(lines)


def _main_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📁 Lọc theo dự án", callback_data="rpt:filter"),
            InlineKeyboardButton("🔄 Làm mới", callback_data="rpt:all"),
        ]
    ])


async def cmd_daily(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    linked = db.get_telegram_user(str(update.effective_user.id))
    if not linked:
        await update.effective_message.reply_text(
            "❌ Chưa liên kết. Dùng /link &lt;Mã NV&gt;.", parse_mode=ParseMode.HTML
        )
        return

    my_name = db.resolve_staff_name(linked)
    team_stats = db.get_report_summary()
    my_stats = db.get_report_summary(assignee_name=my_name)
    text = _build_report_text("", team_stats, personal_stats=my_stats)

    if update.callback_query:
        await update.callback_query.edit_message_text(
            text, parse_mode=ParseMode.HTML, reply_markup=_main_kb()
        )
    else:
        await update.effective_message.reply_text(
            text, parse_mode=ParseMode.HTML, reply_markup=_main_kb()
        )


async def handle_report_callback(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    query = update.callback_query
    await query.answer()

    db = SheetsDB.get()
    linked = db.get_telegram_user(str(update.effective_user.id))
    my_name = db.resolve_staff_name(linked) if linked else ""

    parts = query.data.split(":", 2)
    action = parts[1] if len(parts) > 1 else ""

    if action == "filter":
        # Show project picker
        projects = db.get_all_projects()
        buttons = [[InlineKeyboardButton("🌐 Tất cả dự án", callback_data="rpt:all")]]
        for p in projects:
            buttons.append([
                InlineKeyboardButton(
                    f"📁 {p['id']} — {p['name']}", callback_data=f"rpt:p:{p['id']}"
                )
            ])
        buttons.append([InlineKeyboardButton("❌ Đóng", callback_data="rpt:all")])
        await query.edit_message_reply_markup(InlineKeyboardMarkup(buttons))
        return

    if action == "all":
        team_stats = db.get_report_summary()
        my_stats = db.get_report_summary(assignee_name=my_name) if my_name else None
        text = _build_report_text("", team_stats, personal_stats=my_stats)
        await query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=_main_kb())
        return

    if action == "p" and len(parts) > 2:
        project_id = parts[2]
        projects = db.get_all_projects()
        project = next((p for p in projects if p["id"] == project_id), None)
        pname = project["name"] if project else project_id

        team_stats = db.get_report_summary(project_id=project_id)
        my_stats = (
            db.get_report_summary(assignee_name=my_name, project_id=project_id)
            if my_name else None
        )
        text = _build_report_text(f"{project_id} — {pname}", team_stats, personal_stats=my_stats)
        kb = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("⬅️ Tất cả", callback_data="rpt:all"),
                InlineKeyboardButton("📁 Đổi dự án", callback_data="rpt:filter"),
            ],
            [InlineKeyboardButton("🔄 Làm mới", callback_data=f"rpt:p:{project_id}")],
        ])
        await query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=kb)
        return


async def send_daily_summary(bot: Bot) -> None:
    """Scheduled job — sends individual summary to each registered user."""
    db = SheetsDB.get()
    tg_users = db.get_all_telegram_users()
    if not tg_users:
        logger.info("Daily summary: no telegram users registered")
        return

    team_stats = db.get_report_summary()
    sent = 0
    for tg_user in tg_users:
        telegram_id = str(tg_user.get("Telegram ID", "")).strip()
        name = db.resolve_staff_name(tg_user)
        if not telegram_id or not name:
            continue
        try:
            my_stats = db.get_report_summary(assignee_name=name)
            text = _build_report_text("", team_stats, personal_stats=my_stats)
            await bot.send_message(chat_id=telegram_id, text=text, parse_mode=ParseMode.HTML)
            sent += 1
        except Exception as exc:
            logger.warning("Failed to send daily to %s: %s", name, exc)

    logger.info("Daily summary sent to %d user(s)", sent)


def register(app) -> None:
    app.add_handler(CommandHandler("daily", cmd_daily))
    app.add_handler(CallbackQueryHandler(handle_report_callback, pattern=r"^rpt:"))


