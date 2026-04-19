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
    T_ID,
    T_NAME,
    T_STATUS,
    T_PRIORITY,
    T_ASSIGNEE,
    T_DUE,
    T_START,
    T_COMPLETION,
    T_DESC,
    TASK_STATUSES,
    PRIORITIES,
    COL_STAFF_ROLE,
    COL_TG_STAFF,
)
from sheets import SheetsDB

logger = logging.getLogger(__name__)

# ConversationHandler states
(
    ADD_PROJECT,
    ADD_SUBTASK_CHOICE,
    ADD_PARENT_TASK,
    ADD_NAME,
    ADD_DUE,
    ADD_ASSIGNEE,
    ADD_CONFIRM,
) = range(7)

STATUS_EMOJI = {
    "Chưa bắt đầu": "⚪",
    "Đang thực hiện": "🔵",
    "Hoàn thành": "✅",
    "Tạm dừng": "⏸️",
}
PRIORITY_EMOJI = {"Cao": "🔴", "Trung bình": "🟡", "Thấp": "🟢"}

# Kanban column order (active columns — Hoàn thành is hidden in count only)
KANBAN_COLUMNS = ["Chưa bắt đầu", "Đang thực hiện", "Tạm dừng"]

# Status transitions: what button moves a task from this status
# Value: (target_status_index, button_label)
_TRANSITIONS: dict[str, list[tuple[int, str]]] = {
    "Chưa bắt đầu": [(1, "▶️ Bắt đầu")],
    "Đang thực hiện": [(2, "✅ Xong"), (3, "⏸️ Dừng")],
    "Tạm dừng": [(1, "▶️ Tiếp tục")],
}


def _build_kanban(my_name: str, tasks: list[dict]) -> tuple[str, InlineKeyboardMarkup]:
    """Return (message_text, keyboard) for Kanban board view."""
    active = [t for t in tasks if (t.get(T_STATUS) or "").strip() != "Hoàn thành"]
    done_count = len(tasks) - len(active)

    # Group by status
    groups: dict[str, list] = {s: [] for s in KANBAN_COLUMNS}
    for t in active:
        st = (t.get(T_STATUS) or "").strip() or "Chưa bắt đầu"
        groups.setdefault(st, []).append(t)

    lines = [f"📋 <b>KANBAN</b> — <b>{my_name}</b>  ✅ {done_count} xong\n"]
    keyboard_rows: list[list[InlineKeyboardButton]] = []

    for col_status in KANBAN_COLUMNS:
        col_tasks = groups.get(col_status, [])
        if not col_tasks:
            continue
        col_emoji = STATUS_EMOJI.get(col_status, "📌")
        lines.append(f"{'━' * 16}")
        lines.append(f"{col_emoji} <b>{col_status}</b>  · {len(col_tasks)} nhiệm vụ")

        shown = col_tasks[:5]
        for t in shown:
            tid = t.get(T_ID, "")
            tname = t.get(T_NAME, "")
            prio = PRIORITY_EMOJI.get((t.get(T_PRIORITY) or "").strip(), "")
            due = t.get(T_DUE, "")
            due_str = f" ⏰{due}" if due else ""
            proj = t.get("_projectName", "")
            proj_str = f"  <i>({proj[:14]})</i>" if proj else ""
            lines.append(f"  {prio} <code>{tid}</code> {tname[:32]}{due_str}{proj_str}")

            # Inline buttons for this task
            transitions = _TRANSITIONS.get(col_status, [])
            if transitions:
                row_btns = []
                for target_idx, btn_label in transitions:
                    target_status = TASK_STATUSES[target_idx]
                    row_btns.append(
                        InlineKeyboardButton(
                            f"{btn_label}: {tname[:18]}",
                            callback_data=f"tmove:{tid}:{target_idx}",
                        )
                    )
                keyboard_rows.append(row_btns)

        if len(col_tasks) > 5:
            lines.append(f"  <i>...và {len(col_tasks) - 5} nhiệm vụ khác</i>")

    if not active:
        lines.append("\n🎉 <b>Tất cả nhiệm vụ đã hoàn thành!</b> Xuất sắc!")

    keyboard_rows.append(
        [InlineKeyboardButton("🔄 Làm mới", callback_data="tmove:__refresh__:0")]
    )
    return "\n".join(lines), InlineKeyboardMarkup(keyboard_rows)


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
            return (
                ConversationHandler.END if hasattr(update, "_in_conversation") else None
            )
        context.user_data["_linked"] = linked
        return await func(update, context)

    return wrapper


