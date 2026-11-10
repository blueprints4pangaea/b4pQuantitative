import csv
import json
import os
import re

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_DIR = os.path.join(HERE, "snapshot")

# the [SCORES] Chapter Progress Evaluation sheet
# aak's standardized copy (2026-11-10); Katelyn's original, in the older layout,
# is 1K3tqoI0kFz3S_NmDi1V1i2JF5Y_UDFU85Fk1_eQQZak and still reads fine if set here
SHEET_ID = os.getenv("SCORES_SHEET_ID", "1yeO750FRyjNsC3Mx8EuiHf4U1H1iHmRmaBwRgQvNRSg")

# katelyn keeps one table per stage on each tab, laid out left column first then top to bottom
STAGES = ["Beginner", "Intermediate", "Advanced"]

SEMESTER = re.compile(r"^([WSF])(\d{2})$")
TAB_NAME = re.compile(r"^[WSF]\d{2}-[WSF]\d{2}$")


def semester_key(label):
    season, year = SEMESTER.match(label).groups()
    return int(year) * 3 + "WSF".index(season)


SEMESTER_PREFIX = re.compile(r"^([WSF]\d{2})\b")
PLACEHOLDER = re.compile(r"^(column \d+)?$", re.I)
#the semesters B4P scores, in order through the year (no spring/summer tabs so far)
SCORED_SEASONS = "WF"


def semester_label(raw):
    m = SEMESTER_PREFIX.match(raw.strip().upper())
    return m.group(1) if m else None


def next_semester(label):
    season, year = label[0], int(label[1:])
    i = SCORED_SEASONS.index(season) if season in SCORED_SEASONS else 0
    if i + 1 < len(SCORED_SEASONS):
        return f"{SCORED_SEASONS[i + 1]}{year:02d}"
    return f"{SCORED_SEASONS[0]}{year + 1:02d}"


def cell(grid, r, c):
    if r < len(grid) and c < len(grid[r]):
        return grid[r][c].strip()
    return ""


def find_tables(grid):
    tables = []
    for r, row in enumerate(grid):
        for c in range(len(row)):
            if cell(grid, r, c).lower() != "chapter":
                continue

            #semester headers to the right of "Chapter". Headers aren't always tidy:
            #"F26 (Oct.)" counts as F26, and a placeholder like "Column 6" right
            #after a semester is taken as the next semester in order
            sems = {}
            for cc in range(c + 1, len(row)):
                label = semester_label(cell(grid, r, cc))
                if not label and sems and PLACEHOLDER.match(cell(grid, r, cc)):
                    label = next_semester(list(sems.values())[-1])
                if not label:
                    break
                sems[cc] = label
            if not sems:
                continue

            #chapter rows until the first blank
            rows = []
            rr = r + 1
            while cell(grid, rr, c) and cell(grid, rr, c).lower() != "chapter":
                rows.append((cell(grid, rr, c), {label: cell(grid, rr, cc) for cc, label in sems.items()}))
                rr += 1
            tables.append({"col": c, "row": r, "semesters": list(sems.values()), "rows": rows})

    return sorted(tables, key=lambda t: (t["col"], t["row"]))


def merge_tabs(tabs):
    chapters = {}
    all_sems = set()
    stage_sems = set()

    #oldest tab first so newer tabs win
    parsed = []
    for title, grid in tabs:
        tables = find_tables(grid)
        if len(tables) != len(STAGES):
            raise ValueError(f"tab {title}: expected {len(STAGES)} stage tables, found {len(tables)}")
        latest = max((s for t in tables for s in t["semesters"]), key=semester_key)
        parsed.append((latest, tables))
    parsed.sort(key=lambda p: semester_key(p[0]))

    for latest, tables in parsed:
        stage_sems.add(latest)
        for stage, table in zip(STAGES, tables):
            all_sems.update(table["semesters"])
            for name, values in table["rows"]:
                #"MSU**" marks a chapter that moved stage; it's still MSU
                name = name.rstrip("*").strip()
                ch = chapters.setdefault(name, {"name": name, "scores": {}, "stages": {}, "unscored": []})
                #the tab's stage is where the chapter sits as of its latest semester
                ch["stages"][latest] = stage

                for sem, raw in values.items():
                    if not raw:
                        continue
                    if raw.upper() == "MISSING":
                        if sem not in ch["scores"] and sem not in ch["unscored"]:
                            ch["unscored"].append(sem)
                        continue
                    try:
                        score = float(raw)
                    except ValueError:
                        print(f"skipping {name} {sem}: not a score ({raw!r})")
                        continue
                    ch["scores"][sem] = int(score) if score.is_integer() else score
                    if sem in ch["unscored"]:
                        ch["unscored"].remove(sem)

    return {
        "semesters": sorted(all_sems, key=semester_key),
        "stageSemesters": sorted(stage_sems, key=semester_key),
        "chapters": sorted(chapters.values(), key=lambda ch: ch["name"].lower()),
    }


def read_csv(text):
    return list(csv.reader(text.splitlines()))


def tabs_from_snapshot():
    tabs = []
    for fname in sorted(os.listdir(SNAPSHOT_DIR)):
        if fname.endswith(".csv"):
            with open(os.path.join(SNAPSHOT_DIR, fname), newline="", encoding="utf-8") as f:
                tabs.append((fname[:-4], list(csv.reader(f))))
    return tabs


