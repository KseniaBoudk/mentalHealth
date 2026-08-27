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
TWO OUTPUTS, TWO SOURCE TABLES — VERIFIED LIVE 2026-08-27
===============================================================================
Same PxWeb host and folder as fetch_folkhalsodata_hlv.py
(A_Folkhalsodata/B_HLV/dPsykhals/), two sibling tables:

  1. hlv1psyxreg.px  — "efter region, kön och år".  REGION grain, ~4-year
     pooled survey windows, NO age dimension.  Same table, same variable
     LAYOUT (positions [0]Region [1]"Psykisk hälsa" [2]"Andel och
     konfidensintervall" [3]Kön [4]År) and same sex-id scheme
     (00=Totalt, 01=Kvinnor, 02=Män — NOT Socialstyrelsen's 1=Män/2=Kvinnor)
     that fetch_folkhalsodata_hlv.py documents.  Live coverage check, region
     00 / sex 00 / measure 01, of the categories this script wants:
         35 low wellbeing   11 windows  2004-2007 .. 2015-2018  (STALE: last
                            published in the 2015-2018 window — kept anyway
                            because it was explicitly asked for; the loader
                            will simply have no recent year for it)
         40 suicidal thghts  9 windows  2010-2013 .. 2021-2024
         42 suicide attempt  9 windows  2010-2013 .. 2021-2024
         48 sleep problems  15 windows  2004-2007 .. 2021-2024
         49 mild sleep prob 15 windows  2004-2007 .. 2021-2024
         50 severe sleep    15 windows  2004-2007 .. 2021-2024
         68 loneliness som.  0 windows  <- NOT published at region grain
         69 loneliness oft.  0 windows  <- NOT published at region grain
     -> written to data/processed/folkhalsodata_hlv_psych.json (categories
        35, 40, 42, 48, 49, 50 only — loneliness is region-empty).

  2. hlv1psyaald.px  — "efter ålder, kön och år".  NATIONAL only (no region
     dimension), ANNUAL (not pooled windows), coarse own age bands
     (29 "Totalt 16- år", 30 "Totalt 16-84 år", 31 "16-29", 32 "30-44",
     33 "45-64", 34 "65-84", 35 "85-").  Variable layout is DIFFERENT from
     table 1: positions [0]"Psykisk hälsa" [1]measures [2]Ålder [3]Kön [4]År.
     This is the ONLY table that carries loneliness — and only just: live
     check found categories 68/69 populated for 2024 only (a single year, one
     survey wave), everything else 2004/2010-2024.  Fetched so loneliness and
     an annual national series for the rest are captured even though the
     region table can't give them.
     -> written to data/processed/folkhalsodata_hlv_psych_age.json
        (categories 35, 40, 42, 48, 49, 50, 68, 69).

Missing PxWeb cells come back as the literal string ".." — checked before
every numeric parse, same as the sibling script.

Output: ../data/processed/folkhalsodata_hlv_psych.json
        ../data/processed/folkhalsodata_hlv_psych_age.json
Run:    python pipeline/fetch_folkhalsodata_hlv_psych.py
Then:   python pipeline/build_kurvan_data.py
"""
import csv
import json
import os

import requests

BASE_URL = "https://fohm-app.folkhalsomyndigheten.se/Folkhalsodata/api/v1/sv"
TABLE_REG = "A_Folkhalsodata/B_HLV/dPsykhals/hlv1psyxreg.px"
TABLE_AGE = "A_Folkhalsodata/B_HLV/dPsykhals/hlv1psyaald.px"

HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

# Folkhälsodata "Psykisk hälsa" category id -> Kurvan indicator name. See the
# docstring's coverage table before adding/removing any of these.
CATEGORIES = {
    "35": "low_wellbeing_pct",
    "40": "suicidal_thoughts_pct",
    "42": "suicide_attempt_pct",
    "48": "sleep_problems_pct",
    "49": "mild_sleep_problems_pct",
    "50": "severe_sleep_problems_pct",
    "68": "loneliness_sometimes_pct",
    "69": "loneliness_often_pct",
}
# Region table doesn't publish loneliness (live-checked — 0 windows); only the
# age table does. Everything else is in both.
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


# --------------------------------------------------------------------------
# Table 1 — region grain, pooled windows (same shape fetch_folkhalsodata_hlv.py
# produces, plus a varying `indicator`).
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
            "indicator": CATEGORIES[cat],
            "window": window,
            "midpoint_year": (start + end) // 2,
            "value": share,
            "ci_lo": vals.get(MEASURE_CI_LO),
            "ci_hi": vals.get(MEASURE_CI_HI),
            "n": int(vals[MEASURE_N]) if vals.get(MEASURE_N) is not None else None,
            "sex": sex,
        })
    return out


# --------------------------------------------------------------------------
# Table 2 — national grain, annual, coarse own age bands. Different variable
# order: [0] category, [1] measure, [2] age, [3] sex, [4] year.
# --------------------------------------------------------------------------
def fetch_age(meta):
    var = meta["variables"]
    age_values = var[2]["values"]
    year_values = var[4]["values"]
    query = {
        "query": [
            {"code": var[0]["code"], "selection": {"filter": "item", "values": AGE_CATEGORIES}},
            {"code": var[1]["code"], "selection": {"filter": "item",
             "values": [MEASURE_SHARE, MEASURE_CI_LO, MEASURE_CI_HI, MEASURE_N]}},
            {"code": var[2]["code"], "selection": {"filter": "item", "values": age_values}},
            {"code": var[3]["code"], "selection": {"filter": "item", "values": list(SEX)}},
            {"code": var[4]["code"], "selection": {"filter": "item", "values": year_values}},
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
            "indicator": CATEGORIES[cat],
            "year": int(year),
            "age_id": age_id,
            "age_label": age_labels.get(age_id, age_id),
            "value": share,
            "ci_lo": vals.get(MEASURE_CI_LO),
            "ci_hi": vals.get(MEASURE_CI_HI),
            "n": int(vals[MEASURE_N]) if vals.get(MEASURE_N) is not None else None,
            "sex": sex,
        })
    return out


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
    with open(os.path.join(RAW_DIR, "folkhalsodata_hlv_psych_reg_raw.json"), "w", encoding="utf-8") as f:
        json.dump(reg_raw, f, ensure_ascii=False, indent=1)
    reg_records = region_records(reg_raw, county_names)
    reg_path = os.path.join(PROCESSED_DIR, "folkhalsodata_hlv_psych.json")
    with open(reg_path, "w", encoding="utf-8") as f:
        json.dump(reg_records, f, ensure_ascii=False, indent=1)
    print(f"[hlv-psych] wrote {reg_path}  ({len(reg_records)} records)")
    _coverage(reg_records, "window")

    print("[hlv-psych] table 2/2 — hlv1psyaald.px (national grain, annual, coarse ages)")
    age_meta = get_meta(TABLE_AGE)
    age_labels = dict(zip(age_meta["variables"][2]["values"],
                          age_meta["variables"][2]["valueTexts"]))
    age_raw = fetch_age(age_meta)
    with open(os.path.join(RAW_DIR, "folkhalsodata_hlv_psych_age_raw.json"), "w", encoding="utf-8") as f:
        json.dump(age_raw, f, ensure_ascii=False, indent=1)
    age_recs = age_records(age_raw, age_labels)
    age_path = os.path.join(PROCESSED_DIR, "folkhalsodata_hlv_psych_age.json")
    with open(age_path, "w", encoding="utf-8") as f:
        json.dump(age_recs, f, ensure_ascii=False, indent=1)
    print(f"[hlv-psych] wrote {age_path}  ({len(age_recs)} records)")
    _coverage(age_recs, "year")

    got = {r["indicator"] for r in reg_records} | {r["indicator"] for r in age_recs}
    missing = set(CATEGORIES.values()) - got
    if missing:
        print(f"[hlv-psych] WARNING: no data at all for {sorted(missing)} — check the "
              f"category ids against the live table before trusting this.")
    print("[hlv-psych] now run:  python pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
