from backend.scores import merge_tabs

# made-up chapters in the same layout as the real sheet (real scores stay out of the repo)
OLD_TAB = [
    ["", "Chapter Status:", "91-100 Excellent", "41-65 Weak", "New Chapter", "", "", "", ""],
    ["Chapter ", "W25", "F25", "Δ Score", "", "Chapter ", "W25", "F25", "Δ Score"],
    ["Alpha", "", "83", "", "", "Delta", "72", "", ""],
    ["Beta ", "69", "52", "-17", "", "Echo", "66", "63", "-3"],
    ["Gamma", "79", "22", "-57", "", "", "", "", ""],
    ["", "", "", "", "", "Chapter ", "W25", "F25", "Δ Score"],
    ["", "", "", "", "", "Foxtrot", "95", "94", "-1"],
]

NEW_TAB = [
    ["Chapter ", "W25", "F25", "W26", "Δ Score", "", "Chapter ", "W25", "F25", "W26", "Δ Score", "", "# Chapters"],
    ["Beta ", "69", "52", "63", "11", "", "Alpha", "", "83", "88", "5", "", "9"],
    ["Gamma", "79", "22", "", "", "", "Echo", "66", "63", "72", "9", "", ""],
    ["Delta", "72", "MISSING", "76", "4", "", "", "", "", "", "", "", ""],
    ["Hotel", "", "", "60", "60", "", "Chapter ", "W25", "F25", "W26", "Δ Score", "", ""],
    ["", "", "", "", "", "", "Foxtrot", "95", "94", "94", "0", "", ""],
]


def by_name():
    #newer tab passed first on purpose
    data = merge_tabs([("F25-W26", NEW_TAB), ("W25-F25", OLD_TAB)])
    return data, {ch["name"]: ch for ch in data["chapters"]}


def test_semesters_in_order():
    data, _ = by_name()
    assert data["semesters"] == ["W25", "F25", "W26"]
    assert data["stageSemesters"] == ["F25", "W26"]


def test_stage_moves():
    _, ch = by_name()
    #alpha moved up, delta dropped back
    assert ch["Alpha"]["stages"] == {"F25": "Beginner", "W26": "Intermediate"}
    assert ch["Delta"]["stages"] == {"F25": "Intermediate", "W26": "Beginner"}
    assert ch["Foxtrot"]["stages"]["W26"] == "Advanced"


def test_missing_and_blank():
    _, ch = by_name()
    assert ch["Delta"]["unscored"] == ["F25"]
    assert "W26" not in ch["Gamma"]["scores"]
    #trailing space in the sheet
    assert "Beta" in ch


def test_newer_tab_wins():
    old = [r[:] for r in OLD_TAB]
    old[3][2] = "50"
    data = merge_tabs([("W25-F25", old), ("F25-W26", NEW_TAB)])
    beta = next(c for c in data["chapters"] if c["name"] == "Beta")
    assert beta["scores"] == {"W25": 69, "F25": 52, "W26": 63}


def test_untidy_headers_and_moved_markers():
    from backend.scores import find_tables

    grid = [
        ["Chapter ", "W25", "F25", "W26", "F26 (Oct.)", "Δ Score", "", "Chapter ", "W26", "Column 6"],
        ["Wayne ", "69", "52", "63", "74", "11", "", "MSU**", "76", "68"],
    ]
    tables = find_tables(grid)
    assert [t["semesters"] for t in tables] == [["W25", "F25", "W26", "F26"], ["W26", "F26"]]


def test_standardized_layout():
    from backend.scores import merge_semester_tabs

    tabs = [
        ("W26", [["Chapter", "Score", "Stage"], ["Alpha", "60", "Beginner"], ["Beta", "MISSING", "Intermediate"]]),
        ("F26", [["Chapter", "Score", "Stage"], ["Alpha", "72", "Intermediate"], ["Beta", "80", "Intermediate"]]),
        #duplicated but not added to the summary yet: a draft
        ("W27", [["Chapter", "Score", "Stage"], ["Alpha", "99", "Advanced"]]),
    ]
    roster = [["Chapter", "Standing", "Notes"], ["Alpha", "Active", ""], ["Beta", "Offboarding", "Leaving"]]
    summary = [["", "Chapter", "Standing", "Stage", "Latest", "W26", "F26"]]
    data = merge_semester_tabs(tabs, roster, summary)
    assert data["semesters"] == ["W26", "F26"]
    assert data["stageSemesters"] == ["W26", "F26"]
    ch = {c["name"]: c for c in data["chapters"]}
    assert ch["Alpha"]["scores"] == {"W26": 60, "F26": 72}
    assert ch["Alpha"]["stages"] == {"W26": "Beginner", "F26": "Intermediate"}
    assert ch["Beta"]["unscored"] == ["W26"]
    assert ch["Beta"]["standing"] == "Offboarding"
