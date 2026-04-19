"""
handlers/notifications.py — Gửi thông báo qua Telegram với mascot engine
"""
from __future__ import annotations

import logging

from telegram import Bot

from mascot import (
    BehaviorContext,
    MascotEmotion,
    MascotEvent,
    build_deadline_warning,
    build_level_up,
    build_task_assigned,
    build_task_completed,
    build_task_created,
    registry,
    resolve_emotion,
    spam_guard,
)
from sheets import SheetsDB
from utils.mascot_image import generate_mascot_card_typed
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
    Quét sheet 'Cấp Độ Mới', gửi thông báo lên cấp có mascot.
    """
    try:
        db = SheetsDB.get()
        pending = _get_pending(db)

        for row_idx, row in pending:
            tg_id = str(row.get(COL_LU_TG, "")).strip()
            if not tg_id:
                _mark_sent(db, row_idx)
                continue

            user_name    = str(row.get(COL_LU_NAME,   "Bạn"))
            level_label  = str(row.get(COL_LU_LEVEL,  ""))
            emoji        = str(row.get(COL_LU_EMOJI,  "🏆"))
            try:
                total_points = int(row.get(COL_LU_POINTS, 0))
            except (ValueError, TypeError):
                total_points = 0

            emotion    = MascotEmotion.HYPE
            caption    = build_level_up(user_name, level_label, emoji, total_points, emotion)
            mascot_url = registry.get_url(MascotEvent.LEVEL_UP, emotion)

            try:
                if mascot_url:
                    await bot.send_photo(
                        chat_id=tg_id,
                        photo=mascot_url,
                        caption=caption,
                        parse_mode="HTML",
                    )
                else:
                    img_bytes = generate_level_up_image(user_name, level_label, total_points)
                    await bot.send_photo(
                        chat_id=tg_id,
                        photo=img_bytes,
                        caption=caption,
                        parse_mode="HTML",
                    )
                logger.info("Level-up sent → %s (%s) [%s/%s]",
                            user_name, tg_id, level_label, emotion)
            except Exception as exc:
                logger.error("Failed to send level-up to %s: %s", tg_id, exc)

            _mark_sent(db, row_idx)

    except Exception as exc:
        logger.error("send_pending_level_ups error: %s", exc)


# ── Sheet helpers ─────────────────────────────────────────────────────────────────────

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


# ── Task notifications ─────────────────────────────────────────────────────────────────

SHEET_TASK_NOTIF = "Hàng Đợi TG"

COL_TN_TASK_ID   = "Task ID"
COL_TN_TASK_NAME = "Tên nhiệm vụ"
COL_TN_ASSIGNEE  = "Người nhận"
COL_TN_PROJECT   = "Tên dự án"
COL_TN_CREATOR   = "Người tạo"
COL_TN_TYPE      = "Loại"
COL_TN_TIME      = "Thời gian"
COL_TN_SENT      = "Đã gửi"


async def send_pending_task_notifications(bot: Bot) -> None:
    """
    Được gọi bởi scheduler mỗi 60 giây.
    Quét sheet 'Hàng Đợi TG', gửi thông báo nhiệm vụ với mascot + emotion.
    """
    try:
        db = SheetsDB.get()
        ws = db._ws(SHEET_TASK_NOTIF)
        records = ws.get_all_records()

        for i, row in enumerate(records):
            if str(row.get(COL_TN_SENT, "")).strip().upper() == "TRUE":
                continue

            row_idx       = i + 2
            assignee_name = str(row.get(COL_TN_ASSIGNEE, "")).strip()
            task_name     = str(row.get(COL_TN_TASK_NAME, "")).strip()
            task_id       = str(row.get(COL_TN_TASK_ID, "")).strip()
            project_name  = str(row.get(COL_TN_PROJECT, "")).strip()
            creator       = str(row.get(COL_TN_CREATOR, "")).strip()
            notif_type    = str(row.get(COL_TN_TYPE, "created")).strip()

            # Đánh dấu sent trước — tránh retry vô tận nếu Telegram lỗi
            _mark_task_notif_sent(ws, row_idx)

            if not assignee_name:
                continue

            tg_user = db.get_telegram_user_by_name(assignee_name)
            if not tg_user:
                logger.debug("No Telegram link for '%s' — skip", assignee_name)
                continue

            tg_id = str(tg_user).strip()
            if not tg_id:
                continue

            # ── Xác định event type ─────────────────────────────────────────────────────
            try:
                event = MascotEvent(notif_type)
            except ValueError:
                event = MascotEvent.TASK_CREATED

            # ── Xây dựng BehaviorContext ───────────────────────────────────────────────
            ctx = BehaviorContext()
            if event == MascotEvent.DEADLINE_WARNING:
                try:
                    ctx.days_until_deadline = int(creator)
                except (ValueError, TypeError):
                    ctx.days_until_deadline = 3

            # ── Xác định emotion ────────────────────────────────────────────────────────────
            emotion = resolve_emotion(event, ctx)

            # ── Anti-spam: URGENT luôn bypass ───────────────────────────────────────────
            is_urgent = (event == MascotEvent.DEADLINE_WARNING
                         and ctx.days_until_deadline is not None
                         and ctx.days_until_deadline <= 1)
            if is_urgent:
                spam_guard.bypass(tg_id)
            elif not spam_guard.try_acquire(tg_id):
                logger.debug("AntiSpam: deferred notification for %s", assignee_name)
                _unmark_task_notif_sent(ws, row_idx)
                continue

            # ── Build caption ────────────────────────────────────────────────────────────────────
            if event == MascotEvent.TASK_ASSIGNED:
                caption = build_task_assigned(
                    task_name, task_id, project_name, creator, emotion)
            elif event == MascotEvent.TASK_COMPLETED:
                caption = build_task_completed(
                    task_name, task_id, project_name, creator, emotion)
            elif event == MascotEvent.DEADLINE_WARNING:
                days = ctx.days_until_deadline if ctx.days_until_deadline is not None else 3
                caption = build_deadline_warning(
                    assignee_name, task_name, task_id, project_name, days, emotion)
            else:
                caption = build_task_created(
                    task_name, task_id, project_name, creator, emotion)

            # ── Mascot URL (None nếu chưa config CDN) ───────────────────────────────────
            mascot_url = registry.get_url(event, emotion)

            try:
                photo_source = mascot_url or generate_mascot_card_typed(event, emotion)
                try:
                    await bot.send_photo(
                        chat_id=tg_id,
                        photo=photo_source,
                        caption=caption,
                        parse_mode="HTML",
                    )
                except Exception as photo_exc:
                    logger.warning("Photo send failed, falling back to text: %s", photo_exc)
                    await bot.send_message(
                        chat_id=tg_id,
                        text=caption,
                        parse_mode="HTML",
                    )
                logger.info(
                    "Notif sent → %s (%s) [%s/%s]",
                    assignee_name, tg_id, event.value, emotion.value,
                )
            except Exception as exc:
                logger.error("Failed to send to %s: %s", assignee_name, exc)

    except Exception as exc:
        logger.error("send_pending_task_notifications error: %s", exc)


def _mark_task_notif_sent(ws, row_index: int) -> None:
    try:
        headers = ws.row_values(1)
        col = headers.index(COL_TN_SENT) + 1
        ws.update_cell(row_index, col, "TRUE")
    except Exception as exc:
        logger.error("_mark_task_notif_sent error: %s", exc)


def _unmark_task_notif_sent(ws, row_index: int) -> None:
    """Hoàn tác đánh dấu — dùng khi anti-spam defer notification."""
    try:
        headers = ws.row_values(1)
        col = headers.index(COL_TN_SENT) + 1
        ws.update_cell(row_index, col, "FALSE")
    except Exception as exc:
        logger.error("_unmark_task_notif_sent error: %s", exc)
