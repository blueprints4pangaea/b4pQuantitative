"""Finance, ported from the Blueprints financeDashboard (api/config.py, parse.py, sheets.py).

Reads the live Revenue and Expenses sheets (monthly matrix or transaction list,
see parse.py), falling back to the sample CSVs in backend/finance_sample/.

Shipping is not a finance category here: the master shipment sheet is the
source of truth for shipments and shipping cost, so finance rows in a Shipping
category are left out and the Finance tab shows shipping cost from the master
sheet instead.
"""

from .sheets import append_transaction, load_all_sheets

EXCLUDED_CATEGORIES = {"shipping"}


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
    rows = [_row(t) for t in transactions if t["category"].strip().lower() not in EXCLUDED_CATEGORIES]
    rows.sort(key=lambda t: t["date"])
    return {
        "transactions": rows,
        "origins": {
            "revenue": {"label": "Revenue sheet", "origin": "sheet" if origins["revenue"]["is_live"] else "sample"},
            "expenses": {"label": "Expenses sheet", "origin": "sheet" if origins["expenses"]["is_live"] else "sample"},
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
