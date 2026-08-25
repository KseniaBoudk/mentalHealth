# -*- coding: utf-8 -*-
"""SCB (Statistiska centralbyrån) Statistikdatabasen: population by region,
age band and sex — the denominator behind js/data.js's standardRate().

PxWeb API, same technology fetch_folkhalsodata_hlv.py/fetch_hbsc.py already
speak, but a DIFFERENT host/instance (api.scb.se, not Folkhälsomyndigheten's)
— its own dimension ids are verified live below, not assumed to carry over.
A working (but much narrower) reference for this exact host/table already
exists outside this repo at ../../MentalHealthTemplate/prototype/fetch_scb.py
— the parent project this whole pipeline/ was copied from. Its mechanics
(batching, resolve_years, the JSON-stat parse) are reused here; it only
ever fetched TOTAL population though, no age/sex breakdown, so the query
itself is new.

===============================================================================
TABLE CHOICE: BefolkningNy ONLY, NOT ALSO BefolkningCKM — READ BEFORE ADDING IT
===============================================================================
SCB splits this data across two tables: BefolkningNy (single-year ages,
1968-2024, the table used below) and BefolkningCKM (nominally "the current
year", 2025 as of writing). They are NOT the same shape — checked live
2026-08-25:
  - BefolkningNy: Civilstand has 4 codes, no total. Alder is clean single
    years "0".."100" plus "100+" (102 values). Kon is "1"/"2", no total.
    ContentsCode is BE0101N1 (population) / BE0101N2 (growth).
  - BefolkningCKM: Civilstand has a 5th "SC" (samtliga civilstånd, i.e. a
    real total — different from Ny). Alder mixes single years with
    pre-aggregated range codes and a "TotSA" total (137 values, not a
    superset of Ny's clean single-year scheme). Kon has a "TotSa" total.
    ContentsCode is an entirely different namespace ("000007ME" etc.), not
    BE0101N1/N2.
  This is enough structural drift that reusing BefolkningNy's query against
  BefolkningCKM would silently ask for the wrong things. Given it's ONE
  extra year (2025) and js/data.js's standardRate() already has to handle
  "no population row for this year" gracefully (real indicators here
  already extend past what SCB has published), this script deliberately
  fetches ONLY BefolkningNy and stops at 2024. Add BefolkningCKM later as
  its own separate query if 2025+ standardisation turns out to matter,
  rather than bolting it onto this one.

===============================================================================
OTHER THINGS VERIFIED LIVE, NOT ASSUMED
===============================================================================
  - Region: BefolkningNy's 2-digit codes ("00" Riket, "01".."25") are the
    SAME scheme as Kurvan's own REGIONS — no remapping needed, confirmed
    against every code in REGION_CODES below.
  - Civilstand ("OG"/"G"/"ÄNKL"/"SK" — single/married/widowed/divorced):
    no total code exists on this table. Every record below is the SUM
    across all four; population counts, so summing is exact, not an
    approximation.
  - Alder: single years "0".."99" plus a "100+" catch-all (101 real ages),
    plus one MORE value, "tot" — this dimension's own total pseudo-age,
    102 values total. "tot" is excluded in fetch_population() (querying
    it would double the population). The 101 real ages are pooled into
    Kurvan's own nine AGES bands directly (age_band_of() below) — NOT via
    fetch_socialstyrelsen_psych.py's AGE_GROUPS, which maps a completely
    different id scheme (that register's own 5-year band IDS, not raw
    ages) and does not apply here.
  - Kon: "1"=män (men), "2"=kvinnor (women) — same order Socialstyrelsen's
    fetchers use elsewhere in this folder, unlike Folkhälsodata's HLV/HBSC
    tables, which each have their own independent ordering. Do not assume
    this carries over to a fourth PxWeb host without checking again.
  - ContentsCode: BE0101N1 = "Folkmängd" (population headcount). BE0101N2
    is population growth, not fetched here.
  - Query size: a single request across all 22 regions x 4 civilstand x
    102 ages x 2 sexes x N years is 17,952 cells PER YEAR — SCB's own cap
    is roughly 150,000 cells/request (same limit the parent project's
    fetch_scb.py documents), so YEAR_BATCH below keeps each request under
    that with room to spare.

Output: ../data/processed/scb_population.json
Run:    python prototype/pipeline/fetch_scb_population.py
"""
import json
import os
import time
from datetime import datetime

import requests

BASE_URL = "https://api.scb.se/OV0104/v1/doris/sv/ssd"
TABLE_PATH = "BE/BE0101/BE0101A/BefolkningNy"
HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

# Kurvan's own REGIONS codes (js/data.js) + "00" for Riket/national.
REGION_CODES = ["00", "01", "03", "04", "05", "06", "07", "08", "09", "10",
                "12", "13", "14", "17", "18", "19", "20", "21", "22", "23",
                "24", "25"]
KON = {"1": "M", "2": "K"}
CONTENT = "BE0101N1"          # Folkmängd (population) — not N2 (growth)

# Only years Kurvan's real indicators can actually use a denominator for
# (psych from 2008, antidep from 2006) — no point fetching 1968 onward.
YEARS_WANTED = [str(y) for y in range(2006, datetime.now().year + 1)]
# 22 regions x 4 civilstand x 102 ages x 2 kon x 5 years = 89,760 cells,
# safely under SCB's ~150,000/request cap — see docstring's query-size note.
YEAR_BATCH = 5

AGES = ["0-14", "15-24", "25-34", "35-44", "45-54", "55-64", "65-74", "75-84", "85+"]


