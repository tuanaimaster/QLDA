"""
handlers/core.py — /start, /help, /link
"""
from __future__ import annotations

import logging

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import CommandHandler, ContextTypes

from config import COL_STAFF_ID, COL_STAFF_NAME
from sheets import SheetsDB

logger = logging.getLogger(__name__)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    user = update.effective_user
    existing = db.get_telegram_user(str(user.id))

    if existing:
        staff_name = existing.get("Tên hiển thị", "")
        await update.message.reply_text(
            f"👋 Chào mừng trở lại, <b>{staff_name}</b>!\n\n"
            "Bạn đã liên kết tài khoản rồi. Gõ /help để xem danh sách lệnh.",
            parse_mode=ParseMode.HTML,
        )
    else:
        await update.message.reply_text(
            "👋 Xin chào! Đây là bot quản lý dự án <b>QLDA</b>.\n\n"
            "Để bắt đầu, hãy liên kết tài khoản Telegram với tài khoản nhân viên:\n"
            "<code>/link &lt;Mã NV&gt;</code>\n\n"
            "Ví dụ: <code>/link NV001</code>",
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
        "/daily — Tổng kết nhiệm vụ hôm nay\n"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


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
        await update.message.reply_text(
            f"✅ Liên kết thành công!\n👤 <b>{display_name}</b> ({staff_id})\n\n"
            "Gõ /help để xem danh sách lệnh.",
            parse_mode=ParseMode.HTML,
        )


async def cmd_me(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db = SheetsDB.get()
    tg_user = update.effective_user
    linked = db.get_telegram_user(str(tg_user.id))
    if not linked:
        await update.message.reply_text("❌ Bạn chưa liên kết. Dùng /link &lt;Mã NV&gt;.",
                                         parse_mode=ParseMode.HTML)
        return

    staff_id = linked.get("Mã NV", "")
    staff = db.get_staff_by_id(staff_id)
    role = staff.get("Phân quyền", "") if staff else ""
    points = db.get_total_points(linked.get("Tên hiển thị", ""))

    await update.message.reply_text(
        f"👤 <b>{linked.get('Tên hiển thị', '')}</b>\n"
        f"🆔 Mã NV: <code>{staff_id}</code>\n"
        f"🔑 Vai trò: {role}\n"
        f"⭐ Điểm thành tích: <b>{points}</b>",
        parse_mode=ParseMode.HTML,
    )


def register(app) -> None:
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("link", cmd_link))
    app.add_handler(CommandHandler("me", cmd_me))
