# -*- coding: utf-8 -*-
"""Folkhälsomyndigheten's Folkhälsodata: HBSC (Skolbarns hälsovanor), self-
reported "felt low" at least weekly, at REGION grain, ages 11/13/15.

SAME API/host as fetch_folkhalsodata_hlv.py (Folkhälsomyndigheten's
Folkhälsodata PxWeb instance) — reread that file's docstring for the PxWeb
query-body mechanics if they look unfamiliar; not repeated here. This is a
DIFFERENT folder in the same instance (C_HBSC, not B_HLV), so its own
dimension ids/coverage are re-verified below rather than assumed to match.

===============================================================================
WHY "KÄNT SIG NERE" (FELT LOW), NOT A COMPOSITE — AND WHY THIS IS A SNAPSHOT
===============================================================================
HBSC's regional "Självrapporterade hälsobesvär" table asks about 8 items
(sleep problems, irritability, felt low, nervous, headache, stomachache,
backache, dizziness) — a mix of psychological and somatic complaints, the
international HBSC literature's usual "psychosomatic complaints" scale.
Rather than build a composite index across items Kurvan itself would be
defining (this project sources single published measures elsewhere —
antidepressant dispensing, ICD-10 self-harm codes, etc. — not invented
scores), this fetches exactly one item: "Känt sig nere" (felt low), the
closest single-item analogue to depressive affect among the 8.

Checked live 2026-08-25 against the table's own metadata
(A_Folkhalsodata/C_HBSC/Regionalt/Halsa/Halsobesvar/HalsobesvarReg.px):
  - Only ONE year window is published at region grain: "2021-2022". This is
    a single snapshot, not a trend — same shape as CONTEXT (Kolada, 2023
    only) in js/data.js. Do not build a time series against this table;
    there is nothing to build one from yet.
  - Ages are 11/13/15 ONLY, single years — do not attempt to map these onto
    Kurvan's nine AGES bands (0-14/15-24/.../85+): 11 and 13 would both
    collide into "0-14", losing exactly the precision this fetcher exists
    to add. js/data.js's REAL_HBSC is deliberately NOT IND-shaped, same
    precedent as REAL_CONTEXT/BUP_WAIT.
  - Test-queried the full cartesian product (22 regions x 3 complaints x 3
    ages x 2 sexes x the 1 window = 792 cells): zero ".." (suppressed)
    cells, including Gotland, the smallest county. No disclosure floor
    observed on this table.

===============================================================================
OTHER THINGS VERIFIED LIVE, NOT ASSUMED
===============================================================================
  - Table: A_Folkhalsodata/C_HBSC/Regionalt/Halsa/Halsobesvar/
    HalsobesvarReg.px — "efter besvär, frekvens, kön, ålder, region och år"
    (by complaint, frequency, sex, age, region, year).
  - Unlike hlv1psyxreg.px (fetch_folkhalsodata_hlv.py), this table has NO
    separate "measure" dimension (no share/CI-lo/CI-hi/count split) — each
    cell is directly the share (%), nothing else to pair back together.
    No confidence interval or respondent count is available at this grain.
  - Variables, by POSITION (same caution as fetch_folkhalsodata_hlv.py —
    do not type the accented Swedish names out by hand):
    [0] Region: "00".."25", SAME scheme as Kurvan's own REGIONS.
    [1] "Besvär" (complaint): CATEGORY below picks "Känt sig nere" from
        this dimension's 8 string values (not numeric ids on this table).
    [2] "Antal ggr senaste halvåret" (frequency, past six months): 5
        string values. FREQ_WEEKLY_PLUS below sums "Ung. varje dag"
        (almost daily) + "> 1 gång/vecka" (more than weekly) into one
        "weekly or more" share — the standard HBSC threshold.
    [3] "Ålder": "11"/"13"/"15", single years.
    [4] "Kön": "2"=Flickor (girls), "1"=Pojkar (boys) — confirmed via this
        table's own valueTexts. NOTE this is neither Socialstyrelsen's
        1=Män/2=Kvinnor elsewhere in this folder, NOR B_HLV's own
        00=Totalt/01=Kvinnor/02=Män — a third, independent id scheme. No
        "totalt" option exists here; K/M only.
    [5] "År": exactly one value, "2021-2022", as of this run.
  - Missing cells use PxWeb's ".." sentinel, same as B_HLV.

Output: ../data/processed/hbsc.json
Run:    python prototype/pipeline/fetch_hbsc.py
"""
import json
import os

