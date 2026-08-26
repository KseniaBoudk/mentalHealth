# -*- coding: utf-8 -*-
"""Socialstyrelsen: self-harm hospitalisations and suicide, at REGION grain.

THIS IS A COPY of ../../pipeline/fetch_socialstyrelsen_mh.py, kept in sync by hand,
with exactly one behavioural change from the original: see "KURVAN CHANGE" below.
Everything else — including every trap, warning and rule in this docstring — is
the original author's, and still applies unchanged. Read it before touching
anything below it.

THE MOST DIRECTLY USEFUL FILE IN THIS KIT, and the one where a careless edit does
the most damage.

Both series are regional and STAY REGIONAL. Neither is ever written onto a
municipality. County counts are already small enough that a municipal split
would be disclosive as well as statistically meaningless: at a national suicide
rate near 15 per 100,000, a municipality of 2,400 people expects 0.4 deaths a
year, and one death would render as "the worst municipality in Sweden".

===============================================================================
TWO API TRAPS. BOTH RETURN HTTP 200 WITH WRONG DATA.
===============================================================================

  1. THE FILTERING SEGMENT IS `diagnos`, NOT `yttreorsak`.

     The dimension is named `yttreorsak` (external cause) in the documentation,
     but the path segment that actually FILTERS is `diagnos`. Requesting
     `/yttreorsak/VXY2/` returns all 214 causes rather than one. That is a wrong
     answer, not an error, and it silently inflates every figure by roughly two
     orders of magnitude.

     `assert_diagnos_segment()` below re-runs this check on every fetch. It
     costs two requests. Do not remove it.

  2. AN ABSENT COUNTY-YEAR MEANS ZERO, NOT MISSING.

     The API returns no row for a county-year in which nobody died. That is not
     suppression: counts of 1 and 2 are published freely, so a gap is a year
     with no deaths. Reading a gap as "no data" disqualifies almost every county
     window and leaves the smallest counties, the ones the windowing exists to
     serve, with no series at all.

     So the year grid is taken from the national series, which is complete, and
     every county-year missing from it is filled with 0.

ALSO KNOWN, AND EASY TO GET WRONG:

  - `vardform=SV` (inpatient only) runs from 2001. `vardform=SVOV` (inpatient
    and/or specialised outpatient), the broader and more commonly quoted
    definition, starts in 2008. THEY ARE DIFFERENT DEFINITIONS. Do not splice
    them into one series to get a longer line.
  - `diagnos` and `matt` accept a single value only. A comma there returns 404.
  - Undetermined intent (Y10-Y34) is fetched alongside intentional self-harm
    (X60-X84) deliberately. Drift between the two codes is the main artefact in
    any self-harm trend, and reading the intentional series alone can turn a
    coding change into a finding.

DISCLOSURE RULE, implemented below:
  - five-year rolling windows, labelled by the window and plotted at the midpoint
  - county grain only, never municipal
  - the window RATE is always published
  - the window COUNT is published only at or above SUPPRESS_BELOW, so a small
    county contributes a rate without a headcount

ALL-AGES ROW: neither dataset here has an "0-85+" alder id the way
diagnoserislutenoppenvard (psychiatric care) does — live-checked 2026-08-26,
`/alder` tops out at 18 ("85+") for yttreorsakertillskadorochforgiftningar
and at 20 ("95+") for dodsorsaker. So "0-85+" is added as an extra entry in
SELF_HARM_AGE_GROUPS/SUICIDE_AGE_GROUPS below, pooling ACROSS EVERY register
age id with the same population-recovery trick the nine narrower Kurvan
bands already use. That makes it a genuine additional row this script
publishes — its own real figure, fetched and pooled the same way as
everything else here — not something js/data.js derives afterwards by
averaging the nine age-band rates together (a different, cruder number: an
unweighted mean across bands of very different sizes, not a true
population-weighted all-ages rate).

===============================================================================
KURVAN CHANGE (this copy only — not present in ../../pipeline's original)
===============================================================================
The original discards the national ("Riket", county "00") row after using it as
the complete year grid, because the parent project's regional_series.json is
about comparing regions and a national row there would be redundant with
time_series.json. Kurvan has no national time series file and needs a national
reference line on every chart, so this copy keeps that row instead of dropping
it. Nothing about the disclosure rule changes: the national row is a real
sum/rate the original script already computed, just no longer thrown away.
Search for "KURVAN CHANGE" below to find the two lines this touches.

Output: ../data/processed/socialstyrelsen_mh.json, in the tidy long shape that
        ../../docs/DATA_CONTRACT.md specifies for regional_series.json (plus the
        national row noted above).

Run:  python prototype/pipeline/fetch_socialstyrelsen_mh.py
"""
import json
import os
import time
from datetime import datetime

