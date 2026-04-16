"""
handlers/tasks.py — /mytasks, /donetask, /assign, /addtask (ConversationHandler)
"""
from __future__ import annotations

import logging
from datetime import date

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from config import (
    T_ID, T_NAME, T_STATUS, T_PRIORITY, T_ASSIGNEE,
    T_DUE, T_START, T_COMPLETION, T_DESC,
    TASK_STATUSES, PRIORITIES,
)
from sheets import SheetsDB

logger = logging.getLogger(__name__)

# ConversationHandler states
(
    ADD_PROJECT, ADD_NAME, ADD_ASSIGNEE, ADD_PRIORITY, ADD_DUE, ADD_CONFIRM
) = range(6)

STATUS_EMOJI = {
    "Chưa bắt đầu": "⚪",
    "Đang thực hiện": "🔵",
    "Hoàn thành": "✅",
    "Tạm dừng": "⏸️",
}
PRIORITY_EMOJI = {"Cao": "🔴", "Trung bình": "🟡", "Thấp": "🟢"}


def _require_linked(func):
    """Decorator: reject command if user hasn't linked their account."""
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        db = SheetsDB.get()
        linked = db.get_telegram_user(str(update.effective_user.id))
        if not linked:
            await update.effective_message.reply_text(
                "❌ Bạn chưa liên kết tài khoản.\nDùng /link &lt;Mã NV&gt;.",
                parse_mode=ParseMode.HTML,
            )
            return ConversationHandler.END if hasattr(update, "_in_conversation") else None
        context.user_data["_linked"] = linked
        return await func(update, context)
    return wrapper


# ------------------------------------------------------------------
# /mytasks
# ------------------------------------------------------------------
async def cmd_mytasks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    linked = db.get_telegram_user(str(update.effective_user.id))
    if not linked:
        await update.effective_message.reply_text("❌ Chưa liên kết. Dùng /link &lt;Mã NV&gt;.",
                                         parse_mode=ParseMode.HTML)
        return

    my_name = linked.get("Tên hiển thị", "")
    tasks = db.get_tasks_for_assignee(my_name)

    if not tasks:
        await update.effective_message.reply_text("📭 Bạn chưa có nhiệm vụ nào.")
        return

    active = [t for t in tasks if t.get(T_STATUS) != "Hoàn thành"]
    done = [t for t in tasks if t.get(T_STATUS) == "Hoàn thành"]

    lines = [f"📋 <b>Nhiệm vụ của {my_name}</b>\n"]
    for t in active[:10]:
        emoji = STATUS_EMOJI.get(t.get(T_STATUS, ""), "📌")
        prio = PRIORITY_EMOJI.get(t.get(T_PRIORITY, ""), "")
        due = t.get(T_DUE, "")
        due_str = f" | ⏰ {due}" if due else ""
        lines.append(
            f"{emoji} {prio} <code>{t.get(T_ID, '')}</code> {t.get(T_NAME, '')}{due_str}"
        )

    if len(active) > 10:
        lines.append(f"... và {len(active) - 10} nhiệm vụ chưa hoàn thành khác")

    lines.append(f"\n✅ Đã hoàn thành: {len(done)} nhiệm vụ")
    lines.append("\nDùng /donetask &lt;ID&gt; để đánh dấu hoàn thành.")
    await update.effective_message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


