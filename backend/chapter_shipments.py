import re
from datetime import date

#hand-copied from each chapter's "Shipment History" doc: the KPI table in the doc, or the inventory sheet it links to.
#every item is (name, company, units, total cost). "Total Cost" in those tables is what the shipment is worth,
#and no tracker has a separate shipping cost. weightLbs is None when the tracker doesn't give a usable weight.
SHIPMENTS = [
    {
        "chapter": "UNO",
        "name": "Project Unify",
        "date": "2025-12-04",
        "recipients": ["Monen Health Clinic", "NOAH Clinic"],
        "weightLbs": None,
        "note": (
            "KPI table is titled POTENTIAL. Its totals don't match its rows (600 boxes and 78,810 pcs "
            "listed, rows add to 641 and 101,210), and the faceshield weight reads 968,000 lbs"
        ),
        "items": [
            ("Disposable Blue Gown - Civil Use (One Size)", "", 45000, 70650.00),
            ("Level 2 Disposable Isolation Gown", "", 6000, 11880.00),
            ("Disposable Civil Isolation Gown (Size L)", "", 5000, 7850.00),
            ("Faceshield", "", 10000, 20000.00),
            ("Convenience Kit", "", 12810, 1479.00),
            ("Surgical Masks", "", 7200, 360.00),
            ("N95 Masks", "", 15200, 45600.00),
        ],
    },
    {
        "chapter": "UC Berkeley",
        "name": "American Red Cross @ Cal",
        "date": "2026-04-23",
        "recipients": ["UC Berkeley American Red Cross"],
        "weightLbs": 98.72,
        "note": "",
        "items": [
            ("Soft Disposable Blood Pressure Cuff", "WelchAllyn", 398, 1986.02),
            ("Particulate Respirator N95 (#3)", "3M", 80, 75.96),
            ('Packing Gauze 2" x 3 yards', "Fabco", 30, 315.90),
            ("SurgiCount Safety-Sponge Vaginal Gauze Roll", "Stryker Osteonics AG", 118, 480.56),
            ("Airflow Pediatric Resuscitator with Integrated Manometer", "SunMed", 10, 289.90),
            ("Airflow Infant Resuscitator with Integrated Manometer", "SunMed", 7, 223.65),
        ],
    },
    {
        "chapter": "UC Berkeley",
        "name": "Golden Hearts Nursing School",
        "date": "2026-05-06",
        "recipients": ["Golden Hearts Nursing School"],
        "weightLbs": 76.15,
        "note": "Sheet total says 1,177 units but the rows add to 1,397 (N95 row reads 460)",
        "items": [
            ("Particulate Respirator N95", "3M", 460, 437.00),
            ("Drug Reconstitution Transfer Device", "Rio", 212, 848.00),
            ("Healthometer Professional Scale", "", 2, 254.40),
            ("Pump Infusion Set", "BD Alaris", 1, 12.35),
            ("Drug Reconstitution Transfer Device", "Rio", 87, 348.00),
            ("Vial2Bag Advanced 13 mm Admixture Device", "West Pharma", 49, 183.75),
            ("Cystoscopy Pack 1", "Halyard", 10, 173.20),
            ("Adult NIV and NHF Circuit Kit", "F&P 850", 5, 325.00),
            ("Adult / Pediatric Ventilator Circuit Kit", "F&P 500", 5, 325.00),
            ("Oral/Enteral Syringe 60 mL", "NorrDia", 49, 158.76),
            ("4-Way Stopcock w/ Swivel Male Luer Lock", "Smiths Medical", 1, 12.99),
            ("4-Way Stopcock w/ Swivel Male Luer Lock", "Smiths Medical", 9, 116.91),
            ("BD Secondary Set", "Alaris Products", 40, 479.60),
            ("Urine Management Wrap", "Quick Change", 60, 108.00),
            ("SafetyGlide Needle 23G x 1", "BD", 19, 39.52),
            ("SafetyGlide Needle 25G x 5/8", "BD", 25, 52.00),
            ("BD ChloraPrep Hi-Lite Orange 10.5 mL Applicator", "BD", 19, 151.05),
            ("BD ChloraPrep Hi-Lite Orange 3 mL Applicator", "BD", 4, 10.76),
            ("1 mL TB Syringe Slip Tip with Intradermal Bevel Needle", "BD", 42, 16.80),
            ("Pump Infusion Set", "BD Alaris", 19, 234.65),
            ("Minibore Pressure Rated Extension Set, removable IV Connector", "BD MaxZero", 75, 242.25),
            ("MooreBrand Gauze Pads", "Moore Medical", 103, 51.50),
            ("MooreBrand Alcohol Prep Pad", "Moore Medical", 72, 251.28),
            ("Filtered Extension Set", "Braun", 28, 115.64),
            ("Pediatric Stethoscope", "Caliber", 1, 14.95),
        ],
    },
    {
        "chapter": "UC Berkeley",
        "name": "Berkeley WIC",
        "date": "2026-05-13",
        "recipients": ["Berkeley WIC Program"],
        "weightLbs": 11.9,
        "note": "",
        "items": [
            ("Urine Management Wrap", "Quick Change", 30, 54.00),
            ("Medical Exam Table Paper/Changing Sheets", "", 30, 43.50),
            ("Pediatric Stethoscope", "Caliber", 1, 14.95),
            ("Gen-Med Stethoscope", "McKesson General Medical", 1, 5.75),
            ("Stethoscope", "Littmann Quality", 1, 99.99),
            ("Digital Thermometer", "ADC", 1, 11.47),
            ("Thermometer Probe Covers", "WelchAllyn", 50, 6.00),
            ("Alcohol Swab", "BD", 17, 58.65),
            ("Thermometer/Otoscope", "WelchAllyn", 1, 264.95),
            ("MooreBrand Hydrocortisone Cream", "Moore Medical", 34, 8.16),
            ("Single Cotton Tipped Applicators", "Moore Medical", 33, 2.97),
        ],
    },
    {
        "chapter": "UC Berkeley",
        "name": "Berkeley Blood Pressure Project",
        "date": "2026-10-19",
        "recipients": ["Blood Pressure Project"],
        "weightLbs": 0.9,
        "note": "Stethoscope line reads $198.98, which is $1 under 2 x $99.99; kept as the sheet has it",
        "items": [
            ("Stethoscope", "", 2, 198.98),
            ("WEBCOL Alcohol Prep Pads", "Kendall", 30, 0.60),
        ],
    },
]

