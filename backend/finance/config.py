import os
from pathlib import Path

# Base directories
# backend/finance/config.py -> repo root
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SAMPLE_DATA_DIR = BASE_DIR / "backend" / "finance_sample"

# Helper to load .env.local or .env if python-dotenv is not installed
def load_env_file(filepath: Path):
    if not filepath.exists():
        return
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass

# Load local env files
load_env_file(BASE_DIR / ".env.local")
load_env_file(BASE_DIR / ".env")

# Primary Live Google Sheets CSV URLs
EXPENSES_CSV_URL = os.getenv(
    "EXPENSES_CSV_URL",
    "https://docs.google.com/spreadsheets/d/1HHa9SfzPg9nrXw9QXBN3FvZg9jW-4gAxta8r6Vf07ZU/export?format=csv&gid=0",
)
REVENUE_CSV_URL = os.getenv(
    "REVENUE_CSV_URL",
    "https://docs.google.com/spreadsheets/d/1grr_sLQqoYD6FLLvnQkIqgoz-dNSUnQvgAoOPrjnHPU/export?format=csv&gid=0",
)

# Granular sheet URLs (Option A fallback)
HQ_REVENUE_CSV_URL = os.getenv("HQ_REVENUE_CSV_URL", REVENUE_CSV_URL)
HQ_COST_CSV_URL = os.getenv("HQ_COST_CSV_URL", EXPENSES_CSV_URL)
CHAPTER_REVENUE_CSV_URL = os.getenv("CHAPTER_REVENUE_CSV_URL", "")
CHAPTER_COST_CSV_URL = os.getenv("CHAPTER_COST_CSV_URL", "")

# Google Sheets API / Service Account (Option B: gspread)
# the ops dashboard and chapter scores use GOOGLE_SHEETS_CREDENTIALS_JSON, so accept either name
GOOGLE_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON") or os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON", "")
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "")
GOOGLE_SHEETS_API_KEY = os.getenv("GOOGLE_SHEETS_API_KEY", "")

# Sheet IDs for gspread / API
HQ_REVENUE_SHEET_ID = os.getenv(
    "HQ_REVENUE_SHEET_ID",
    "1grr_sLQqoYD6FLLvnQkIqgoz-dNSUnQvgAoOPrjnHPU",
)
HQ_COST_SHEET_ID = os.getenv(
    "HQ_COST_SHEET_ID",
    "1HHa9SfzPg9nrXw9QXBN3FvZg9jW-4gAxta8r6Vf07ZU",
)
CHAPTER_REVENUE_SHEET_ID = os.getenv("CHAPTER_REVENUE_SHEET_ID", "")
CHAPTER_COST_SHEET_ID = os.getenv("CHAPTER_COST_SHEET_ID", "")

# Google Sheet Range / Tab Name
GOOGLE_SHEETS_RANGE = os.getenv("GOOGLE_SHEETS_RANGE", "A:Z")

# Year-one timeline settings
YEAR_ONE_START = os.getenv("YEAR_ONE_START", "2026-01")
REVALIDATE_SECONDS = int(os.getenv("REVALIDATE_SECONDS", "0"))
