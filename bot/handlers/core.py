"""
handlers/core.py — /start, /help, /link, /menu
"""
from __future__ import annotations

import logging

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes

from config import COL_STAFF_ID, COL_STAFF_NAME
from sheets import SheetsDB

logger = logging.getLogger(__name__)

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
    """Helper: gửi tin nhắn kèm inline menu."""
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
        await send_main_menu(
            update,
            f"👋 Chào mừng trở lại, <b>{staff_name}</b>!\n\n"
            "Chọn chức năng bên dưới hoặc gõ lệnh trực tiếp:",
        )
    else:
        await update.message.reply_text(
            "👋 Xin chào! Đây là bot quản lý dự án <b>QLDA</b>.\n\n"
            "Để bắt đầu, hãy liên kết tài khoản Telegram với tài khoản nhân viên:\n"
            "<code>/link &lt;Mã NV&gt;</code>\n\n"
            "Ví dụ: <code>/link NV001</code>",
            parse_mode=ParseMode.HTML,
        )


async def cmd_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Hiển thị menu chính bất kỳ lúc nào."""
    db = SheetsDB.get()
    tg_user = update.effective_user
    existing = db.get_telegram_user(str(tg_user.id))
    if existing:
        name = existing.get("Tên hiển thị", "bạn")
        await send_main_menu(update, f"🏠 <b>Menu chính</b> — Xin chào <b>{name}</b>!\nChọn chức năng:")
    else:
        msg = update.message or update.callback_query.message
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
    if not context.args:
        await update.message.reply_text(
            "❌ Thiếu Mã NV.\nCú pháp: <code>/link NV001</code>",
            parse_mode=ParseMode.HTML,
        )
        return

    staff_id = context.args[0].strip().upper()
    db = SheetsDB.get()
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
        await send_main_menu(
            update,
            f"✅ Liên kết thành công!\n👤 <b>{display_name}</b> ({staff_id})\n\n"
            "Chọn chức năng bên dưới để bắt đầu:",
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
    points = db.get_total_points(linked.get("Tên hiển thị", ""))

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


def register(app) -> None:
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("menu",  cmd_menu))
    app.add_handler(CommandHandler("help",  cmd_help))
    app.add_handler(CommandHandler("link",  cmd_link))
    app.add_handler(CommandHandler("me",    cmd_me))
    app.add_handler(CallbackQueryHandler(handle_menu_callback, pattern=r"^menu:"))
