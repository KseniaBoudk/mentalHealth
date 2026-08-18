# -*- coding: utf-8 -*-
"""Socialstyrelsen: specialist psychiatric care, at REGION grain.

Same API and municipality-privacy reasoning as fetch_socialstyrelsen_mh.py —
read that file's docstring first, this one only documents what's different.

Reads Kurvan's IND.psych: "Patientregistret", general psychiatric diagnoses,
NOT the self-harm/suicide slice fetch_socialstyrelsen_mh.py already covers.

===============================================================================
WHAT WAS VERIFIED LIVE AGAINST THE API BEFORE WRITING THIS, AND WHEN
===============================================================================
Checked 2026-08-18 against sdb.socialstyrelsen.se. Re-verify anything you
change here the same way — this dataset is a DIFFERENT resource from
yttreorsakertillskadorochforgiftningarbarn, hosted on the same domain, and its
quirks are not the same ones.

  - Dataset: `diagnoserislutenoppenvard` ("Diagnoses in inpatient and/or
    specialised outpatient care"). The dataset itself is already the SVOV
    (inpatient-or-outpatient) definition; unlike the self-harm dataset there
    is no separate `vardform` segment to get right or wrong.
  - The filtering segment IS named `diagnos` here (confirmed against
    /api/v1/sv/diagnoserislutenoppenvard: the dimension list literally names
    it "diagnos"). No yttreorsak-style trap on this dataset.
  - DIAGNOS = "05" is the ICD-10 chapter grouping "F00-F99: Psykiska
    sjukdomar och syndrom samt beteendestörningar" — the whole chapter, not
    a sub-diagnosis. Confirmed via /diagnos: id "05" sits above eleven
    sub-groups (0501 F00-F09 ... 0511 F99-F99). Sanity check: national 2023
    rate for "05" (4556.2/100k) is a proper subset of "99" (all diagnoses,
    42219.6/100k) — about a ninth, plausible for "any psychiatric contact"
    against "any specialist contact at all".
  - MATT: 6 = "Antal patienter" (count), 7 = "Antal patienter/100 000 inv"
    (rate). `matt` accepts ONE value per request — a comma returns 404,
    same trap as the self-harm dataset. `diagnos`, `kon`, `alder`, `ar` and
    `region` all accept comma-separated multi-values here (confirmed each
    independently); that is NOT true of every dataset on this API, so don't
    assume it elsewhere without checking again.
  - ALDER: 1-18 are 5-year bands (1="0-4" ... 18="85+"); 19 is "0-85+" (all
    ages) as its own directly-published value, not something to reconstruct.
    Kurvan's nine wider bands (see AGE_GROUPS below) are each two 5-year
    bands pooled, using the same population-recovery trick roll_suicide()
    uses in fetch_socialstyrelsen_mh.py: population = count / rate * 1e5,
    pooled rate = summed count / summed population. "85+" needs no pooling.
  - REGION ids are the SAME scheme as fetch_socialstyrelsen_mh.py's
    REGION_ID_TO_COUNTY (0=Riket, 1=01 Stockholm, ... no id 2, 11, 15, 16 —
    verified against /api/v1/sv/diagnoserislutenoppenvard/region).
  - KON: 1=Män, 2=Kvinnor, 3=Båda könen — same {1:"M",2:"K",3:"T"} mapping
    already used for self-harm/suicide, and this dataset DOES publish by
    sex (self-harm/suicide's regional data does not).
  - Years 2008-2025 are all present, matching the SVOV-from-2008 note that
    is already in IND.psych's caveat text in js/lang.js.
  - No suppression flag or disclosure floor is published on this dataset
    (unlike the self-harm/suicide one). It is read as given; Socialstyrelsen
    applies its own disclosure control before anything reaches this API.

A single 22-region x 3-sex x 18-year request for one age band is ~1,200
rows, safely under the API's 5,000-per-page limit that fetch_socialstyrelsen_mh.py's
get() does not paginate past (it only warns). So this script requests one age
band at a time rather than teach get() to follow nasta_sida.

Output: ../data/processed/socialstyrelsen_psych.json
Run:    python prototype/pipeline/fetch_socialstyrelsen_psych.py
"""
import json
import os
import time
from datetime import datetime

import requests

BASE_URL = "https://sdb.socialstyrelsen.se/api/v1/sv"
DATASET = "diagnoserislutenoppenvard"
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

DIAGNOS = "05"          # F00-F99, all psychiatric diagnoses. See docstring.
MATT_COUNT = 6
MATT_RATE = 7
YEARS = list(range(2008, datetime.now().year + 1))
YEARS_CSV = ",".join(str(y) for y in YEARS)

# Kurvan's nine age bands -> the 5-year alder ids that pool into each one.
# "0-85+" (id 19) is fetched separately and used as-is for the "all ages" total.
AGE_GROUPS = {
    "0-14": [1, 2, 3], "15-24": [4, 5], "25-34": [6, 7], "35-44": [8, 9],
    "45-54": [10, 11], "55-64": [12, 13], "65-74": [14, 15], "75-84": [16, 17],
    "85+": [18],
}
ALL_AGES_ID = 19


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


