"""Finance data: the four HQ / chapter revenue and cost sheets.

Ported from financeDashboard (lib/config.ts, lib/sheets.ts, lib/parse.ts).
Each sheet is read from, in order:

1. <NAME>_CSV_URL         a sheet published to the web as CSV ("off" = skip it)
2. <NAME>_SHEET_ID        plus GOOGLE_SHEETS_API_KEY (sheet shared "anyone with the link")
3. backend/finance_sample/<file>  made-up sample rows, so the page always renders

Shipping is not a finance category any more: the master shipment sheet is the
source of truth for shipments and shipping cost, so rows with category
"Shipping" are dropped here and the Supplies Sent column is ignored.
"""

import csv
import os
import re
from datetime import date
from io import StringIO

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLE_DIR = os.path.join(HERE, "finance_sample")

HQ_NAME = "HQ"

SHEETS = [
    {"key": "hqRevenue", "label": "HQ Revenue", "flow": "revenue", "env": "HQ_REVENUE", "sample": "hq-revenue.csv"},
    {"key": "hqCost", "label": "HQ Cost", "flow": "cost", "env": "HQ_COST", "sample": "hq-cost.csv"},
    {"key": "chapterRevenue", "label": "Chapter Revenue", "flow": "revenue", "env": "CHAPTER_REVENUE", "sample": "chapter-revenue.csv"},
    {"key": "chapterCost", "label": "Chapter Cost", "flow": "cost", "env": "CHAPTER_COST", "sample": "chapter-cost.csv"},
]

# header names we accept for each field, compared lowercase and trimmed.
# add aliases here if a Google Form question gets a slightly different title
HEADER_ALIASES = {
    "date": ["date", "transaction date"],
    "amount": ["amount", "amount ($)", "amount (usd)"],
    "category": ["category"],
    "source": ["source", "paid by", "paid to", "who paid or who we paid"],
    "chapter": ["chapter"],
    "notes": ["notes", "note", "description"],
}

# categories that now come from the master shipment sheet instead
EXCLUDED_CATEGORIES = {"shipping"}

ISO_DATE = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})")
US_DATE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})")


def parse_amount(raw):
    """'$1,234.50' -> 1234.5, '(50)' -> 50. None if it isn't a number."""
    cleaned = re.sub(r"[$,\s()]", "", raw or "")
    if not cleaned:
        return None
    try:
        return abs(float(cleaned))
    except ValueError:
        return None


def parse_date(raw):
    """Accepts 2026-03-15 or 3/15/2026 (what Google Forms writes). None if unreadable."""
    s = (raw or "").strip()
    try:
        m = ISO_DATE.match(s)
        if m:
            return date(int(m[1]), int(m[2]), int(m[3]))
        m = US_DATE.match(s)
        if m:
            return date(int(m[3]), int(m[1]), int(m[2]))
    except ValueError:
        return None
    return None


def rows_to_transactions(rows, sheet_key, flow):
    if len(rows) < 2:
        return []
    header = [h.strip().lower() for h in rows[0]]
    col = {f: next((i for i, h in enumerate(header) if h in aliases), -1) for f, aliases in HEADER_ALIASES.items()}

    def get(row, field):
        i = col[field]
        return row[i].strip() if 0 <= i < len(row) else ""

    out = []
    for n, row in enumerate(rows[1:], start=2):
        if not any((c or "").strip() for c in row):
            continue
        d = parse_date(get(row, "date"))
        amount = parse_amount(get(row, "amount"))
        if d is None or amount is None:
            print(f"[{sheet_key}] skipping row {n}: bad date or amount")
            continue
        category = get(row, "category") or "Uncategorized"
        if category.lower() in EXCLUDED_CATEGORIES:
            continue
        out.append({
            "date": d.isoformat(),
            "month": d.isoformat()[:7],
            "amount": amount,
            "flow": flow,
            "category": category,
            "source": get(row, "source") or "Unknown",
            "entity": get(row, "chapter") or HQ_NAME,
            "notes": get(row, "notes"),
            "sheet": sheet_key,
        })
    return out


def _csv(text):
    return [r for r in csv.reader(StringIO(text.strip())) if r]


def _load_sheet(cfg):
    csv_url = os.getenv(f"{cfg['env']}_CSV_URL")
    sheet_id = os.getenv(f"{cfg['env']}_SHEET_ID")
    api_key = os.getenv("GOOGLE_SHEETS_API_KEY")

    # "off" means this sheet doesn't exist for us, so load nothing, not even sample rows
    if csv_url == "off" or sheet_id == "off":
        return [], "off"
    try:
        if csv_url:
            res = requests.get(csv_url, timeout=15)
            res.raise_for_status()
            return _csv(res.text), "sheet"
        if sheet_id and api_key:
            rng = os.getenv("GOOGLE_SHEETS_RANGE", "A:Z")
            res = requests.get(
                f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{requests.utils.quote(rng)}",
                params={"key": api_key},
                timeout=15,
            )
            res.raise_for_status()
            return res.json().get("values", []), "sheet"
    except Exception as exc:  # don't take the page down if Google is unreachable
        print(f"[{cfg['key']}] couldn't load live data, using sample instead: {exc}")
    with open(os.path.join(SAMPLE_DIR, cfg["sample"]), encoding="utf-8") as f:
        return _csv(f.read()), "sample"


def load_finance():
    transactions = []
    origins = {}
    for cfg in SHEETS:
        rows, origin = _load_sheet(cfg)
        origins[cfg["key"]] = {"label": cfg["label"], "origin": origin}
        transactions.extend(rows_to_transactions(rows, cfg["key"], cfg["flow"]))
    transactions.sort(key=lambda t: t["date"])
    return {"transactions": transactions, "origins": origins}