import requests

BASE_URL = "https://sdb.socialstyrelsen.se/api/v1/sv"
HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

# Socialstyrelsen region id -> two-digit SCB county code. id 0 = Riket (national).
REGION_ID_TO_COUNTY = {
    0: "00", 1: "01", 3: "03", 4: "04", 5: "05", 6: "06", 7: "07", 8: "08",
    9: "09", 10: "10", 12: "12", 13: "13", 14: "14", 17: "17", 18: "18",
    19: "19", 20: "20", 21: "21", 22: "22", 23: "23", 24: "24", 25: "25",
}
REGION_IDS = ",".join(str(i) for i in REGION_ID_TO_COUNTY)
SEX = {1: "M", 2: "K", 3: "T"}

SELF_HARM_DATASET = "yttreorsakertillskadorochforgiftningar"
SELF_HARM_CAUSES = {"VXY2": "self_harm", "VXY4": "undetermined_intent"}
SELF_HARM_AGE_IDS = ",".join(str(i) for i in range(1, 19))
SELF_HARM_MATT = 7          # patients per 100 000
SELF_HARM_VARDFORM = "SVOV"  # see the docstring before changing this
SELF_HARM_YEARS = list(range(2008, datetime.now().year + 1))

SUICIDE_DATASET = "dodsorsaker"
SUICIDE_CAUSES = {"2026": "suicide", "2028": "undetermined_intent"}
SUICIDE_AGE_IDS = ",".join(str(i) for i in range(1, 21))
SUICIDE_YEARS = list(range(1997, datetime.now().year + 1))

SELF_HARM_AGE_GROUPS = {
    "0-14": [1, 2, 3], "15-24": [4, 5], "25-34": [6, 7], "35-44": [8, 9],
    "45-54": [10, 11], "55-64": [12, 13], "65-74": [14, 15], "75-84": [16, 17],
    "85+": [18],
    # Neither this dataset nor dodsorsaker publishes a pre-aggregated
    # "all ages" alder id the way psych's diagnoserislutenoppenvard does
    # (live-checked 2026-08-26: /alder tops out at 18 = "85+" here, at
    # 20 = "95+" for suicide — no id 19/21 for "0-85+"). Rather than derive
    # "all ages" as a post-hoc average of the nine band rates at read time
    # (what js/data.js's total() used to do — a crude, unweighted variant
    # of real data, not itself a real figure), this extra "0-85+" entry
    # runs it through the SAME population-recovery pooling the nine bands
    # above already get, across every register age id, so the all-ages
    # figure is a genuine additional row in the output — its own real
    # number, not a client-side approximation.
    "0-85+": list(range(1, 19)),
}
SUICIDE_AGE_GROUPS = {
    "0-14": [1, 2, 3], "15-24": [4, 5], "25-34": [6, 7], "35-44": [8, 9],
    "45-54": [10, 11], "55-64": [12, 13], "65-74": [14, 15], "75-84": [16, 17],
    "85+": [18, 19, 20],
    "0-85+": list(range(1, 21)),
}

WINDOW = 5
SUPPRESS_BELOW = 10          # window counts under this are withheld; the rate is not


