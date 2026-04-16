#!/bin/bash
# ============================================================
# QLDA Bot - VPS Ubuntu Deployment Script
# Chạy lần đầu trên VPS Ubuntu (dùng chung với FreedomWalletBot)
# Usage: bash deploy_vps.sh
# ============================================================

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

BOT_DIR="/root/QLDABot"
BOT_SERVICE="qlda_bot"

echo -e "\n${CYAN}============================================================${NC}"
echo -e "${CYAN}  QLDA Bot - VPS Ubuntu Setup${NC}"
echo -e "${CYAN}============================================================${NC}\n"

# 1. Check root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Cần chạy với quyền root: sudo bash deploy_vps.sh${NC}"
  exit 1
fi

# 2. Install system deps
echo -e "${YELLOW}[1/7] Cài Python + pip...${NC}"
apt-get update -qq
apt-get install -y python3 python3-pip python3-venv git > /dev/null
echo -e "${GREEN}  ✅ OK${NC}"

# 3. Clone or pull repo
echo -e "${YELLOW}[2/7] Lấy source code...${NC}"
if [ -d "$BOT_DIR/.git" ]; then
  cd "$BOT_DIR"
  git pull origin master
  echo -e "${GREEN}  ✅ Pulled latest code${NC}"
else
  git clone https://github.com/tuanaimaster/QLDA.git "$BOT_DIR" 2>/dev/null || {
    echo -e "${YELLOW}  ⚠️  Repo chưa có trên GitHub. Copy files thủ công vào $BOT_DIR${NC}"
    mkdir -p "$BOT_DIR/bot"
  }
fi

cd "$BOT_DIR/bot"

# 4. Create venv + install deps
echo -e "${YELLOW}[3/7] Tạo virtual environment...${NC}"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r requirements.txt -q
echo -e "${GREEN}  ✅ Dependencies installed${NC}"

# 5. Create logs dir
echo -e "${YELLOW}[4/7] Tạo thư mục logs...${NC}"
mkdir -p logs
echo -e "${GREEN}  ✅ OK${NC}"

# 6. Setup .env nếu chưa có
echo -e "${YELLOW}[5/7] Kiểm tra .env...${NC}"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${YELLOW}  ⚠️  Đã tạo .env từ template. Cần điền BOT_TOKEN + SPREADSHEET_ID!${NC}"
    echo -e "${YELLOW}  Chạy: nano $BOT_DIR/bot/.env${NC}"
  else
    echo -e "${RED}  ❌ Không có .env.example. Tạo .env thủ công!${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}  ✅ .env đã có${NC}"
fi

# 7. Kiểm tra credentials.json
echo -e "${YELLOW}[6/7] Kiểm tra credentials.json...${NC}"
if [ ! -f credentials.json ]; then
  echo -e "${RED}  ❌ Thiếu credentials.json! Upload file lên:${NC}"
  echo -e "${YELLOW}     scp credentials.json root@<VPS_IP>:$BOT_DIR/bot/credentials.json${NC}"
  exit 1
fi
echo -e "${GREEN}  ✅ credentials.json OK${NC}"

# 8. Install + start systemd service
echo -e "${YELLOW}[7/7] Cài systemd service...${NC}"
cp qlda_bot.service /etc/systemd/system/${BOT_SERVICE}.service
systemctl daemon-reload
systemctl enable ${BOT_SERVICE}
systemctl restart ${BOT_SERVICE}
sleep 2

STATUS=$(systemctl is-active ${BOT_SERVICE} 2>/dev/null || echo "inactive")
if [ "$STATUS" = "active" ]; then
  echo -e "${GREEN}  ✅ Service đang chạy!${NC}"
else
  echo -e "${RED}  ❌ Service không start được. Kiểm tra logs:${NC}"
  journalctl -u ${BOT_SERVICE} -n 20 --no-pager
fi

echo -e "\n${CYAN}============================================================${NC}"
echo -e "${CYAN}  HOÀN TẤT! Lệnh hữu ích:${NC}"
echo -e "${CYAN}============================================================${NC}"
echo -e "  Xem logs:     journalctl -u ${BOT_SERVICE} -f"
echo -e "  Restart:      systemctl restart ${BOT_SERVICE}"
echo -e "  Stop:         systemctl stop ${BOT_SERVICE}"
echo -e "  Status:       systemctl status ${BOT_SERVICE}"
echo -e "  Edit .env:    nano $BOT_DIR/bot/.env\n"
