"""
handlers/projects.py — /projects, /project <id>
"""
from __future__ import annotations

import logging

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import CommandHandler, ContextTypes

from config import T_STATUS, T_ASSIGNEE, COL_STAFF_ROLE, COL_TG_STAFF, COL_STAFF_ID
from sheets import SheetsDB

logger = logging.getLogger(__name__)

STATUS_EMOJI = {
    "Đang thực hiện": "🔵",
    "Hoàn thành": "✅",
    "Tạm dừng": "⏸️",
    "Chưa bắt đầu": "⚪",
}


def _get_user_staff(db: SheetsDB, telegram_id: str) -> tuple[str, str]:
    """Return (staff_name, role) for the linked Telegram user, or ('', '') if not linked."""
    tg_row = db.get_telegram_user(telegram_id)
    if not tg_row:
        return "", ""
    staff_id = str(tg_row.get(COL_TG_STAFF, "")).strip()
    if staff_id:
        staff = db.get_staff_by_id(staff_id)
        if staff:
            return str(staff.get("Họ tên", "")).strip(), str(staff.get(COL_STAFF_ROLE, "")).strip()
    name = db.resolve_staff_name(tg_row)
    return name, ""


async def cmd_projects(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    tg_id = str(update.effective_user.id)
    staff_name, role = _get_user_staff(db, tg_id)

    if not staff_name:
        await update.effective_message.reply_text(
            "❌ Bạn chưa liên kết tài khoản.\nDùng /link &lt;Mã NV&gt;.",
            parse_mode=ParseMode.HTML,
        )
        return

    projects = db.get_projects_for_user(staff_name, role)
    if not projects:
        await update.effective_message.reply_text("📭 Bạn không có dự án nào.")
        return

    lines = ["📁 <b>Danh sách dự án</b>\n"]
    for p in projects:
        emoji = STATUS_EMOJI.get(p["status"], "📌")
        task_count = len(p.get("tasks", []))
        done_count = sum(1 for t in p.get("tasks", []) if t.get(T_STATUS) == "Hoàn thành")
        lines.append(
            f"{emoji} <b>{p['id']}</b> — {p['name']}\n"
            f"   👤 {p['manager']} | ✅ {done_count}/{task_count} nhiệm vụ\n"
        )

    lines.append("\nDùng /project &lt;ID&gt; để xem chi tiết.")
    await update.effective_message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


async def cmd_project(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.effective_message.reply_text(
            "❌ Thiếu ID dự án.\nCú pháp: <code>/project DA001</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    project_id = context.args[0].strip().upper()
    db = SheetsDB.get()
    tg_id = str(update.effective_user.id)
    staff_name, role = _get_user_staff(db, tg_id)

    # Filter projects by permission first
    if staff_name:
        projects = db.get_projects_for_user(staff_name, role)
    else:
        projects = db.get_all_projects()

    project = next((p for p in projects if p["id"] == project_id), None)

    if not project:
        await update.effective_message.reply_text(
            f"❌ Không tìm thấy dự án <b>{project_id}</b> hoặc bạn không có quyền xem.",
            parse_mode=ParseMode.HTML,
        )
        return

    tasks = project.get("tasks", [])
    by_status: dict[str, list] = {}
    for t in tasks:
        s = t.get(T_STATUS, "Chưa bắt đầu")
        by_status.setdefault(s, []).append(t)

    lines = [
        f"📁 <b>{project['name']}</b> (<code>{project['id']}</code>)\n"
        f"👤 Quản lý: {project['manager']}\n"
        f"📊 Trạng thái: {project['status']}\n"
        f"📋 Tổng nhiệm vụ: {len(tasks)}\n",
    ]

    for status, status_tasks in by_status.items():
        emoji = STATUS_EMOJI.get(status, "📌")
        lines.append(f"\n{emoji} <b>{status}</b> ({len(status_tasks)})")
        for t in status_tasks[:5]:
            assignee = t.get(T_ASSIGNEE, "—")
            lines.append(f"  • <code>{t.get('Mã nhiệm vụ', '')}</code> {t.get('Tên nhiệm vụ', '')} [{assignee}]")
        if len(status_tasks) > 5:
            lines.append(f"  ... và {len(status_tasks) - 5} nhiệm vụ khác")

    await update.effective_message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


def register(app) -> None:
    app.add_handler(CommandHandler("projects", cmd_projects))
    app.add_handler(CommandHandler("project", cmd_project))

