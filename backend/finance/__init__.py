"""Finance, ported from the Blueprints financeDashboard (api/config.py, parse.py, sheets.py).

Reads the live Revenue and Expenses sheets (monthly matrix or transaction list,
see parse.py), falling back to the sample CSVs in backend/finance_sample/.

Shipping cost comes from the finance sheets (aak, 2026-11-10): rows in a
shipping category count as expenses like any other. The shipment trackers'
"Shipment Cost" column is not added into finance, so nothing is counted twice.

Years come from one place each: 2025 from fy2025.json, 2026 from the
revenue/expense sheets below, and 2027 on from the Finance Master Tracker
(tracker.py).

2025 is a closed year: its figures are hardcoded in fy2025.json (from the 2025
Income Statement) and the live sheets only supply 2026 onward. Any live row
dated 2025 (the expense sheet's "December*" row, say) is dropped so 2025 is
never counted twice.
"""

import json
from pathlib import Path

from .sheets import append_transaction, load_all_sheets
from .tracker import TRACKER_FROM_YEAR, load_tracker

STATIC_YEAR = "2025"
STATIC_FILE = Path(__file__).with_name("fy2025.json")


def _static_rows():
    try:
        rows = json.loads(STATIC_FILE.read_text(encoding="utf-8"))["rows"]
    except (OSError, ValueError, KeyError):
        return []
    return [
        {
            **r,
            "month": r["date"][:7],
            "source": "2025 Income Statement",
            "notes": "",
            "sheet": "2025 Income Statement (hardcoded)",
        }
        for r in rows
    ]


def _row(tx):
    return {
        "id": tx["id"],
        "date": tx["date"],
        "month": tx["date"][:7],
        "amount": tx["amount"],
        "flow": "revenue" if tx["type"] == "Revenue" else "cost",
        "category": tx["category"],
        "source": tx["source"],
        "entity": tx["chapter"],
        "notes": tx.get("notes", ""),
        "sheet": tx.get("sheet_name", ""),
    }


def load_finance(force_reload=False):
    transactions, origins, audit = load_all_sheets(force_reload=force_reload)
    live = [_row(t) for t in transactions]
    static = _static_rows()
    if static:
        live = [r for r in live if not r["date"].startswith(STATIC_YEAR)]
    tracker, tracker_live = load_tracker(force_reload=force_reload)
    live = [r for r in live if int(r["date"][:4]) < TRACKER_FROM_YEAR]
    rows = live + static + tracker
    rows.sort(key=lambda t: t["date"])
    return {
        "transactions": rows,
        "origins": {
            "revenue": {"label": "Revenue sheet", "origin": "sheet" if origins["revenue"]["is_live"] else "sample"},
            "expenses": {"label": "Expenses sheet", "origin": "sheet" if origins["expenses"]["is_live"] else "sample"},
            "tracker": {"label": f"Finance Master Tracker ({TRACKER_FROM_YEAR} on)", "origin": "sheet" if tracker_live else "offline"},
            "fy2025": {"label": "2025 Income Statement", "origin": "static" if static else "missing"},
        },
        "audit": {
            "skippedRows": audit["skipped_row_count"],
            "revenueMatch": audit["revenue_match"],
            "expenseMatch": audit["expense_match"],
        },
    }


def add_finance_entry(payload):
    """Append one revenue or cost entry to its Google Sheet (needs the service account)."""
    return append_transaction(payload)
