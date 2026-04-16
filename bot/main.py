"""
main.py — Entry point cho QLDA Telegram Bot
"""
from __future__ import annotations

import logging
import sys

from telegram.ext import Application

from config import BOT_TOKEN
from handlers import core, projects, tasks, achievements, daily
from scheduler import setup_scheduler

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


def main() -> None:
    logger.info("Starting QLDA Bot...")

    app = Application.builder().token(BOT_TOKEN).build()

    # Register all command handlers
    core.register(app)
    projects.register(app)
    tasks.register(app)
    achievements.register(app)
    daily.register(app)

    # Setup APScheduler for daily summary
    scheduler = setup_scheduler(app.bot)
    scheduler.start()

    logger.info("Bot is running. Press Ctrl+C to stop.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