def assert_diagnos_filters():
    """Trap check: diagnos=05 must be a proper, smaller subset of diagnos=99
    (all diagnoses combined). If it isn't, the filter has stopped filtering —
    the exact failure mode fetch_socialstyrelsen_mh.py's diagnos/yttreorsak
    trap warns about, on a different dataset."""
    psych = get(f"/{DATASET}/resultat/diagnos/{DIAGNOS}/alder/{ALL_AGES_ID}"
                f"/kon/3/matt/{MATT_RATE}/ar/2023/region/0", "trap check (05)")
    total = get(f"/{DATASET}/resultat/diagnos/99/alder/{ALL_AGES_ID}"
                f"/kon/3/matt/{MATT_RATE}/ar/2023/region/0", "trap check (99)")
    pv = num(psych[0]["varde"]) if psych else None
    tv = num(total[0]["varde"]) if total else None
    print(f"  trap check: diagnos=05 -> {pv}, diagnos=99 (all) -> {tv}")
    if pv is None or tv is None or not (0 < pv < tv):
        raise SystemExit(
            "FATAL: diagnos=05 is not a smaller positive subset of diagnos=99 "
            "for 2023 national data. The filter or the ids have changed. Stop "
            "and re-verify against the API before publishing anything from "
            "this script."
        )


def fetch_all_ages():
    """One row per region/sex/year at the API's own '0-85+' age value —
    used directly for the 'all ages' total, no pooling needed."""
    rows = []
    for matt in (MATT_COUNT, MATT_RATE):
        batch = get(
            f"/{DATASET}/resultat/diagnos/{DIAGNOS}/alder/{ALL_AGES_ID}"
            f"/kon/{KON_IDS}/matt/{matt}/ar/{YEARS_CSV}/region/{REGION_IDS}",
            f"all-ages matt{matt}",
        )
        rows.extend(batch)
        time.sleep(1.0)
    print(f"    all-ages: {len(rows)} rows")
    return rows


def fetch_age_bands():
    """One request pair (count, rate) per 5-year age band, kept under the
    5,000-row page limit. See the docstring's row-count arithmetic."""
    rows = []
    for age_id in range(1, 19):
        for matt in (MATT_COUNT, MATT_RATE):
            batch = get(
                f"/{DATASET}/resultat/diagnos/{DIAGNOS}/alder/{age_id}"
                f"/kon/{KON_IDS}/matt/{matt}/ar/{YEARS_CSV}/region/{REGION_IDS}",
                f"age {age_id} matt{matt}",
            )
            rows.extend(batch)
            time.sleep(0.8)
        print(f"    age band {age_id}: cumulative {len(rows)} rows")
    return rows


def pool(rows, county_names):
    """rows -> tidy long records, one per (county, kurvan age band, sex, year).

    Splits into counts and rates first, same shape roll_suicide() in
    fetch_socialstyrelsen_mh.py uses, then recovers population as
    count / rate * 1e5 to pool two 5-year bands into one Kurvan band.
    """
    counts, rates = {}, {}
    for r in rows:
        county = REGION_ID_TO_COUNTY.get(r.get("regionId"))
        sex = SEX.get(r.get("konId"))
        val = num(r.get("varde"))
        if not (county and sex) or val is None:
            continue
        target = counts if r.get("mattId") == MATT_COUNT else rates
        target.setdefault((county, sex, r.get("alderId")), {})[int(r["ar"])] = val

    out = []
    for band_name, age_ids in AGE_GROUPS.items():
        for county in REGION_ID_TO_COUNTY.values():
            for sex in SEX.values():
                for year in YEARS:
                    total_count, total_pop = 0.0, 0.0
                    any_data = False
                    for aid in age_ids:
                        c = counts.get((county, sex, aid), {}).get(year)
                        rt = rates.get((county, sex, aid), {}).get(year)
                        if c is None or rt is None:
                            continue
                        any_data = True
                        total_count += c
                        if rt > 0:
                            total_pop += c / rt * 1e5
                    if not any_data or total_pop <= 0:
                        continue
                    out.append({
                        "region": county_names.get(county, county) if county != "00" else "Sverige",
                        "county_code": county,
                        "indicator": "psych_per_100k",
                        "year": year,
                        "age_group": band_name,
                        "sex": sex,
                        "value": round(total_count / total_pop * 1e5, 1),
                        "count": int(round(total_count)),
                    })
    return out


def all_ages_records(rows, county_names):
    counts, rates = {}, {}
    for r in rows:
        county = REGION_ID_TO_COUNTY.get(r.get("regionId"))
        sex = SEX.get(r.get("konId"))
        val = num(r.get("varde"))
        if not (county and sex) or val is None:
            continue
        target = counts if r.get("mattId") == MATT_COUNT else rates
        target.setdefault((county, sex), {})[int(r["ar"])] = val

    out = []
    for (county, sex), by_year in rates.items():
        for year, rate in by_year.items():
            c = counts.get((county, sex), {}).get(year)
            out.append({
                "region": county_names.get(county, county) if county != "00" else "Sverige",
                "county_code": county,
                "indicator": "psych_per_100k",
                "year": year,
                "age_group": "0-85+",
                "sex": sex,
                "value": rate,
                "count": int(c) if c is not None else None,
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
    print("[socialstyrelsen-psych] region-grain specialist psychiatric care")
    assert_diagnos_filters()
    county_names = load_county_names()

    print("  fetching 'all ages' (0-85+)...")
    all_ages_raw = fetch_all_ages()
    print("  fetching 5-year age bands (for Kurvan's nine wider bands)...")
    band_raw = fetch_age_bands()

    with open(os.path.join(RAW_DIR, "socialstyrelsen_psych_raw.json"), "w", encoding="utf-8") as f:
        json.dump({"all_ages": all_ages_raw, "age_bands": band_raw}, f, ensure_ascii=False, indent=1)

    records = all_ages_records(all_ages_raw, county_names) + pool(band_raw, county_names)
    out_path = os.path.join(PROCESSED_DIR, "socialstyrelsen_psych.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    print(f"\n[socialstyrelsen-psych] wrote {out_path}  ({len(records)} records)")
    print("[socialstyrelsen-psych] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