def get(path, description="", retries=3):
    """One result path. Multi-value segments are comma-separated, except
    `diagnos` and `matt`, which accept a single value only."""
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
    """Socialstyrelsen writes decimals with a comma and thousands with a space."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace("\xa0", "").replace(" ", "").replace(",", "."))
    except (ValueError, TypeError):
        return None


def assert_diagnos_segment():
    """Trap 1, re-checked on every run.

    Two requests. It is the one failure here that produces plausible-looking
    wrong numbers rather than an error, so it is worth the round trip.
    """
    ok = get(f"/{SELF_HARM_DATASET}/resultat/diagnos/VXY2/alder/6/kon/3/matt/7"
             f"/ar/2024/region/0/vardform/SVOV", "trap check (diagnos)")
    bad = get(f"/{SELF_HARM_DATASET}/resultat/yttreorsak/VXY2/alder/6/kon/3/matt/7"
              f"/ar/2024/region/0/vardform/SVOV", "trap check (yttreorsak)")
    print(f"  trap check: diagnos/VXY2 -> {len(ok)} row(s); "
          f"yttreorsak/VXY2 -> {len(bad)} row(s), unfiltered")
    if len(ok) != 1:
        raise SystemExit(
            "FATAL: diagnos/VXY2 did not return exactly one row. The filtering "
            "segment has changed. Stop and re-verify against the API before "
            "publishing anything from this script."
        )


def fetch_self_harm():
    print("  self-harm and undetermined-intent hospitalisations, by sex (all age bands)")
    assert_diagnos_segment()
    years = ",".join(str(y) for y in SELF_HARM_YEARS)
    rows = []
    for cause in SELF_HARM_CAUSES:
        for age_id in range(1, 19):
            for matt in (6, 7):   # 6 = count (antal patienter), 7 = rate (patienter/100k)
                batch = get(
                    f"/{SELF_HARM_DATASET}/resultat/diagnos/{cause}/alder/{age_id}"
                    f"/kon/1,2,3/matt/{matt}/ar/{years}/region/{REGION_IDS}"
                    f"/vardform/{SELF_HARM_VARDFORM}",
                    f"self-harm {cause} age {age_id} matt{matt}",
                )
                rows.extend(batch)
                time.sleep(0.8)
        print(f"    {cause}: cumulative {len(rows)} rows")
    return rows


def fetch_suicide():
    print("  suicide and undetermined-intent deaths, by sex (all age bands)")
    years = ",".join(str(y) for y in SUICIDE_YEARS)
    rows = []
    for cause in SUICIDE_CAUSES:
        for age_id in range(1, 21):
            for matt in (1, 2):   # 1 = deaths, 2 = deaths per 100 000
                batch = get(
                    f"/{SUICIDE_DATASET}/resultat/diagnos/{cause}/alder/{age_id}"
                    f"/kon/1,2,3/matt/{matt}/ar/{years}/region/{REGION_IDS}",
                    f"suicide {cause} age {age_id} matt{matt}",
                )
                rows.extend(batch)
                time.sleep(0.8)
        print(f"    {cause}: cumulative {len(rows)} rows")
    return rows


def windows_from(years):
    """Consecutive WINDOW-length spans over a sorted year list."""
    years = sorted(years)
    for i in range(len(years) - WINDOW + 1):
        span = years[i:i + WINDOW]
        if span[-1] - span[0] == WINDOW - 1:
            yield span


def roll_self_harm(rows, county_names):
    """Rolling windows over self-harm rates across Kurvan's nine age bands."""
    counts, rates = {}, {}
    for r in rows:
        county = REGION_ID_TO_COUNTY.get(r.get("regionId"))
        cause = SELF_HARM_CAUSES.get(r.get("diagnosId"))
        sex = SEX.get(r.get("konId"))
        age_id = int(r.get("alderId")) if r.get("alderId") is not None else None
        val = num(r.get("varde"))
        if not (county and cause and sex and age_id) or val is None:
            continue
        target = counts if r.get("mattId") == 6 else rates
        target.setdefault((county, cause, sex, age_id), {})[int(r["ar"])] = val

    out = []
    for cause in set(SELF_HARM_CAUSES.values()):
        for sex in SEX.values():
            for band_name, age_ids in SELF_HARM_AGE_GROUPS.items():
                # Union of years across every age id in the band, not just
                # age_ids[0] — a single sub-request 404ing (the API returns
                # 404, not an empty 200, when a whole age/cause/region slice
                # has no rows at all — confirmed live on the "0-4" suicide
                # slice below) must not silently zero out a whole band that
                # still has real data on its OTHER age ids.
                grid = sorted(set().union(*(
                    counts.get(("00", cause, sex, aid), {}) for aid in age_ids
                )))
                if not grid:
                    continue

                for county in REGION_ID_TO_COUNTY.values():
                    annual_rates = {}
                    for y in grid:
                        total_count, total_pop, any_data = 0.0, 0.0, False
                        for aid in age_ids:
                            c = counts.get((county, cause, sex, aid), {}).get(y)
                            rt = rates.get((county, cause, sex, aid), {}).get(y)
                            if c is None or rt is None:
                                continue
                            any_data = True
                            total_count += c
                            if rt > 0:
                                total_pop += c / rt * 1e5
                        if any_data and total_pop > 0:
                            annual_rates[y] = total_count / total_pop * 1e5

                    if not annual_rates:
                        continue

                    for span in windows_from(grid):
                        vals = [annual_rates[y] for y in span if y in annual_rates]
                        if len(vals) < WINDOW:
                            continue
                        out.append({
                            "region": county_names.get(county, county) if county != "00" else "Sverige",
                            "county_code": county,
                            "indicator": f"{cause}_hosp_per_100k",
                            "window": f"{span[0]}-{span[-1]}",
                            "midpoint_year": span[WINDOW // 2],
                            "value": round(sum(vals) / len(vals), 1),
                            "count": None,
                            "suppressed": False,
                            "age_group": band_name,
                            "sex": sex,
                        })
    return out


def roll_suicide(rows, county_names):
    """Rolling windows over suicide counts and rates across Kurvan's nine age bands."""
    counts, rates = {}, {}
    for r in rows:
        county = REGION_ID_TO_COUNTY.get(r.get("regionId"))
        cause = SUICIDE_CAUSES.get(str(r.get("diagnosId")))
        sex = SEX.get(r.get("konId"))
        age_id = int(r.get("alderId")) if r.get("alderId") is not None else None
        val = num(r.get("varde"))
        if not (county and cause and sex and age_id) or val is None:
            continue
        target = counts if r.get("mattId") == 1 else rates
        target.setdefault((county, cause, sex, age_id), {})[int(r["ar"])] = val

    out = []
    for cause in set(SUICIDE_CAUSES.values()):
        for sex in SEX.values():
            for band_name, age_ids in SUICIDE_AGE_GROUPS.items():
                # See roll_self_harm()'s matching comment: union across the
                # whole band, not just age_ids[0] — dodsorsaker 404s (rather
                # than returning an empty 200) on ages 0-4 x suicide x every
                # region/year, which would otherwise zero out "0-14" and
                # "0-85+" entirely even though ages 5-14 do have real deaths.
                grid = sorted(set().union(*(
                    counts.get(("00", cause, sex, aid), {}) for aid in age_ids
                )))
                if not grid:
                    continue

                for county in REGION_ID_TO_COUNTY.values():
                    deaths_by_year = {}
                    pop_by_year = {}
                    for y in grid:
                        total_deaths, total_pop, any_data = 0.0, 0.0, False
                        for aid in age_ids:
                            d = counts.get((county, cause, sex, aid), {}).get(y, 0.0)
                            rt = rates.get((county, cause, sex, aid), {}).get(y)
                            total_deaths += d
                            if d > 0 and rt and rt > 0:
                                any_data = True
                                total_pop += d / rt * 1e5
                        deaths_by_year[y] = total_deaths
                        if total_pop > 0:
                            pop_by_year[y] = total_pop

                    if not pop_by_year:
                        continue

                    for y in grid:
                        if y not in pop_by_year and pop_by_year:
                            nearest = min(pop_by_year, key=lambda k: abs(k - y))
                            pop_by_year[y] = pop_by_year[nearest]

                    for span in windows_from(grid):
                        total_deaths = sum(deaths_by_year.get(y, 0.0) for y in span)
                        total_pop = sum(pop_by_year.get(y, 0.0) for y in span)
                        if total_pop <= 0:
                            continue
                        suppressed = total_deaths < SUPPRESS_BELOW and county != "00"
                        out.append({
                            "region": county_names.get(county, county) if county != "00" else "Sverige",
                            "county_code": county,
                            "indicator": f"{cause}_per_100k",
                            "window": f"{span[0]}-{span[-1]}",
                            "midpoint_year": span[WINDOW // 2],
                            "value": round(total_deaths / total_pop * 1e5, 1),
                            "count": None if suppressed else int(total_deaths),
                            "suppressed": suppressed,
                            "age_group": band_name,
                            "sex": sex,
                        })
    return out


def load_county_names():
    """county_code -> region name, from the municipality seed."""
    import csv
    names = {}
    with open(os.path.join(HERE, "kommuner.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            names.setdefault(r["code"][:2], r["region"])
    return names


def main():
    print("[socialstyrelsen] region-grain mental health series (Kurvan copy)")
    county_names = load_county_names()

    sh_raw = fetch_self_harm()
    su_raw = fetch_suicide()

    with open(os.path.join(RAW_DIR, "socialstyrelsen_mh_raw.json"), "w", encoding="utf-8") as f:
        json.dump({"self_harm": sh_raw, "suicide": su_raw}, f, ensure_ascii=False, indent=1)

    rows = roll_self_harm(sh_raw, county_names) + roll_suicide(su_raw, county_names)
    out_path = os.path.join(PROCESSED_DIR, "socialstyrelsen_mh.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)

    n_suppressed = sum(1 for r in rows if r["suppressed"])
    print(f"\n[socialstyrelsen] wrote {out_path}")
    print(f"[socialstyrelsen] {len(rows)} rows, {n_suppressed} with counts suppressed "
          f"(floor {SUPPRESS_BELOW})")
    print("[socialstyrelsen] REGION GRAIN ONLY (plus one national row per indicator). "
          "Do not join these onto municipalities.")
    print("[socialstyrelsen] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
