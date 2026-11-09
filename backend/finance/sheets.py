import json
import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import requests

from .config import (
    EXPENSES_CSV_URL,
    GOOGLE_SERVICE_ACCOUNT_FILE,
    GOOGLE_SERVICE_ACCOUNT_JSON,
    HQ_COST_SHEET_ID,
    HQ_REVENUE_SHEET_ID,
    REVENUE_CSV_URL,
    SAMPLE_DATA_DIR,
)
from .parse import clean_amount, clean_date, clean_int, parse_csv_content

logger = logging.getLogger("b4p_sheets")
logging.basicConfig(level=logging.INFO)

# Global in-memory cache
_CACHE: Dict[str, Any] = {
    "transactions": None,
    "last_fetched": None,
    "origins": {},
    "audit_data": {},
}

_GSPREAD_CLIENT = None


def get_gspread_client():
    global _GSPREAD_CLIENT
    if _GSPREAD_CLIENT is not None:
        return _GSPREAD_CLIENT

    try:
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive",
        ]

        if GOOGLE_SERVICE_ACCOUNT_JSON:
            try:
                creds_dict = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
                creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
                _GSPREAD_CLIENT = gspread.authorize(creds)
                logger.info("Successfully authenticated gspread using JSON string.")
                return _GSPREAD_CLIENT
            except Exception as e:
                logger.warning("Failed to authenticate gspread with JSON string: %s", e)

        if GOOGLE_SERVICE_ACCOUNT_FILE and os.path.exists(GOOGLE_SERVICE_ACCOUNT_FILE):
            try:
                _GSPREAD_CLIENT = gspread.service_account(
                    filename=GOOGLE_SERVICE_ACCOUNT_FILE, scopes=scopes
                )
                logger.info(
                    "Successfully authenticated gspread using file: %s",
                    GOOGLE_SERVICE_ACCOUNT_FILE,
                )
                return _GSPREAD_CLIENT
            except Exception as e:
                logger.warning("Failed to authenticate gspread with file: %s", e)
    except Exception as e:
        logger.warning("gspread client setup failed: %s", e)

    return None


def fetch_sheet_text(url: str) -> Optional[str]:
    """Fetches text from a published Google Sheet CSV URL."""
    if not url or url.strip().lower() == "off":
        return None
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            timeout=8,
        )
        if resp.status_code == 200:
            text = resp.text.strip()
            # If Google redirects to an HTML login page
            if text.startswith("<!DOCTYPE html") or text.startswith("<html"):
                logger.warning(
                    "Google Sheet at %s returned HTML instead of CSV (Google sign-in). Ensure sheet is shared as 'Anyone with the link can view' or Published to Web.",
                    url,
                )
                return None
            return text
        else:
            logger.warning("Google Sheet at %s returned status %s", url, resp.status_code)
    except Exception as e:
        logger.warning("Failed to fetch Google Sheet at %s: %s", url, e)
    return None


