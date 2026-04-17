"""
handlers/notifications.py — Gửi thông báo lên cấp qua Telegram
"""
from __future__ import annotations

import logging
import random

from telegram import Bot

from sheets import SheetsDB
from utils.medal_image import generate_level_up_image

logger = logging.getLogger(__name__)

# Column names must match code.gs LEVEL_UP_NOTIF_SHEET constants
COL_LU_STAFF  = "Mã NV"
COL_LU_NAME   = "Tên"
COL_LU_TG     = "Telegram ID"
COL_LU_LEVEL  = "Cấp độ mới"
COL_LU_EMOJI  = "Emoji"
COL_LU_POINTS = "Điểm"
COL_LU_SENT   = "Đã gửi"

SHEET_LEVEL_UP = "Cấp Độ Mới"


async def send_pending_level_ups(bot: Bot) -> None:
    """
    Được gọi bởi scheduler mỗi 60 giây.
    Quét sheet 'Cấp Độ Mới', gửi ảnh huy chương cho các hàng chưa gửi.
    """
    try:
        db = SheetsDB.get()
        pending = _get_pending(db)

        for row_idx, row in pending:
            tg_id = str(row.get(COL_LU_TG, "")).strip()
            if not tg_id:
                _mark_sent(db, row_idx)
                continue

            user_name   = str(row.get(COL_LU_NAME,   "Bạn"))
            level_label = str(row.get(COL_LU_LEVEL,  ""))
            emoji       = str(row.get(COL_LU_EMOJI,  "🏆"))
            try:
                total_points = int(row.get(COL_LU_POINTS, 0))
            except (ValueError, TypeError):
                total_points = 0

            try:
                img_bytes = generate_level_up_image(user_name, level_label, total_points)
                caption = (
                    f"🎉 <b>CHÚC MỪNG LÊN CẤP!</b>\n\n"
                    f"Xin chúc mừng <b>{user_name}</b>!\n"
                    f"Bạn vừa đạt cấp độ mới:\n"
                    f"{emoji} <b>{level_label}</b>\n\n"
                    f"⭐ Tổng điểm: <b>{total_points}</b>\n\n"
                    f"Tiếp tục hoàn thành nhiệm vụ để leo hạng! 🚀"
                )
                await bot.send_photo(
                    chat_id=tg_id,
                    photo=img_bytes,
                    caption=caption,
                    parse_mode="HTML",
                )
                logger.info("Level-up notification sent → %s (%s)", user_name, tg_id)
            except Exception as exc:
                logger.error("Failed to send level-up to %s: %s", tg_id, exc)

            _mark_sent(db, row_idx)

    except Exception as exc:
        logger.error("send_pending_level_ups error: %s", exc)


# ── Sheet helpers ─────────────────────────────────────────────────────────────

def _get_pending(db: SheetsDB) -> list[tuple[int, dict]]:
    try:
        ws = db._ws(SHEET_LEVEL_UP)
        records = ws.get_all_records()
        return [
            (i + 2, r)
            for i, r in enumerate(records)
            if str(r.get(COL_LU_SENT, "")).strip().upper() == "FALSE"
        ]
    except Exception as exc:
        logger.error("_get_pending error: %s", exc)
        return []


