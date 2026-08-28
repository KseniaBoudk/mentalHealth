# -*- coding: utf-8 -*-
"""Folkhälsomyndigheten's Folkhälsodata: FIVE more HLV self-reported mental-
health categories, alongside the one `fetch_folkhalsodata_hlv.py` already
fetches for Kurvan's `distress` indicator.

    suicidal thoughts   (Suicidtankar,               category 40)
    suicide attempts    (Försökt ta sitt liv,        category 42)
    low wellbeing       (Nedsatt psykiskt välbef.,   category 35)
    sleep problems      (Sömnbesvär / Svåra s.,      categories 48 / 49 / 50)
    loneliness          (Ibland / Ofta besvär av
                         ensamhet,                   categories 68 / 69)

===============================================================================
WHY THIS IS A SEPARATE SCRIPT AND A SEPARATE OUTPUT FILE — READ BEFORE MERGING
IT INTO fetch_folkhalsodata_hlv.py
===============================================================================
The existing HLV fetcher writes data/processed/folkhalsodata_hlv.json, which
js/data.js's rebuildREAL_HLV() indexes straight into idx[county][sex][year]
WITHOUT filtering on `indicator`. Appending more categories to that file would
have every extra row overwrite the `distress` cell for its county/sex/window.
So these go to their OWN processed files and their OWN js/data/real_*.js via
build_kurvan_data.py; they are not read by any js/data.js function yet (no
reader, no lang strings, no view — deliberately "on disk, not shown", per the
scope this was built under). Wiring them into the UI is a later, separate pass.

===============================================================================
FAIL LOUD, DON'T WARN — same principle as fetch_socialstyrelsen_lakemedel.py's
assert_atc_filter()
===============================================================================
An HLV category quietly losing (or gaining) coverage is exactly the kind of
"still 200 OK, still plausible-looking, silently wrong" failure the läkemedel
fetcher's ATC trap check guards against. So this script does NOT print a
warning and carry on — `assert_expected_coverage()` raises SystemExit:

  - a `"live"` category (should still be published) that comes back with far
    fewer windows/years than expected, or whose newest window is stale, is
    FATAL — go re-verify the category id against the live table.
  - a `"closed"` category (known to have stopped) that has UNEXPECTEDLY gained
    data past its recorded `end_year` is also FATAL — good news, but a human
    must move its end year / reclassify it, not let the script silently
    publish a series whose own metadata now lies.
  - `low_wellbeing_pct` is `"closed"` at 2018 (region) / 2018 (age): it was
    Kurvan's ORIGINAL `distress` label and Folkhälsomyndigheten stopped
    publishing it regionally after the 2015-2018 window. It is fetched and
    published anyway (it was explicitly asked for) but tagged
    `series_status="closed"` + `end_year` on every row so the UI can render it
    as a finished historical series, not stale "real" data.
  - `loneliness_*` is `"snapshot"` — only 2024 exists so far, national only.
    Not treated as a failure for being small; only an EMPTY result is fatal.

Every row also carries `fetched` (this run's ISO date) so the figure can show
its own age next to it rather than in a footnote.

===============================================================================
TWO OUTPUTS, TWO SOURCE TABLES — VERIFIED LIVE 2026-08-27
===============================================================================
Same PxWeb host and folder as fetch_folkhalsodata_hlv.py
(A_Folkhalsodata/B_HLV/dPsykhals/), two sibling tables:

  1. hlv1psyxreg.px  — "efter region, kön och år".  REGION grain, ~4-year
     pooled survey windows, NO age dimension.  Same variable LAYOUT
     (positions [0]Region [1]"Psykisk hälsa" [2]"Andel och konfidensintervall"
     [3]Kön [4]År) and same sex-id scheme (00=Totalt, 01=Kvinnor, 02=Män) that
     fetch_folkhalsodata_hlv.py documents.  Loneliness (68/69) is NOT
     published at region grain (live-checked — 0 windows).
     -> data/processed/folkhalsodata_hlv_psych.json (categories 35, 40, 42,
        48, 49, 50).

  2. hlv1psyaald.px  — "efter ålder, kön och år".  NATIONAL only, ANNUAL,
     coarse own age bands (29 "Totalt 16- år", 30 "Totalt 16-84 år",
     31 "16-29", 32 "30-44", 33 "45-64", 34 "65-84", 35 "85-").  DIFFERENT
     variable layout: [0]"Psykisk hälsa" [1]measures [2]Ålder [3]Kön [4]År.
     The only table that carries loneliness, and only for 2024 so far.
     -> data/processed/folkhalsodata_hlv_psych_age.json (categories 35, 40,
        42, 48, 49, 50, 68, 69).

Missing PxWeb cells come back as the literal string ".." — checked before
every numeric parse.

Output: ../data/processed/folkhalsodata_hlv_psych.json
        ../data/processed/folkhalsodata_hlv_psych_age.json
Run:    python pipeline/fetch_folkhalsodata_hlv_psych.py
Then:   python pipeline/build_kurvan_data.py
"""
import csv
import json
import os
from datetime import date

