"""
main.py — Entry point cho QLDA Telegram Bot
"""
from __future__ import annotations

import logging
import sys

from telegram import BotCommand
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


async def _post_init(app: Application) -> None:
    """Set bot command list shown in Telegram "/" menu."""
    await app.bot.set_my_commands([
        BotCommand("start",        "🏠 Khởi động bot"),
        BotCommand("menu",         "📋 Mở menu chính"),
        BotCommand("mytasks",      "✅ Nhiệm vụ của tôi"),
        BotCommand("projects",     "📁 Danh sách dự án"),
        BotCommand("addtask",      "➕ Thêm nhiệm vụ mới"),
        BotCommand("daily",        "📊 Báo cáo hôm nay"),
        BotCommand("achievements", "🏆 Thành tích của tôi"),
        BotCommand("leaderboard",  "🥇 Bảng xếp hạng"),
        BotCommand("donetask",     "☑️ Đánh dấu hoàn thành"),
        BotCommand("me",           "👤 Tài khoản của tôi"),
        BotCommand("link",         "🔗 Liên kết tài khoản"),
        BotCommand("help",         "❓ Trợ giúp"),
    ])
    logger.info("Bot commands registered.")


def main() -> None:
    logger.info("Starting QLDA Bot...")

    app = Application.builder().token(BOT_TOKEN).post_init(_post_init).build()

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
