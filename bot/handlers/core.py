"""
handlers/core.py — /start, /help, /link, /menu
"""
from __future__ import annotations

import logging

from telegram import (
    InlineKeyboardButton, InlineKeyboardMarkup,
    KeyboardButton, ReplyKeyboardMarkup,
    Update,
)
from telegram.constants import ParseMode
from telegram.ext import (
    CallbackQueryHandler, CommandHandler, ContextTypes,
    MessageHandler, filters,
)

from config import COL_STAFF_ID, COL_STAFF_NAME
from sheets import SheetsDB

logger = logging.getLogger(__name__)

# ── Persistent bottom keyboard (always visible, no typing needed) ──────────────
PERSISTENT_KEYBOARD = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton("📋 Nhiệm vụ"),   KeyboardButton("📁 Dự án")],
        [KeyboardButton("➕ Thêm NV"),    KeyboardButton("📊 Báo cáo")],
        [KeyboardButton("🏆 Thành tích"), KeyboardButton("🥇 Xếp hạng")],
        [KeyboardButton("👤 Tài khoản"),  KeyboardButton("❓ Trợ giúp")],
    ],
    resize_keyboard=True,
    is_persistent=True,
)

# Map button text → handler action (must match keyboard labels exactly)
_BUTTON_ROUTES: dict[str, str] = {
    "📋 Nhiệm vụ":   "mytasks",
    "📁 Dự án":      "projects",
    "➕ Thêm NV":    "addtask",
    "📊 Báo cáo":    "daily",
    "🏆 Thành tích": "achievements",
    "🥇 Xếp hạng":  "leaderboard",
    "👤 Tài khoản":  "me",
    "❓ Trợ giúp":   "help",
}

# ── Inline-keyboard menu definition ────────────────────────────────────────────
MAIN_MENU_KEYBOARD = InlineKeyboardMarkup([
    [
        InlineKeyboardButton("📋 Nhiệm vụ của tôi", callback_data="menu:mytasks"),
        InlineKeyboardButton("📁 Dự án",            callback_data="menu:projects"),
    ],
    [
        InlineKeyboardButton("➕ Thêm nhiệm vụ",    callback_data="menu:addtask"),
        InlineKeyboardButton("📊 Báo cáo hôm nay",  callback_data="menu:daily"),
    ],
    [
        InlineKeyboardButton("🏆 Thành tích",        callback_data="menu:achievements"),
        InlineKeyboardButton("🥇 Xếp hạng",          callback_data="menu:leaderboard"),
    ],
    [
        InlineKeyboardButton("👤 Tài khoản của tôi", callback_data="menu:me"),
        InlineKeyboardButton("❓ Trợ giúp",           callback_data="menu:help"),
    ],
])


async def send_main_menu(update: Update, text: str) -> None:
    """Helper: gửi tin nhắn kèm inline menu + giữ persistent keyboard."""
    if update.callback_query:
        await update.callback_query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=MAIN_MENU_KEYBOARD)
    else:
        await update.message.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=MAIN_MENU_KEYBOARD)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    user = update.effective_user
    existing = db.get_telegram_user(str(user.id))

    if existing:
        staff_name = existing.get("Tên hiển thị", "")
        await update.message.reply_text(
            f"👋 Chào mừng trở lại, <b>{staff_name}</b>!\n\n"
            "Các nút bên dưới luôn sẵn sàng — chỉ cần bấm 👇",
            parse_mode=ParseMode.HTML,
            reply_markup=PERSISTENT_KEYBOARD,
        )
    else:
        await update.message.reply_text(
            "👋 Xin chào! Đây là bot quản lý dự án <b>QLDA</b>.\n\n"
            "Để bắt đầu, chọn tên bạn trong danh sách nhân viên — bấm nút bên dưới:",
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔗 Chọn tên để liên kết", callback_data="lnk:__list__")
            ]]),
        )


