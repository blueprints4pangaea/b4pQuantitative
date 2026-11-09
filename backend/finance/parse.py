import csv
import io
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("b4p_parse")
logging.basicConfig(level=logging.INFO)

# Header alias mappings for case-insensitive matching
HEADER_ALIASES = {
    "date": [
        "date",
        "transaction date",
        "tx date",
        "month",
        "time",
        "period",
        "timestamp",
    ],
    "amount": [
        "amount",
        "amount ($)",
        "cost",
        "revenue",
        "total",
        "spending",
        "value",
        "price",
        "sum",
        "amt",
    ],
    "category": [
        "category",
        "cat",
        "expense category",
        "revenue category",
        "type",
        "class",
        "classification",
    ],
    "source": [
        "source",
        "vendor",
        "payer",
        "donor",
        "payee",
        "from",
        "to",
        "recipient",
        "account",
        "funder",
    ],
    "chapter": [
        "chapter",
        "location",
        "entity",
        "branch",
        "campus",
        "school",
        "unit",
    ],
    "supplies": [
        "supplies sent",
        "supplies",
        "units",
        "quantity",
        "supplies_sent",
        "boxes",
        "packages",
        "items",
    ],
    "notes": [
        "notes",
        "note",
        "description",
        "desc",
        "memo",
        "comments",
        "details",
    ],
}

# Month names to number mapping
MONTH_MAP = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}


def clean_amount(val: Any) -> Optional[float]:
    """Clean currency string or number to float.
    
    Handles $, commas, trailing spaces, and negative accounting formats like (100) or -100.
    Returns None if unparseable.
    """
    if val is None:
        return None
    s = str(val).strip()
    if s == "":
        return 0.0

    # Handle accounting parentheses: (100) -> -100
    is_negative = False
    if s.startswith("(") and s.endswith(")"):
        is_negative = True
        s = s[1:-1].strip()
    elif s.startswith("-"):
        is_negative = True
        s = s[1:].strip()

    # Strip currency signs, commas, spaces
    cleaned = re.sub(r"[^\d.]", "", s)
    if not cleaned:
        return None

    try:
        num = float(cleaned)
        return -num if is_negative else num
    except ValueError:
        return None


def clean_date(val: Any, default_year: int = 2026, context_seen_jan: bool = False) -> Tuple[Optional[str], Optional[str]]:
    """Parses various date formats and month strings into YYYY-MM-DD.
    
    Returns (date_str, error_message).
    """
    if val is None or str(val).strip() == "":
        return None, "Empty date value"

    s = str(val).strip()

    # Check for Month Name (e.g., 'December*', 'January', 'March')
    clean_alpha = re.sub(r"[^a-zA-Z]", "", s).lower()
    if clean_alpha in MONTH_MAP:
        mo_num = MONTH_MAP[clean_alpha]
        yr = default_year
        # Handle December* prior to January in fiscal cycle
        if mo_num == 12 and not context_seen_jan:
            yr = default_year - 1
        return f"{yr}-{mo_num:02d}-01", None

    # Try ISO and standard numeric date formats
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            dt = datetime.strptime(s.split(" ")[0].split("T")[0], fmt)
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, f"Invalid Date format: '{s}'"


def clean_int(val: Any) -> int:
    """Safely parse integer."""
    if val is None or str(val).strip() == "":
        return 0
    try:
        cleaned = re.sub(r"[^\d.-]", "", str(val))
        return int(float(cleaned))
    except (ValueError, TypeError):
        return 0


def match_header(column_name: str) -> Optional[str]:
    """Matches a CSV column header to canonical field names case-insensitively."""
    norm = re.sub(r"[_\s]+", " ", str(column_name).strip()).lower()
    for canonical, aliases in HEADER_ALIASES.items():
        for alias in aliases:
            if norm == alias or alias in norm:
                return canonical
    return None


def detect_sheet_format(headers: List[str]) -> str:
    """Detects whether CSV is a monthly matrix (Rahul's format) or a transaction list."""
    if not headers:
        return "transaction_list"

    first_col = re.sub(r"[_\s]+", " ", headers[0].strip()).lower()
    last_col = re.sub(r"[_\s]+", " ", headers[-1].strip()).lower() if len(headers) > 1 else ""

    # Check for Monthly Matrix format:
    # First column is Month, last column is Total, middle columns are Category names
    if "month" in first_col and ("total" in last_col or len(headers) >= 4):
        return "monthly_matrix"

    return "transaction_list"


