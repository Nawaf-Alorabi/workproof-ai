from __future__ import annotations

import html
import os
import sqlite3
import time
from datetime import datetime, timedelta
from contextlib import suppress
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "workproof.db"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def fmt_date(value: str | None) -> str:
    dt = parse_dt(value)
    return dt.strftime("%b %d, %Y %I:%M %p") if dt else "No date set"


def fmt_duration(seconds: int | None) -> str:
    seconds = max(0, int(seconds or 0))
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours}h {minutes}m"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def esc(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def status_label(value: str) -> str:
    return value.replace("_", " ").title()


def mock_ai_summary(title: str, notes: list[str]) -> str:
    if notes:
        progress = " ".join(notes[:3])
    else:
        progress = "No progress notes have been added yet."
    return f"Mock AI summary: {title} is ready for review context. Recent progress: {progress}"


def init_db() -> None:
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              role TEXT NOT NULL CHECK(role IN ('MANAGER', 'EMPLOYEE')),
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tasks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              description TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'TODO'
                CHECK(status IN ('TODO', 'IN_PROGRESS', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED')),
              manager_id INTEGER NOT NULL REFERENCES users(id),
              assignee_id INTEGER NOT NULL REFERENCES users(id),
              due_date TEXT,
              submitted_at TEXT,
              reviewed_at TEXT,
              recommendation TEXT,
              ai_summary TEXT,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS work_sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
              employee_id INTEGER NOT NULL REFERENCES users(id),
              session_type TEXT NOT NULL DEFAULT 'WORK' CHECK(session_type IN ('WORK', 'BREAK')),
              start_time TEXT NOT NULL,
              end_time TEXT,
              duration_seconds INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS progress_notes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
              author_id INTEGER NOT NULL REFERENCES users(id),
              content TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS proof_items (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
              author_id INTEGER NOT NULL REFERENCES users(id),
              label TEXT NOT NULL,
              url TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        columns = {
            row["name"]
            for row in db.execute("PRAGMA table_info(work_sessions)").fetchall()
        }
        if "session_type" not in columns:
            db.execute(
                "ALTER TABLE work_sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'WORK'"
            )


def seed_db() -> None:
    with connect() as db:
        existing = db.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        if existing:
            return

        db.execute(
            "INSERT INTO users (name, email, role) VALUES (?, ?, ?)",
            ("Aisha Manager", "manager@workproof.ai", "MANAGER"),
        )
        db.execute(
            "INSERT INTO users (name, email, role) VALUES (?, ?, ?)",
            ("Omar Employee", "employee@workproof.ai", "EMPLOYEE"),
        )
        manager_id = db.execute("SELECT id FROM users WHERE role='MANAGER'").fetchone()["id"]
        employee_id = db.execute("SELECT id FROM users WHERE role='EMPLOYEE'").fetchone()["id"]
        due_date = (datetime.now() + timedelta(days=5)).isoformat(timespec="seconds")

        db.execute(
            """
            INSERT INTO tasks
              (title, description, status, manager_id, assignee_id, due_date, ai_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "Prepare onboarding checklist",
                "Draft the first onboarding checklist, collect source links, and document proof for manager review.",
                "IN_PROGRESS",
                manager_id,
                employee_id,
                due_date,
                mock_ai_summary("Prepare onboarding checklist", []),
            ),
        )
        task_id = db.execute("SELECT id FROM tasks ORDER BY id DESC LIMIT 1").fetchone()["id"]
        db.execute(
            "INSERT INTO progress_notes (task_id, author_id, content) VALUES (?, ?, ?)",
            (task_id, employee_id, "Mapped checklist sections and gathered policy references."),
        )
        db.execute(
            "INSERT INTO proof_items (task_id, author_id, label, url) VALUES (?, ?, ?, ?)",
            (task_id, employee_id, "Draft checklist document", "https://example.com/workproof/checklist-draft"),
        )


def get_demo_user(role: str) -> sqlite3.Row:
    with connect() as db:
        return db.execute("SELECT * FROM users WHERE role = ? LIMIT 1", (role,)).fetchone()


def total_task_seconds(task_id: int) -> int:
    with connect() as db:
        rows = db.execute(
            "SELECT start_time, end_time, duration_seconds FROM work_sessions WHERE task_id = ? AND session_type = 'WORK'",
            (task_id,),
        )
        total = 0
        for row in rows:
            total += int(row["duration_seconds"] or 0)
            if row["end_time"] is None:
                total += int(time.time() - parse_dt(row["start_time"]).timestamp())
        return total


def total_break_seconds(task_id: int) -> int:
    with connect() as db:
        rows = db.execute(
            "SELECT start_time, end_time, duration_seconds FROM work_sessions WHERE task_id = ? AND session_type = 'BREAK'",
            (task_id,),
        )
        total = 0
        for row in rows:
            total += int(row["duration_seconds"] or 0)
            if row["end_time"] is None:
                total += int(time.time() - parse_dt(row["start_time"]).timestamp())
        return total


def layout(active: str, content: str) -> bytes:
    nav = [
        ("/login", "Demo Login", "home"),
        ("/manager", "Manager", "manager"),
        ("/employee", "Employee", "employee"),
    ]
    links = "".join(
        f'<a class="nav {"active" if active == key else ""}" href="{href}">{label}</a>'
        for href, label, key in nav
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WorkProof AI</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <header>
    <a class="brand" href="/login"><span>WP</span><div><strong>WorkProof AI</strong><small>Onboarding and task tracking</small></div></a>
    <nav>{links}</nav>
  </header>
  <main>{content}</main>
  <script src="/static/app.js"></script>
</body>
</html>""".encode()


def stat(label: str, value: str) -> str:
    return f'<div class="stat"><small>{esc(label)}</small><strong>{esc(value)}</strong></div>'


def pill(status: str) -> str:
    return f'<span class="pill {esc(status.lower())}">{esc(status_label(status))}</span>'


def home_page() -> bytes:
    manager = get_demo_user("MANAGER")
    employee = get_demo_user("EMPLOYEE")
    content = f"""
    <section class="grid two">
      <div class="panel intro">
        <small class="eyebrow">Stage 1 Prototype</small>
        <h1>WorkProof AI tracks assigned work from task creation to manager review.</h1>
        <p>Use the demo roles to create tasks, track work sessions, add proof, submit for review, and view a final report with a mock AI summary.</p>
        <div class="cards">
          <a class="card" href="/manager"><strong>Manager dashboard</strong><small>{esc(manager["email"])}</small><span>Open manager view</span></a>
          <a class="card" href="/employee"><strong>Employee dashboard</strong><small>{esc(employee["email"])}</small><span>Open employee view</span></a>
        </div>
      </div>
      <aside class="panel">
        <h2>Stage 1 coverage</h2>
        <ul class="checklist">
          <li>Manager creates and assigns tasks</li>
          <li>Employee views assigned tasks</li>
          <li>Start/end work session tracking</li>
          <li>Start Work, End Work, Start Break, End Break buttons</li>
          <li>Progress notes and proof links/files</li>
          <li>Review, recommendations, and final report</li>
        </ul>
      </aside>
    </section>
    """
    return layout("home", content)


def manager_page() -> bytes:
    manager = get_demo_user("MANAGER")
    with connect() as db:
        tasks = db.execute(
            """
            SELECT tasks.*, users.name AS assignee_name
            FROM tasks JOIN users ON users.id = tasks.assignee_id
            ORDER BY tasks.updated_at DESC
            """
        ).fetchall()

    submitted = sum(1 for t in tasks if t["status"] == "SUBMITTED")
    approved = sum(1 for t in tasks if t["status"] == "APPROVED")
    tracked = sum(total_task_seconds(t["id"]) for t in tasks)
    task_rows = "".join(
        f"""
        <article class="row">
          <div>
            <a class="row-title" href="/manager/tasks/{task["id"]}">{esc(task["title"])}</a>
            <p>Assigned to {esc(task["assignee_name"])} · Due {fmt_date(task["due_date"])}</p>
            <div class="row-actions">
              <span>{fmt_duration(total_task_seconds(task["id"]))} tracked</span>
              <a href="/manager/tasks/{task["id"]}">Review</a>
              <a href="/reports/{task["id"]}">Report</a>
            </div>
          </div>
          {pill(task["status"])}
        </article>
        """
        for task in tasks
    ) or '<div class="empty">No tasks have been created yet.</div>'

    content = f"""
    <div class="page-title"><small>Signed in as {esc(manager["name"])}</small><h1>Manager dashboard</h1></div>
    <section class="stats">{stat("Total tasks", str(len(tasks)))}{stat("Submitted", str(submitted))}{stat("Approved", str(approved))}{stat("Tracked work", fmt_duration(tracked))}</section>
    <section class="panel action-panel"><a class="primary-link" href="/manager/tasks/new">Create new task</a></section>
    <section>
      <div class="panel list"><h2>Assigned tasks</h2>{task_rows}</div>
    </section>
    """
    return layout("manager", content)


def new_task_page() -> bytes:
    manager = get_demo_user("MANAGER")
    with connect() as db:
        employees = db.execute("SELECT * FROM users WHERE role='EMPLOYEE' ORDER BY name").fetchall()
    employee_options = "".join(f'<option value="{e["id"]}">{esc(e["name"])}</option>' for e in employees)
    content = f"""
    <a class="back" href="/manager">Back to manager dashboard</a>
    <div class="page-title"><small>Signed in as {esc(manager["name"])}</small><h1>Create task</h1></div>
    <form class="panel form narrow" method="post" action="/tasks/create">
      <label>Title<input required name="title" placeholder="Task title"></label>
      <label>Description<textarea required name="description" rows="6" placeholder="Expected outcome and acceptance criteria"></textarea></label>
      <label>Assign to<select required name="assignee_id">{employee_options}</select></label>
      <label>Due date<input type="date" name="due_date"></label>
      <button type="submit">Assign task</button>
    </form>
    """
    return layout("manager", content)


def employee_page() -> bytes:
    employee = get_demo_user("EMPLOYEE")
    with connect() as db:
        tasks = db.execute("SELECT * FROM tasks WHERE assignee_id = ? ORDER BY updated_at DESC", (employee["id"],)).fetchall()

    total = sum(total_task_seconds(t["id"]) for t in tasks)
    task_rows = ""
    with connect() as db:
        for task in tasks:
            notes = db.execute("SELECT COUNT(*) AS count FROM progress_notes WHERE task_id = ?", (task["id"],)).fetchone()["count"]
            proofs = db.execute("SELECT COUNT(*) AS count FROM proof_items WHERE task_id = ?", (task["id"],)).fetchone()["count"]
            active = db.execute("SELECT id FROM work_sessions WHERE task_id = ? AND end_time IS NULL", (task["id"],)).fetchone()
            active_badge = '<span class="active-session">Active session</span>' if active else ""
            task_rows += f"""
            <a class="row employee-task" href="/employee/tasks/{task["id"]}">
              <div>
                <strong>{esc(task["title"])}</strong>
                <p>{esc(task["description"])}</p>
                <div class="row-actions"><span>Due {fmt_date(task["due_date"])}</span><span>{notes} notes</span><span>{proofs} proofs</span>{active_badge}</div>
              </div>
              {pill(task["status"])}
            </a>
            """

    content = f"""
    <div class="page-title"><small>Signed in as {esc(employee["name"])}</small><h1>Employee dashboard</h1></div>
    <section class="stats">{stat("Assigned tasks", str(len(tasks)))}{stat("Tracked work", fmt_duration(total))}</section>
    <section class="panel list"><h2>My assigned tasks</h2>{task_rows or '<div class="empty">No tasks are assigned to you yet.</div>'}</section>
    """
    return layout("employee", content)


def task_page(task_id: int) -> bytes:
    employee = get_demo_user("EMPLOYEE")
    with connect() as db:
        task = db.execute(
            "SELECT tasks.*, users.name AS assignee_name FROM tasks JOIN users ON users.id = tasks.assignee_id WHERE tasks.id = ?",
            (task_id,),
        ).fetchone()
        notes = db.execute("SELECT * FROM progress_notes WHERE task_id = ? ORDER BY created_at DESC", (task_id,)).fetchall()
        proofs = db.execute("SELECT * FROM proof_items WHERE task_id = ? ORDER BY created_at DESC", (task_id,)).fetchall()
        sessions = db.execute("SELECT * FROM work_sessions WHERE task_id = ? ORDER BY start_time DESC", (task_id,)).fetchall()

    if not task:
        return layout("employee", '<div class="empty">Task not found.</div>')

    active_work = next((s for s in sessions if s["end_time"] is None and s["session_type"] == "WORK"), None)
    active_break = next((s for s in sessions if s["end_time"] is None and s["session_type"] == "BREAK"), None)
    active_start = active_work["start_time"] if active_work else ""
    ended_seconds = sum(
        s["duration_seconds"]
        for s in sessions
        if s["end_time"] is not None and s["session_type"] == "WORK"
    )
    note_rows = "".join(f'<li><span>{esc(n["content"])}</span><small>{fmt_date(n["created_at"])}</small></li>' for n in notes)
    proof_rows = "".join(f'<li><a href="{esc(p["url"])}" target="_blank">{esc(p["label"])}</a><small>{esc(p["url"])}</small></li>' for p in proofs)
    session_rows = "".join(
        f'<li><span>{status_label(s["session_type"])}: {fmt_date(s["start_time"])} to {fmt_date(s["end_time"])}</span><small>{fmt_duration(s["duration_seconds"])}</small></li>'
        for s in sessions
    )
    submit_disabled = "disabled" if task["status"] == "APPROVED" else ""

    content = f"""
    <a class="back" href="/employee">Back to employee dashboard</a>
    <section class="panel task-head">
      <div><h1>{esc(task["title"])}</h1><p>{esc(task["description"])}</p><small>Assigned to {esc(task["assignee_name"])} · Due {fmt_date(task["due_date"])}</small></div>
      {pill(task["status"])}
    </section>
    <section class="timer panel" data-start="{esc(active_start)}" data-tracked="{ended_seconds}">
      <div><small>Work session timer</small><strong id="timer-value">{fmt_duration(total_task_seconds(task_id))}</strong></div>
      <div class="timer-actions">
        <form method="post" action="/tasks/{task_id}/start-work"><button {"disabled" if active_work or active_break else ""}>Start Work</button></form>
        <form method="post" action="/tasks/{task_id}/end-work"><button {"disabled" if not active_work else ""} class="secondary">End Work</button></form>
        <form method="post" action="/tasks/{task_id}/start-break"><button {"disabled" if active_work or active_break else ""} class="secondary">Start Break</button></form>
        <form method="post" action="/tasks/{task_id}/end-break"><button {"disabled" if not active_break else ""} class="secondary">End Break</button></form>
      </div>
    </section>
    <section class="grid two">
      <form class="panel form" method="post" action="/tasks/{task_id}/notes"><h2>Add progress note</h2><textarea required name="content" rows="5"></textarea><button>Add note</button></form>
      <form class="panel form" method="post" action="/tasks/{task_id}/proofs"><h2>Add proof link/file</h2><label>Label<input required name="label"></label><label>URL or file path<input required name="url"></label><button>Add proof</button></form>
    </section>
    <section class="grid three">
      <div class="panel"><h2>Progress notes</h2><ul class="timeline">{note_rows or '<li>No progress notes yet.</li>'}</ul></div>
      <div class="panel"><h2>Proof of work</h2><ul class="timeline">{proof_rows or '<li>No proof items yet.</li>'}</ul></div>
      <div class="panel"><h2>Sessions</h2><ul class="timeline">{session_rows or '<li>No work sessions yet.</li>'}</ul></div>
    </section>
    <section class="panel ai"><h2>AI summary</h2><p>{esc(task["ai_summary"])}</p></section>
    <form class="submit-bar" method="post" action="/tasks/{task_id}/submit"><button {submit_disabled}>Submit task for review</button><a href="/reports/{task_id}">Open final report</a></form>
    """
    return layout("employee", content)


def review_page(task_id: int) -> bytes:
    with connect() as db:
        task = db.execute(
            "SELECT tasks.*, users.name AS assignee_name FROM tasks JOIN users ON users.id = tasks.assignee_id WHERE tasks.id = ?",
            (task_id,),
        ).fetchone()
        notes = db.execute("SELECT * FROM progress_notes WHERE task_id = ? ORDER BY created_at DESC", (task_id,)).fetchall()
        proofs = db.execute("SELECT * FROM proof_items WHERE task_id = ? ORDER BY created_at DESC", (task_id,)).fetchall()
    if not task:
        return layout("manager", '<div class="empty">Task not found.</div>')
    note_rows = "".join(f'<li>{esc(n["content"])}<small>{fmt_date(n["created_at"])}</small></li>' for n in notes)
    proof_rows = "".join(f'<li><a href="{esc(p["url"])}" target="_blank">{esc(p["label"])}</a><small>{esc(p["url"])}</small></li>' for p in proofs)
    content = f"""
    <a class="back" href="/manager">Back to manager dashboard</a>
    <section class="panel task-head"><div><h1>Review: {esc(task["title"])}</h1><p>{esc(task["description"])}</p><small>Employee: {esc(task["assignee_name"])} · Submitted {fmt_date(task["submitted_at"])}</small></div>{pill(task["status"])}</section>
    <section class="stats">{stat("Tracked work", fmt_duration(total_task_seconds(task_id)))}{stat("Notes", str(len(notes)))}{stat("Proof items", str(len(proofs)))}</section>
    <section class="grid three">
      <div class="panel"><h2>Progress notes</h2><ul class="timeline">{note_rows or '<li>No notes.</li>'}</ul></div>
      <div class="panel"><h2>Proof</h2><ul class="timeline">{proof_rows or '<li>No proof.</li>'}</ul></div>
      <div class="panel ai"><h2>AI summary</h2><p>{esc(task["ai_summary"])}</p></div>
    </section>
    <form class="panel form review-form" method="post" action="/tasks/{task_id}/review">
      <h2>Manager recommendation</h2>
      <textarea name="recommendation" rows="4" placeholder="Add recommendation or change request notes">{esc(task["recommendation"])}</textarea>
      <div class="split-actions"><button name="decision" value="approve">Approve</button><button class="secondary" name="decision" value="changes">Request changes</button></div>
    </form>
    """
    return layout("manager", content)


def report_page(task_id: int) -> bytes:
    with connect() as db:
        task = db.execute(
            "SELECT tasks.*, users.name AS assignee_name FROM tasks JOIN users ON users.id = tasks.assignee_id WHERE tasks.id = ?",
            (task_id,),
        ).fetchone()
        notes = db.execute("SELECT * FROM progress_notes WHERE task_id = ? ORDER BY created_at ASC", (task_id,)).fetchall()
        proofs = db.execute("SELECT * FROM proof_items WHERE task_id = ? ORDER BY created_at ASC", (task_id,)).fetchall()
    if not task:
        return layout("home", '<div class="empty">Task not found.</div>')
    note_rows = "".join(f"<li>{esc(n['content'])}</li>" for n in notes)
    proof_rows = "".join(f'<li><a href="{esc(p["url"])}" target="_blank">{esc(p["label"])}</a></li>' for p in proofs)
    content = f"""
    <a class="back" href="/manager">Back to manager dashboard</a>
    <section class="panel report">
      <div class="report-title">{pill(task["status"])}<h1>Final report: {esc(task["title"])}</h1><p>{esc(task["description"])}</p></div>
      <section class="stats">{stat("Employee", task["assignee_name"])}{stat("Work duration", fmt_duration(total_task_seconds(task_id)))}{stat("Break duration", fmt_duration(total_break_seconds(task_id)))}{stat("Reviewed", fmt_date(task["reviewed_at"]))}</section>
      <div class="grid two">
        <div><h2>AI summary</h2><p>{esc(task["ai_summary"])}</p></div>
        <div><h2>Manager recommendation</h2><p>{esc(task["recommendation"] or "No recommendation added yet.")}</p></div>
      </div>
      <div class="grid two">
        <div><h2>Progress notes</h2><ul>{note_rows or '<li>No notes.</li>'}</ul></div>
        <div><h2>Proof of work</h2><ul>{proof_rows or '<li>No proof items.</li>'}</ul></div>
      </div>
    </section>
    """
    return layout("home", content)


def redirect_response(handler: BaseHTTPRequestHandler, location: str) -> None:
    handler.send_response(303)
    handler.send_header("Location", location)
    handler.end_headers()


class WorkProofHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        body: bytes
        status = 200

        if path == "/static/style.css":
            self.send_file(ROOT / "static" / "style.css", "text/css")
            return
        if path == "/static/app.js":
            self.send_file(ROOT / "static" / "app.js", "text/javascript")
            return
        if path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        if path == "/":
            redirect_response(self, "/login")
            return
        if path == "/login":
            body = home_page()
        elif path == "/manager":
            body = manager_page()
        elif path == "/manager/tasks/new":
            body = new_task_page()
        elif path == "/employee":
            body = employee_page()
        elif path.startswith("/manager/tasks/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                body = review_page(int(parts[2]))
            else:
                status, body = 404, layout("home", '<div class="empty">Page not found.</div>')
        elif path.startswith("/employee/tasks/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                body = task_page(int(parts[2]))
            else:
                status, body = 404, layout("home", '<div class="empty">Page not found.</div>')
        elif path.startswith("/reports/"):
            parts = path.strip("/").split("/")
            if len(parts) == 2:
                body = report_page(int(parts[1]))
            else:
                status, body = 404, layout("home", '<div class="empty">Page not found.</div>')
        elif path.startswith("/tasks/"):
            parts = path.strip("/").split("/")
            if len(parts) == 2:
                redirect_response(self, f"/employee/tasks/{parts[1]}")
                return
            elif len(parts) == 3 and parts[2] == "review":
                redirect_response(self, f"/manager/tasks/{parts[1]}")
                return
            elif len(parts) == 3 and parts[2] == "report":
                redirect_response(self, f"/reports/{parts[1]}")
                return
            else:
                status, body = 404, layout("home", '<div class="empty">Page not found.</div>')
        else:
            status, body = 404, layout("home", '<div class="empty">Page not found.</div>')

        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path, content_type: str) -> None:
        if not path.exists():
            self.send_response(404)
            self.end_headers()
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(length).decode()
        data = {key: values[0] for key, values in parse_qs(payload).items()}
        path = (urlparse(self.path).path.rstrip("/") or "/")

        if path == "/tasks/create":
            self.create_task(data)
            redirect_response(self, "/manager")
            return

        parts = path.strip("/").split("/")
        if len(parts) >= 3 and parts[0] == "tasks":
            task_id = int(parts[1])
            action = parts[2]
            if action == "start-work":
                self.start_session(task_id, "WORK")
                redirect_response(self, f"/employee/tasks/{task_id}")
            elif action == "end-work":
                self.end_session(task_id, "WORK")
                redirect_response(self, f"/employee/tasks/{task_id}")
            elif action == "start-break":
                self.start_session(task_id, "BREAK")
                redirect_response(self, f"/employee/tasks/{task_id}")
            elif action == "end-break":
                self.end_session(task_id, "BREAK")
                redirect_response(self, f"/employee/tasks/{task_id}")
            elif action == "notes":
                self.add_note(task_id, data)
                redirect_response(self, f"/employee/tasks/{task_id}")
            elif action == "proofs":
                self.add_proof(task_id, data)
                redirect_response(self, f"/employee/tasks/{task_id}")
            elif action == "submit":
                self.end_session(task_id, "WORK")
                self.end_session(task_id, "BREAK")
                self.update_task(task_id, status="SUBMITTED", submitted_at=now_iso())
                redirect_response(self, f"/reports/{task_id}")
            elif action == "review":
                decision = data.get("decision")
                status = "APPROVED" if decision == "approve" else "CHANGES_REQUESTED"
                self.update_task(
                    task_id,
                    status=status,
                    recommendation=data.get("recommendation", "").strip(),
                    reviewed_at=now_iso(),
                )
                redirect_response(self, f"/reports/{task_id}" if status == "APPROVED" else f"/manager/tasks/{task_id}")
            else:
                redirect_response(self, "/")
            return

        redirect_response(self, "/")

    def create_task(self, data: dict[str, str]) -> None:
        manager = get_demo_user("MANAGER")
        due_date = data.get("due_date")
        due_iso = f"{due_date}T12:00:00" if due_date else None
        title = data.get("title", "").strip()
        with connect() as db:
            db.execute(
                """
                INSERT INTO tasks (title, description, manager_id, assignee_id, due_date, ai_summary, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    title,
                    data.get("description", "").strip(),
                    manager["id"],
                    int(data.get("assignee_id", "0")),
                    due_iso,
                    mock_ai_summary(title, []),
                    now_iso(),
                ),
            )

    def start_session(self, task_id: int, session_type: str) -> None:
        employee = get_demo_user("EMPLOYEE")
        with connect() as db:
            active = db.execute(
                "SELECT * FROM work_sessions WHERE employee_id = ? AND end_time IS NULL",
                (employee["id"],),
            ).fetchone()
            if active:
                duration = int(time.time() - parse_dt(active["start_time"]).timestamp())
                db.execute(
                    "UPDATE work_sessions SET end_time = ?, duration_seconds = ? WHERE id = ?",
                    (now_iso(), duration, active["id"]),
                )
            db.execute(
                "INSERT INTO work_sessions (task_id, employee_id, session_type, start_time) VALUES (?, ?, ?, ?)",
                (task_id, employee["id"], session_type, now_iso()),
            )
            if session_type == "WORK":
                db.execute(
                    "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?",
                    ("IN_PROGRESS", now_iso(), task_id),
                )

    def end_session(self, task_id: int, session_type: str) -> None:
        employee = get_demo_user("EMPLOYEE")
        with connect() as db:
            active = db.execute(
                "SELECT * FROM work_sessions WHERE task_id = ? AND employee_id = ? AND session_type = ? AND end_time IS NULL",
                (task_id, employee["id"], session_type),
            ).fetchone()
            if active:
                duration = int(time.time() - parse_dt(active["start_time"]).timestamp())
                db.execute(
                    "UPDATE work_sessions SET end_time = ?, duration_seconds = ? WHERE id = ?",
                    (now_iso(), duration, active["id"]),
                )

    def add_note(self, task_id: int, data: dict[str, str]) -> None:
        employee = get_demo_user("EMPLOYEE")
        content = data.get("content", "").strip()
        if not content:
            return
        with connect() as db:
            db.execute(
                "INSERT INTO progress_notes (task_id, author_id, content) VALUES (?, ?, ?)",
                (task_id, employee["id"], content),
            )
            task = db.execute("SELECT title FROM tasks WHERE id = ?", (task_id,)).fetchone()
            notes = [row["content"] for row in db.execute("SELECT content FROM progress_notes WHERE task_id = ? ORDER BY created_at DESC", (task_id,))]
            db.execute(
                "UPDATE tasks SET ai_summary = ?, updated_at = ? WHERE id = ?",
                (mock_ai_summary(task["title"], notes), now_iso(), task_id),
            )

    def add_proof(self, task_id: int, data: dict[str, str]) -> None:
        employee = get_demo_user("EMPLOYEE")
        label = data.get("label", "").strip()
        url = data.get("url", "").strip()
        if not label or not url:
            return
        with connect() as db:
            db.execute(
                "INSERT INTO proof_items (task_id, author_id, label, url) VALUES (?, ?, ?, ?)",
                (task_id, employee["id"], label, url),
            )
            db.execute("UPDATE tasks SET updated_at = ? WHERE id = ?", (now_iso(), task_id))

    def update_task(self, task_id: int, **fields: str | None) -> None:
        if not fields:
            return
        columns = ", ".join(f"{key} = ?" for key in fields)
        values = list(fields.values())
        with connect() as db:
            db.execute(
                f"UPDATE tasks SET {columns}, updated_at = ? WHERE id = ?",
                [*values, now_iso(), task_id],
            )


def main() -> None:
    init_db()
    seed_db()
    port = int(os.environ.get("PORT", "8000"))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), WorkProofHandler)
    except OSError as error:
        if error.errno == 10048:
            print(f"Port {port} is already in use. Open http://127.0.0.1:{port} or stop the existing Python server first.")
            return
        raise

    print(f"WorkProof AI running at http://127.0.0.1:{port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nWorkProof AI stopped.")
    finally:
        with suppress(Exception):
            server.server_close()


if __name__ == "__main__":
    main()
