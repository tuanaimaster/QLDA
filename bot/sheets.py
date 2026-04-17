"""
sheets.py — Lớp truy cập Google Sheets trực tiếp qua gspread
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime
from typing import Any

import gspread
from oauth2client.service_account import ServiceAccountCredentials

from config import (
    GOOGLE_CREDS_JSON, SPREADSHEET_ID,
    SHEET_TASKS, SHEET_STAFF, SHEET_ACHIEVEMENTS, SHEET_TELEGRAM_USERS,
    COL_STAFF_ID, COL_STAFF_NAME, COL_STAFF_EMAIL, COL_STAFF_ROLE,
    COL_TG_ID, COL_TG_STAFF, COL_TG_NAME, COL_TG_DATE,
    COL_ACH_ID, COL_ACH_STAFF, COL_ACH_TYPE, COL_ACH_TITLE,
    COL_ACH_POINTS, COL_ACH_DATE, COL_ACH_DESC,
    T_ID, T_NAME, T_DESC, T_ASSIGNEE, T_STATUS, T_PRIORITY,
    T_START, T_DUE, T_COMPLETION, T_REPORT_DATE, T_TARGET,
    T_NOTES, P_ID, P_NAME, P_MANAGER, P_PARTICIPANTS, P_STATUS, P_TASKS_JSON,
    ROLE_ADMIN, ROLE_MANAGER, ROLE_TEAM_LEADER,
)

logger = logging.getLogger(__name__)

# ── XP constants (mirror js.html) ─────────────────────────────────────────────
_TASK_XP: dict[str, int] = {
    "Thấp": 10, "Trung bình": 20, "Cao": 40, "Khẩn cấp": 80,
}
_TASK_XP_DEFAULT = 20
_CREATE_TASK_XP = 10
_ASSIGN_ASSIGNER_XP = 20
_ASSIGN_COMPLETER_XP = 10
_T_CREATOR = "Người tạo"        # column name in task JSON
_LEVELS: list[tuple[int, int, str, str]] = [   # (level, minXP, name, icon)
    (1, 0,     "Thực tập",          "🌱"),
    (2, 150,   "Nhân viên",         "📚"),
    (3, 400,   "Chuyên viên",       "💼"),
    (4, 800,   "Senior",            "⚡"),
    (5, 1400,  "Team Leader",       "🔥"),
    (6, 2200,  "Coordinator",       "💎"),
    (7, 3200,  "Project Leader",    "🎯"),
    (8, 4500,  "Project Manager",   "🏆"),
    (9, 6000,  "Senior PM",         "🌟"),
    (10, 8000, "Program Manager",   "👑"),
    (11, 11000,"Portfolio Manager", "🚀"),
    (12, 15000,"Director",          "⭐"),
    (13, 20000,"Head",              "🏅"),
]

def _get_level(xp: int) -> tuple[int, str, str]:
    """Return (level, name, icon) for given XP."""
    result = _LEVELS[0]
    for lvl in _LEVELS:
        if xp >= lvl[1]:
            result = lvl
        else:
            break
    return result[0], result[2], result[3]


SCOPES = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]


class SheetsDB:
    """Singleton wrapper around gspread for QLDA spreadsheet."""

    _instance: SheetsDB | None = None

    def __init__(self) -> None:
        creds = ServiceAccountCredentials.from_json_keyfile_name(GOOGLE_CREDS_JSON, SCOPES)
        gc = gspread.authorize(creds)
        self._ss = gc.open_by_key(SPREADSHEET_ID)
        self._ws_cache: dict[str, gspread.Worksheet] = {}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    # Headers for auto-created sheets
    _SHEET_HEADERS: dict[str, list[str]] = {}  # populated after config import

    def _ws(self, name: str) -> gspread.Worksheet:
        if name not in self._ws_cache:
            try:
                self._ws_cache[name] = self._ss.worksheet(name)
            except gspread.exceptions.WorksheetNotFound:
                logger.info("Sheet '%s' not found, creating it...", name)
                ws = self._ss.add_worksheet(title=name, rows=1000, cols=20)
                headers = self._get_default_headers(name)
                if headers:
                    ws.append_row(headers)
                self._ws_cache[name] = ws
        return self._ws_cache[name]

    def _get_default_headers(self, name: str) -> list[str]:
        from config import (
            SHEET_TELEGRAM_USERS, SHEET_ACHIEVEMENTS,
            COL_TG_ID, COL_TG_STAFF, COL_TG_NAME, COL_TG_DATE,
            COL_ACH_ID, COL_ACH_STAFF, COL_ACH_TYPE, COL_ACH_TITLE,
            COL_ACH_POINTS, COL_ACH_DATE, COL_ACH_DESC,
        )
        if name == SHEET_TELEGRAM_USERS:
            return [COL_TG_ID, COL_TG_STAFF, COL_TG_NAME, COL_TG_DATE]
        if name == SHEET_ACHIEVEMENTS:
            return [COL_ACH_ID, COL_ACH_STAFF, COL_ACH_TYPE, COL_ACH_TITLE,
                    COL_ACH_POINTS, COL_ACH_DATE, COL_ACH_DESC]
        return []

    @classmethod
    def get(cls) -> SheetsDB:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @staticmethod
    def _today_str() -> str:
        return date.today().strftime("%Y-%m-%d")

    # ------------------------------------------------------------------
    # Staff
    # ------------------------------------------------------------------
    def get_all_staff(self) -> list[dict]:
        records = self._ws(SHEET_STAFF).get_all_records()
        return records

    def get_staff_by_id(self, staff_id: str) -> dict | None:
        for row in self.get_all_staff():
            if str(row.get(COL_STAFF_ID, "")).strip() == staff_id.strip():
                return row
        return None

    # ------------------------------------------------------------------
    # Projects + Tasks
    # ------------------------------------------------------------------
    def _parse_project_row(self, row: dict) -> dict:
        """Parse project row — tasks stored as JSON in P_TASKS_JSON column."""
        tasks_raw = row.get(P_TASKS_JSON, "[]") or "[]"
        try:
            tasks = json.loads(tasks_raw) if isinstance(tasks_raw, str) else tasks_raw
        except json.JSONDecodeError:
            tasks = []
        return {
            "id": str(row.get(P_ID, "")),
            "name": str(row.get(P_NAME, "")),
            "manager": str(row.get(P_MANAGER, "")),
            "participants": str(row.get(P_PARTICIPANTS, "")),
            "status": str(row.get(P_STATUS, "")),
            "tasks": tasks,
        }

    def get_all_projects(self) -> list[dict]:
        ws = self._ws(SHEET_TASKS)
        rows = ws.get_all_records()
        return [self._parse_project_row(r) for r in rows]

    def get_projects_for_user(self, staff_name: str, role: str) -> list[dict]:
        """Return projects visible to a staff member based on their role.

        - Admin: all projects
        - Quản lý / Trưởng nhóm: projects they manage + are a participant in + have tasks in
        - Nhân viên (default): projects they are a participant in + have tasks in
        """
        all_projects = self.get_all_projects()
        role_lower = role.strip().lower()

        if ROLE_ADMIN in role_lower:
            return all_projects

        result: list[dict] = []
        for p in all_projects:
            # Manager of this project
            if p["manager"].strip() == staff_name.strip():
                result.append(p)
                continue
            # Listed as participant
            participants = [s.strip() for s in p["participants"].split(",") if s.strip()]
            if staff_name.strip() in participants:
                result.append(p)
                continue
            # Has at least one task assigned
            if any(str(t.get(T_ASSIGNEE, "")).strip() == staff_name.strip() for t in p["tasks"]):
                result.append(p)
        return result

    def get_all_tasks(self) -> list[dict]:
        """Flatten all tasks from all projects."""
        tasks: list[dict] = []
        for p in self.get_all_projects():
            for t in p["tasks"]:
                t["_projectId"] = p["id"]
                t["_projectName"] = p["name"]
            tasks.extend(p["tasks"])
        return tasks

    def get_tasks_for_assignee(self, assignee_name: str) -> list[dict]:
        name_lower = assignee_name.strip().lower()
        return [t for t in self.get_all_tasks()
                if str(t.get(T_ASSIGNEE, "")).strip().lower() == name_lower]

    def resolve_staff_name(self, telegram_user_row: dict) -> str:
        """Return the real 'Họ tên' from the staff sheet using the linked Mã NV.
        Falls back to 'Tên hiển thị' if the staff record can't be found."""
        staff_id = str(telegram_user_row.get(COL_TG_STAFF, "")).strip()
        if staff_id:
            staff = self.get_staff_by_id(staff_id)
            if staff:
                real_name = str(staff.get(COL_STAFF_NAME, "")).strip()
                if real_name:
                    return real_name
        return str(telegram_user_row.get(COL_TG_NAME, "")).strip()

    def get_task_by_id(self, task_id: str) -> tuple[dict | None, dict | None]:
        """Return (task, project) or (None, None)."""
        for p in self.get_all_projects():
            for t in p["tasks"]:
                if str(t.get(T_ID, "")).strip() == task_id.strip():
                    return t, p
        return None, None

    def _write_project_tasks(self, project_id: str, tasks: list[dict]) -> None:
        ws = self._ws(SHEET_TASKS)
        rows = ws.get_all_records()
        for i, row in enumerate(rows):
            if str(row.get(P_ID, "")).strip() == project_id.strip():
                # gspread rows are 1-indexed, +2 for header row
                row_num = i + 2
                # Find which column holds P_TASKS_JSON
                headers = ws.row_values(1)
                try:
                    col_num = headers.index(P_TASKS_JSON) + 1
                except ValueError:
                    raise ValueError(f"Column '{P_TASKS_JSON}' not found in sheet")
                ws.update_cell(row_num, col_num, json.dumps(tasks, ensure_ascii=False))
                return
        raise ValueError(f"Project '{project_id}' not found")

    def update_task_status(self, task_id: str, new_status: str) -> dict:
        task, project = self.get_task_by_id(task_id)
        if not task:
            return {"success": False, "error": f"Không tìm thấy nhiệm vụ {task_id}"}

        all_projects = self.get_all_projects()
        for p in all_projects:
            for t in p["tasks"]:
                if str(t.get(T_ID, "")).strip() == task_id.strip():
                    t[T_STATUS] = new_status
                    if new_status == "Hoàn thành":
                        t[T_COMPLETION] = 100
                        t[T_REPORT_DATE] = self._today_str()
                    self._write_project_tasks(p["id"], p["tasks"])
                    return {"success": True, "task": t}
        return {"success": False, "error": "Lỗi cập nhật"}

    def update_task_field(self, task_id: str, field: str, value: Any) -> dict:
        all_projects = self.get_all_projects()
        for p in all_projects:
            for t in p["tasks"]:
                if str(t.get(T_ID, "")).strip() == task_id.strip():
                    t[field] = value
                    self._write_project_tasks(p["id"], p["tasks"])
                    return {"success": True}
        return {"success": False, "error": f"Không tìm thấy nhiệm vụ {task_id}"}

    def create_task(self, project_id: str, task_data: dict) -> dict:
        all_projects = self.get_all_projects()
        for p in all_projects:
            if p["id"].strip() == project_id.strip():
                # Auto-generate ID
                existing_ids = [str(t.get(T_ID, "")) for t in p["tasks"]]
                num = len(p["tasks"]) + 1
                while f"{project_id}-{num:02d}" in existing_ids:
                    num += 1
                task_data[T_ID] = f"{project_id}-{num:02d}"
                p["tasks"].append(task_data)
                self._write_project_tasks(project_id, p["tasks"])
                return {"success": True, "taskId": task_data[T_ID]}
        return {"success": False, "error": f"Không tìm thấy dự án {project_id}"}

    # ------------------------------------------------------------------
    # Telegram Users
    # ------------------------------------------------------------------
    def register_telegram_user(self, telegram_id: str, staff_id: str, display_name: str) -> dict:
        ws = self._ws(SHEET_TELEGRAM_USERS)
        # Ensure headers exist
        try:
            headers = ws.row_values(1)
        except Exception:
            headers = []
        if not headers:
            ws.append_row([COL_TG_ID, COL_TG_STAFF, COL_TG_NAME, COL_TG_DATE])

        # Check duplicate
        records = ws.get_all_records()
        for i, row in enumerate(records):
            if str(row.get(COL_TG_ID, "")).strip() == str(telegram_id).strip():
                row_num = i + 2
                ws.update(f"A{row_num}:D{row_num}",
                          [[str(telegram_id), str(staff_id), str(display_name), self._today_str()]])
                return {"success": True, "updated": True}

        ws.append_row([str(telegram_id), str(staff_id), str(display_name), self._today_str()])
        return {"success": True, "updated": False}

    def get_telegram_user(self, telegram_id: str) -> dict | None:
        records = self._ws(SHEET_TELEGRAM_USERS).get_all_records()
        for row in records:
            if str(row.get(COL_TG_ID, "")).strip() == str(telegram_id).strip():
                return row
        return None

    def get_telegram_user_by_name(self, staff_name: str) -> str | None:
        """Trả về Telegram ID cho một nhân viên theo tên (Họ tên). None nếu chưa liên kết."""
        try:
            # Bước 1: tìm Mã NV theo tên nhân viên
            staff_id = None
            for s in self.get_all_staff():
                if str(s.get(COL_STAFF_NAME, "")).strip() == staff_name.strip():
                    staff_id = str(s.get(COL_STAFF_ID, "")).strip()
                    break
            if not staff_id:
                return None
            # Bước 2: tìm Telegram ID theo Mã NV
            for row in self._ws(SHEET_TELEGRAM_USERS).get_all_records():
                if str(row.get(COL_TG_STAFF, "")).strip() == staff_id:
                    tg_id = str(row.get(COL_TG_ID, "")).strip()
                    return tg_id if tg_id else None
        except Exception as exc:
            logger.debug("get_telegram_user_by_name error: %s", exc)
        return None

    def get_all_telegram_users(self) -> list[dict]:
        try:
            return self._ws(SHEET_TELEGRAM_USERS).get_all_records()
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Achievements
    # ------------------------------------------------------------------
    # XP & Achievements — computed dynamically from task data (mirrors js.html)
    # ------------------------------------------------------------------
    def _compute_xp_stats(self, staff_name: str) -> dict:
        """Compute XP, level, and task stats for a staff member from task data."""
        all_tasks = self.get_all_tasks()
        completed = [
            t for t in all_tasks
            if "hoàn thành" in str(t.get(T_STATUS, "")).lower()
            and str(t.get(T_ASSIGNEE, "")).strip() == staff_name.strip()
        ]

        xp = 0
        on_time = 0
        per_day: dict[str, dict] = {}

        for t in completed:
            priority = str(t.get(T_PRIORITY, "")).strip()
            base = _TASK_XP.get(priority, _TASK_XP_DEFAULT)

            # Timing multiplier
            due_str = str(t.get(T_DUE, "") or "")
            done_str = str(t.get(T_REPORT_DATE, "") or "")
            if due_str and done_str:
                try:
                    due_d = datetime.fromisoformat(due_str[:10])
                    done_d = datetime.fromisoformat(done_str[:10])
                    diff = (due_d - done_d).days
                    if diff >= 1:
                        base = round(base * 1.5)
                    elif done_d <= due_d:
                        base = round(base * 1.2)
                        on_time += 1
                    else:
                        base = round(base * 0.7)
                except Exception:
                    pass

            xp += base

            # Completer bonus: +10 if task created by someone else
            creator = str(t.get(_T_CREATOR, "") or "").strip()
            if creator and creator != staff_name:
                xp += _ASSIGN_COMPLETER_XP

            # Combo tracking by day
            day = done_str[:10]
            if day:
                if day not in per_day:
                    per_day[day] = {"count": 0, "base_xp": 0}
                per_day[day]["count"] += 1
                per_day[day]["base_xp"] += base

        # Combo bonus
        for day_info in per_day.values():
            c = day_info["count"]
            mult = 2.0 if c >= 10 else 1.5 if c >= 5 else 1.2 if c >= 3 else 1.0
            if mult > 1.0:
                xp += round(day_info["base_xp"] * (mult - 1))

        # Create task XP (+10 per task created)
        created = [t for t in all_tasks if str(t.get(_T_CREATOR, "") or "").strip() == staff_name.strip()]
        xp += len(created) * _CREATE_TASK_XP

        # Assigner XP (+20 per assigned-to-others task that was completed)
        assigner_done = [
            t for t in all_tasks
            if str(t.get(_T_CREATOR, "") or "").strip() == staff_name.strip()
            and str(t.get(T_ASSIGNEE, "")).strip() != staff_name.strip()
            and "hoàn thành" in str(t.get(T_STATUS, "")).lower()
        ]
        xp += len(assigner_done) * _ASSIGN_ASSIGNER_XP

        level, level_name, level_icon = _get_level(xp)
        on_time_rate = round(on_time / len(completed) * 100) if completed else 0

        return {
            "xp": xp,
            "level": level,
            "level_name": level_name,
            "level_icon": level_icon,
            "completed": len(completed),
            "created": len(created),
            "on_time_rate": on_time_rate,
        }

    def get_achievements_for_staff(self, staff_id: str) -> list[dict]:
        """Return task-based achievements (computed from task data)."""
        staff = self.get_staff_by_id(staff_id)
        if not staff:
            return []
        staff_name = str(staff.get(COL_STAFF_NAME, "")).strip()
        stats = self._compute_xp_stats(staff_name)
        if stats["completed"] == 0:
            return []
        return [{
            "Tên thành tích": f"✅ {stats['completed']} nhiệm vụ hoàn thành",
            "Điểm": stats["xp"],
            "Mô tả": f"Lv.{stats['level']} {stats['level_icon']} {stats['level_name']} — Đúng hạn: {stats['on_time_rate']}%",
            "Ngày đạt": "",
            "Loại": "COMPUTED",
        }]

    def get_total_points(self, staff_id: str) -> int:
        """Return computed XP for a staff member."""
        staff = self.get_staff_by_id(staff_id)
        if not staff:
            return 0
        staff_name = str(staff.get(COL_STAFF_NAME, "")).strip()
        return self._compute_xp_stats(staff_name)["xp"]

    def get_leaderboard(self, top_n: int = 10) -> list[dict]:
        """Compute leaderboard from task data for all staff."""
        all_staff = self.get_all_staff()
        result = []
        for s in all_staff:
            name = str(s.get(COL_STAFF_NAME, "")).strip()
            if not name:
                continue
            stats = self._compute_xp_stats(name)
            result.append({
                "name": name,
                "points": stats["xp"],
                "level": stats["level"],
                "level_icon": stats["level_icon"],
            })
        result.sort(key=lambda x: x["points"], reverse=True)
        return result[:top_n]

    # ------------------------------------------------------------------
    # Report summary
    # ------------------------------------------------------------------
    def get_report_summary(
        self,
        assignee_name: str | None = None,
        project_id: str | None = None,
    ) -> dict:
        """Return comprehensive stats for today's report.

        Args:
            assignee_name: filter tasks belonging to this person only.
            project_id: filter tasks belonging to this project only.
        """
        today = self._today_str()
        all_tasks = self.get_all_tasks()

        # Project filter
        if project_id:
            all_tasks = [t for t in all_tasks if t.get("_projectId", "") == project_id]

        # Assignee filter
        if assignee_name:
            tasks = [
                t for t in all_tasks
                if str(t.get(T_ASSIGNEE, "")).strip() == assignee_name.strip()
            ]
        else:
            tasks = all_tasks

        added_today = [t for t in tasks if str(t.get(T_START, "")).startswith(today)]
        completed_today = [
            t for t in tasks
            if str(t.get(T_STATUS, "")) == "Hoàn thành"
            and str(t.get(T_REPORT_DATE, "")).startswith(today)
        ]
        in_progress = [t for t in tasks if str(t.get(T_STATUS, "")) == "Đang thực hiện"]
        pending = [t for t in tasks if str(t.get(T_STATUS, "")) == "Chưa bắt đầu"]
        completed_all = [t for t in tasks if str(t.get(T_STATUS, "")) == "Hoàn thành"]
        paused = [t for t in tasks if str(t.get(T_STATUS, "")) == "Tạm dừng"]

        return {
            "total": len(tasks),
            "added_today": len(added_today),
            "added_today_tasks": added_today,
            "completed_today": len(completed_today),
            "completed_today_tasks": completed_today,
            "in_progress": len(in_progress),
            "in_progress_tasks": in_progress,
            "pending": len(pending),
            "completed_all": len(completed_all),
            "paused": len(paused),
        }

    # ------------------------------------------------------------------
    # Daily summary (legacy — kept for scheduled job fallback)
    # ------------------------------------------------------------------
    def get_daily_summary(self) -> list[dict]:
        """Return tasks completed today, grouped by assignee + telegram_id."""
        today = self._today_str()
        all_tasks = self.get_all_tasks()
        done_today = [
            t for t in all_tasks
            if str(t.get(T_STATUS, "")) == "Hoàn thành"
            and str(t.get(T_REPORT_DATE, "")).startswith(today)
        ]

        tg_users = {
            str(r.get(COL_TG_STAFF, "")).strip(): str(r.get(COL_TG_ID, "")).strip()
            for r in self.get_all_telegram_users()
        }
        staff_all = self.get_all_staff()
        staff_name_to_id = {
            str(s.get(COL_STAFF_NAME, "")).strip(): str(s.get(COL_STAFF_ID, "")).strip()
            for s in staff_all
        }

        by_assignee: dict[str, list[dict]] = {}
        for t in done_today:
            a = str(t.get(T_ASSIGNEE, "Không rõ")).strip()
            by_assignee.setdefault(a, []).append(t)

        result: list[dict] = []
        for assignee, tasks in by_assignee.items():
            staff_id = staff_name_to_id.get(assignee, "")
            telegram_id = tg_users.get(staff_id, "") or tg_users.get(assignee, "")
            result.append({
                "assignee": assignee,
                "staff_id": staff_id,
                "telegram_id": telegram_id,
                "tasks": tasks,
                "count": len(tasks),
            })

        return result