def age_band_of(age_str):
    """SCB single-year age (or '100+') -> index into Kurvan's own AGES.
    Returns None for 'tot' — this dimension's own total pseudo-value,
    present in its values list alongside the 101 single years + '100+'
    (found live: 102 values total, not the 101+1 the docstring's own
    query-size note assumed before this was caught — excluded at query
    time in fetch_population() too, so this is a belt-and-suspenders
    guard, not the only place it's filtered)."""
    if age_str == "tot":
        return None
    n = 100 if age_str == "100+" else int(age_str)
    if n <= 14: return 0
    if n <= 24: return 1
    if n <= 34: return 2
    if n <= 44: return 3
    if n <= 54: return 4
    if n <= 64: return 5
    if n <= 74: return 6
    if n <= 84: return 7
    return 8


def get_metadata():
    resp = requests.get(f"{BASE_URL}/{TABLE_PATH}", timeout=60)
    resp.raise_for_status()
    return resp.json()


def resolve_years(meta, wanted):
    """Intersect the wanted years with what this table has actually
    published — see the parent project's fetch_scb.py docstring for why
    this matters (different SCB tables advance on different schedules)."""
    for var in meta["variables"]:
        if var["code"] == "Tid":
            available = set(var["values"])
            years = [y for y in wanted if y in available]
            print(f"    {TABLE_PATH}: years {years[0]}-{years[-1]} of {len(years)} available")
            return years
    return wanted


def post_table(query, description="", retries=3):
    url = f"{BASE_URL}/{TABLE_PATH}"
    resp = None
    for attempt in range(retries):
        try:
            resp = requests.post(url, json=query, timeout=90)
            break
        except (requests.exceptions.ConnectionError,
                requests.exceptions.ChunkedEncodingError,
                requests.exceptions.Timeout) as e:
            if attempt < retries - 1:
                wait = 5 * (attempt + 1)
                print(f"    connection error for {description}, retrying in {wait}s")
                time.sleep(wait)
            else:
                print(f"    failed after {retries} attempts for {description}: {e}")
                return None
    if resp is None or resp.status_code != 200:
        print(f"    error {getattr(resp, 'status_code', '?')} for {description}: "
              f"{getattr(resp, 'text', '')[:200]}")
        return None
    return resp.json()


def fetch_population(meta):
    var = {v["code"]: v for v in meta["variables"]}
    civilstand_values = var["Civilstand"]["values"]
    # Excludes "tot" — this dimension's own total pseudo-value, not a real
    # age (found live: 102 values = 101 single years/"100+" + "tot").
    alder_values = [a for a in var["Alder"]["values"] if a != "tot"]
    years = resolve_years(meta, YEARS_WANTED)

    all_rows = []
    for i in range(0, len(years), YEAR_BATCH):
        batch_years = years[i:i + YEAR_BATCH]
        query = {
            "query": [
                {"code": "Region", "selection": {"filter": "item", "values": REGION_CODES}},
                {"code": "Civilstand", "selection": {"filter": "item", "values": civilstand_values}},
                {"code": "Alder", "selection": {"filter": "item", "values": alder_values}},
                {"code": "Kon", "selection": {"filter": "item", "values": list(KON)}},
                {"code": "ContentsCode", "selection": {"filter": "item", "values": [CONTENT]}},
                {"code": "Tid", "selection": {"filter": "item", "values": batch_years}},
            ],
            "response": {"format": "json"},
        }
        data = post_table(query, f"population {batch_years[0]}-{batch_years[-1]}")
        if data:
            all_rows.extend(data.get("data", []))
        time.sleep(1.0)
    print(f"    population: {len(all_rows)} raw cells")
    return all_rows


def to_records(raw_rows):
    """Raw PxWeb cells (one region/civilstand/age/kon/year each) -> summed
    across civilstand, pooled across single-year age into Kurvan's nine
    AGES bands, one record per county/age_band/sex/year."""
    groups = {}   # (county, ageIdx, sex, year) -> summed population
    for cell in raw_rows:
        region, _civilstand, age, kon_id, year = cell["key"]
        sex = KON.get(kon_id)
        if sex is None:
            continue
        try:
            pop = int(cell["values"][0])
        except (ValueError, TypeError, IndexError):
            continue   # population counts are never suppressed by SCB; a bad
                        # cell here means a parse issue, not real "no data"
        key = (region, age_band_of(age), sex, year)
        groups[key] = groups.get(key, 0) + pop

    out = []
    for (county_code, age_idx, sex, year), pop in groups.items():
        out.append({
            "county_code": county_code,
            "indicator": "population",
            "age_group": AGES[age_idx],
            "sex": sex,
            "year": int(year),
            "value": pop,
        })
    return out


def main():
    print("[scb-population] region-grain population by age band and sex (BE0101A/BefolkningNy)")
    meta = get_metadata()

    raw = fetch_population(meta)
    with open(os.path.join(RAW_DIR, "scb_population_raw.json"), "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=1)

    records = to_records(raw)
    out_path = os.path.join(PROCESSED_DIR, "scb_population.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    years = sorted({r["year"] for r in records})
    counties = sorted({r["county_code"] for r in records})
    print(f"[scb-population] wrote {out_path}  ({len(records)} records, "
          f"{len(counties)} region(s), years {years[0]}..{years[-1]})")
    if len(counties) < 22:
        print(f"[scb-population] WARNING: expected 22 regions (21 counties + Riket). "
              f"Got {len(counties)}.")
    expected_per_year_region = len(AGES) * 2   # 9 age bands x 2 sexes
    got = len(records) / max(1, len(counties) * len(years))
    if abs(got - expected_per_year_region) > 0.01:
        print(f"[scb-population] WARNING: expected {expected_per_year_region} records per "
              f"county/year (9 age bands x 2 sexes), averaged {got:.1f}. Some cells may be "
              f"missing — check for gaps before trusting standardRate() against this.")
    print("[scb-population] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
