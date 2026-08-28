# -*- coding: utf-8 -*-
"""BUP (barn- och ungdomspsykiatri) — and now, optionally, ADULT psychiatry —
waiting times, region grain, median days waited. Converts the MANUAL browser
CSV export(s) from Socialstyrelsen's väntetider database into tidy JSON.

===============================================================================
THIS IS NOT LIKE THE fetch_*.py SCRIPTS. READ THIS FIRST.
===============================================================================
Every fetch_*.py in this folder calls a stable JSON API and can be re-run
unattended. This one CANNOT: the source (sdb.socialstyrelsen.se's väntetider
databases) is a classic ASP.NET page whose selection is 600+ nameless
client-side checkboxes assembled into hidden POST fields by its own JS, with
no documented JSON API. Getting data out means using its built-in
"Spara tabellen som: csv" export button in a real browser.

So the "fetch" step here is a MANUAL procedure, and this data GOES STALE — see
`valid_until` below, which every row now carries so the site can grey the
figure out once it's old rather than showing a year-old median as current.

-------------------------------------------------------------------------------
MANUAL EXPORT PROCEDURE
-------------------------------------------------------------------------------
BUP first visit (the one that's checked in and always produced):
  1. Open https://sdb.socialstyrelsen.se/vantetider-barn-och-ungdomspsykiatrin/
  2. Select: Status=Genomförd (completed), Fas=Första besök (first visit),
     Year=all, Months=all, Dimension=Medianvärde (50th percentile),
     Region=all, Kön=Alla, Ålder=Alla åldrar.
  3. Pivot: Region (rows) x Månad (columns).
  4. Export CSV -> data/raw/vantetider_bup_manual_export.csv

BUP treatment / assessment goals (the utrednings- & behandlingsgaranti,
NOT only first visit — asked for, not yet exported):
  - Repeat steps 1-4 with Fas=Fördjupad utredning  -> save as
    data/raw/vantetider_bup_assessment_export.csv
  - Repeat with Fas=Påbörjad behandling            -> save as
    data/raw/vantetider_bup_treatment_export.csv

Adult specialised psychiatry waiting times (a DIFFERENT database, same export
mechanics):
  - Open https://sdb.socialstyrelsen.se/vantetider-specialiserad-vard/
    (or the "specialiserad vård" waiting-times DB), filter to the psychiatry
    verksamhetsområde, Fas=Första besök, same other selections, same
    Region x Månad pivot.
  - Save as data/raw/vantetider_vuxenpsyk_forstabesok_export.csv

This script AUTO-DISCOVERS whichever of the files in SOURCES below exist in
data/raw/ and merges them into one output, tagging each row with its
`indicator` and `care_area`. Missing files are simply skipped — running it
with only the first-visit CSV present behaves exactly as before.

  5. python pipeline/convert_vantetider_bup.py
  6. python pipeline/build_kurvan_data.py

-------------------------------------------------------------------------------
WHAT THE NUMBERS MEAN
-------------------------------------------------------------------------------
"Median days waited, among COMPLETED contacts in that month" — not a count of
people, not everyone currently waiting. A short median can mean short waits OR
that only fast cases have completed. Kurvan's "need vs. response" framing (no
ranking, no causal language) applies here. The source holds only a rolling
~12-month window — this is a CURRENT-SNAPSHOT indicator, not a trend line.

SUPPRESSION: cells with too few contacts show as `N` in the export and are
treated as missing (no fabricated fallback).

Output: ../data/processed/vantetider_bup.json
Run:    python pipeline/convert_vantetider_bup.py
"""
import csv
import json
import os
from datetime import date

HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(PROCESSED_DIR, exist_ok=True)

# raw filename -> how to tag every row it produces. Only the first entry is
# checked in; the rest are picked up automatically once a human exports them.
SOURCES = {
    "vantetider_bup_manual_export.csv": {
        "indicator": "bup_vantetid_forstabesok_median_dagar", "care_area": "bup", "phase": "first_visit"},
    "vantetider_bup_assessment_export.csv": {
        "indicator": "bup_vantetid_utredning_median_dagar", "care_area": "bup", "phase": "assessment"},
    "vantetider_bup_treatment_export.csv": {
        "indicator": "bup_vantetid_behandling_median_dagar", "care_area": "bup", "phase": "treatment"},
    "vantetider_vuxenpsyk_forstabesok_export.csv": {
        "indicator": "vuxenpsyk_vantetid_forstabesok_median_dagar", "care_area": "vuxenpsyk", "phase": "first_visit"},
}

