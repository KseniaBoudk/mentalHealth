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
  - DIAGNOS "05" is the ICD-10 chapter grouping "F00-F99: Psykiska
    sjukdomar och syndrom samt beteendestörningar" — the whole chapter.
    This script no longer fetches "05" itself: it fetches six of its
    eleven real sub-groups instead (DIAGNOS_GROUPS below), confirmed live
    2026-08-25 via /diagnos — every one of the six has `grupp:"05"` (a
    real child of the F00-F99 chapter, not a sibling or typo) and a label
    matching what was asked for:
      0502 substance use     (F10-F19, "orsakade av psykoaktiva substanser")
      0503 psychosis         (F20-F29, "Schizofreni, schizotypa störningar...")
      0504 depression/mood   (F30-F39, "Förstämningssyndrom")
      0505 anxiety/stress    (F40-F48, "Neurotiska, stressrelaterade...")
      0506 eating disorders  (F50-F59 — the label is really "behavioural
                               syndromes with physiological disturbance";
                               eating disorders are the largest piece, not
                               the only one — also sleep, sexual
                               dysfunction, postpartum. Kept the requested
                               name in DIAGNOS_GROUPS' key for readability,
                               but js/lang.js's caveat text says the real
                               scope, not just "eating disorders")
      0510 ADHD/childhood    (F90-F98 — same caveat: really "behavioural
                               and emotional disorders with onset in
                               childhood", ADHD is the largest piece, not
                               the only one — also conduct disorders, tics,
                               enuresis)
    Kurvan's own "all psychiatric care" figure is no longer fetched
    directly either — js/data.js reconstructs it by summing these six
    real series (same pattern the age-band pooling below already uses),
    not by an extra API call for "05" itself.
  - MATT: 6 = "Antal patienter" (count), 7 = "Antal patienter/100 000 inv"
    (rate). `matt` accepts ONE value per request — a comma returns 404,
    same trap as the self-harm dataset. `diagnos`, `kon`, `alder`, `ar` and
    `region` all accept comma-separated multi-values here (confirmed each
    independently); that is NOT true of every dataset on this API, so don't
    assume it elsewhere without checking again.
  - ALDER: 1-18 are 5-year bands (1="0-4" ... 18="85+"); 19 is "0-85+" (all
    ages) as its own directly-published value, not something to reconstruct.
    Kurvan's nine wider bands (see AGE_GROUPS below) are each built from
    5-year bands pooled, using the same population-recovery trick
    roll_suicide() uses in fetch_socialstyrelsen_mh.py: population =
    count / rate * 1e5, pooled rate = summed count / summed population.
    Most bands pool a pair of 5-year bands, but "0-14" pools THREE
    (0-4, 5-9, 10-14 — it's a 15-year band, not 10) and "85+" needs no
    pooling at all. Live-verified 2026-08-25 against
    /api/v1/sv/diagnoserislutenoppenvard/alder: ids 1-18 are exactly the
    5-year bands assumed above, confirming AGE_GROUPS' id lists are right.
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
    RE-VERIFIED for the new, finer-grained sub-diagnosis series specifically
    (a real concern: six-way-split cells are much smaller than the "05"
    aggregate's, and a floor that never triggered on the aggregate could
    start triggering here) — live-checked 2026-08-25, Gotland (smallest
    county) x substance use (0502) x ages 0-4 x men, 2023: a raw count of
    ONE person, published unsuppressed (`"varde":"1"`). Every other
    year/sex combination in that same narrow slice was simply absent
    (zero cases, not withheld — same "absent county-year means zero, not
    missing" rule fetch_socialstyrelsen_mh.py's docstring already
    documents for self-harm/suicide). No disclosure floor found anywhere
    down to a true single-digit cell.

A single 22-region x 3-sex x 18-year request for one age band is ~1,200
rows, safely under the API's 5,000-per-page limit that fetch_socialstyrelsen_mh.py's
get() does not paginate past (it only warns). So this script requests one age
band at a time rather than teach get() to follow nasta_sida — now six times
over, once per DIAGNOS_GROUPS entry (~40 requests before -> ~240 now; several
minutes, not one).

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

# DIAGNOS "05" (F00-F99, all psychiatric diagnoses) -> six of its real
# sub-groups, each its own indicator series. See docstring for the id ->
# label verification and the two labelling caveats (0506, 0510).
DIAGNOS_GROUPS = {
    "0502": "substance_use",
    "0503": "psychosis",
    "0504": "depression_mood",
    "0505": "anxiety_stress",
    "0506": "eating_disorders",
    "0510": "adhd_childhood",
}
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
    """Two trap checks, both on 2023 national all-ages data:

    1. Each of the six DIAGNOS_GROUPS sub-codes must return a DIFFERENT
       rate from every other one. If any two match, either a code was
       copy-pasted wrong or the diagnos filter has stopped filtering (the
       exact failure mode fetch_socialstyrelsen_mh.py's diagnos/yttreorsak
       trap already warns about, on a different dataset).
    2. Each sub-code must be a proper, smaller-than, positive subset of
       diagnos=99 (all diagnoses combined) — same sanity bound the old
       single-DIAGNOS="05" version of this check used.
    """
    total = get(f"/{DATASET}/resultat/diagnos/99/alder/{ALL_AGES_ID}"
                f"/kon/3/matt/{MATT_RATE}/ar/2023/region/0", "trap check (99, all diagnoses)")
    tv = num(total[0]["varde"]) if total else None
    values = {}
    for code, name in DIAGNOS_GROUPS.items():
        rows = get(f"/{DATASET}/resultat/diagnos/{code}/alder/{ALL_AGES_ID}"
                    f"/kon/3/matt/{MATT_RATE}/ar/2023/region/0", f"trap check ({code} {name})")
        values[code] = num(rows[0]["varde"]) if rows else None
    print(f"  trap check: diagnos=99 (all) -> {tv}")
    for code, name in DIAGNOS_GROUPS.items():
        print(f"    diagnos={code} ({name}) -> {values[code]}")

    if tv is None:
        raise SystemExit("FATAL: could not read diagnos=99 (all diagnoses) reference value.")
    for code, v in values.items():
        if v is None or not (0 < v < tv):
            raise SystemExit(
                f"FATAL: diagnos={code} ({DIAGNOS_GROUPS[code]}) is not a smaller "
                f"positive subset of diagnos=99 for 2023 national data. Stop and "
                f"re-verify against the API before publishing anything from this "
                f"script."
            )
    seen = {}
    for code, v in values.items():
        dup = seen.get(v)
        if dup is not None:
            raise SystemExit(
                f"FATAL: diagnos={code} ({DIAGNOS_GROUPS[code]}) returned the exact "
                f"same rate ({v}) as diagnos={dup} ({DIAGNOS_GROUPS[dup]}) — the "
                f"filter has very likely stopped distinguishing between codes. Stop "
                f"and re-verify against the API before publishing anything from "
                f"this script."
            )
        seen[v] = code


def fetch_all_ages(diagnos, label):
    """One row per region/sex/year at the API's own '0-85+' age value —
    used directly for the 'all ages' total, no pooling needed."""
    rows = []
    for matt in (MATT_COUNT, MATT_RATE):
        batch = get(
            f"/{DATASET}/resultat/diagnos/{diagnos}/alder/{ALL_AGES_ID}"
            f"/kon/{KON_IDS}/matt/{matt}/ar/{YEARS_CSV}/region/{REGION_IDS}",
            f"{label} all-ages matt{matt}",
        )
        rows.extend(batch)
        time.sleep(1.0)
    print(f"    {label} all-ages: {len(rows)} rows")
    return rows


def fetch_age_bands(diagnos, label):
    """One request pair (count, rate) per 5-year age band, kept under the
    5,000-row page limit. See the docstring's row-count arithmetic."""
    rows = []
    for age_id in range(1, 19):
        for matt in (MATT_COUNT, MATT_RATE):
            batch = get(
                f"/{DATASET}/resultat/diagnos/{diagnos}/alder/{age_id}"
                f"/kon/{KON_IDS}/matt/{matt}/ar/{YEARS_CSV}/region/{REGION_IDS}",
                f"{label} age {age_id} matt{matt}",
            )
            rows.extend(batch)
            time.sleep(0.8)
        print(f"    {label} age band {age_id}: cumulative {len(rows)} rows")
    return rows


def pool(rows, county_names, indicator):
    """rows -> tidy long records, one per (county, kurvan age band, sex, year).

    Splits into counts and rates first, same shape roll_suicide() in
    fetch_socialstyrelsen_mh.py uses, then recovers population as
    count / rate * 1e5 to pool two 5-year bands into one Kurvan band.
    `indicator` tags which of the six DIAGNOS_GROUPS this batch is —
    js/data.js sums all six back into an "all" pseudo-type rather than
    this script fetching diagnos=05 separately (see module docstring).
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
                        "indicator": indicator,
                        "year": year,
                        "age_group": band_name,
                        "sex": sex,
                        "value": round(total_count / total_pop * 1e5, 1),
                        "count": int(round(total_count)),
                    })
    return out


def all_ages_records(rows, county_names, indicator):
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
                "indicator": indicator,
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
    print("[socialstyrelsen-psych] region-grain specialist psychiatric care, "
          f"by diagnosis type ({len(DIAGNOS_GROUPS)} groups)")
    assert_diagnos_filters()
    county_names = load_county_names()

    all_ages_raw_by_group = {}
    band_raw_by_group = {}
    records = []
    for code, name in DIAGNOS_GROUPS.items():
        indicator = f"psych_{name}_per_100k"
        label = f"{code} ({name})"
        print(f"  --- {label} ---")
        print(f"  fetching 'all ages' (0-85+)...")
        all_ages_raw = fetch_all_ages(code, label)
        print("  fetching 5-year age bands (for Kurvan's nine wider bands)...")
        band_raw = fetch_age_bands(code, label)
        all_ages_raw_by_group[code] = all_ages_raw
        band_raw_by_group[code] = band_raw
        records += all_ages_records(all_ages_raw, county_names, indicator)
        records += pool(band_raw, county_names, indicator)

    with open(os.path.join(RAW_DIR, "socialstyrelsen_psych_raw.json"), "w", encoding="utf-8") as f:
        json.dump({"all_ages": all_ages_raw_by_group, "age_bands": band_raw_by_group}, f, ensure_ascii=False, indent=1)

    out_path = os.path.join(PROCESSED_DIR, "socialstyrelsen_psych.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    by_indicator = {}
    for r in records:
        by_indicator[r["indicator"]] = by_indicator.get(r["indicator"], 0) + 1
    print(f"\n[socialstyrelsen-psych] wrote {out_path}  ({len(records)} records total)")
    for ind, n in sorted(by_indicator.items()):
        print(f"    {ind}: {n} rows")
    print("[socialstyrelsen-psych] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