# USC's Historical Impact Summary sheet, hard-coded (see usc_history.py)
from backend.usc_history import shipments as _usc_shipments  # noqa: E402

SHIPMENTS += _usc_shipments()

#what each shipment's own table says the total is, used by the tests to catch typos in the rows above
SHEET_TOTALS = {
    "Project Unify": 157819.00,
    "American Red Cross @ Cal": 3371.99,
    "Golden Hearts Nursing School": 4963.36,
    "Berkeley WIC": 570.39,
    "Berkeley Blood Pressure Project": 199.58,
}

#first match wins, so more specific groups come first
CATEGORIES = [
    ("Syringes & needles", r"syringe|needle|safetyglide"),
    ("IV & infusion", r"infusion|extension set|secondary set|stopcock|vial2bag|reconstitution|transfer device"),
    ("PPE (gowns, masks, shields)", r"gown|mask|n95|respirator|faceshield|glove"),
    ("Respiratory", r"resuscitator|ventilator|\bniv\b"),
    ("Diagnostics & monitoring", r"stethoscope|thermometer|otoscope|scale|blood pressure|cuff"),
    ("Wound care & prep", r"gauze|sponge|alcohol|chloraprep|swab|cotton|applicator|hydrocortisone"),
]
OTHER = "Other supplies"


def categorize(name):
    lowered = name.lower()
    for label, pattern in CATEGORIES:
        if re.search(pattern, lowered):
            return label
    return OTHER


def build(raw):
    items = [
        {"name": n, "company": c, "units": u, "cost": cost, "category": categorize(n)}
        for n, c, u, cost in raw["items"]
    ]
    return {
        "chapter": raw["chapter"],
        "name": raw["name"],
        "date": raw["date"],
        "recipients": raw["recipients"],
        "weightLbs": raw["weightLbs"],
        "note": raw["note"],
        # a country for shipments that left the US; None means it stayed in the US
        "destination": raw.get("destination"),
        "units": sum(i["units"] for i in items),
        "cost": round(sum(i["cost"] for i in items), 2),
        "items": items,
    }


DEFAULT_SCHOOL = "UC Berkeley"


def summarize(rows):
    recipients = {name for r in rows for name in r["recipients"]}
    weights = [r["weightLbs"] for r in rows if r["weightLbs"] is not None]
    return {
        "shipments": len(rows),
        "recipientsServed": len(recipients),
        "cost": round(sum(r["cost"] for r in rows), 2),
        "units": sum(r["units"] for r in rows),
        "weightLbs": {"total": round(sum(weights), 2), "known": len(weights), "missing": len(rows) - len(weights)},
        "years": sorted({int(r["date"][:4]) for r in rows}),
    }


def recipient_rows(rows):
    #one line per recipient, with the shipments that went to it
    seen = {}
    for r in rows:
        for name in r["recipients"]:
            seen.setdefault(name, []).append(r["name"])
    return [{"name": n, "shipments": s} for n, s in sorted(seen.items(), key=lambda kv: (-len(kv[1]), kv[0]))]


def load_shipments():
    rows = sorted((build(r) for r in SHIPMENTS), key=lambda r: r["date"])
    names = sorted({r["chapter"] for r in rows}, key=lambda n: (n != DEFAULT_SCHOOL, n.lower()))
    return {
        "defaultSchool": DEFAULT_SCHOOL,
        "categories": [label for label, _ in CATEGORIES] + [OTHER],
        "schools": [
            {
                "name": name,
                "summary": summarize([r for r in rows if r["chapter"] == name]),
                "recipients": recipient_rows([r for r in rows if r["chapter"] == name]),
                "shipments": [r for r in rows if r["chapter"] == name],
            }
            for name in names
        ],
        "asOf": date.today().isoformat(),
    }
