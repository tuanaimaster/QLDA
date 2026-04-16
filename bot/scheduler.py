"""
scheduler.py — APScheduler daily summary at configured time
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from config import DAILY_HOUR, DAILY_MINUTE

logger = logging.getLogger(__name__)


def setup_scheduler(bot) -> AsyncIOScheduler:
    from handlers.daily import send_daily_summary

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        send_daily_summary,
        trigger=CronTrigger(hour=DAILY_HOUR, minute=DAILY_MINUTE),
        args=[bot],
        id="daily_summary",
        replace_existing=True,
    )
    logger.info("Scheduled daily summary at %02d:%02d", DAILY_HOUR, DAILY_MINUTE)
    return scheduler
