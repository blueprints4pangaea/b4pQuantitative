from backend.chapter_shipments import OTHER, SHEET_TOTALS, categorize, load_shipments


def schools():
    return {s["name"]: s for s in load_shipments()["schools"]}


def by_name():
    return {sh["name"]: sh for school in schools().values() for sh in school["shipments"]}


def test_item_costs_add_up_to_each_sheet_total():
    for name, shipment in by_name().items():
        assert abs(shipment["cost"] - SHEET_TOTALS[name]) < 0.01, name


def test_school_order_and_default():
    data = load_shipments()
    assert data["defaultSchool"] == "UC Berkeley"
    assert [s["name"] for s in data["schools"]] == ["UC Berkeley", "UNO"]


def test_summary_per_school():
    s = schools()
    assert s["UC Berkeley"]["summary"]["shipments"] == 4
    assert s["UC Berkeley"]["summary"]["recipientsServed"] == 4
    assert s["UC Berkeley"]["summary"]["cost"] == round(3371.99 + 4963.36 + 570.39 + 199.58, 2)
    assert s["UNO"]["summary"]["shipments"] == 1
    assert s["UNO"]["summary"]["recipientsServed"] == 2
    assert s["UNO"]["summary"]["cost"] == 157819.00


def test_units_come_from_rows_not_sheet_totals():
    ships = by_name()
    assert ships["American Red Cross @ Cal"]["units"] == 643
    assert ships["Berkeley WIC"]["units"] == 199
    assert ships["Berkeley Blood Pressure Project"]["units"] == 32
    assert ships["Project Unify"]["units"] == 101210


def test_weight_missing_for_unify_only():
    assert schools()["UC Berkeley"]["summary"]["weightLbs"] == {"total": 187.67, "known": 4, "missing": 0}
    assert schools()["UNO"]["summary"]["weightLbs"]["missing"] == 1


def test_shipments_sorted_oldest_first():
    dates = [sh["date"] for sh in schools()["UC Berkeley"]["shipments"]]
    assert dates == sorted(dates)


def test_recipients_listed_with_their_shipments():
    rec = {r["name"]: r["shipments"] for r in schools()["UNO"]["recipients"]}
    assert rec == {"Monen Health Clinic": ["Project Unify"], "NOAH Clinic": ["Project Unify"]}


def test_categories():
    assert categorize("Oral/Enteral Syringe 60 mL") == "Syringes & needles"
    assert categorize("Pump Infusion Set") == "IV & infusion"
    assert categorize("Particulate Respirator N95 (#3)") == "PPE (gowns, masks, shields)"
    assert categorize("Airflow Infant Resuscitator with Integrated Manometer") == "Respiratory"
    assert categorize("Soft Disposable Blood Pressure Cuff") == "Diagnostics & monitoring"
    assert categorize("Packing Gauze 2\" x 3 yards") == "Wound care & prep"
    assert categorize("Convenience Kit") == OTHER


def test_every_item_has_a_category():
    for shipment in by_name().values():
        for item in shipment["items"]:
            assert item["category"]