import requests

BASE_URL = "https://fohm-app.folkhalsomyndigheten.se/Folkhalsodata/api/v1/sv"
TABLE_REG = "A_Folkhalsodata/B_HLV/dPsykhals/hlv1psyxreg.px"
TABLE_AGE = "A_Folkhalsodata/B_HLV/dPsykhals/hlv1psyaald.px"

HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

FETCHED = date.today().isoformat()

# Folkhälsodata "Psykisk hälsa" category id -> (indicator name, status, meta).
#   status "live"     -> assert_expected_coverage() FAILS if it goes thin/stale
#   status "closed"   -> publish as a finished series ending `end_year`; FAILS
#                        if it unexpectedly gains data past that year
#   status "snapshot" -> single survey point; FAILS only if it comes back empty
CATEGORIES = {
    "35": {"indicator": "low_wellbeing_pct",         "status": "closed",   "end_year": 2018},
    "40": {"indicator": "suicidal_thoughts_pct",     "status": "live",     "min_year": 2019},
    "42": {"indicator": "suicide_attempt_pct",       "status": "live",     "min_year": 2019},
    "48": {"indicator": "sleep_problems_pct",        "status": "live",     "min_year": 2019},
    "49": {"indicator": "mild_sleep_problems_pct",   "status": "live",     "min_year": 2019},
    "50": {"indicator": "severe_sleep_problems_pct", "status": "live",     "min_year": 2019},
    "68": {"indicator": "loneliness_sometimes_pct",  "status": "snapshot"},
    "69": {"indicator": "loneliness_often_pct",      "status": "snapshot"},
}
# Region table doesn't publish loneliness; only the age table does.
REGION_CATEGORIES = [c for c in CATEGORIES if c not in ("68", "69")]
AGE_CATEGORIES = list(CATEGORIES)

MEASURE_SHARE, MEASURE_CI_LO, MEASURE_CI_HI, MEASURE_N = "01", "02", "03", "04"
SEX = {"00": "T", "01": "K", "02": "M"}   # FoHM's ids — NOT Socialstyrelsen's


def get_meta(table):
    resp = requests.get(f"{BASE_URL}/{table}", timeout=60)
    resp.raise_for_status()
    return resp.json()


def num(val):
    """PxWeb's missing-value sentinel is the literal string '..'."""
    if val is None or val == "..":
        return None
    try:
        return float(str(val).replace(",", "."))
    except (ValueError, TypeError):
        return None