# ------------------------------------------------------------------
# /donetask <id>
# ------------------------------------------------------------------
async def cmd_donetask(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.effective_message.reply_text(
            "❌ Thiếu ID nhiệm vụ.\nCú pháp: <code>/donetask DA001-01</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    task_id = context.args[0].strip().upper()
    db = SheetsDB.get()
    linked = db.get_telegram_user(str(update.effective_user.id))
    if not linked:
        await update.effective_message.reply_text("❌ Chưa liên kết. Dùng /link &lt;Mã NV&gt;.",
                                         parse_mode=ParseMode.HTML)
        return

    result = db.update_task_status(task_id, "Hoàn thành")
    if not result.get("success"):
        await update.effective_message.reply_text(
            f"❌ {result.get('error', 'Lỗi cập nhật')}", parse_mode=ParseMode.HTML
        )
        return

    task = result.get("task", {})
    await update.effective_message.reply_text(
        f"✅ Đã hoàn thành: <b>{task.get(T_NAME, task_id)}</b>\n"
        "🎉 Bạn có thể dùng /achievements để xem thành tích!",
        parse_mode=ParseMode.HTML,
    )


# ------------------------------------------------------------------
# /assign <id> <tên>
# ------------------------------------------------------------------
async def cmd_assign(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if len(context.args) < 2:
        await update.effective_message.reply_text(
            "❌ Cú pháp: <code>/assign DA001-01 Nguyễn Văn A</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    task_id = context.args[0].strip().upper()
    assignee = " ".join(context.args[1:]).strip()
    db = SheetsDB.get()

    # Verify staff exists
    staff_all = db.get_all_staff()
    names = [str(s.get("Họ tên", "")).strip() for s in staff_all]
    if assignee not in names:
        await update.effective_message.reply_text(
            f"❌ Không tìm thấy nhân viên <b>{assignee}</b>.\n"
            "Kiểm tra lại tên (phân biệt hoa/thường).",
            parse_mode=ParseMode.HTML,
        )
        return

    result = db.update_task_field(task_id, T_ASSIGNEE, assignee)
    if not result.get("success"):
        await update.effective_message.reply_text(
            f"❌ {result.get('error', 'Lỗi cập nhật')}", parse_mode=ParseMode.HTML
        )
        return

    await update.effective_message.reply_text(
        f"✅ Đã phân công <code>{task_id}</code> cho <b>{assignee}</b>.",
        parse_mode=ParseMode.HTML,
    )


# ------------------------------------------------------------------
# /addtask — ConversationHandler
# ------------------------------------------------------------------
async def add_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    db = SheetsDB.get()
    linked = db.get_telegram_user(str(update.effective_user.id))
    if not linked:
        await update.effective_message.reply_text("❌ Chưa liên kết. Dùng /link &lt;Mã NV&gt;.",
                                         parse_mode=ParseMode.HTML)
        return ConversationHandler.END

    projects = db.get_all_projects()
    if not projects:
        await update.effective_message.reply_text("❌ Chưa có dự án nào.")
        return ConversationHandler.END

    context.user_data["add_task"] = {}
    buttons = [[InlineKeyboardButton(f"{p['id']} — {p['name']}", callback_data=f"ap:{p['id']}")]
               for p in projects]
    buttons.append([InlineKeyboardButton("❌ Hủy", callback_data="ap:cancel")])
    await update.effective_message.reply_text(
        "📁 Chọn dự án cho nhiệm vụ:",
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return ADD_PROJECT


async def add_got_project(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    data = query.data.split(":", 1)[1]
    if data == "cancel":
        await query.edit_message_text("❌ Đã hủy thêm nhiệm vụ.")
        return ConversationHandler.END

    context.user_data["add_task"]["project_id"] = data
    await query.edit_message_text(f"✏️ Nhập <b>tên nhiệm vụ</b>:", parse_mode=ParseMode.HTML)
    return ADD_NAME


async def add_got_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["add_task"][T_NAME] = update.message.text.strip()
    db = SheetsDB.get()
    staff_all = db.get_all_staff()
    names = [str(s.get("Họ tên", "")).strip() for s in staff_all if s.get("Họ tên")]
    buttons = [[InlineKeyboardButton(n, callback_data=f"aa:{n}")] for n in names[:10]]
    buttons.append([InlineKeyboardButton("⏭️ Bỏ qua", callback_data="aa:skip")])
    await update.effective_message.reply_text(
        "👤 Phân công cho ai?",
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return ADD_ASSIGNEE


async def add_got_assignee(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    data = query.data.split(":", 1)[1]
    context.user_data["add_task"][T_ASSIGNEE] = "" if data == "skip" else data

    buttons = [[InlineKeyboardButton(p, callback_data=f"apr:{p}")] for p in PRIORITIES]
    await query.edit_message_text("⚡ Mức ưu tiên?", reply_markup=InlineKeyboardMarkup(buttons))
    return ADD_PRIORITY


async def add_got_priority(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    data = query.data.split(":", 1)[1]
    context.user_data["add_task"][T_PRIORITY] = data
    await query.edit_message_text("⏰ Nhập hạn chót (YYYY-MM-DD) hoặc gõ <b>skip</b> để bỏ qua:",
                                   parse_mode=ParseMode.HTML)
    return ADD_DUE


async def add_got_due(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    context.user_data["add_task"][T_DUE] = "" if text.lower() == "skip" else text

    td = context.user_data["add_task"]
    summary = (
        f"📋 <b>Xác nhận tạo nhiệm vụ</b>\n\n"
        f"Dự án: <code>{td.get('project_id')}</code>\n"
        f"Tên: <b>{td.get(T_NAME)}</b>\n"
        f"Người thực hiện: {td.get(T_ASSIGNEE) or '(chưa phân công)'}\n"
        f"Ưu tiên: {td.get(T_PRIORITY)}\n"
        f"Hạn chót: {td.get(T_DUE) or '(không có)'}\n"
    )
    buttons = [
        [InlineKeyboardButton("✅ Xác nhận", callback_data="ac:confirm"),
         InlineKeyboardButton("❌ Hủy", callback_data="ac:cancel")],
    ]
    await update.effective_message.reply_text(summary, parse_mode=ParseMode.HTML,
                                     reply_markup=InlineKeyboardMarkup(buttons))
    return ADD_CONFIRM


async def add_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    data = query.data.split(":", 1)[1]
    if data == "cancel":
        await query.edit_message_text("❌ Đã hủy.")
        return ConversationHandler.END

    td = context.user_data["add_task"]
    task_data = {
        T_NAME: td.get(T_NAME, ""),
        T_ASSIGNEE: td.get(T_ASSIGNEE, ""),
        T_PRIORITY: td.get(T_PRIORITY, "Trung bình"),
        T_DUE: td.get(T_DUE, ""),
        T_STATUS: "Chưa bắt đầu",
        T_COMPLETION: 0,
        T_START: date.today().isoformat(),  # track creation date for reports
    }
    db = SheetsDB.get()
    result = db.create_task(td["project_id"], task_data)
    if result.get("success"):
        await query.edit_message_text(
            f"✅ Đã tạo nhiệm vụ <code>{result['taskId']}</code>: <b>{task_data[T_NAME]}</b>",
            parse_mode=ParseMode.HTML,
        )
    else:
        await query.edit_message_text(f"❌ {result.get('error', 'Lỗi tạo nhiệm vụ')}")
    return ConversationHandler.END


async def add_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.effective_message.reply_text("❌ Đã hủy thêm nhiệm vụ.")
    return ConversationHandler.END


def register(app) -> None:
    app.add_handler(CommandHandler("mytasks", cmd_mytasks))
    app.add_handler(CommandHandler("donetask", cmd_donetask))
    app.add_handler(CommandHandler("assign", cmd_assign))

    add_conv = ConversationHandler(
        entry_points=[CommandHandler("addtask", add_start)],
        states={
            ADD_PROJECT: [CallbackQueryHandler(add_got_project, pattern=r"^ap:")],
            ADD_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_got_name)],
            ADD_ASSIGNEE: [CallbackQueryHandler(add_got_assignee, pattern=r"^aa:")],
            ADD_PRIORITY: [CallbackQueryHandler(add_got_priority, pattern=r"^apr:")],
            ADD_DUE: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_got_due)],
            ADD_CONFIRM: [CallbackQueryHandler(add_confirm, pattern=r"^ac:")],
        },
        fallbacks=[CommandHandler("cancel", add_cancel)],
        allow_reentry=True,
    )
    app.add_handler(add_conv)

