# -*- coding: utf-8 -*-
"""BUP (barn- och ungdomspsykiatri / child & adolescent psychiatry) waiting
times, region grain — median days waited for a completed first visit.

===============================================================================
THIS IS NOT LIKE THE OTHER SCRIPTS IN THIS FOLDER. READ THIS FIRST.
===============================================================================
Every other fetch_*.py in this folder calls a small, stable JSON API and can
be re-run unattended (`python fetch_X.py`) to get fresh data any time. This
one CANNOT: the source — Socialstyrelsen's väntetider-barn-och-
ungdomspsykiatrin database (sdb.socialstyrelsen.se) — is a classic ASP.NET
WebForms page with no JSON API behind it. Getting data out of it means using
its own built-in "Spara tabellen som: csv" export button in an actual
browser (its `__VIEWSTATE`/`__PREVIOUSPAGE` postback tokens are single-use
and session-tied — they can't be scripted the way the other sources'
plain URL parameters can, short of a much more fragile browser-session
scraper this project has deliberately chosen not to build).

So the "fetch" step here is MANUAL, not automated:
  1. Open https://sdb.socialstyrelsen.se/vantetider-barn-och-ungdomspsykiatrin/
  2. Select: Status=Completed, Phase=First visit, Year=select all,
     Months=select all, Dimensions=Median waiting time (50th percentile),
     Region=select all, Legal gender=All genders, Age at year-end=All ages.
  3. On the results page, set the pivot to Region (rows) x Month (columns).
  4. Export via the "csv" link, save as ../data/raw/vantetider_bup_manual_export.csv
     (already done once — see that file, exported 2026-08-24).
  5. Run this script to convert it to ../data/processed/vantetider_bup.json.

REFRESH MODEL: this data will go stale and needs a human to repeat steps
1-5 periodically — there is no `python fetch_....py` that keeps it current.
Worse, the source itself only holds a ROLLING ~12-MONTH WINDOW (its own
page said "Last updated: 2026-07-31, monthly data July 2025 - June 2026") —
this is fundamentally a CURRENT-SNAPSHOT indicator, not a multi-year
trend line the way self-harm/suicide/psych/antidep are. Do not build a
"BUP over time" chart expecting years of history; there isn't any to have.

FUTURE MANUAL PULL — MORE THAN JUST BUP FIRST VISIT: the same database also
holds the other BUP phases (fördjupad utredning / assessment, and
behandling / treatment — the "utrednings- och behandlingsgaranti" 30+30-day
targets), and there is a SEPARATE sibling database for ADULT specialised
psychiatry waiting times. Neither has a JSON API — same WebForms export as
below. To bring them in, redo steps 1-5 with Phase set to "Fördjupad
utredning" and "Behandling" as well as "First visit" (one export per phase,
or all phases pivoted into the column axis), keep the same
Region x Month pivot, and extend REGION_CODE / the INDICATOR mapping here to
tag each phase. The adult-psychiatry database is a different URL
(sdb.socialstyrelsen.se, "väntetider specialiserad vård") but the same
export mechanics. Deferred for now — this file still only carries the
first-visit CSV.

WHAT THE NUMBERS MEAN: "median days waited, among COMPLETED first-visit
contacts, in that month" — not a count of people, not everyone currently
waiting (that's the separate "Pending" status this pull didn't request).
A short median can mean short waits OR that only easy/fast cases have
completed so far that month; a long one can reflect a real backlog. This
project's "need vs. response" framing (not ranking, not causal language —
see CLAUDE.md's Interpretation rules) applies here same as everywhere else:
don't rank regions by this number without that caveat attached wherever
it's shown.

SUPPRESSION: cells with too few contacts to publish a value show as `N` in
the export (confirmed for the smaller/northern regions — Blekinge,
Västernorrland, Norrbotten — in the 2026-08-24 pull). Treated as missing
(no fabricated fallback), same rule as every real indicator in this
project.

Output: ../data/processed/vantetider_bup.json
Run:    python prototype/pipeline/convert_vantetider_bup.py
"""
import csv
import json
import os

HERE = os.path.dirname(__file__)
RAW_PATH = os.path.join(HERE, "..", "data", "raw", "vantetider_bup_manual_export.csv")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(PROCESSED_DIR, exist_ok=True)

# Region name (as this export spells it) -> Kurvan's own two-digit county
# code (js/data.js's REGIONS). Only "Jämtland Härjedalen" differs from
# Kurvan's own shorter "Jämtland" — every other name matches exactly.
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
INDICATOR = "bup_vantetid_forstabesok_median_dagar"


def num(val):
    """Swedish decimal comma; 'N' (and anything else non-numeric) means
    suppressed/too-few-to-publish, not zero."""
    val = (val or "").strip()
    if not val:
        return None
    try:
        return float(val.replace(",", "."))
    except ValueError:
        return None  # e.g. "N"


def main():
    with open(RAW_PATH, encoding="utf-8") as f:
        rows = list(csv.reader(f, delimiter=";"))

    # Row 0: title. Row 1: year per column. Row 2: "Region" + month names.
    # Last row: source/date footer, not data — skipped via MONTH_NUM lookup
    # failing on region-name rows that aren't in REGION_CODE (below).
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
            month_name = months[i] if i < len(months) else None
            month_num = MONTH_NUM.get(month_name)
            year = num(years[i]) if i < len(years) else None
            value = num(cell)
            if month_num is None or year is None or value is None:
                continue
            records.append({
                "county_code": county_code,
                "indicator": INDICATOR,
                "year": int(year),
                "month": month_num,
                "value": value,
                "sex": "T",  # this pull requested "Alla kön" (all genders combined)
            })

    out_path = os.path.join(PROCESSED_DIR, "vantetider_bup.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    months_covered = sorted({(r["year"], r["month"]) for r in records})
    print(f"[vantetider-bup] wrote {out_path}  ({len(records)} records, "
          f"{len(months_covered)} months: {months_covered[0]}..{months_covered[-1]})")
    print("[vantetider-bup] MANUAL SOURCE — see this script's docstring "
          "before assuming this can just be re-run for fresh data.")


if __name__ == "__main__":
    main()