async def cmd_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Hiển thị menu chính + kích hoạt lại persistent keyboard nếu cần."""
    db = SheetsDB.get()
    tg_user = update.effective_user
    existing = db.get_telegram_user(str(tg_user.id))
    if existing:
        name = existing.get("Tên hiển thị", "bạn")
        if update.message:
            # Called as /menu command — resend persistent keyboard + inline menu
            await update.message.reply_text(
                f"🏠 <b>Menu chính</b> — Xin chào <b>{name}</b>!\nCác nút bên dưới luôn sẵn sàng 👇",
                parse_mode=ParseMode.HTML,
                reply_markup=PERSISTENT_KEYBOARD,
            )
        else:
            await send_main_menu(update, f"🏠 <b>Menu chính</b> — Xin chào <b>{name}</b>!\nChọn chức năng:")
    else:
        msg = update.message or (update.callback_query.message if update.callback_query else None)
        if msg:
            await msg.reply_text(
                "❌ Bạn chưa liên kết tài khoản.\nDùng <code>/link &lt;Mã NV&gt;</code> trước.",
                parse_mode=ParseMode.HTML,
            )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "📋 <b>Danh sách lệnh QLDA Bot</b>\n\n"
        "<b>🔗 Tài khoản</b>\n"
        "/link &lt;Mã NV&gt; — Liên kết tài khoản\n"
        "/me — Thông tin tài khoản của tôi\n\n"
        "<b>📁 Dự án</b>\n"
        "/projects — Danh sách dự án\n"
        "/project &lt;ID&gt; — Chi tiết dự án\n\n"
        "<b>✅ Nhiệm vụ</b>\n"
        "/mytasks — Nhiệm vụ của tôi\n"
        "/addtask — Thêm nhiệm vụ mới\n"
        "/donetask &lt;ID&gt; — Đánh dấu hoàn thành\n"
        "/assign &lt;ID&gt; &lt;Tên NV&gt; — Phân công nhiệm vụ\n\n"
        "<b>🏆 Thành tích</b>\n"
        "/achievements — Thành tích của tôi\n"
        "/leaderboard — Bảng xếp hạng\n\n"
        "<b>📊 Báo cáo</b>\n"
        "/daily — Tổng kết nhiệm vụ hôm nay\n\n"
        "Dùng /menu để mở menu nhanh."
    )
    await update.message.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=MAIN_MENU_KEYBOARD)


async def cmd_link(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    # No args — show staff list as inline keyboard
    if not context.args:
        staff_all = db.get_all_staff()
        if not staff_all:
            await update.message.reply_text("❌ Chưa có dữ liệu nhân viên.")
            return
        buttons = []
        row = []
        for s in staff_all:
            sid  = str(s.get(COL_STAFF_ID,   s.get("Mã NV", ""))).strip()
            name = str(s.get(COL_STAFF_NAME,  s.get("Họ tên", ""))).strip()
            if not sid:
                continue
            label = f"{name} ({sid})" if name else sid
            row.append(InlineKeyboardButton(label, callback_data=f"lnk:{sid}"))
            if len(row) == 1:           # 1 button per row (names can be long)
                buttons.append(row)
                row = []
        if row:
            buttons.append(row)
        buttons.append([InlineKeyboardButton("❌ Hủy", callback_data="lnk:cancel")])
        await update.message.reply_text(
            "👤 Chọn tên bạn trong danh sách nhân viên:",
            reply_markup=InlineKeyboardMarkup(buttons),
        )
        return

    staff_id = context.args[0].strip().upper()
    staff = db.get_staff_by_id(staff_id)
    if not staff:
        await update.message.reply_text(
            f"❌ Không tìm thấy nhân viên có mã <b>{staff_id}</b>.",
            parse_mode=ParseMode.HTML,
        )
        return

    tg_user = update.effective_user
    display_name = staff.get(COL_STAFF_NAME, tg_user.full_name)
    result = db.register_telegram_user(str(tg_user.id), staff_id, display_name)

    if result.get("updated"):
        await update.message.reply_text(
            f"🔄 Đã cập nhật liên kết: <b>{display_name}</b> ({staff_id})",
            parse_mode=ParseMode.HTML,
        )
    else:
        await update.message.reply_text(
            f"✅ Liên kết thành công!\n👤 <b>{display_name}</b> ({staff_id})\n\n"
            "Keyboard bên dưới luôn sẵn sàng — chỉ cần bấm 👇",
            parse_mode=ParseMode.HTML,
            reply_markup=PERSISTENT_KEYBOARD,
        )


async def _do_link_by_id(update: Update, staff_id: str) -> None:
    """Link current Telegram user to a staff ID — used by inline callback."""
    db = SheetsDB.get()
    staff = db.get_staff_by_id(staff_id)
    if not staff:
        await update.callback_query.edit_message_text(
            f"❌ Không tìm thấy nhân viên mã <b>{staff_id}</b>.",
            parse_mode=ParseMode.HTML,
        )
        return
    tg_user = update.effective_user
    display_name = staff.get(COL_STAFF_NAME, tg_user.full_name)
    result = db.register_telegram_user(str(tg_user.id), staff_id, display_name)
    verb = "cập nhật" if result.get("updated") else "liên kết"
    await update.callback_query.edit_message_text(
        f"✅ Đã {verb}: <b>{display_name}</b> ({staff_id})\n\n"
        "Keyboard bên dưới luôn sẵn sàng — chỉ cần bấm 👇",
        parse_mode=ParseMode.HTML,
    )
    # Send a new message to activate the persistent keyboard
    await update.callback_query.message.reply_text(
        "🏠 Sẵn sàng!",
        reply_markup=PERSISTENT_KEYBOARD,
    )


async def cmd_me(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    tg_user = update.effective_user
    linked = db.get_telegram_user(str(tg_user.id))

    msg = update.message or (update.callback_query.message if update.callback_query else None)
    if not linked:
        if msg:
            await msg.reply_text("❌ Bạn chưa liên kết. Dùng /link &lt;Mã NV&gt;.",
                                 parse_mode=ParseMode.HTML)
        return

    staff_id = linked.get("Mã NV", "")
    staff = db.get_staff_by_id(staff_id)
    role = staff.get("Phân quyền", "") if staff else ""
    points = db.get_total_points(staff_id)

    text = (
        f"👤 <b>{linked.get('Tên hiển thị', '')}</b>\n"
        f"🆔 Mã NV: <code>{staff_id}</code>\n"
        f"🔑 Vai trò: {role}\n"
        f"⭐ Điểm thành tích: <b>{points}</b>"
    )
    kb = InlineKeyboardMarkup([[InlineKeyboardButton("🏠 Menu chính", callback_data="menu:home")]])
    if update.callback_query:
        await update.callback_query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=kb)
    else:
        await msg.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=kb)


# ── Callback handler for inline menu buttons ────────────────────────────────────
async def handle_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    action = query.data.split(":", 1)[1] if ":" in query.data else ""

    if action == "home":
        await cmd_menu(update, context)
    elif action == "help":
        text = (
            "📋 <b>Danh sách lệnh QLDA Bot</b>\n\n"
            "<b>🔗 Tài khoản:</b> /link /me\n"
            "<b>📁 Dự án:</b> /projects /project &lt;ID&gt;\n"
            "<b>✅ Nhiệm vụ:</b> /mytasks /addtask /donetask /assign\n"
            "<b>🏆 Thành tích:</b> /achievements /leaderboard\n"
            "<b>📊 Báo cáo:</b> /daily\n"
        )
        await query.message.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=MAIN_MENU_KEYBOARD)
    elif action == "me":
        await cmd_me(update, context)
    elif action == "mytasks":
        from handlers import tasks as _tasks
        await _tasks.cmd_mytasks(update, context)
    elif action == "projects":
        from handlers import projects as _projects
        await _projects.cmd_projects(update, context)
    elif action == "addtask":
        await query.message.reply_text(
            "➕ Để thêm nhiệm vụ mới, dùng lệnh:\n<code>/addtask</code>",
            parse_mode=ParseMode.HTML,
        )
    elif action == "daily":
        from handlers import daily as _daily
        await _daily.cmd_daily(update, context)
    elif action == "achievements":
        from handlers import achievements as _achievements
        await _achievements.cmd_achievements(update, context)
    elif action == "leaderboard":
        from handlers import achievements as _achievements
        await _achievements.cmd_leaderboard(update, context)
    else:
        await send_main_menu(update, "🏠 <b>Menu chính</b>\nChọn chức năng:")


async def handle_link_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle lnk: callbacks — show staff list or confirm linking."""
    query = update.callback_query
    await query.answer()
    data = query.data  # "lnk:<staff_id>" or "lnk:cancel" or "lnk:__list__"
    action = data.split(":", 1)[1]

    if action == "cancel":
        await query.edit_message_text("❌ Đã hủy.")
        return

    db = SheetsDB.get()

    if action == "__list__":
        # Show the staff picker keyboard
        staff_all = db.get_all_staff()
        buttons = []
        for s in staff_all:
            sid  = str(s.get(COL_STAFF_ID,  s.get("Mã NV", ""))).strip()
            name = str(s.get(COL_STAFF_NAME, s.get("Họ tên", ""))).strip()
            if not sid:
                continue
            label = f"{name} ({sid})" if name else sid
            buttons.append([InlineKeyboardButton(label, callback_data=f"lnk:{sid}")])
        buttons.append([InlineKeyboardButton("❌ Hủy", callback_data="lnk:cancel")])
        await query.edit_message_text(
            "👤 Chọn tên bạn trong danh sách:",
            reply_markup=InlineKeyboardMarkup(buttons),
        )
        return

    # action is a staff_id — perform the link
    await _do_link_by_id(update, action.upper())


