"""
config.py — Cấu hình bot từ biến môi trường
"""
import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.environ["BOT_TOKEN"]
SPREADSHEET_ID: str = os.environ["SPREADSHEET_ID"]
GOOGLE_CREDS_JSON: str = os.getenv("GOOGLE_CREDS_JSON", "credentials.json")
DAILY_HOUR: int = int(os.getenv("DAILY_HOUR", "18"))
DAILY_MINUTE: int = int(os.getenv("DAILY_MINUTE", "0"))
DAILY_SUMMARY_CHAT_ID: str = os.getenv("DAILY_SUMMARY_CHAT_ID", "")

# Sheet names (khớp với code.gs)
SHEET_TASKS = "Dự án/Nhiệm vụ"   # Tasks stored as JSON in project rows
SHEET_STAFF = "Người dùng"
SHEET_ACHIEVEMENTS = "Thành tích"
SHEET_TELEGRAM_USERS = "Telegram Users"

# Column names (khớp với code.gs)
COL_STAFF_ID = "Mã NV"
COL_STAFF_NAME = "Họ tên"
COL_STAFF_EMAIL = "Email"
COL_STAFF_ROLE = "Phân quyền"

COL_TG_ID = "Telegram ID"
COL_TG_STAFF = "Mã NV"
COL_TG_NAME = "Tên hiển thị"
COL_TG_DATE = "Ngày đăng ký"

COL_ACH_ID = "Mã"
COL_ACH_STAFF = "Mã NV"
COL_ACH_TYPE = "Loại"
COL_ACH_TITLE = "Tên thành tích"
COL_ACH_POINTS = "Điểm"
COL_ACH_DATE = "Ngày đạt"
COL_ACH_DESC = "Mô tả"

# Task fields (in JSON inside project row)
T_ID = "Mã nhiệm vụ"
T_NAME = "Tên nhiệm vụ"
T_DESC = "Mô tả nhiệm vụ"
T_ASSIGNEE = "Người thực hiện"
T_STATUS = "Trạng thái"
T_PRIORITY = "Ưu tiên"
T_START = "Ngày bắt đầu"
T_DUE = "Hạn chót"
T_COMPLETION = "Tiến độ (%)"
T_REPORT_DATE = "Ngày hoàn thành"
T_TARGET = "Mục tiêu"
T_RESULT_LINKS = "Link kết quả"
T_OUTPUT = "Kết quả đầu ra"
T_NOTES = "Ghi chú"

P_ID = "Mã dự án"
P_NAME = "Tên dự án"
P_MANAGER = "Quản lý dự án"
P_PARTICIPANTS = "Người tham gia"
P_STATUS = "Trạng thái dự án"
P_TASKS_JSON = "Nhiệm vụ JSON"

# Roles
ROLE_ADMIN = "admin"
ROLE_MANAGER = "quản lý"
ROLE_TEAM_LEADER = "trưởng nhóm"

TASK_STATUSES = ["Chưa bắt đầu", "Đang thực hiện", "Hoàn thành", "Tạm dừng"]
PRIORITIES = ["Cao", "Trung bình", "Thấp"]
