# -*- coding: utf-8 -*-
"""Socialstyrelsen: psychiatric medication dispensed, at REGION grain — five
ATC classes (antidepressants, ADHD medication, antipsychotics, anxiety
medication, sleep medication).

Same API and municipality-privacy reasoning as fetch_socialstyrelsen_mh.py —
read that file's docstring first, this one only documents what's different.

Backs Kurvan's IND.antidep, previously synthetic-only. pipeline/README.md used
to say this needed a several-GB bulk CSV download (Läkemedelsregistret has no
queryable API) — that turned out to be about the *microdata* register only.
Socialstyrelsen's own statistics database has a separate, ordinary aggregate
table for exactly this, on the same small-request API every other real
indicator here already uses.

===============================================================================
WHAT WAS VERIFIED LIVE AGAINST THE API BEFORE WRITING THIS, AND WHEN
===============================================================================
Checked 2026-08-24 against sdb.socialstyrelsen.se. Re-verify anything you
change here the same way — this dataset is a DIFFERENT resource from the
self-harm/suicide/psych ones, hosted on the same domain, and its own quirks
are not necessarily the same.

  - Dataset: `lakemedel` ("Medicines"). Dimensions: region, alder, kon, matt,
    ar, atc.
  - The filtering segment IS named `atc` here, and it filters correctly —
    confirmed live by comparing N06A/N05A/C09A at the same region/age/sex/
    year/matt cell and getting three genuinely different values (87370 /
    a different count / etc.), not the yttreorsak-style silent-passthrough
    trap fetch_socialstyrelsen_mh.py warns about on a different dataset.
    N06A = "Antidepressiva medel", confirmed via /lakemedel/atc/N06A.
  - ATC_GROUPS below (five classes, not just N06A) all verified live
    2026-08-25 against /lakemedel/atc: N06BA = "Centralt verkande
    sympatomimetika" (ADHD medication in practice — methylphenidate/
    amphetamine-class stimulants and atomoxetine are the drugs actually in
    this class, but that's not what WHO's ATC label literally says, so
    js/lang.js's caveat text says both), N05A = "Neuroleptika"
    (antipsychotics), N05B = "Lugnande medel, ataraktika" (anxiolytics —
    "anxiety medication"), N05C = "Sömnmedel och lugnande medel"
    (hypnotics/sedatives — "sleep medication"; note N05B's Swedish name
    ALSO contains "lugnande medel" — they are still two distinct `atc`
    dimension ids with materially different values, not a naming
    collision in the data itself, just in how Swedish glosses both
    classes).
  - A dataset quirk specific to lakemedel, not psych: an (atc, alder,
    kon, ar, region) combination with truly ZERO matching rows returns
    HTTP 404, not `{"data":[]}` with 200 (confirmed live: N06BA — ADHD
    medication — at alder=1, ages 0-4, in Gotland, 2023 — essentially
    never prescribed to toddlers). get() below already treats a non-200
    status as "no rows" and moves on, so this doesn't need a code change,
    just documenting: a 404 in this script's log output for a young/rare
    age-band combination is expected, not a sign anything is broken.
  - MATT: 1 = "Antal patienter" (count), 2 = "Patienter/1000 invånare"
    (rate) — DIFFERENT ids from psych's 6/7, don't reuse those. There are
    also 3 ("Antal expedieringar") and 4 ("Expedieringar/1000 invånare") —
    dispensing EVENTS, not patients. Confirmed live which one to use: the
    existing synthetic generator's IND.antidep.age base values run 8-152
    (js/data.js); matt=2 for a mid-range cell (ages 40-44, national, 2023)
    reads 134.86, squarely in that range, while matt=4 reads 661.92 for the
    same cell — a ~5x mismatch that would have looked like a data error
    against everything users have seen on this chart so far. Use matt=2.
    `matt` accepts ONE value per request — a comma 404s, same trap as the
    other two datasets on this API.
  - ALDER: 1-18 are the same 5-year bands as psych's (1="0-4" ... 18="85+"),
    confirmed via /lakemedel/alder (re-verified live 2026-08-25 — ids 1-18
    still line up with AGE_GROUPS below exactly, including "0-14" pooling
    three bands, not two — see fetch_socialstyrelsen_psych.py's docstring).
    UNLIKE psych, there is no pre-aggregated "all ages" id here (psych has
    id 19 = "0-85+" published directly) — the all-ages total below is
    pooled from all 18 bands ourselves, same population-recovery trick
    pool() already uses for psych's nine bands, just applied across all
    eighteen instead of nine.
  - REGION ids are the SAME scheme as fetch_socialstyrelsen_mh.py's
    REGION_ID_TO_COUNTY — confirmed via /lakemedel/region (0=Riket, 1=01
    Stockholm, ... same set, no id 2/11/15/16).
  - KON: 1=Män, 2=Kvinnor, 3=Båda könen — same mapping as the other two
    datasets, and this one DOES publish by sex.
  - alder/kon/ar/region all accept comma-separated multi-values here
    (confirmed live, 3x3x2x2=36 rows back for a combined request) — but
    that's still not a blanket rule for every dataset on this API, per
    psych's own docstring; re-check per dataset.
  - Years 2006-2025 are all present (confirmed via /lakemedel/ar).
  - No suppression flag or disclosure floor is published on this dataset,
    same as psych — read as given. RE-VERIFIED for the four new ATC
    classes specifically (same concern as psych's docstring: a five-way
    split has much smaller cells than N06A alone did) — live-checked
    2026-08-25, Gotland x sleep medication (N05C) x ages 0-4 x women:
    counts of exactly 1 published unsuppressed for two separate years
    (2021, 2022). No floor found down to a true single-digit cell here
    either.

A single 22-region x 3-sex x 20-year request for one age band and one matt
value is ~1,320 rows, safely under the API's 5,000-per-page limit. This
script requests one age band at a time (like fetch_socialstyrelsen_psych.py
does), x2 for count/rate — 36 requests per ATC class, x5 classes = 180
requests total (was 36, single-class, before ATC_GROUPS existed).

Output: ../data/processed/socialstyrelsen_lakemedel.json
Run:    python prototype/pipeline/fetch_socialstyrelsen_lakemedel.py
"""
import json
import os
import time
from datetime import datetime

