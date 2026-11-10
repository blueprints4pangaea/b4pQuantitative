from unittest import mock

import backend.finance as finance
from backend.finance.tracker import parse_tracker_csv


def _live(date, amount, flow="Cost"):
    return {"id": f"live-{date}", "date": date, "amount": amount, "type": flow, "category": "Operations", "source": "", "chapter": "HQ"}


def _load(transactions, tracker=None):
    origins = {"revenue": {"is_live": True}, "expenses": {"is_live": True}}
    audit = {"skipped_row_count": 0, "revenue_match": True, "expense_match": True}
    with mock.patch.object(finance, "load_all_sheets", return_value=(transactions, origins, audit)), mock.patch.object(
        finance, "load_tracker", return_value=(tracker or [], True)
    ):
        return finance.load_finance()


def test_2025_totals_match_income_statement():
    rows = [r for r in _load([])["transactions"] if r["date"].startswith("2025")]
    rev = sum(r["amount"] for r in rows if r["flow"] == "revenue")
    cost = sum(r["amount"] for r in rows if r["flow"] == "cost")
    assert round(rev, 2) == 21760.64
    assert round(cost, 2) == 19832.34
    hq = [r for r in rows if r["entity"] == "HQ"]
    assert round(sum(r["amount"] for r in hq if r["flow"] == "revenue"), 2) == 14689.31


def test_live_2025_rows_are_dropped_not_double_counted():
    data = _load([_live("2025-12-01", 478.78), _live("2026-01-01", 100.0)])
    live = [r for r in data["transactions"] if r["id"].startswith("live-")]
    assert [r["date"] for r in live] == ["2026-01-01"]
    assert data["origins"]["fy2025"]["origin"] == "static"


TRACKER_CSV = """Chapter,Date,Category,Sub-category,Description,Amount
University of Michigan,11/09/2026,Grants,University / Student Org,test, $ 125.32 
Wayne State,01/15/2027,Shipping & Freight,International Shipment,Syria," $ 1,200.00 "
,,,,,
"""


def test_tracker_rows_start_in_2027():
    rows = parse_tracker_csv(TRACKER_CSV, "cost")
    assert len(rows) == 1
    r = rows[0]
    assert (r["date"], r["amount"], r["category"], r["entity"], r["source"]) == ("2027-01-15", 1200.0, "Shipping & Freight", "Wayne State", "International Shipment")


def test_tracker_owns_2027_on():
    tracker = parse_tracker_csv(TRACKER_CSV, "cost")
    data = _load([_live("2026-05-01", 10.0), _live("2027-02-01", 99.0)], tracker)
    dates = sorted(r["date"] for r in data["transactions"] if not r["id"].startswith("fy2025"))
    assert dates == ["2026-05-01", "2027-01-15"]
    assert data["origins"]["tracker"]["origin"] == "sheet"