def tabs_from_csv_urls(urls):
    tabs = []
    for i, url in enumerate(urls):
        res = requests.get(url, timeout=15)
        res.raise_for_status()
        res.encoding = "utf-8"
        tabs.append((f"tab {i + 1}", read_csv(res.text)))
    return tabs


# --- the standardized layout (2026-11): one tab per semester named like "F26"
# (Chapter | Score | Stage), a "Chapters" roster (Chapter | Standing | Notes) and
# a formula summary, "Chapter Scores", whose header row lists the semesters in use

SEMESTER_TAB = re.compile(r"^[WSF]\d{2}$")


def _header_map(row):
    return {cell.strip().lower(): i for i, cell in enumerate(row) if cell.strip()}


def merge_semester_tabs(semester_tabs, roster=None, summary=None):
    """semester_tabs: [("F26", grid)]. roster: the Chapters grid. summary: the Chapter Scores grid.

    Only semesters named in the summary's header row count, so a tab that's been
    duplicated but not yet added there (a draft) stays off the dashboard.
    """
    listed = None
    for row in summary or []:
        if any(c.strip().lower() == "chapter" for c in row):
            listed = {semester_label(c) for c in row if semester_label(c) and SEMESTER.match(c.strip().upper())}
            break

    chapters = {}
    sems, stage_sems = set(), set()
    for title, grid in semester_tabs:
        sem = title.strip().upper()
        if listed is not None and sem not in listed:
            continue
        if not grid:
            continue
        cols = _header_map(grid[0])
        if "chapter" not in cols or "score" not in cols:
            continue
        sems.add(sem)
        for r in grid[1:]:
            name = cell([r], 0, cols["chapter"])
            if not name:
                continue
            ch = chapters.setdefault(name, {"name": name, "scores": {}, "stages": {}, "unscored": []})
            raw = cell([r], 0, cols["score"])
            stage = cell([r], 0, cols["stage"]) if "stage" in cols else ""
            if stage in STAGES:
                ch["stages"][sem] = stage
                stage_sems.add(sem)
            if not raw:
                continue
            if raw.upper() == "MISSING":
                ch["unscored"].append(sem)
                continue
            try:
                score = float(raw)
            except ValueError:
                print(f"skipping {name} {sem}: not a score ({raw!r})")
                continue
            ch["scores"][sem] = int(score) if score.is_integer() else score

    if roster:
        cols = _header_map(roster[0])
        for r in roster[1:]:
            name = cell([r], 0, cols.get("chapter", 0))
            if name in chapters:
                if "standing" in cols:
                    chapters[name]["standing"] = cell([r], 0, cols["standing"])
                if "notes" in cols:
                    chapters[name]["notes"] = cell([r], 0, cols["notes"])

    return {
        "semesters": sorted(sems, key=semester_key),
        "stageSemesters": sorted(stage_sems, key=semester_key),
        "chapters": sorted(chapters.values(), key=lambda ch: ch["name"].lower()),
    }


def tabs_from_gspread(creds_json):
    import gspread
    from google.oauth2.service_account import Credentials

    creds = Credentials.from_service_account_info(
        json.loads(creds_json),
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    sheet = gspread.authorize(creds).open_by_key(SHEET_ID)
    worksheets = sheet.worksheets()
    titles = {ws.title.strip(): ws for ws in worksheets}
    semester_tabs = [ws for ws in worksheets if SEMESTER_TAB.match(ws.title.strip())]
    if semester_tabs:
        #standardized layout
        grids = {t: titles[t].get_all_values() for t in ("Chapters", "Chapter Scores") if t in titles}
        return merge_semester_tabs(
            [(ws.title, ws.get_all_values()) for ws in semester_tabs],
            roster=grids.get("Chapters"),
            summary=grids.get("Chapter Scores"),
        )
    #older layout: only the W25-F25 style tabs
    return merge_tabs([(ws.title, ws.get_all_values()) for ws in worksheets if TAB_NAME.match(ws.title.strip())])


LAST_ERROR = None


def load_scores():
    csv_urls = [u.strip() for u in os.getenv("SCORES_CSV_URLS", "").split(",") if u.strip()]
    creds_json = os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON") or os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")

    #live sheet first, saved copy if that fails. The reason it failed is kept in
    #LAST_ERROR so /chapter-scores can show it (no need to dig through Vercel logs)
    global LAST_ERROR
    LAST_ERROR = None if (csv_urls or creds_json) else "no GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SERVICE_ACCOUNT_JSON set"
    try:
        if csv_urls:
            return merge_tabs(tabs_from_csv_urls(csv_urls)), "sheet"
        if creds_json:
            return tabs_from_gspread(creds_json), "sheet"
    except Exception as exc:
        LAST_ERROR = f"{type(exc).__name__}: {exc}"[:300]
        print(f"couldn't read the scores sheet, using snapshot: {exc}")

    #saved copy until the service account gets access to the sheet
    tabs = tabs_from_snapshot() if os.path.isdir(SNAPSHOT_DIR) else []
    if not tabs:
        raise RuntimeError("scores sheet isn't connected and there's no saved copy in backend/snapshot/")
    return merge_tabs(tabs), "snapshot"