# How long after the newest month in an export we still consider it current.
# Past this the site greys the figure and says it may be out of date.
VALID_MONTHS = 6

REGION_CODE = {
    "Stockholm": "01", "Uppsala": "03", "Södermanland": "04",
    "Östergötland": "05", "Jönköping": "06", "Kronoberg": "07",
    "Kalmar": "08", "Gotland": "09", "Blekinge": "10", "Skåne": "12",
    "Halland": "13", "Västra Götaland": "14", "Värmland": "17",
    "Örebro": "18", "Västmanland": "19", "Dalarna": "20",
    "Gävleborg": "21", "Västernorrland": "22",
    "Jämtland Härjedalen": "23", "Västerbotten": "24", "Norrbotten": "25",
}
MONTH_NUM = {
    "Januari": 1, "Februari": 2, "Mars": 3, "April": 4, "Maj": 5, "Juni": 6,
    "Juli": 7, "Augusti": 8, "September": 9, "Oktober": 10,
    "November": 11, "December": 12,
}


def num(val):
    """Swedish decimal comma; 'N' (and anything non-numeric) means
    suppressed/too-few-to-publish, not zero."""
    val = (val or "").strip()
    if not val:
        return None
    try:
        return float(val.replace(",", "."))
    except ValueError:
        return None  # e.g. "N"


def add_months(y, m, delta):
    idx = (y * 12 + (m - 1)) + delta
    return idx // 12, idx % 12 + 1


def last_day_of(y, m):
    ny, nm = add_months(y, m, 1)
    from datetime import date as _d, timedelta
    return (_d(ny, nm, 1) - timedelta(days=1)).isoformat()


def parse_export(path, tag):
    with open(path, encoding="utf-8") as f:
        rows = list(csv.reader(f, delimiter=";"))
    # Row 0: title. Row 1: year per column. Row 2: "Region" + month names.
    years = [c.strip() for c in rows[1]]
    months = [c.strip() for c in rows[2]]

    records = []
    for row in rows[3:]:
        if not row or not row[0].strip():
            continue
        region_name = row[0].strip()
        county_code = "00" if region_name == "Alla regioner" else REGION_CODE.get(region_name)
        if county_code is None:
            continue  # footer row ("Socialstyrelsens statistikdatabas ...")
        for i, cell in enumerate(row[1:], start=1):
            month_num = MONTH_NUM.get(months[i] if i < len(months) else None)
            year = num(years[i]) if i < len(years) else None
            value = num(cell)
            if month_num is None or year is None or value is None:
                continue
            records.append({
                "county_code": county_code,
                "indicator": tag["indicator"],
                "care_area": tag["care_area"],
                "phase": tag["phase"],
                "year": int(year),
                "month": month_num,
                "value": value,
                "sex": "T",
            })
    return records


def main():
    all_records = []
    used = []
    for fname, tag in SOURCES.items():
        path = os.path.join(RAW_DIR, fname)
        if not os.path.exists(path):
            continue
        recs = parse_export(path, tag)
        # per-source freshness, stamped onto every row of that source
        fetched = date.fromtimestamp(os.path.getmtime(path)).isoformat()
        newest_y, newest_m = max((r["year"], r["month"]) for r in recs)
        vy, vm = add_months(newest_y, newest_m, VALID_MONTHS)
        valid_until = last_day_of(vy, vm)
        for r in recs:
            r["fetched"] = fetched
            r["valid_until"] = valid_until
        all_records.extend(recs)
        used.append(f"{fname} ({len(recs)} rows, newest {newest_y}-{newest_m:02d}, "
                    f"valid_until {valid_until})")

    if not all_records:
        raise SystemExit(
            f"FATAL: no väntetider export found in {RAW_DIR}. Expected at least "
            f"vantetider_bup_manual_export.csv — see this script's docstring for "
            f"the manual export procedure.")

    out_path = os.path.join(PROCESSED_DIR, "vantetider_bup.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=1)

    print(f"[vantetider-bup] wrote {out_path}  ({len(all_records)} records)")
    for line in used:
        print(f"[vantetider-bup]   from {line}")
    if date.today().isoformat() > min(r["valid_until"] for r in all_records):
        print("[vantetider-bup] NOTE: at least one export is already past its "
              "valid_until — re-export before trusting the site's current figure.")
    print("[vantetider-bup] MANUAL SOURCE — see docstring before assuming this "
          "can just be re-run for fresh data.")


if __name__ == "__main__":
    main()