# ── Persistent keyboard text button handler ────────────────────────────────────
async def handle_text_buttons(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Route persistent-keyboard button presses to the correct handler."""
    text = update.message.text.strip()
    action = _BUTTON_ROUTES.get(text)
    if not action:
        return

    if action == "mytasks":
        from handlers import tasks as _tasks
        await _tasks.cmd_mytasks(update, context)
    elif action == "projects":
        from handlers import projects as _projects
        await _projects.cmd_projects(update, context)
    elif action == "addtask":
        pass  # Handled by ConversationHandler (group=0) via entry_points
    elif action == "daily":
        from handlers import daily as _daily
        await _daily.cmd_daily(update, context)
    elif action == "achievements":
        from handlers import achievements as _ach
        await _ach.cmd_achievements(update, context)
    elif action == "leaderboard":
        from handlers import achievements as _ach
        await _ach.cmd_leaderboard(update, context)
    elif action == "me":
        await cmd_me(update, context)
    elif action == "help":
        await cmd_help(update, context)


def register(app) -> None:
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("menu",  cmd_menu))
    app.add_handler(CommandHandler("help",  cmd_help))
    app.add_handler(CommandHandler("link",  cmd_link))
    app.add_handler(CommandHandler("me",    cmd_me))
    app.add_handler(CallbackQueryHandler(handle_menu_callback, pattern=r"^menu:"))
    app.add_handler(CallbackQueryHandler(handle_link_callback, pattern=r"^lnk:"))
    # Persistent keyboard button presses — group=1 so ConversationHandlers (group=0) take priority
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND,
        handle_text_buttons,
    ), group=1)
