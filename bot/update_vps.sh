#!/bin/bash
# Update QLDA Bot từ GitHub (chạy trên VPS khi có code mới)
set -e
BOT_DIR="/root/QLDABot"
cd "$BOT_DIR"
git pull origin main
cd bot
.venv/bin/pip install -r requirements.txt -q
systemctl restart qlda_bot
echo "✅ QLDA Bot updated & restarted"
journalctl -u qlda_bot -n 10 --no-pager
