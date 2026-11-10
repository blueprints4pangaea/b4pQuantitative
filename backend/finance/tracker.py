"""The Finance Master Tracker (2027 on): one Google Form for every chapter feeds
its Revenue and Expenses tabs, and the responses stay there year after year, so
this one link covers every year from 2027.

Both tabs have the same columns: Chapter | Date | Category | Sub-category |
Description | Amount. Rows dated before TRACKER_FROM_YEAR are left out: 2025 is
hardcoded (fy2025.json) and 2026 comes from the older revenue/expense sheets,
so no year is read from two places.
"""

import csv
import io
import os
import time

from .parse import clean_amount, clean_date
from .sheets import fetch_sheet_text

TRACKER_SHEET_ID = os.getenv("FINANCE_TRACKER_SHEET_ID", "1Bpt5yf5zoQqYtxTYft9G7pda9Iny_tznYfmDg0i8KMI")
TRACKER_TABS = {"revenue": os.getenv("FINANCE_TRACKER_REVENUE_GID", "819520"), "cost": os.getenv("FINANCE_TRACKER_EXPENSES_GID", "1287161095")}
TRACKER_FROM_YEAR = int(os.getenv("FINANCE_TRACKER_FROM_YEAR", "2027"))
CACHE_SECONDS = 300

_cache = {"at": 0.0, "value": None}


def _csv_url(gid):
    return f"https://docs.google.com/spreadsheets/d/{TRACKER_SHEET_ID}/export?format=csv&gid={gid}"


def parse_tracker_csv(text, flow):
    """Rows of one tab, in load_finance's row shape. Blank or unparseable rows are skipped."""
    rows = []
    reader = csv.reader(io.StringIO(text))
    header = [h.strip().lower() for h in next(reader, [])]
    col = {name: header.index(name) for name in ("chapter", "date", "category", "sub-category", "description", "amount") if name in header}
    if "date" not in col or "amount" not in col:
        return rows
    get = lambda r, k: r[col[k]].strip() if k in col and col[k] < len(r) else ""  # noqa: E731
    for n, r in enumerate(reader, start=2):
        date, _ = clean_date(get(r, "date"))
        amount = clean_amount(get(r, "amount"))
        if not date or not amount or int(date[:4]) < TRACKER_FROM_YEAR:
            continue
        chapter = get(r, "chapter")
        sub = get(r, "sub-category")
        rows.append(
            {
                "id": f"tracker-{flow}-{n}",
                "date": date,
                "month": date[:7],
                "amount": round(amount, 2),
                "flow": flow,
                "category": get(r, "category") or "Uncategorized",
                "source": sub,
                "entity": "HQ" if chapter.lower() in ("", "hq", "university of michigan", "umich") else chapter,
                "notes": get(r, "description"),
                "sheet": "Finance Master Tracker",
            }
        )
    return rows


def load_tracker(force_reload=False):
    """(rows, is_live). is_live is False when either tab can't be read."""
    if not force_reload and _cache["value"] is not None and time.time() - _cache["at"] < CACHE_SECONDS:
        return _cache["value"]
    rows, live = [], True
    for flow, gid in TRACKER_TABS.items():
        text = fetch_sheet_text(_csv_url(gid))
        if text is None:
            live = False
            continue
        rows.extend(parse_tracker_csv(text, flow))
    _cache.update(at=time.time(), value=(rows, live))
    return rows, live