def _mark_sent(db: SheetsDB, row_index: int) -> None:
    try:
        ws = db._ws(SHEET_LEVEL_UP)
        headers = ws.row_values(1)
        col = headers.index(COL_LU_SENT) + 1
        ws.update_cell(row_index, col, "TRUE")
    except Exception as exc:
        logger.error("_mark_sent error: %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# Task assignment notifications
# ─────────────────────────────────────────────────────────────────────────────

SHEET_TASK_NOTIF = "Hàng Đợi TG"

COL_TN_TASK_ID   = "Task ID"
COL_TN_TASK_NAME = "Tên nhiệm vụ"
COL_TN_ASSIGNEE  = "Người nhận"
COL_TN_PROJECT   = "Tên dự án"
COL_TN_CREATOR   = "Người tạo"
COL_TN_TYPE      = "Loại"
COL_TN_TIME      = "Thời gian"
COL_TN_SENT      = "Đã gửi"

_MOTIVATIONAL_TIPS = [
    "💡 Gợi ý: Hãy chia nhỏ nhiệm vụ thành các bước hành động cụ thể để dễ hoàn thành hơn!",
    "🔥 Mẹo: Dùng kỹ thuật Pomodoro — làm việc tập trung 25 phút rồi nghỉ 5 phút để duy trì năng suất.",
    "🚀 Gợi ý: Xác định kết quả đầu ra rõ ràng trước khi bắt đầu để tiết kiệm thời gian chỉnh sửa.",
    "🎯 Mẹo: Hãy hoàn thành phần khó nhất trước — sau đó mọi thứ sẽ trở nên dễ dàng hơn!",
    "📈 Gợi ý: Cập nhật tiến độ thường xuyên trên hệ thống để nhóm luôn đồng bộ với nhau.",
    "🤝 Gợi ý: Nếu gặp khó khăn, đừng ngại nhờ đồng nghiệp hỗ trợ — teamwork là sức mạnh!",
    "⭐ Mẹo: Ghi lại kết quả ngay khi hoàn thành để không bỏ sót bất kỳ thành tích nào.",
    "🌟 Gợi ý: Đặt deadline cá nhân sớm hơn deadline thật 1–2 ngày để luôn đúng hẹn.",
    "💪 Mẹo: Mỗi nhiệm vụ hoàn thành là một bước tiến trên bảng xếp hạng — hãy phấn đấu lên top!",
    "🧠 Gợi ý: Đọc lại mô tả nhiệm vụ kỹ trước khi bắt đầu để hiểu đúng yêu cầu.",
]


async def send_pending_task_notifications(bot: Bot) -> None:
    """
    Được gọi bởi scheduler mỗi 60 giây.
    Quét sheet 'Hàng Đợi TG', gửi thông báo nhiệm vụ cho người được giao.
    """
    try:
        db = SheetsDB.get()
        ws = db._ws(SHEET_TASK_NOTIF)
        records = ws.get_all_records()

        for i, row in enumerate(records):
            if str(row.get(COL_TN_SENT, "")).strip().upper() == "TRUE":
                continue

            row_idx = i + 2  # 1-based + header row
            assignee_name = str(row.get(COL_TN_ASSIGNEE, "")).strip()
            task_name     = str(row.get(COL_TN_TASK_NAME, "")).strip()
            task_id       = str(row.get(COL_TN_TASK_ID, "")).strip()
            project_name  = str(row.get(COL_TN_PROJECT, "")).strip()
            creator       = str(row.get(COL_TN_CREATOR, "")).strip()
            notif_type    = str(row.get(COL_TN_TYPE, "created")).strip()

            # Always mark as sent even if we can't deliver — avoids infinite retry
            _mark_task_notif_sent(ws, row_idx, records[0] if records else {})

            if not assignee_name:
                continue

            # Look up the assignee's Telegram ID
            tg_user = db.get_telegram_user_by_name(assignee_name)
            if not tg_user:
                logger.debug("No Telegram link for assignee '%s' — skip", assignee_name)
                continue

            tg_id = str(tg_user).strip()
            if not tg_id:
                continue

            tip = random.choice(_MOTIVATIONAL_TIPS)

            if notif_type == "assigned":
                header_line = f"📬 <b>BẠN CÓ NHIỆM VỤ MỚI ĐƯỢC GIAO!</b>"
                from_line   = f"👤 Người giao: <b>{creator}</b>" if creator else ""
                xp_line     = f"⭐ <b>+10 XP</b> cho nhiệm vụ mới!"
            elif notif_type == "completed":
                header_line = f"✅ <b>NHIỆM VỤ ĐÃ HOÀN THÀNH!</b>"
                from_line   = f"👤 Xác nhận bởi: <b>{creator}</b>" if creator else ""
                xp_line     = f"🌟 <b>+XP điểm thưởng được cộng vào tài khoản!</b>"
            else:
                header_line = f"📋 <b>NHIỆM VỤ MỚI!</b>"
                from_line   = f"👤 Người tạo: <b>{creator}</b>" if creator else ""
                xp_line     = f"⭐ <b>+10 XP</b> được cộng vào tài khoản!"

            lines = [
                header_line,
                "",
                f"📋 Nhiệm vụ: <b>{task_name}</b>",
                f"🆔 Mã: <code>{task_id}</code>",
                f"📁 Dự án: {project_name}",
            ]
            if from_line:
                lines.append(from_line)
            lines += [
                "",
                xp_line,
                "",
                tip,
                "",
                "Dùng /mytasks để xem danh sách nhiệm vụ của bạn.",
            ]

            try:
                await bot.send_message(
                    chat_id=tg_id,
                    text="\n".join(lines),
                    parse_mode="HTML",
                )
                logger.info("Task notification sent → %s (%s) [%s]", assignee_name, tg_id, notif_type)
            except Exception as exc:
                logger.error("Failed to send task notif to %s: %s", assignee_name, exc)

    except Exception as exc:
        logger.error("send_pending_task_notifications error: %s", exc)


def _mark_task_notif_sent(ws, row_index: int, first_record: dict) -> None:
    try:
        headers = ws.row_values(1)
        col = headers.index(COL_TN_SENT) + 1
        ws.update_cell(row_index, col, "TRUE")
    except Exception as exc:
        logger.error("_mark_task_notif_sent error: %s", exc)