def load_county_names():
    names = {}
    with open(os.path.join(HERE, "kommuner.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            names.setdefault(r["code"][:2], r["region"])
    return names


def _status_fields(cat):
    meta = CATEGORIES[cat]
    out = {"series_status": meta["status"], "fetched": FETCHED}
    if meta["status"] == "closed":
        out["end_year"] = meta["end_year"]
    return out


# --------------------------------------------------------------------------
# Table 1 — region grain, pooled windows.
# --------------------------------------------------------------------------
def fetch_region(meta):
    var = meta["variables"]
    query = {
        "query": [
            {"code": var[0]["code"], "selection": {"filter": "item", "values": var[0]["values"]}},
            {"code": var[1]["code"], "selection": {"filter": "item", "values": REGION_CATEGORIES}},
            {"code": var[2]["code"], "selection": {"filter": "item",
             "values": [MEASURE_SHARE, MEASURE_CI_LO, MEASURE_CI_HI, MEASURE_N]}},
            {"code": var[3]["code"], "selection": {"filter": "item", "values": list(SEX)}},
            {"code": var[4]["code"], "selection": {"filter": "item", "values": var[4]["values"]}},
        ],
        "response": {"format": "json"},
    }
    resp = requests.post(f"{BASE_URL}/{TABLE_REG}", json=query, timeout=90)
    resp.raise_for_status()
    return resp.json()


def region_records(raw, county_names):
    groups = {}
    for cell in raw.get("data", []):
        region, cat, measure, sex_id, window = cell["key"]
        sex = SEX.get(sex_id)
        if not sex:
            continue
        groups.setdefault((region, cat, sex, window), {})[measure] = num(cell["values"][0])

    out = []
    for (region, cat, sex, window), vals in groups.items():
        share = vals.get(MEASURE_SHARE)
        if share is None:
            continue
        start, end = (int(x) for x in window.split("-"))
        out.append({
            "region": county_names.get(region, region) if region != "00" else "Sverige",
            "county_code": region,
            "indicator": CATEGORIES[cat]["indicator"],
            "window": window,
            "midpoint_year": (start + end) // 2,
            "value": share,
            "ci_lo": vals.get(MEASURE_CI_LO),
            "ci_hi": vals.get(MEASURE_CI_HI),
            "n": int(vals[MEASURE_N]) if vals.get(MEASURE_N) is not None else None,
            "sex": sex,
            **_status_fields(cat),
        })
    return out


# --------------------------------------------------------------------------
# Table 2 — national grain, annual, coarse own age bands. Different variable
# order: [0] category, [1] measure, [2] age, [3] sex, [4] year.
# --------------------------------------------------------------------------
def fetch_age(meta):
    var = meta["variables"]
    query = {
        "query": [
            {"code": var[0]["code"], "selection": {"filter": "item", "values": AGE_CATEGORIES}},
            {"code": var[1]["code"], "selection": {"filter": "item",
             "values": [MEASURE_SHARE, MEASURE_CI_LO, MEASURE_CI_HI, MEASURE_N]}},
            {"code": var[2]["code"], "selection": {"filter": "item", "values": var[2]["values"]}},
            {"code": var[3]["code"], "selection": {"filter": "item", "values": list(SEX)}},
            {"code": var[4]["code"], "selection": {"filter": "item", "values": var[4]["values"]}},
        ],
        "response": {"format": "json"},
    }
    resp = requests.post(f"{BASE_URL}/{TABLE_AGE}", json=query, timeout=90)
    resp.raise_for_status()
    return resp.json()


def age_records(raw, age_labels):
    groups = {}
    for cell in raw.get("data", []):
        cat, measure, age_id, sex_id, year = cell["key"]
        sex = SEX.get(sex_id)
        if not sex:
            continue
        groups.setdefault((cat, age_id, sex, year), {})[measure] = num(cell["values"][0])

    out = []
    for (cat, age_id, sex, year), vals in groups.items():
        share = vals.get(MEASURE_SHARE)
        if share is None:
            continue
        out.append({
            "county_code": "00",              # this table is national only
            "indicator": CATEGORIES[cat]["indicator"],
            "year": int(year),
            "age_id": age_id,
            "age_label": age_labels.get(age_id, age_id),
            "value": share,
            "ci_lo": vals.get(MEASURE_CI_LO),
            "ci_hi": vals.get(MEASURE_CI_HI),
            "n": int(vals[MEASURE_N]) if vals.get(MEASURE_N) is not None else None,
            "sex": sex,
            **_status_fields(cat),
        })
    return out


# --------------------------------------------------------------------------
# Fail-loud coverage check.
# --------------------------------------------------------------------------
def assert_expected_coverage(reg_records, age_records):
    """Raise SystemExit on the silent-degradation failure modes described in
    this module's docstring. Nothing is written if this raises."""
    def years_for(records, indicator, key):
        return sorted({r[key] for r in records if r["indicator"] == indicator})

    problems = []
    for cat, meta in CATEGORIES.items():
        ind, status = meta["indicator"], meta["status"]
        reg_years = years_for(reg_records, ind, "midpoint_year")
        age_years = years_for(age_records, ind, "year")
        all_years = reg_years + age_years

        if status == "live":
            # region table is the one that matters for a region-grain indicator
            if len(reg_years) < 6:
                problems.append(f"{ind}: only {len(reg_years)} region window(s) "
                                f"({reg_years}) — expected the full ~9+. Re-verify "
                                f"category id {cat} against {TABLE_REG}.")
            elif reg_years and max(reg_years) < meta["min_year"]:
                problems.append(f"{ind}: newest region window midpoint {max(reg_years)} "
                                f"< {meta['min_year']} — the series looks frozen. "
                                f"Re-verify category id {cat}.")
        elif status == "closed":
            newest = max(all_years) if all_years else None
            if newest is None:
                problems.append(f"{ind}: closed series returned NO data at all "
                                f"(category id {cat}).")
            elif newest > meta["end_year"] + 2:
                problems.append(
                    f"{ind}: recorded as CLOSED at end_year={meta['end_year']} but "
                    f"data now runs to {newest}. Good news — but update "
                    f"CATEGORIES[{cat!r}] (end_year, or move it to \"live\") before "
                    f"publishing, so the series' own metadata stops lying.")
        elif status == "snapshot":
            if not all_years:
                problems.append(f"{ind}: snapshot series returned NO data "
                                f"(category id {cat}).")

    if problems:
        raise SystemExit("FATAL: HLV coverage check failed — nothing written.\n  - "
                         + "\n  - ".join(problems))


def _coverage(records, key):
    by_ind = {}
    for r in records:
        by_ind.setdefault(r["indicator"], set()).add(r[key])
    for ind in sorted(by_ind):
        vs = sorted(str(v) for v in by_ind[ind])
        print(f"    {ind:28s} {len(vs):2d}  {vs[0]} .. {vs[-1]}")


def main():
    county_names = load_county_names()

    print("[hlv-psych] table 1/2 — hlv1psyxreg.px (region grain, pooled windows)")
    reg_meta = get_meta(TABLE_REG)
    reg_raw = fetch_region(reg_meta)
    reg_records = region_records(reg_raw, county_names)

    print("[hlv-psych] table 2/2 — hlv1psyaald.px (national grain, annual, coarse ages)")
    age_meta = get_meta(TABLE_AGE)
    age_labels = dict(zip(age_meta["variables"][2]["values"],
                          age_meta["variables"][2]["valueTexts"]))
    age_raw = fetch_age(age_meta)
    age_recs = age_records(age_raw, age_labels)

    # Fail loud BEFORE writing anything.
    assert_expected_coverage(reg_records, age_recs)

    with open(os.path.join(RAW_DIR, "folkhalsodata_hlv_psych_reg_raw.json"), "w", encoding="utf-8") as f:
        json.dump(reg_raw, f, ensure_ascii=False, indent=1)
    with open(os.path.join(RAW_DIR, "folkhalsodata_hlv_psych_age_raw.json"), "w", encoding="utf-8") as f:
        json.dump(age_raw, f, ensure_ascii=False, indent=1)

    reg_path = os.path.join(PROCESSED_DIR, "folkhalsodata_hlv_psych.json")
    with open(reg_path, "w", encoding="utf-8") as f:
        json.dump(reg_records, f, ensure_ascii=False, indent=1)
    print(f"[hlv-psych] wrote {reg_path}  ({len(reg_records)} records, fetched {FETCHED})")
    _coverage(reg_records, "window")

    age_path = os.path.join(PROCESSED_DIR, "folkhalsodata_hlv_psych_age.json")
    with open(age_path, "w", encoding="utf-8") as f:
        json.dump(age_recs, f, ensure_ascii=False, indent=1)
    print(f"[hlv-psych] wrote {age_path}  ({len(age_recs)} records, fetched {FETCHED})")
    _coverage(age_recs, "year")

    closed = sorted({r["indicator"] for r in reg_records + age_recs
                     if r.get("series_status") == "closed"})
    if closed:
        print(f"[hlv-psych] published as CLOSED series (ends at end_year): {closed}")
    print("[hlv-psych] now run:  python pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
