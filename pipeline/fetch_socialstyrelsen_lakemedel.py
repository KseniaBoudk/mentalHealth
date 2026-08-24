# -*- coding: utf-8 -*-
"""Socialstyrelsen: antidepressants dispensed (ATC N06A), at REGION grain.

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
    confirmed via /lakemedel/alder. UNLIKE psych, there is no pre-aggregated
    "all ages" id here (psych has id 19 = "0-85+" published directly) — the
    all-ages total below is pooled from all 18 bands ourselves, same
    population-recovery trick pool() already uses for psych's nine bands,
    just applied across all eighteen instead of pairs of two.
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
    same as psych — read as given.

A single 22-region x 3-sex x 20-year request for one age band and one matt
value is ~1,320 rows, safely under the API's 5,000-per-page limit. This
script requests one age band at a time (like fetch_socialstyrelsen_psych.py
does), x2 for count/rate — 36 requests total.

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

ATC = "N06A"            # Antidepressiva medel. See docstring.
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
    """Trap check: N06A must read differently from an unrelated ATC class at
    the same cell. If it doesn't, the filter has stopped filtering — the
    same failure mode fetch_socialstyrelsen_mh.py's diagnos/yttreorsak trap
    warns about, on a different dataset."""
    antidep = get(f"/{DATASET}/resultat/atc/{ATC}/alder/9/kon/3/matt/{MATT_RATE}"
                  f"/ar/2023/region/0", "trap check (N06A)")
    other = get(f"/{DATASET}/resultat/atc/N05A/alder/9/kon/3/matt/{MATT_RATE}"
                f"/ar/2023/region/0", "trap check (N05A)")
    av = num(antidep[0]["varde"]) if antidep else None
    ov = num(other[0]["varde"]) if other else None
    print(f"  trap check: N06A -> {av}, N05A -> {ov}")
    if av is None or ov is None or av == ov:
        raise SystemExit(
            "FATAL: N06A and N05A read identically (or one is missing) for "
            "2023 national data, ages 40-44. The atc filter or the codes "
            "have changed. Stop and re-verify against the API before "
            "publishing anything from this script."
        )


def fetch_age_bands():
    """One request pair (count, rate) per 5-year age band, kept under the
    5,000-row page limit — same shape as fetch_socialstyrelsen_psych.py's
    fetch_age_bands(), reused here for all 18 bands (there's no separate
    pre-aggregated 'all ages' request to make on this dataset)."""
    rows = []
    for age_id in ALL_AGE_IDS:
        for matt in (MATT_COUNT, MATT_RATE):
            batch = get(
                f"/{DATASET}/resultat/atc/{ATC}/alder/{age_id}"
                f"/kon/{KON_IDS}/matt/{matt}/ar/{YEARS_CSV}/region/{REGION_IDS}",
                f"age {age_id} matt{matt}",
            )
            rows.extend(batch)
            time.sleep(0.8)
        print(f"    age band {age_id}: cumulative {len(rows)} rows")
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


def pool_bands(rows, county_names):
    """One record per (county, Kurvan age band, sex, year) — population
    recovered as count / rate * 1e3 (this table's rate is per 1,000, not
    per 100,000 like psych's) wherever both are published, same trick
    fetch_socialstyrelsen_psych.py's pool() uses for its nine bands."""
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
                        "indicator": "antidep_per_1000",
                        "year": year,
                        "age_group": band_name,
                        "sex": sex,
                        "value": round(total_count / total_pop * 1e3, 1),
                        "count": int(round(total_count)),
                    })
    return out


def pool_all_ages(rows, county_names):
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
                    "indicator": "antidep_per_1000",
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
    print("[socialstyrelsen-lakemedel] region-grain antidepressant dispensing (ATC N06A)")
    assert_atc_filter()
    county_names = load_county_names()

    print("  fetching 5-year age bands...")
    band_raw = fetch_age_bands()

    with open(os.path.join(RAW_DIR, "socialstyrelsen_lakemedel_raw.json"), "w", encoding="utf-8") as f:
        json.dump({"age_bands": band_raw}, f, ensure_ascii=False, indent=1)

    records = pool_all_ages(band_raw, county_names) + pool_bands(band_raw, county_names)
    out_path = os.path.join(PROCESSED_DIR, "socialstyrelsen_lakemedel.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    print(f"\n[socialstyrelsen-lakemedel] wrote {out_path}  ({len(records)} records)")
    print("[socialstyrelsen-lakemedel] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