def load_all_sheets(
    force_reload: bool = False,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], Dict[str, Any]]:
    """Loads all revenue and expense transactions with caching and data audit logging."""
    global _CACHE
    if not force_reload and _CACHE["transactions"] is not None:
        return _CACHE["transactions"], _CACHE["origins"], _CACHE["audit_data"]

    all_tx: List[Dict[str, Any]] = []
    all_skipped: List[Dict[str, Any]] = []
    total_raw_rows = 0

    raw_rev_sum = 0.0
    parsed_rev_sum = 0.0

    raw_exp_sum = 0.0
    parsed_exp_sum = 0.0

    is_live = False

    # 1. Fetch & Parse Revenue
    rev_text = fetch_sheet_text(REVENUE_CSV_URL)
    rev_source_name = REVENUE_CSV_URL
    rev_is_live = False

    if rev_text:
        parsed_rev = parse_csv_content(rev_text, "Revenue", "Live Revenue Sheet")
        all_tx.extend(parsed_rev["transactions"])
        all_skipped.extend(parsed_rev["skipped_rows"])
        total_raw_rows += parsed_rev["raw_row_count"]
        raw_rev_sum = parsed_rev["raw_sum"]
        parsed_rev_sum = parsed_rev["parsed_sum"]
        rev_is_live = True
        is_live = True
    else:
        # Fallback to local sample files
        rev_source_name = "data/sample/ (hq-revenue.csv + chapter-revenue.csv)"
        hq_rev_path = SAMPLE_DATA_DIR / "hq-revenue.csv"
        chap_rev_path = SAMPLE_DATA_DIR / "chapter-revenue.csv"

        if hq_rev_path.exists():
            with open(hq_rev_path, "r", encoding="utf-8") as f:
                res = parse_csv_content(f.read(), "Revenue", "hq-revenue.csv")
                all_tx.extend(res["transactions"])
                all_skipped.extend(res["skipped_rows"])
                total_raw_rows += res["raw_row_count"]
                raw_rev_sum += res["raw_sum"]
                parsed_rev_sum += res["parsed_sum"]

        if chap_rev_path.exists():
            with open(chap_rev_path, "r", encoding="utf-8") as f:
                res = parse_csv_content(f.read(), "Revenue", "chapter-revenue.csv")
                all_tx.extend(res["transactions"])
                all_skipped.extend(res["skipped_rows"])
                total_raw_rows += res["raw_row_count"]
                raw_rev_sum += res["raw_sum"]
                parsed_rev_sum += res["parsed_sum"]

    # 2. Fetch & Parse Expenses
    exp_text = fetch_sheet_text(EXPENSES_CSV_URL)
    exp_source_name = EXPENSES_CSV_URL
    exp_is_live = False

    if exp_text:
        parsed_exp = parse_csv_content(exp_text, "Cost", "Live Expenses Sheet")
        all_tx.extend(parsed_exp["transactions"])
        all_skipped.extend(parsed_exp["skipped_rows"])
        total_raw_rows += parsed_exp["raw_row_count"]
        raw_exp_sum = parsed_exp["raw_sum"]
        parsed_exp_sum = parsed_exp["parsed_sum"]
        exp_is_live = True
        is_live = True
    else:
        # Fallback to local sample files
        exp_source_name = "data/sample/ (hq-cost.csv + chapter-cost.csv)"
        hq_cost_path = SAMPLE_DATA_DIR / "hq-cost.csv"
        chap_cost_path = SAMPLE_DATA_DIR / "chapter-cost.csv"

        if hq_cost_path.exists():
            with open(hq_cost_path, "r", encoding="utf-8") as f:
                res = parse_csv_content(f.read(), "Cost", "hq-cost.csv")
                all_tx.extend(res["transactions"])
                all_skipped.extend(res["skipped_rows"])
                total_raw_rows += res["raw_row_count"]
                raw_exp_sum += res["raw_sum"]
                parsed_exp_sum += res["parsed_sum"]

        if chap_cost_path.exists():
            with open(chap_cost_path, "r", encoding="utf-8") as f:
                res = parse_csv_content(f.read(), "Cost", "chapter-cost.csv")
                all_tx.extend(res["transactions"])
                all_skipped.extend(res["skipped_rows"])
                total_raw_rows += res["raw_row_count"]
                raw_exp_sum += res["raw_sum"]
                parsed_exp_sum += res["parsed_sum"]

    # Sort all transactions descending by date
    all_tx.sort(key=lambda x: x["date"], reverse=True)

    dates = [t["date"] for t in all_tx]
    min_date = min(dates) if dates else None
    max_date = max(dates) if dates else None

    # Audit discrepancy validation
    rev_diff = round(abs(raw_rev_sum - parsed_rev_sum), 2)
    exp_diff = round(abs(raw_exp_sum - parsed_exp_sum), 2)

    origins = {
        "overall": {
            "is_live": is_live,
            "status_text": "Connected to Live Google Sheets"
            if is_live
            else "Showing Sample Data",
            "last_synced": datetime.utcnow().isoformat() + "Z",
            "total_records": len(all_tx),
            "expenses_url": EXPENSES_CSV_URL,
            "revenue_url": REVENUE_CSV_URL,
        },
        "revenue": {
            "source": rev_source_name,
            "is_live": rev_is_live,
            "raw_sum": round(raw_rev_sum, 2),
            "parsed_sum": round(parsed_rev_sum, 2),
            "discrepancy": rev_diff,
        },
        "expenses": {
            "source": exp_source_name,
            "is_live": exp_is_live,
            "raw_sum": round(raw_exp_sum, 2),
            "parsed_sum": round(parsed_exp_sum, 2),
            "discrepancy": exp_diff,
        },
    }

    audit_data = {
        "raw_row_count": total_raw_rows,
        "parsed_row_count": len(all_tx),
        "skipped_row_count": len(all_skipped),
        "skipped_rows": all_skipped,
        "raw_revenue_sum": round(raw_rev_sum, 2),
        "dashboard_revenue_sum": round(parsed_rev_sum, 2),
        "revenue_match": rev_diff == 0.0,
        "revenue_discrepancy": rev_diff,
        "raw_expense_sum": round(raw_exp_sum, 2),
        "dashboard_expense_sum": round(parsed_exp_sum, 2),
        "expense_match": exp_diff == 0.0,
        "expense_discrepancy": exp_diff,
        "net_margin": round(parsed_rev_sum - parsed_exp_sum, 2),
        "date_range": {
            "min_date": min_date,
            "max_date": max_date,
        },
        "is_live": is_live,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

    logger.info(
        "Data Audit: Raw Revenue=$%.2f vs Parsed=$%.2f (Match: %s) | Raw Expense=$%.2f vs Parsed=$%.2f (Match: %s)",
        raw_rev_sum,
        parsed_rev_sum,
        audit_data["revenue_match"],
        raw_exp_sum,
        parsed_exp_sum,
        audit_data["expense_match"],
    )

    _CACHE["transactions"] = all_tx
    _CACHE["origins"] = origins
    _CACHE["audit_data"] = audit_data
    _CACHE["last_fetched"] = datetime.now()

    return all_tx, origins, audit_data


def append_transaction(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Appends a new transaction to the appropriate sheet or sample file."""
    date_val, _ = clean_date(payload.get("date"))
    if not date_val:
        date_val = datetime.now().strftime("%Y-%m-%d")
    amount_val = clean_amount(payload.get("amount")) or 0.0
    category_val = str(payload.get("category", "General")).strip() or "General"
    source_val = str(payload.get("source", "Other")).strip() or "Other"
    chapter_raw = str(payload.get("chapter", "HQ")).strip()
    chapter_val = "HQ" if chapter_raw.upper() in ("", "HQ", "NONE") else chapter_raw
    notes_val = str(payload.get("notes", "")).strip()
    tx_type = (
        "Cost" if str(payload.get("type", "Revenue")).lower() == "cost" else "Revenue"
    )

    is_hq = chapter_val == "HQ"
    sheet_name = "Revenue Sheet" if tx_type == "Revenue" else "Expenses Sheet"
    sample_file = (
        ("hq-revenue.csv" if is_hq else "chapter-revenue.csv")
        if tx_type == "Revenue"
        else ("hq-cost.csv" if is_hq else "chapter-cost.csv")
    )
    target_sheet_id = HQ_REVENUE_SHEET_ID if tx_type == "Revenue" else HQ_COST_SHEET_ID

    new_tx = {
        "id": f"{tx_type.lower()}-{chapter_val.lower().replace(' ', '_')}-{date_val}-{uuid.uuid4().hex[:6]}",
        "date": date_val,
        "amount": round(abs(amount_val), 2),
        "category": category_val,
        "source": source_val,
        "chapter": chapter_val,
        "notes": notes_val,
        "type": tx_type,
        "origin": "HQ" if is_hq else "Chapter",
        "sheet_name": sheet_name,
    }

    # Attempt gspread write
    written_to_gspread = False
    gc = get_gspread_client()
    if gc and target_sheet_id:
        try:
            sh = gc.open_by_key(target_sheet_id)
            wks = sh.sheet1
            row_data = [
                date_val,
                amount_val,
                category_val,
                source_val,
                "" if is_hq else chapter_val,
                "",
                notes_val,
            ]
            wks.append_row(row_data)
            written_to_gspread = True
            logger.info("Successfully appended row to Google Sheet: %s", target_sheet_id)
        except Exception as e:
            logger.error("Failed to append row to gspread: %s", e)

    # Local persistence to sample CSV
    local_saved = False
    target_csv = SAMPLE_DATA_DIR / sample_file
    if target_csv.exists():
        try:
            import csv

            with open(target_csv, "a", encoding="utf-8", newline="") as handle:
                csv.writer(handle).writerow(
                    [date_val, f"{amount_val:.2f}", category_val, source_val, "" if is_hq else chapter_val, "", notes_val]
                )
            local_saved = True
        except Exception as e:
            logger.error("Failed to append to local CSV %s: %s", sample_file, e)

    # Update in-memory cache directly
    global _CACHE
    if _CACHE["transactions"] is not None:
        _CACHE["transactions"].insert(0, new_tx)
        _CACHE["origins"]["overall"]["total_records"] = len(_CACHE["transactions"])

    return {
        "success": True,
        "transaction": new_tx,
        "written_to_gspread": written_to_gspread,
        "written_to_local_csv": local_saved,
        "sheet_target": sheet_name,
    }
