"""USC's Historical Impact Summary, hard-coded.

Copied from the "KPI / Historical Impact Summary" sheet
(https://docs.google.com/spreadsheets/d/1Y47SUTBuvJg0XvCvwUwzSgPmwUaGtqf25usc-CwWFiQ),
which won't change again. Each row there is one shipment with a semester in its
name, so each becomes one chapter shipment dated mid-semester (Spring = March 15,
Summer = July 15, Fall = October 15). The first eleven product rows have no
semester; they add up exactly to the sheet's Spring 2022 KPI ($230,939.25), so
they are one Spring 2022 shipment.

Rows are (name, semester, pieces, value, pounds, destination). Pieces and pounds
are None where the sheet leaves them blank. Destination is a country for
shipments that name one, otherwise the shipment stayed in the US.
"""

SHEET_URL = "https://docs.google.com/spreadsheets/d/1Y47SUTBuvJg0XvCvwUwzSgPmwUaGtqf25usc-CwWFiQ"
SHEET_TOTAL = 2278002.38

SPRING_2022_ITEMS = [
    ("Disposable Blue Gown - Civil Use (One Size)", 21450, 33676.50, 2459.0423),
    ("Level 2 Disposable Isolation Gown", 4400, 8712.00, 1067.44),
    ("Disposable Civil Isolation Gown (Size L)", 200, 314.00, 50.70632),
    ("Faceshield", 9300, 18600.00, 900.24),
    ("Convenience Kit", 12810, 1479.00, 290.4),
    ("Surgical Masks", 7200, 360.00, 30),
    ("N95 Masks", 15200, 45600.00, 380),
    ("N95 Masks", 17600, 114400.00, 528),
    ("School Supplies", 100, 300.00, 40),
    ("Isolation Gowns", 600, 2580.00, 100),
    ("Lysol Wipe Packs", 1494, 4917.75, 1792.8),
]

ROWS = [
    ("Keck School of Medicine (Assorted)", "Fall 2022", 118685, 370340.95, 13648.775, None),
    ("986 Pharmacy", "Fall 2022", 186237, 27043.31, 1503.59, None),
    ("Turkey", "Spring 2023", 225691.5, 190911.72, 5066.74, "Turkey"),
    ("Aunt Flow", "Spring 2023", 1000, 270.00, 17.117, None),
    ("Shaving Shipment", "Spring 2023", 52558, 54002.59, 2440.9725, None),
    ("Myanmar Suture Shipment", "Summer 2023", 465, 7399.59, 12.92, "Myanmar"),
    ("Claris Shipment", "Fall 2023", 272900, 24540.96, 2333.74, None),
    ("The People's Concern/Miriam's House", "Fall 2023", 5292, 627.00, 69.92, None),
    ("Philippines Shipment", "Fall 2023", 295, 4672.00, 388.00, "Philippines"),
    ("Ukraine Shipment", "Fall 2023", 4740, 6601.55, 250.00, "Ukraine"),
    ("LA Shelters Shipment", "Spring 2024", 9435, 22747.29, 2497.88, None),
    ("Myanmar NUG Shipment", "Spring 2024", 2961, 4774.14, 98.37, "Myanmar"),
    ("New Member Shipment", "Spring 2024", 8170, 4585.00, 70.82, None),
    ("Health Fair Shipment", "Spring 2024", 512, 308.29, 185.504, None),
    ("UCI Flying Samaritans", "Fall 2024", 470, 636.44, 54.868, None),
    ("Tapestry LA Church", "Fall 2024", 7183, 763.39, 221.76, None),
    ("CCED", "Fall 2024", 4524, 1130.00, 113.96, None),
    ("SALEF", "Fall 2024", 1000, 1400.00, 54.34, None),
    ("Shelter Partnership", "Fall 2024", 9300, 2401.00, 288.42, None),
    ("The People Concern", "Fall 2024", 627, 1441.14, 272.272, None),
    ("Best Friends", "Fall 2024", 31687, 5235.84, 2613.6, None),
    ("Stray Cat Alliance", "Fall 2024", 8720, 12644.09, 643.83, None),
    ("Shelter Partnership (2nd)", "Fall 2024", 11000, 10844.47, 2403.5, None),
    ("SCU", "Fall 2024", 4360, 1824.59, 24.94756, None),
    ("Helping Hands (Pakistan)", "Spring 2025", 503356, 42186.04, 9106.45868, "Pakistan"),
    ("Fire Relief (masks)", "Spring 2025", 518716, 9751.79, 244.64, None),
    ("Helping Hands Senior Foundation (Fox News)", "Spring 2025", 285823, 45081.45, 188.42, None),
    ("Stray Cat Alliance", "Spring 2025", 10280, 1965.93, 94.072, None),
    ("Tapestry LA Church", "Spring 2025", 10770, 7408.51, 1185.008, None),
    ("Share A Meal", "Spring 2025", 480, 420.00, 17.16, None),
    ("USC Flying Samaritans", "Spring 2025", 3000, 599.40, 1316.04, None),
    ("USC Medlife", "Spring 2025", 1000, 490.00, 792, None),
    ("Long Beach", "Spring 2025", 82190, 47017.43, 1636.118, None),
    ("Stray Cat Alliance (2nd)", "Spring 2025", None, 5644.00, None, None),
    ("Shelter Partnership", "Spring 2025", None, 13024.00, None, None),
    ("Wound Walk", "Spring 2025", 553, 870.40, 39.22, None),
    ("Nigeria Shipment", "Summer 2025", None, 572512.23, None, "Nigeria"),
    ("Long Beach N95 Shipment", "Fall 2025", None, 399360.00, None, None),
    ("Burma", "Spring 2026", None, 552.77, None, "Myanmar"),
    ("Shipment Day 4/24 - Burma + Nepal +6", "Spring 2026", None, 25869.85, None, "Myanmar"),
    ("Americares", "Spring 2026", None, 67302.43, None, None),
    ("Crescent Clinic Swap 6/5", "Spring 2026", None, 71.25, None, None),
    ("Open Shipment - Peru", "Fall 2026", 8195, 9790.30, None, "Peru"),
    ("Liberia Face Shield Shipment", "Fall 2026", None, 40000.00, None, "Liberia"),
]

_MONTH = {"Spring": "03", "Summer": "07", "Fall": "10"}
_NOTE = "From USC's Historical Impact Summary sheet; dated mid-semester because the sheet only gives the semester."


def _date(semester):
    season, year = semester.split()
    return f"{year}-{_MONTH[season]}-15"


def shipments():
    """USC rows in the same shape as chapter_shipments.SHIPMENTS."""
    out = [
        {
            "chapter": "USC",
            "name": "Early PPE donations (Spring 2022)",
            "date": _date("Spring 2022"),
            "recipients": ["Early PPE donations"],
            "weightLbs": round(sum(w for *_, w in SPRING_2022_ITEMS), 2),
            "note": _NOTE,
            "items": [(name, "", pcs, value) for name, pcs, value, _ in SPRING_2022_ITEMS],
        }
    ]
    for name, semester, pcs, value, pounds, destination in ROWS:
        out.append(
            {
                "chapter": "USC",
                "name": f"{name} ({semester})",
                "date": _date(semester),
                "recipients": [name.replace(" (2nd)", "")],
                "weightLbs": pounds,
                "note": _NOTE,
                "destination": destination,
                "items": [(name.replace(" (2nd)", ""), "", int(pcs or 0), value)],
            }
        )
    return out
