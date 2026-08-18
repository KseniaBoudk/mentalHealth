# -*- coding: utf-8 -*-
"""Folkhälsomyndigheten's Folkhälsodata: HLV survey, self-reported anxiety,
at REGION grain.

PxWeb API, the same technology ../../pipeline/fetch_scb.py already speaks —
reread that file if the query-body shape below looks unfamiliar. This is a
DIFFERENT host and a DIFFERENT PxWeb instance (Folkhälsomyndigheten's, not
SCB's), so its own quirks are documented here rather than assumed.

===============================================================================
WHY THIS FETCHES "SVÅR ÄNGSLAN, ORO ELLER ÅNGEST", NOT "NEDSATT PSYKISKT
VÄLBEFINNANDE" — READ THIS BEFORE CHANGING CATEGORY
===============================================================================
Kurvan's `distress` indicator originally claimed "Nedsatt psykiskt
välbefinnande" (poor mental wellbeing), matching HLV's own category of that
name. That category IS real and IS in this table — and stopped being
published after the 2015-2018 survey window. It has not been updated since;
using it would mean showing a decade-stale number under a "real data" label.

Checked 2026-08-18 against every category in this table for its actual year
coverage (see the coverage-check block this docstring is describing, not
shipped as code here — rerun it yourself against /Psykisk hälsa's full value
list before trusting this note against a much later run of this script).
Findings, category id -> windows with data / windows possible:

    35 Nedsatt psykiskt välbefinnande      2004-2007 .. 2015-2018   (11/15)
    21 Allvarlig psykisk påfrestning       2019-2022 .. 2021-2024    (2/15)
    58 Svår ängslan, oro eller ångest      2004-2007 .. 2021-2024   (15/15)  <- chosen
    46 Mycket stressad                     2004-2007 .. 2021-2024   (15/15)  <- also continuous

58 was picked over 46 as the closer conceptual match to a general "poor
mental wellbeing" indicator (anxiety/worry/dread, not workload-driven
stress). CATEGORY below is the only thing that decision touches; the rest of
this script works for any of this table's category ids.

===============================================================================
OTHER THINGS VERIFIED LIVE, NOT ASSUMED
===============================================================================
  - Table: A_Folkhalsodata/B_HLV/dPsykhals/hlv1psyxreg.px — "efter region, kön
    och år" (by region, sex, year). A sibling table in the same folder,
    hlv1psyaald.px, has an age breakdown instead of region — the two are not
    the same table and this script does not fetch the age one. Kurvan's
    per-age-band curve is simply unavailable for this indicator; see
    js/data.js's REAL_HLV docstring for how that is handled.
  - Variables, by POSITION not by typing out their Swedish names by hand
    (Kön, År — easy to mistype the accents and silently query nothing):
    [0] Region: two-digit county codes, "00".."25", SAME scheme as
        Kurvan's own REGIONS (no id-remapping needed, unlike Socialstyrelsen's
        API elsewhere in this folder).
    [1] the "Psykisk hälsa" category dimension.
    [2] "Andel och konfidensintervall": 01=share(%), 02=CI lower, 03=CI
        upper, 04=respondent count. All FOUR must be requested and paired
        back together into one record — a single PxWeb cell is only one of
        these four numbers.
    [3] "Kön": 00=Totalt, 01=Kvinnor, 02=Män. NOTE the id order is not the
        same as Socialstyrelsen's kon dimension elsewhere in this folder
        (there 1=Män, 2=Kvinnor). Do not reuse that mapping here.
    [4] "År": window labels like "2021-2024", NOT necessarily 4 consecutive
        years' worth of survey waves — the underlying survey is biennial and
        these windows pool two waves for regional sample size. Windows are
        NOT evenly spaced (there are gaps, e.g. 2013-2016 to 2015-2018 to
        2017-2020 skips no years, but 2015-2018 to 2017-2020 does skip
        2016-2019). Take the exact window list from the API, never assume a
        fixed step.
  - Missing cells come back as the PxWeb sentinel ".." (a string), not null
    and not absent. Every value must be checked for this before parsing as
    a number.

Output: ../data/processed/folkhalsodata_hlv.json
Run:    python prototype/pipeline/fetch_folkhalsodata_hlv.py
"""
import json
import os