# ------------------------------------------------------------------
# /mytasks — Kanban board view
# ------------------------------------------------------------------
async def cmd_mytasks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    linked = db.get_telegram_user(str(update.effective_user.id))
    if not linked:
        await update.effective_message.reply_text(
            "❌ Chưa liên kết. Dùng /link để chọn tên.",
            parse_mode=ParseMode.HTML,
        )
        return

    my_name = db.resolve_staff_name(linked)
    tasks = db.get_tasks_for_assignee(my_name)

    if not tasks:
        await update.effective_message.reply_text(
            f"📭 <b>{my_name}</b> chưa có nhiệm vụ nào.\n\n"
            "Dùng ➕ <b>Thêm nhiệm vụ</b> từ /menu để tạo nhiệm vụ đầu tiên.",
            parse_mode=ParseMode.HTML,
        )
        return

    text, keyboard = _build_kanban(my_name, tasks)
    await update.effective_message.reply_text(
        text, parse_mode=ParseMode.HTML, reply_markup=keyboard
    )


async def handle_task_move_callback(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    """Handle tmove:<task_id>:<status_idx> and legacy tdone:<task_id> inline buttons."""
    query = update.callback_query
    raw = query.data  # e.g. 'tmove:DA001-01:2'  or  'tdone:DA001-01'

    # Parse legacy tdone: format
    if raw.startswith("tdone:"):
        task_id = raw.split(":", 1)[1]
        if task_id == "__refresh__":
            await query.answer()
            await cmd_mytasks(update, context)
            return
        status_idx = 2  # Hoàn thành
    else:
        parts = raw.split(":")
        task_id = parts[1] if len(parts) > 1 else ""
        if task_id == "__refresh__":
            await query.answer()
            await cmd_mytasks(update, context)
            return
        try:
            status_idx = int(parts[2]) if len(parts) > 2 else 2
        except ValueError:
            status_idx = 2

    new_status = (
        TASK_STATUSES[status_idx]
        if 0 <= status_idx < len(TASK_STATUSES)
        else "Hoàn thành"
    )
    await query.answer()

    db = SheetsDB.get()
    result = db.update_task_status(task_id.upper(), new_status)
    if not result.get("success"):
        await query.answer(f"❌ {result.get('error', 'Lỗi')}", show_alert=True)
        return

    task = result.get("task", {})
    tname = task.get(T_NAME, task_id)
    status_emoji = STATUS_EMOJI.get(new_status, "📌")

    # Build status-change header
    if new_status == "Hoàn thành":
        header = f"✅ <b>Hoàn thành:</b> {tname} 🎉\n⭐ Điểm thưởng sẽ được cộng vào tài khoản!"
    elif new_status == "Đang thực hiện":
        header = f"▶️ <b>Bắt đầu:</b> {tname}  — Chúc bạn làm việc hiệu quả!"
    elif new_status == "Tạm dừng":
        header = f"⏸️ <b>Tạm dừng:</b> {tname}"
    else:
        header = f"{status_emoji} <b>{new_status}:</b> {tname}"

    # Rebuild kanban after update
    linked = db.get_telegram_user(str(update.effective_user.id))
    my_name = db.resolve_staff_name(linked) if linked else ""
    tasks = db.get_tasks_for_assignee(my_name)
    kanban_text, kanban_kb = _build_kanban(my_name, tasks)
    full_text = f"{header}\n\n{kanban_text}"

    try:
        await query.edit_message_text(
            full_text, parse_mode=ParseMode.HTML, reply_markup=kanban_kb
        )
    except Exception:
        pass


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
        await update.effective_message.reply_text(
            "❌ Chưa liên kết. Dùng /link &lt;Mã NV&gt;.", parse_mode=ParseMode.HTML
        )
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
        await update.effective_message.reply_text(
            "❌ Chưa liên kết. Dùng /link &lt;Mã NV&gt;.", parse_mode=ParseMode.HTML
        )
        return ConversationHandler.END

    # Resolve staff name + role for permission filtering
    staff_id = str(linked.get(COL_TG_STAFF, "")).strip()
    staff_name, role = "", ""
    if staff_id:
        staff = db.get_staff_by_id(staff_id)
        if staff:
            staff_name = str(staff.get("Họ tên", "")).strip()
            role = str(staff.get(COL_STAFF_ROLE, "")).strip()
    if not staff_name:
        staff_name = db.resolve_staff_name(linked)

    projects = (
        db.get_projects_for_user(staff_name, role)
        if staff_name
        else db.get_all_projects()
    )
    if not projects:
        await update.effective_message.reply_text("❌ Bạn không có dự án nào.")
        return ConversationHandler.END

    context.user_data["add_task"] = {}
    context.user_data["staff_name"] = (
        staff_name  # dùng trong add_confirm để so sánh creator
    )
    buttons = [
        [
            InlineKeyboardButton(
                f"{p['id']} — {p['name']}", callback_data=f"ap:{p['id']}"
            )
        ]
        for p in projects
    ]
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
    logger.info("add_got_project called: data=%s user=%s", data, update.effective_user.id)
    if data == "cancel":
        await query.edit_message_text("❌ Đã hủy thêm nhiệm vụ.")
        return ConversationHandler.END

    try:
        # Ensure add_task dict exists (safety guard for state loss)
        if "add_task" not in context.user_data or not isinstance(context.user_data.get("add_task"), dict):
            context.user_data["add_task"] = {}
        context.user_data["add_task"]["project_id"] = data

        db = SheetsDB.get()
        all_projects = db.get_all_projects()
        project = next((p for p in all_projects if p["id"] == data), None)
        existing_tasks = project["tasks"] if project else []
        active_tasks = [
            t for t in existing_tasks
            if (t.get(T_STATUS) or "").strip() != "Hoàn thành"
        ]
        context.user_data["add_task"]["_existing_tasks"] = active_tasks
    except Exception as exc:
        logger.error("add_got_project error: %s", exc, exc_info=True)
        await query.edit_message_text(f"❌ Lỗi tải dữ liệu: {exc}\nThử lại với /addtask")
        return ConversationHandler.END
        active_tasks = [
            t for t in existing_tasks
            if (t.get(T_STATUS) or "").strip() != "Hoàn thành"
        ]
        context.user_data["add_task"]["_existing_tasks"] = active_tasks
    except Exception as exc:
        logger.error("add_got_project error: %s", exc, exc_info=True)
        await query.edit_message_text(f"❌ Lỗi tải dữ liệu: {exc}\nThử lại với /addtask")
        return ConversationHandler.END

    buttons = [
        [InlineKeyboardButton("✅ Có — Chọn nhiệm vụ cha", callback_data="asc:yes")],
        [InlineKeyboardButton("❌ Không — Tạo nhiệm vụ chính", callback_data="asc:no")],
        [InlineKeyboardButton("✖️ Hủy", callback_data="asc:cancel")],
    ]
    await query.edit_message_text(
        f"📁 Dự án: <b>{data}</b>\n\n"
        "Bạn muốn tạo <b>nhiệm vụ con</b> (phụ thuộc vào một nhiệm vụ khác) "
        "hay <b>nhiệm vụ chính</b>?",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return ADD_SUBTASK_CHOICE


async def add_got_subtask_choice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    choice = query.data.split(":", 1)[1]

    if choice == "cancel":
        await query.edit_message_text("❌ Đã hủy.")
        return ConversationHandler.END

    existing_tasks = context.user_data["add_task"].get("_existing_tasks", [])

    if choice == "no" or not existing_tasks:
        if choice == "yes" and not existing_tasks:
            await query.edit_message_text(
                "ℹ️ Dự án chưa có nhiệm vụ nào để chọn làm cha.\n"
                "✔️ Sẽ tạo nhiệm vụ chính.\n\n"
                "✏️ Nhập <b>tên nhiệm vụ</b>:",
                parse_mode=ParseMode.HTML,
            )
        else:
            await query.edit_message_text(
                "✏️ Nhập <b>tên nhiệm vụ</b>:",
                parse_mode=ParseMode.HTML,
            )
        context.user_data["add_task"]["parent_task_id"] = None
        return ADD_NAME

    buttons = []
    for t in existing_tasks[:15]:
        tid = t.get(T_ID, "")
        tname = t.get(T_NAME, "")
        st_emoji = STATUS_EMOJI.get((t.get(T_STATUS) or "").strip(), "📌")
        prio_emoji = PRIORITY_EMOJI.get((t.get(T_PRIORITY) or "").strip(), "")
        label = f"{st_emoji}{prio_emoji} {tid} — {tname[:30]}"
        buttons.append([InlineKeyboardButton(label, callback_data=f"apt:{tid}")])
    buttons.append([InlineKeyboardButton("✖️ Hủy", callback_data="apt:cancel")])

    await query.edit_message_text(
        "📋 Chọn <b>nhiệm vụ cha</b>:",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return ADD_PARENT_TASK


async def add_got_parent_task(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    data = query.data.split(":", 1)[1]

    if data == "cancel":
        await query.edit_message_text("❌ Đã hủy.")
        return ConversationHandler.END

    context.user_data["add_task"]["parent_task_id"] = data
    await query.edit_message_text(
        f"🔗 Nhiệm vụ cha: <code>{data}</code>\n\n"
        "✏️ Nhập <b>tên nhiệm vụ con</b>:",
        parse_mode=ParseMode.HTML,
    )
    return ADD_NAME


async def add_got_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["add_task"][T_NAME] = update.message.text.strip()
    await update.effective_message.reply_text(
        "⏰ Nhập <b>hạn chốt</b> (dd/mm/yyyy) hoặc gõ <b>skip</b> để bỏ qua:",
        parse_mode=ParseMode.HTML,
    )
    return ADD_DUE


async def add_got_due(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    import re as _re
    text = update.message.text.strip()
    due_iso = ""
    if text.lower() not in ("skip", "bỏ qua", "-"):
        m = _re.match(r"^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$", text)
        if m:
            dd, mm, yyyy = m.group(1), m.group(2), m.group(3)
            due_iso = f"{yyyy}-{mm.zfill(2)}-{dd.zfill(2)}"
        elif _re.match(r"^\d{4}-\d{2}-\d{2}$", text):
            due_iso = text
        else:
            await update.effective_message.reply_text(
                "❌ Ngày không hợp lệ. Nhập lại (dd/mm/yyyy) hoặc gõ <b>skip</b>:",
                parse_mode=ParseMode.HTML,
            )
            return ADD_DUE
    context.user_data["add_task"][T_DUE] = due_iso

    db = SheetsDB.get()
    my_name = context.user_data.get("staff_name", "")
    staff_all = db.get_all_staff()
    names = [str(s.get("Họ tên", "")).strip() for s in staff_all if s.get("Họ tên")]

    buttons = []
    if my_name:
        buttons.append([
            InlineKeyboardButton(f"👤 {my_name} (bạn - mặc định)", callback_data=f"aa:{my_name}")
        ])
    for n in names:
        if n != my_name:
            buttons.append([InlineKeyboardButton(n, callback_data=f"aa:{n}")])
    buttons = buttons[:11]
    buttons.append([InlineKeyboardButton("⏭️ Bỏ qua (chưa phân công)", callback_data="aa:skip")])

    await update.effective_message.reply_text(
        "👥 Giao nhiệm vụ này cho ai?\n<i>(mặc định: chính bạn)</i>",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return ADD_ASSIGNEE


async def add_got_assignee(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    raw = query.data.split(":", 1)[1]
    context.user_data["add_task"][T_ASSIGNEE] = "" if raw == "skip" else raw

    td = context.user_data["add_task"]
    parent_id = td.get("parent_task_id")
    parent_line = f"\n🔗 Nhiệm vụ cha: <code>{parent_id}</code>" if parent_id else ""
    due_display = ""
    if td.get(T_DUE):
        parts = td[T_DUE].split("-")
        due_display = f"{parts[2]}/{parts[1]}/{parts[0]}" if len(parts) == 3 else td[T_DUE]
    assignee_display = td.get(T_ASSIGNEE) or context.user_data.get("staff_name") or "(chưa phân công)"

    summary = (
        f"📋 <b>Xác nhận tạo nhiệm vụ</b>\n\n"
        f"📁 Dự án: <code>{td.get('project_id')}</code>{parent_line}\n"
        f"📝 Tên: <b>{td.get(T_NAME)}</b>\n"
        f"👤 Giao cho: <b>{assignee_display}</b>\n"
        f"⏰ Hạn chốt: {due_display or '(không có)'}\n"
    )
    buttons = [
        [
            InlineKeyboardButton("✅ Xác nhận tạo", callback_data="ac:confirm"),
            InlineKeyboardButton("❌ Hủy", callback_data="ac:cancel"),
        ],
    ]
    await query.edit_message_text(
        summary, parse_mode=ParseMode.HTML, reply_markup=InlineKeyboardMarkup(buttons)
    )
    return ADD_CONFIRM


async def add_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    data = query.data.split(":", 1)[1]
    if data == "cancel":
        await query.edit_message_text("❌ Đã hủy.")
        return ConversationHandler.END

    td = context.user_data["add_task"]
    creator_name = context.user_data.get("staff_name", "")
    # Mặc định assignee = chính creator nếu skip
    assignee = td.get(T_ASSIGNEE, "").strip() or creator_name

    task_data = {
        T_NAME: td.get(T_NAME, ""),
        T_ASSIGNEE: assignee,
        T_PRIORITY: "Trung bình",
        T_DUE: td.get(T_DUE, ""),
        T_STATUS: "Chưa bắt đầu",
        T_COMPLETION: 0,
        T_START: date.today().isoformat(),
    }
    parent_id = td.get("parent_task_id")
    if parent_id:
        task_data["parent_task_id"] = parent_id

    db = SheetsDB.get()
    result = db.create_task(td["project_id"], task_data)

    if not result.get("success"):
        await query.edit_message_text(f"❌ {result.get('error', 'Lỗi tạo nhiệm vụ')}")
        return ConversationHandler.END

    task_id = result["taskId"]

    # Thông báo cho assignee nếu khác creator
    if assignee and assignee != creator_name:
        await _notify_task_assignee(
            context.bot, db, assignee, task_id, task_data[T_NAME],
            td.get("project_id", ""), creator_name,
        )

    # Tính XP và chúc mừng creator
    xp_info = ""
    try:
        if creator_name:
            stats = db._compute_xp_stats(creator_name)
            xp_info = (
                f"\n\n🎉 <b>CHÚC MỪNG!</b> Bạn vừa tạo nhiệm vụ mới!\n"
                f"🌟 <b>+10 XP</b> được cộng vào tài khoản\n"
                f"⭐ Tổng điểm: <b>{stats['xp']} XP</b>\n"
                f"{stats['level_icon']} Cấp độ: <b>Lv.{stats['level']} — {stats['level_name']}</b>\n"
                f"✅ Hoàn thành: {stats['completed']} nhiệm vụ"
            )
    except Exception as _exc:
        logger.debug("XP compute error after create_task: %s", _exc)

    parent_line = f"\n🔗 Nhiệm vụ cha: <code>{parent_id}</code>" if parent_id else ""
    due_display = ""
    if td.get(T_DUE):
        parts = td[T_DUE].split("-")
        due_display = f"{parts[2]}/{parts[1]}/{parts[0]}" if len(parts) == 3 else td[T_DUE]

    await query.edit_message_text(
        f"✅ Đã tạo nhiệm vụ <code>{task_id}</code>!\n"
        f"📝 <b>{task_data[T_NAME]}</b>{parent_line}\n"
        f"👤 Giao cho: <b>{assignee}</b>\n"
        f"⏰ Hạn chốt: {due_display or '(không có)'}"
        f"{xp_info}",
        parse_mode=ParseMode.HTML,
    )
    return ConversationHandler.END


async def add_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.effective_message.reply_text("❌ Đã hủy thêm nhiệm vụ.")
    return ConversationHandler.END


_MOTIVATIONAL_TIPS = [
    "💡 Gợi ý: Chia nhỏ nhiệm vụ thành các bước hành động cụ thể để dễ hoàn thành hơn!",
    "🔥 Mẹo: Dùng kỹ thuật Pomodoro — làm việc 25 phút rồi nghỉ 5 phút để giữ năng suất.",
    "🚀 Gợi ý: Xác định kết quả đầu ra rõ ràng trước khi bắt đầu để tránh phải làm lại.",
    "🎯 Mẹo: Hoàn thành phần khó nhất trước — sau đó mọi thứ sẽ trở nên dễ dàng hơn!",
    "📈 Gợi ý: Cập nhật tiến độ thường xuyên để nhóm luôn đồng bộ với nhau.",
    "🤝 Gợi ý: Nếu gặp khó khăn, đừng ngại nhờ đồng nghiệp hỗ trợ — teamwork là sức mạnh!",
    "⭐ Mẹo: Ghi lại kết quả ngay khi hoàn thành để không bỏ sót bất kỳ thành tích nào.",
    "💪 Mẹo: Mỗi nhiệm vụ hoàn thành là một bước tiến trên bảng xếp hạng — hãy phấn đấu lên top!",
    "🧠 Gợi ý: Đọc lại mô tả nhiệm vụ kỹ trước khi bắt đầu để hiểu đúng yêu cầu.",
    "🌟 Gợi ý: Đặt deadline cá nhân sớm hơn deadline thật 1–2 ngày để luôn đúng hẹn.",
]


async def _notify_task_assignee(
    bot,
    db,
    assignee_name: str,
    task_id: str,
    task_name: str,
    project_id: str,
    creator_name: str,
) -> None:
    """Gửi thông báo Telegram cho người được giao nhiệm vụ (mascot engine)."""
    try:
        tg_id = str(db.get_telegram_user_by_name(assignee_name) or "").strip()
        if not tg_id:
            return

        # Lookup project name
        project_name = project_id
        try:
            for proj in db.get_all_projects():
                if proj.get("id") == project_id:
                    project_name = proj.get("name", project_id)
                    break
        except Exception:
            pass

        from mascot import (
            BehaviorContext, MascotEvent, build_task_assigned,
            registry, resolve_emotion,
        )
        from utils.mascot_image import generate_mascot_card_typed
        ctx = BehaviorContext()
        emotion = resolve_emotion(MascotEvent.TASK_ASSIGNED, ctx)
        caption = build_task_assigned(task_name, task_id, project_name, creator_name, emotion)
        mascot_url = registry.get_url(MascotEvent.TASK_ASSIGNED, emotion)
        photo_source = mascot_url or generate_mascot_card_typed(MascotEvent.TASK_ASSIGNED, emotion)

        try:
            await bot.send_photo(chat_id=tg_id, photo=photo_source,
                                 caption=caption, parse_mode="HTML")
            logger.info("Task notif (photo) sent → %s [%s]", assignee_name, emotion.value)
        except Exception as photo_exc:
            logger.warning("Photo send failed, falling back to text: %s", photo_exc)
            await bot.send_message(chat_id=tg_id, text=caption, parse_mode="HTML")
            logger.info("Task notif (text) sent → %s [%s]", assignee_name, emotion.value)
    except Exception as exc:
        logger.error("_notify_task_assignee error: %s", exc)


def register(app) -> None:
    app.add_handler(CommandHandler("mytasks", cmd_mytasks))
    app.add_handler(CommandHandler("donetask", cmd_donetask))
    app.add_handler(CommandHandler("assign", cmd_assign))
    # Handle both new tmove: and legacy tdone: callback patterns
    app.add_handler(CallbackQueryHandler(handle_task_move_callback, pattern=r"^tmove:"))
    app.add_handler(CallbackQueryHandler(handle_task_move_callback, pattern=r"^tdone:"))

    add_conv = ConversationHandler(
        entry_points=[
            CommandHandler("addtask", add_start),
            MessageHandler(filters.Text(["➕ Thêm NV"]), add_start),
        ],
        states={
            ADD_PROJECT:        [CallbackQueryHandler(add_got_project,        pattern=r"^ap:")],
            ADD_SUBTASK_CHOICE: [CallbackQueryHandler(add_got_subtask_choice, pattern=r"^asc:")],
            ADD_PARENT_TASK:    [CallbackQueryHandler(add_got_parent_task,    pattern=r"^apt:")],
            ADD_NAME:           [MessageHandler(filters.TEXT & ~filters.COMMAND, add_got_name)],
            ADD_DUE:            [MessageHandler(filters.TEXT & ~filters.COMMAND, add_got_due)],
            ADD_ASSIGNEE:       [CallbackQueryHandler(add_got_assignee,       pattern=r"^aa:")],
            ADD_CONFIRM:        [CallbackQueryHandler(add_confirm,            pattern=r"^ac:")],
        },
        fallbacks=[CommandHandler("cancel", add_cancel)],
        allow_reentry=True,
    )
    app.add_handler(add_conv)
