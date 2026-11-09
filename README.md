# Inventory Management and Analytics System

This project uses a React/Vite frontend, a FastAPI backend, and Google Sheets as the inventory data source.

## Project structure

```text
backend/       FastAPI application
frontend/      React application
api/           Serverless API entry point
```

The legacy `streamlit_app/` directory is not used and is ignored by Git.

## Combined dashboard (Home, Operations, Finance, Expansion)

The finance dashboard (blueprints4pangaea/financeDashboard) and the expansion
dashboard (blueprints4pangaea/expansionDash) now live here, on this repo's
Vite + FastAPI stack and in its look.

| Tab | What it shows | Data |
|---|---|---|
| Home | Key ops, finance and expansion numbers; value of supplies donated year over year; net finances | all of the below |
| Operations | The operations dashboard as before. Shipment KPIs and the past shipments archive now include every chapter's shipments (master sheet plus chapter Shipment History docs not yet in it) and have a chapter filter. Inventory is HQ only | inventory sheet, master shipment sheet, `backend/chapter_shipments.py` |
| Finance | Revenue, Cost, and an Add-an-entry form | Revenue and Expenses sheets (`/finance`, `backend/finance/`) |
| Expansion | Chapter Scores | scores sheet (`/chapter-scores`) |

- The **chapter** and **semester** filters next to the tabs apply to Home and Finance. Operations has its own chapter filter on Shipment KPIs and Past Shipments.
- Chapter names are matched through one list with aliases: `frontend/src/shared/chapters.js`.
  Add a spelling there when a sheet uses a new one.
- Semesters come from dates: Winter = Jan to Apr, Spring/Summer = May to Aug, Fall = Sep to Dec
  (`frontend/src/shared/semester.js`).
- The master shipment sheet is the source of truth for shipments and shipping cost, so finance
  leaves out any "Shipping" category.

Environment variables for the new tabs (set in Vercel, never in the repo):

- Finance: `REVENUE_CSV_URL`, `EXPENSES_CSV_URL` (default to the HQ sheets), `CHAPTER_REVENUE_CSV_URL`,
  `CHAPTER_COST_CSV_URL`, and `GOOGLE_SHEETS_CREDENTIALS_JSON` (or `GOOGLE_SERVICE_ACCOUNT_JSON`) for
  the Add-an-entry form. Without a reachable sheet, Finance shows made-up sample data from
  `backend/finance_sample/` and says so.
- Chapter scores: `SCORES_CSV_URLS` or `GOOGLE_SHEETS_CREDENTIALS_JSON`. Until then it uses the saved
  copy in `backend/snapshot/` (HQ-only scores, so keep this repo private).

## Run locally

Open two terminals from the repository root.

### Backend

```powershell
cd backend
py -m pip install -r requirements.txt
$env:GOOGLE_SHEETS_CREDENTIALS_PATH = (Resolve-Path ".\credentials.json")
py -m uvicorn app:app --reload
```

The API is available at `http://127.0.0.1:8000` and its interactive documentation is at `http://127.0.0.1:8000/docs`.

### React frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies the React app's `/items` and `/kpis` requests to the local FastAPI server.

For a separately hosted backend, set `VITE_API_BASE` to its public URL before building the frontend.
