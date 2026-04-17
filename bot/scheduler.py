"""
scheduler.py — APScheduler: daily summary + level-up notifications
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from config import DAILY_HOUR, DAILY_MINUTE

logger = logging.getLogger(__name__)


def setup_scheduler(bot) -> AsyncIOScheduler:
    from handlers.daily import send_daily_summary
    from handlers.notifications import send_pending_level_ups, send_pending_task_notifications

    scheduler = AsyncIOScheduler()

    # Daily summary at configured time
    scheduler.add_job(
        send_daily_summary,
        trigger=CronTrigger(hour=DAILY_HOUR, minute=DAILY_MINUTE),
        args=[bot],
        id="daily_summary",
        replace_existing=True,
    )

    # Poll for pending level-up notifications every 60 seconds
    scheduler.add_job(
        send_pending_level_ups,
        trigger=IntervalTrigger(seconds=60),
        args=[bot],
        id="level_up_notifications",
        replace_existing=True,
    )

    # Poll for pending task assignment notifications every 60 seconds
    scheduler.add_job(
        send_pending_task_notifications,
        trigger=IntervalTrigger(seconds=60),
        args=[bot],
        id="task_notifications",
        replace_existing=True,
    )

    logger.info(
        "Scheduled daily summary at %02d:%02d + level-up + task notification polling every 60s",
        DAILY_HOUR, DAILY_MINUTE,
    )
    return scheduler
