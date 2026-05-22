# WorkProof AI - Python Stage 1

This is a Python-only Stage 1 prototype for an AI onboarding and task tracking system.

## Run

```bash
python app.py
```

Then open:

```text
http://127.0.0.1:8000/login
```

To stop a server that is still running on port `8000` after closing the terminal or pressing Ctrl+C:

```bash
python stop_app.py
```

The app creates `workproof.db` automatically and seeds:

- Manager: `manager@workproof.ai`
- Employee: `employee@workproof.ai`

## Included

- SQLite schema created from Python
- Seed demo manager and employee
- `/login`
- `/manager`
- `/manager/tasks/new`
- `/manager/tasks/[id]`
- `/employee`
- `/employee/tasks/[id]`
- `/reports/[taskId]`
- Work session timer with Start Work and End Work buttons
- Break tracking with Start Break and End Break buttons
- Progress notes
- Proof links or file path entries
- Submit for review
- Manager approve/request changes/recommendation
- Mock AI summary
- Final report page