import requests

BASE_URL = "https://sdb.socialstyrelsen.se/api/v1/sv"
DATASET = "lakemedel"
HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

REGION_ID_TO_COUNTY = {
    0: "00", 1: "01", 3: "03", 4: "04", 5: "05", 6: "06", 7: "07", 8: "08",
    9: "09", 10: "10", 12: "12", 13: "13", 14: "14", 17: "17", 18: "18",
    19: "19", 20: "20", 21: "21", 22: "22", 23: "23", 24: "24", 25: "25",
}
REGION_IDS = ",".join(str(i) for i in REGION_ID_TO_COUNTY)
SEX = {1: "M", 2: "K", 3: "T"}
KON_IDS = "1,2,3"

# ATC N06A alone -> five classes, each its own indicator series. See
# docstring for the id -> label verification and the N06BA caveat.
ATC_GROUPS = {
    "N06A": "antidepressants",
    "N06BA": "adhd_med",
    "N05A": "antipsychotics",
    "N05B": "anxiety_med",
    "N05C": "sleep_med",
}
MATT_COUNT = 1
MATT_RATE = 2
YEARS = list(range(2006, datetime.now().year + 1))
YEARS_CSV = ",".join(str(y) for y in YEARS)

# Kurvan's nine age bands -> the 5-year alder ids that pool into each one —
# identical grouping to fetch_socialstyrelsen_psych.py's AGE_GROUPS, since
# both datasets share the same 5-year alder ids (1-18).
AGE_GROUPS = {
    "0-14": [1, 2, 3], "15-24": [4, 5], "25-34": [6, 7], "35-44": [8, 9],
    "45-54": [10, 11], "55-64": [12, 13], "65-74": [14, 15], "75-84": [16, 17],
    "85+": [18],
}
ALL_AGE_IDS = list(range(1, 19))   # no pre-aggregated "all ages" id here


