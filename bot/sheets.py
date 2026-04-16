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
    T_NOTES, P_ID, P_NAME, P_MANAGER, P_STATUS, P_TASKS_JSON,
)

logger = logging.getLogger(__name__)

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
    def _ws(self, name: str) -> gspread.Worksheet:
        if name not in self._ws_cache:
            self._ws_cache[name] = self._ss.worksheet(name)
        return self._ws_cache[name]

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
            "status": str(row.get(P_STATUS, "")),
            "tasks": tasks,
        }

    def get_all_projects(self) -> list[dict]:
        ws = self._ws(SHEET_TASKS)
        rows = ws.get_all_records()
        return [self._parse_project_row(r) for r in rows]

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
        return [t for t in self.get_all_tasks()
                if str(t.get(T_ASSIGNEE, "")).strip() == assignee_name.strip()]

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

    def get_all_telegram_users(self) -> list[dict]:
        try:
            return self._ws(SHEET_TELEGRAM_USERS).get_all_records()
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Achievements
    # ------------------------------------------------------------------
    def get_achievements_for_staff(self, staff_name: str) -> list[dict]:
        try:
            records = self._ws(SHEET_ACHIEVEMENTS).get_all_records()
        except Exception:
            return []
        return [r for r in records if str(r.get(COL_ACH_STAFF, "")).strip() == staff_name.strip()]

    def get_total_points(self, staff_name: str) -> int:
        return sum(int(r.get(COL_ACH_POINTS, 0) or 0)
                   for r in self.get_achievements_for_staff(staff_name))

    def get_leaderboard(self, top_n: int = 10) -> list[dict]:
        try:
            records = self._ws(SHEET_ACHIEVEMENTS).get_all_records()
        except Exception:
            return []
        totals: dict[str, int] = {}
        for r in records:
            name = str(r.get(COL_ACH_STAFF, "")).strip()
            if name:
                totals[name] = totals.get(name, 0) + int(r.get(COL_ACH_POINTS, 0) or 0)
        leaderboard = sorted(totals.items(), key=lambda x: x[1], reverse=True)[:top_n]
        return [{"name": name, "points": pts} for name, pts in leaderboard]

    # ------------------------------------------------------------------
    # Daily summary
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