import requests

BASE_URL = "https://fohm-app.folkhalsomyndigheten.se/Folkhalsodata/api/v1/sv"
TABLE_PATH = "A_Folkhalsodata/C_HBSC/Regionalt/Halsa/Halsobesvar/HalsobesvarReg.px"
HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

CATEGORY = "Känt sig nere"          # "felt low" — see docstring before changing
FREQ_WEEKLY_PLUS = ["Ung. varje dag", "> 1 gång/vecka"]
SEX = {"2": "K", "1": "M"}          # verified via valueTexts — see docstring


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


def fetch_complaint(meta, complaint):
    var = meta["variables"]
    query = {
        "query": [
            {"code": var[0]["code"], "selection": {"filter": "item", "values": var[0]["values"]}},
            {"code": var[1]["code"], "selection": {"filter": "item", "values": [complaint]}},
            {"code": var[2]["code"], "selection": {"filter": "item", "values": FREQ_WEEKLY_PLUS}},
            {"code": var[3]["code"], "selection": {"filter": "item", "values": var[3]["values"]}},
            {"code": var[4]["code"], "selection": {"filter": "item", "values": var[4]["values"]}},
            {"code": var[5]["code"], "selection": {"filter": "item", "values": var[5]["values"]}},
        ],
        "response": {"format": "json"},
    }
    resp = requests.post(f"{BASE_URL}/{TABLE_PATH}", json=query, timeout=60)
    resp.raise_for_status()
    return resp.json()


def to_records(raw):
    """PxWeb cells (one share each) -> one record per region/age/sex/window,
    summing the two 'weekly or more' frequency categories together."""
    groups = {}
    for cell in raw.get("data", []):
        region, _complaint, _freq, age, sex_id, window = cell["key"]
        val = num(cell["values"][0])
        sex = SEX.get(sex_id)
        if sex is None or val is None:
            continue
        key = (region, age, sex, window)
        groups[key] = groups.get(key, 0.0) + val

    out = []
    for (region, age, sex, window), share in groups.items():
        out.append({
            "county_code": region,
            "indicator": "hbsc_felt_low_weekly_pct",
            "age_group": age,
            "sex": sex,
            "year": window,
            "value": round(share, 1),
        })
    return out


def main():
    print("[hbsc] region-grain 'felt low, weekly or more' share (HBSC survey), ages 11/13/15")
    meta = get_metadata()

    raw = fetch_complaint(meta, CATEGORY)
    with open(os.path.join(RAW_DIR, "hbsc_raw.json"), "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=1)

    records = to_records(raw)
    out_path = os.path.join(PROCESSED_DIR, "hbsc.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    windows = sorted({r["year"] for r in records})
    counties = sorted({r["county_code"] for r in records})
    print(f"[hbsc] wrote {out_path}  ({len(records)} records, "
          f"{len(counties)} region(s), window(s): {windows})")
    if len(windows) != 1:
        print(f"[hbsc] NOTE: expected exactly one window (2021-2022, as of writing) "
              f"at region grain. Got {windows} — if there's now more than one, "
              f"js/data.js's REAL_HBSC and viewHbsc() were both written assuming a "
              f"single snapshot and need revisiting to show a real trend instead.")
    if len(counties) < 22:
        print(f"[hbsc] WARNING: expected 22 regions (21 counties + Riket). Got {len(counties)}.")
    print("[hbsc] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