def get(path, description="", retries=3):
    url = f"{BASE_URL}{path}?per_sida=5000&sida=1"
    resp = None
    for attempt in range(retries):
        try:
            resp = requests.get(url, timeout=90)
            break
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            if attempt == retries - 1:
                print(f"    failed after {retries} attempts for {description}: {e}")
                return []
            time.sleep(5 * (attempt + 1))
    if resp is not None and resp.status_code == 404:
        # A real, benign quirk of THIS dataset (not the psych/self-harm
        # ones) — a query with truly zero matching rows 404s instead of
        # returning {"data":[]} with 200 (confirmed live: ADHD medication,
        # ages 0-4 — see module docstring). Not suppression, not an error.
        print(f"    (no rows — 404, empty combination) for {description}")
        return []
    if resp is None or resp.status_code != 200:
        print(f"    error {getattr(resp, 'status_code', '?')} for {description}")
        return []
    body = resp.json()
    rows = body.get("data", body) if isinstance(body, dict) else body
    if isinstance(body, dict) and body.get("nasta_sida"):
        print(f"    WARNING: {description} paginated ({body.get('sidor')} pages); "
              f"only page 1 read. Narrow the request.")
    return rows if isinstance(rows, list) else []


def num(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace("\xa0", "").replace(" ", "").replace(",", "."))
    except (ValueError, TypeError):
        return None


def assert_atc_filter():
    """Trap check, extended from the original single N06A-vs-N05A
    comparison to all five ATC_GROUPS: every class must read a genuinely
    DIFFERENT rate from every other one at the same cell (2023 national,
    ages 40-44). If any two match, either a code was copy-pasted wrong or
    the atc filter has stopped filtering — the same failure mode
    fetch_socialstyrelsen_mh.py's diagnos/yttreorsak trap warns about, on
    a different dataset."""
    values = {}
    for code, name in ATC_GROUPS.items():
        rows = get(f"/{DATASET}/resultat/atc/{code}/alder/9/kon/3/matt/{MATT_RATE}"
                   f"/ar/2023/region/0", f"trap check ({code} {name})")
        values[code] = num(rows[0]["varde"]) if rows else None
    for code, name in ATC_GROUPS.items():
        print(f"  trap check: {code} ({name}) -> {values[code]}")

    for code, v in values.items():
        if v is None:
            raise SystemExit(
                f"FATAL: atc={code} ({ATC_GROUPS[code]}) returned no value for "
                f"2023 national data, ages 40-44. Stop and re-verify against "
                f"the API before publishing anything from this script."
            )
    seen = {}
    for code, v in values.items():
        dup = seen.get(v)
        if dup is not None:
            raise SystemExit(
                f"FATAL: atc={code} ({ATC_GROUPS[code]}) read identically ({v}) "
                f"to atc={dup} ({ATC_GROUPS[dup]}) for 2023 national data, ages "
                f"40-44. The atc filter or the codes have changed. Stop and "
                f"re-verify against the API before publishing anything from "
                f"this script."
            )
        seen[v] = code


def fetch_age_bands(atc, label):
    """One request pair (count, rate) per 5-year age band, kept under the
    5,000-row page limit — same shape as fetch_socialstyrelsen_psych.py's
    fetch_age_bands(), reused here for all 18 bands (there's no separate
    pre-aggregated 'all ages' request to make on this dataset)."""
    rows = []
    for age_id in ALL_AGE_IDS:
        for matt in (MATT_COUNT, MATT_RATE):
            batch = get(
                f"/{DATASET}/resultat/atc/{atc}/alder/{age_id}"
                f"/kon/{KON_IDS}/matt/{matt}/ar/{YEARS_CSV}/region/{REGION_IDS}",
                f"{label} age {age_id} matt{matt}",
            )
            rows.extend(batch)
            time.sleep(0.8)
        print(f"    {label} age band {age_id}: cumulative {len(rows)} rows")
    return rows


def _split(rows):
    """rows -> (counts, rates) keyed by (county, sex, alderId) -> {year: val}."""
    counts, rates = {}, {}
    for r in rows:
        county = REGION_ID_TO_COUNTY.get(r.get("regionId"))
        sex = SEX.get(r.get("konId"))
        val = num(r.get("varde"))
        if not (county and sex) or val is None:
            continue
        target = counts if r.get("mattId") == MATT_COUNT else rates
        target.setdefault((county, sex, r.get("alderId")), {})[int(r["ar"])] = val
    return counts, rates


