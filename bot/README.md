# QLDA Telegram Bot

Bot Telegram quản lý dự án, tích hợp với QLDA Google Sheets.

## Tính năng

- 🔗 Liên kết tài khoản Telegram với nhân viên
- 📁 Xem danh sách & chi tiết dự án
- ✅ Quản lý nhiệm vụ (thêm, phân công, hoàn thành)
- 🏆 Hệ thống thành tích & bảng xếp hạng
- 📊 Tổng kết nhiệm vụ hàng ngày lúc 18:00 (gửi cá nhân từng người)

## Cài đặt

### 1. Tạo Service Account Google

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện tại
3. Vào **APIs & Services → Enable APIs**: bật **Google Sheets API** và **Google Drive API**
4. Vào **APIs & Services → Credentials → Create Credentials → Service account**
5. Điền tên → Tạo → Tải file JSON về → đổi tên thành `credentials.json`
6. Copy file `credentials.json` vào thư mục `bot/`
7. **Share** Google Sheet với email của service account (quyền Editor)

### 2. Tạo Telegram Bot

1. Chat với [@BotFather](https://t.me/BotFather) → `/newbot`
2. Copy token → điền vào `.env`

### 3. Cài đặt dependencies

```bash
cd bot
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

### 4. Cấu hình

```bash
copy .env.example .env
# Mở .env và điền BOT_TOKEN + SPREADSHEET_ID
```

Lấy `SPREADSHEET_ID` từ URL của Google Sheet:
`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

### 5. Chạy bot

```bash
python main.py
```

## Cấu trúc thư mục

```
bot/
├── main.py              # Entry point
├── config.py            # Cấu hình từ .env
├── sheets.py            # Truy cập Google Sheets
├── scheduler.py         # APScheduler daily summary
├── requirements.txt
├── .env.example
├── credentials.json     # Service account (KHÔNG commit lên git)
└── handlers/
    ├── core.py          # /start /help /link /me
    ├── projects.py      # /projects /project
    ├── tasks.py         # /mytasks /addtask /donetask /assign
    ├── achievements.py  # /achievements /leaderboard
    └── daily.py         # /daily + scheduled job
```

## Danh sách lệnh

| Lệnh | Mô tả |
|------|-------|
| `/start` | Chào mừng |
| `/help` | Danh sách lệnh |
| `/link <Mã NV>` | Liên kết tài khoản |
| `/me` | Thông tin tài khoản |
| `/projects` | Danh sách dự án |
| `/project <ID>` | Chi tiết dự án |
| `/mytasks` | Nhiệm vụ của tôi |
| `/addtask` | Thêm nhiệm vụ (hội thoại) |
| `/donetask <ID>` | Đánh dấu hoàn thành |
| `/assign <ID> <Tên>` | Phân công nhiệm vụ |
| `/achievements` | Thành tích của tôi |
| `/leaderboard` | Bảng xếp hạng top 10 |
| `/daily` | Tổng kết nhiệm vụ hôm nay |