def parse_csv_content(
    csv_text: str,
    tx_type: str,
    sheet_name: str = "Sheet",
    default_chapter: str = "HQ",
) -> Dict[str, Any]:
    """Robust parser that supports both Monthly Matrix sheets and Transaction List sheets.
    
    Returns structured parsed transactions and data audit statistics.
    """
    reader = list(csv.reader(io.StringIO(csv_text.strip())))
    if not reader:
        return {
            "transactions": [],
            "skipped_rows": [{"row": 0, "data": [], "reason": "Empty CSV file"}],
            "raw_row_count": 0,
            "parsed_row_count": 0,
            "raw_sum": 0.0,
            "parsed_sum": 0.0,
            "min_date": None,
            "max_date": None,
            "format": "empty",
        }

    raw_headers = [h.strip() for h in reader[0]]
    sheet_format = detect_sheet_format(raw_headers)

    transactions: List[Dict[str, Any]] = []
    skipped_rows: List[Dict[str, Any]] = []
    raw_sum = 0.0

    if sheet_format == "monthly_matrix":
        # Format B: Matrix of Months x Categories
        cat_columns = [h for h in raw_headers[1:] if h.lower() != "total"]
        seen_january = False

        for r_idx, row in enumerate(reader[1:], start=2):
            if not row or not any(x.strip() for x in row):
                skipped_rows.append({
                    "row": r_idx,
                    "sheet": sheet_name,
                    "data": row,
                    "reason": "Empty row",
                })
                continue

            first_col = row[0].strip()
            first_clean = re.sub(r"[^a-zA-Z]", "", first_col).lower()

            # Skip summary rows (e.g. 'Total Spending', 'Total Revenue')
            if "total" in first_col.lower():
                skipped_rows.append({
                    "row": r_idx,
                    "sheet": sheet_name,
                    "data": row,
                    "reason": f"Summary total row: '{first_col}' (excluded to avoid double-counting)",
                })
                continue

            # Skip footnote rows (e.g. '* means from when I (Rahul)...')
            if ("*" in first_col or len(row) < len(cat_columns) + 1) and not first_clean:
                skipped_rows.append({
                    "row": r_idx,
                    "sheet": sheet_name,
                    "data": row,
                    "reason": f"Footnote / text row: '{first_col}'",
                })
                continue

            # Parse month name
            date_str, err = clean_date(first_col, default_year=2026, context_seen_jan=seen_january)
            if err or not date_str:
                skipped_rows.append({
                    "row": r_idx,
                    "sheet": sheet_name,
                    "data": row,
                    "reason": err or "Invalid date in month column",
                })
                continue

            if "-01-01" in date_str:
                seen_january = True

            # Process each category column
            for i, cat_name in enumerate(raw_headers[1:], start=1):
                if i >= len(row):
                    break
                if cat_name.lower() == "total":
                    continue

                raw_val = row[i]
                amt = clean_amount(raw_val)

                if amt is None:
                    skipped_rows.append({
                        "row": r_idx,
                        "sheet": sheet_name,
                        "data": [first_col, cat_name, raw_val],
                        "reason": f"Invalid Amount in {cat_name}: '{raw_val}'",
                    })
                    continue

                # Add to raw sum
                raw_sum += amt

                # Create transaction line item for non-zero amounts
                if amt != 0:
                    norm_cat = cat_name.strip()
                    uid = f"{tx_type.lower()}-hq-{date_str}-{re.sub(r'[^a-zA-Z0-9]', '_', norm_cat).lower()}"
                    transactions.append({
                        "id": uid,
                        "date": date_str,
                        "amount": round(abs(amt), 2),
                        "category": norm_cat,
                        "source": norm_cat if tx_type == "Revenue" else "Operations",
                        "chapter": "HQ",
                        "supplies_sent": 0,
                        "notes": f"{first_col} {norm_cat}",
                        "type": tx_type,
                        "origin": "HQ",
                        "sheet_name": sheet_name,
                    })

    else:
        # Format A: Standard Transaction List
        header_map: Dict[str, int] = {}
        for idx, col_name in enumerate(raw_headers):
            matched = match_header(col_name)
            if matched and matched not in header_map:
                header_map[matched] = idx

        for r_idx, row in enumerate(reader[1:], start=2):
            if not row or not any(x.strip() for x in row):
                skipped_rows.append({
                    "row": r_idx,
                    "sheet": sheet_name,
                    "data": row,
                    "reason": "Empty row",
                })
                continue

            # Amount
            amt_idx = header_map.get("amount")
            raw_amt = row[amt_idx] if amt_idx is not None and amt_idx < len(row) else None
            amt = clean_amount(raw_amt)

            if amt is None:
                skipped_rows.append({
                    "row": r_idx,
                    "sheet": sheet_name,
                    "data": row,
                    "reason": f"Invalid Amount: '{raw_amt}'",
                })
                logger.warning("Row %d in %s dropped: Invalid Amount '%s'", r_idx, sheet_name, raw_amt)
                continue

            if amt <= 0:
                skipped_rows.append({
                    "row": r_idx,
                    "sheet": sheet_name,
                    "data": row,
                    "reason": f"Non-positive Amount: {amt}",
                })
                continue

            raw_sum += amt

            # Date
            date_idx = header_map.get("date")
            raw_date = row[date_idx] if date_idx is not None and date_idx < len(row) else None
            date_str, err = clean_date(raw_date, default_year=2026)
            if err or not date_str:
                skipped_rows.append({
                    "row": r_idx,
                    "sheet": sheet_name,
                    "data": row,
                    "reason": err or f"Invalid Date: '{raw_date}'",
                })
                logger.warning("Row %d in %s dropped: %s", r_idx, sheet_name, err)
                continue

            # Category
            cat_idx = header_map.get("category")
            raw_cat = row[cat_idx] if cat_idx is not None and cat_idx < len(row) else "General"
            category = str(raw_cat).strip() if raw_cat and str(raw_cat).strip() else "General"

            # Source
            src_idx = header_map.get("source")
            raw_src = row[src_idx] if src_idx is not None and src_idx < len(row) else "Other"
            source = str(raw_src).strip() if raw_src and str(raw_src).strip() else "Other"

            # Chapter normalization
            chap_idx = header_map.get("chapter")
            raw_chap = row[chap_idx] if chap_idx is not None and chap_idx < len(row) else ""
            cleaned_chap = str(raw_chap).strip()
            if not cleaned_chap or cleaned_chap.upper() in ("", "HQ", "NONE", "NAN"):
                chapter = "HQ"
                origin = "HQ"
            else:
                chapter = cleaned_chap
                origin = "Chapter"

            # Supplies Sent
            sup_idx = header_map.get("supplies")
            raw_sup = row[sup_idx] if sup_idx is not None and sup_idx < len(row) else 0
            supplies = clean_int(raw_sup)

            # Notes
            note_idx = header_map.get("notes")
            raw_notes = row[note_idx] if note_idx is not None and note_idx < len(row) else ""
            notes = str(raw_notes).strip() if raw_notes and str(raw_notes).strip() != "nan" else ""

            uid = f"{tx_type.lower()}-{chapter.lower().replace(' ', '_')}-{date_str}-{r_idx}"

            transactions.append({
                "id": uid,
                "date": date_str,
                "amount": round(amt, 2),
                "category": category,
                "source": source,
                "chapter": chapter,
                "supplies_sent": supplies,
                "notes": notes,
                "type": tx_type,
                "origin": origin,
                "sheet_name": sheet_name,
            })

    # Sort transactions descending
    transactions.sort(key=lambda x: x["date"], reverse=True)

    parsed_sum = sum(t["amount"] for t in transactions)
    dates = [t["date"] for t in transactions]
    min_date = min(dates) if dates else None
    max_date = max(dates) if dates else None

    logger.info(
        "Parsed %s (%s format): raw rows=%d, parsed=%d, raw sum=$%.2f, parsed sum=$%.2f, dates=%s to %s",
        sheet_name,
        sheet_format,
        len(reader),
        len(transactions),
        raw_sum,
        parsed_sum,
        min_date,
        max_date,
    )

    return {
        "transactions": transactions,
        "skipped_rows": skipped_rows,
        "raw_row_count": len(reader),
        "parsed_row_count": len(transactions),
        "raw_sum": round(raw_sum, 2),
        "parsed_sum": round(parsed_sum, 2),
        "min_date": min_date,
        "max_date": max_date,
        "format": sheet_format,
    }