import requests

BASE_URL = "https://fohm-app.folkhalsomyndigheten.se/Folkhalsodata/api/v1/sv"
TABLE_PATH = "A_Folkhalsodata/B_HLV/dPsykhals/hlv1psyxreg.px"
HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

CATEGORY = "58"   # Svår ängslan, oro eller ångest. See the docstring before changing this.
MEASURE_SHARE, MEASURE_CI_LO, MEASURE_CI_HI, MEASURE_N = "01", "02", "03", "04"
SEX = {"00": "T", "01": "K", "02": "M"}   # NOT the same ids Socialstyrelsen uses elsewhere here


def get_metadata():
    resp = requests.get(f"{BASE_URL}/{TABLE_PATH}", timeout=60)
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


def fetch_category(meta, category):
    var = meta["variables"]
    region_values = var[0]["values"]
    year_values = var[4]["values"]
    query = {
        "query": [
            {"code": var[0]["code"], "selection": {"filter": "item", "values": region_values}},
            {"code": var[1]["code"], "selection": {"filter": "item", "values": [category]}},
            {"code": var[2]["code"], "selection": {"filter": "item",
             "values": [MEASURE_SHARE, MEASURE_CI_LO, MEASURE_CI_HI, MEASURE_N]}},
            {"code": var[3]["code"], "selection": {"filter": "item", "values": list(SEX)}},
            {"code": var[4]["code"], "selection": {"filter": "item", "values": year_values}},
        ],
        "response": {"format": "json"},
    }
    resp = requests.post(f"{BASE_URL}/{TABLE_PATH}", json=query, timeout=60)
    resp.raise_for_status()
    return resp.json()


def to_records(raw, county_names):
    """PxWeb cells (one number each) -> one record per region/sex/window,
    pairing the four 'Andel och konfidensintervall' rows back together."""
    groups = {}
    for cell in raw.get("data", []):
        region, _cat, measure, sex_id, window = cell["key"]
        val = num(cell["values"][0])
        sex = SEX.get(sex_id)
        if not sex:
            continue
        key = (region, sex, window)
        groups.setdefault(key, {})[measure] = val

    out = []
    for (region, sex, window), vals in groups.items():
        share = vals.get(MEASURE_SHARE)
        if share is None:
            continue   # PxWeb's ".." — this cell genuinely was not published
        start, end = (int(x) for x in window.split("-"))
        out.append({
            "region": county_names.get(region, region) if region != "00" else "Sverige",
            "county_code": region,
            "indicator": "distress_pct",
            "window": window,
            "midpoint_year": (start + end) // 2,
            "value": share,
            "ci_lo": vals.get(MEASURE_CI_LO),
            "ci_hi": vals.get(MEASURE_CI_HI),
            "n": int(vals[MEASURE_N]) if vals.get(MEASURE_N) is not None else None,
            "sex": sex,
        })
    return out


def load_county_names():
    import csv
    names = {}
    with open(os.path.join(HERE, "kommuner.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            names.setdefault(r["code"][:2], r["region"])
    return names


def main():
    print("[folkhalsodata-hlv] region-grain self-reported anxiety (HLV survey)")
    meta = get_metadata()
    county_names = load_county_names()

    raw = fetch_category(meta, CATEGORY)
    with open(os.path.join(RAW_DIR, "folkhalsodata_hlv_raw.json"), "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=1)

    records = to_records(raw, county_names)
    out_path = os.path.join(PROCESSED_DIR, "folkhalsodata_hlv.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    windows = sorted({r["window"] for r in records})
    print(f"[folkhalsodata-hlv] wrote {out_path}  ({len(records)} records, "
          f"{len(windows)} window(s): {windows[0]} .. {windows[-1]})")
    if len(windows) < 10:
        print(f"[folkhalsodata-hlv] WARNING: expected close to full coverage (15 windows "
              f"as of writing) for category {CATEGORY}. Got {len(windows)}. Check the "
              f"category's actual coverage before trusting this.")
    print("[folkhalsodata-hlv] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
