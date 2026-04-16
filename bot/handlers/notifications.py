"""
handlers/notifications.py — Gửi thông báo lên cấp qua Telegram
"""
from __future__ import annotations

import logging

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