def pool_bands(rows, county_names, indicator):
    """One record per (county, Kurvan age band, sex, year) — population
    recovered as count / rate * 1e3 (this table's rate is per 1,000, not
    per 100,000 like psych's) wherever both are published, same trick
    fetch_socialstyrelsen_psych.py's pool() uses for its nine bands.
    `indicator` tags which of the five ATC_GROUPS this batch is — js/data.js
    sums all five back into an "all" pseudo-type (same as psych's six)."""
    counts, rates = _split(rows)
    out = []
    for band_name, age_ids in AGE_GROUPS.items():
        for county in REGION_ID_TO_COUNTY.values():
            for sex in SEX.values():
                for year in YEARS:
                    total_count, total_pop, any_data = 0.0, 0.0, False
                    for aid in age_ids:
                        c = counts.get((county, sex, aid), {}).get(year)
                        rt = rates.get((county, sex, aid), {}).get(year)
                        if c is None or rt is None:
                            continue
                        any_data = True
                        total_count += c
                        if rt > 0:
                            total_pop += c / rt * 1e3
                    if not any_data or total_pop <= 0:
                        continue
                    out.append({
                        "region": county_names.get(county, county) if county != "00" else "Sverige",
                        "county_code": county,
                        "indicator": indicator,
                        "year": year,
                        "age_group": band_name,
                        "sex": sex,
                        "value": round(total_count / total_pop * 1e3, 1),
                        "count": int(round(total_count)),
                    })
    return out


def pool_all_ages(rows, county_names, indicator):
    """Same pooling as pool_bands(), but across all eighteen 5-year bands
    at once, for the '0-85+' total — psych gets this from a directly-
    published id, this dataset doesn't have one so it's reconstructed."""
    counts, rates = _split(rows)
    out = []
    for county in REGION_ID_TO_COUNTY.values():
        for sex in SEX.values():
            for year in YEARS:
                total_count, total_pop, any_data = 0.0, 0.0, False
                for aid in ALL_AGE_IDS:
                    c = counts.get((county, sex, aid), {}).get(year)
                    rt = rates.get((county, sex, aid), {}).get(year)
                    if c is None or rt is None:
                        continue
                    any_data = True
                    total_count += c
                    if rt > 0:
                        total_pop += c / rt * 1e3
                if not any_data or total_pop <= 0:
                    continue
                out.append({
                    "region": county_names.get(county, county) if county != "00" else "Sverige",
                    "county_code": county,
                    "indicator": indicator,
                    "year": year,
                    "age_group": "0-85+",
                    "sex": sex,
                    "value": round(total_count / total_pop * 1e3, 1),
                    "count": int(round(total_count)),
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
    print("[socialstyrelsen-lakemedel] region-grain psychiatric medication dispensing, "
          f"by ATC class ({len(ATC_GROUPS)} classes)")
    assert_atc_filter()
    county_names = load_county_names()

    band_raw_by_group = {}
    records = []
    for code, name in ATC_GROUPS.items():
        indicator = f"{name}_per_1000"
        label = f"{code} ({name})"
        print(f"  --- {label} ---")
        print("  fetching 5-year age bands...")
        band_raw = fetch_age_bands(code, label)
        band_raw_by_group[code] = band_raw
        records += pool_all_ages(band_raw, county_names, indicator)
        records += pool_bands(band_raw, county_names, indicator)

    with open(os.path.join(RAW_DIR, "socialstyrelsen_lakemedel_raw.json"), "w", encoding="utf-8") as f:
        json.dump({"age_bands": band_raw_by_group}, f, ensure_ascii=False, indent=1)

    out_path = os.path.join(PROCESSED_DIR, "socialstyrelsen_lakemedel.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    by_indicator = {}
    for r in records:
        by_indicator[r["indicator"]] = by_indicator.get(r["indicator"], 0) + 1
    print(f"\n[socialstyrelsen-lakemedel] wrote {out_path}  ({len(records)} records total)")
    for ind, n in sorted(by_indicator.items()):
        print(f"    {ind}: {n} rows")
    print("[socialstyrelsen-lakemedel] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
