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

===============================================================================
KURVAN CHANGES (this copy only — not present in ../../pipeline's original)
===============================================================================
Two behavioural changes from the original now, both marked "KURVAN CHANGE"
at the lines they touch:

  1. The original discards the national ("Riket", county "00") row after
     using it as the complete year grid, because the parent project's
     regional_series.json is about comparing regions and a national row
     there would be redundant with time_series.json. Kurvan has no national
     time series file and needs a national reference line on every chart, so
     this copy keeps that row instead of dropping it. Nothing about the
     disclosure rule changes: the national row is a real sum/rate the
     original script already computed, just no longer thrown away.

  2. The original (and, until now, this copy too) only ever requests suicide
     deaths for age 15-19 (SUICIDE_AGE = 4) — self-harm/suicide's real
     source has always been treated as youth-only. Kurvan added an
     age-standardised suicide chart (matching the standardisation psych and
     antidepressants already had) that needs a real death count in every one
     of Kurvan's nine AGES bands, not just one. dodsorsaker's `/alder`
     dimension actually publishes ALL ages in 5-year bands (ids 1-20,
     "0-4" through "95+", live-verified 2026-08-26 — see SUICIDE_AGE_GROUPS
     below) — the 15-19-only restriction was this project's own scope
     choice, not a limit of the source. fetch_suicide()/roll_suicide() below
     now fetch and pool every age id into Kurvan's nine bands, the same
     population-recovery pooling fetch_socialstyrelsen_psych.py's pool()
     already uses to combine 5-year bands into Kurvan's wider ones. Expect
     materially more suppressed cells than before: a given county/age-band/
     sex/window slice of suicide deaths is small, and this project's own
     disclosure floor (SUPPRESS_BELOW) is working as intended when it
     withholds those counts — not a bug to route around.

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

SELF_HARM_DATASET = "yttreorsakertillskadorochforgiftningarbarn"
SELF_HARM_CAUSES = {"VXY2": "self_harm", "VXY4": "undetermined_intent"}
# Live-verified 2026-08-25 against /api/v1/sv/{SELF_HARM_DATASET}/alder:
# id 5 = "12-14", id 6 = "15-17" — exactly what's assumed below.
SELF_HARM_AGES = {5: "12_14", 6: "15_17"}
SELF_HARM_MATT = 7          # patients per 100 000
SELF_HARM_VARDFORM = "SVOV"  # see the docstring before changing this
SELF_HARM_YEARS = list(range(2008, datetime.now().year + 1))

SUICIDE_DATASET = "dodsorsaker"
SUICIDE_CAUSES = {"2026": "suicide", "2028": "undetermined_intent"}
# Live-verified 2026-08-26 against /api/v1/sv/{SUICIDE_DATASET}/alder: ids
# 1-20 are 5-year bands, "0-4" through "95+", covering every age with no
# gap and no combined "all ages" id (unlike fetch_socialstyrelsen_psych.py's
# id 19 = "0-85+") — a suicide "all ages" total is reconstructed client-side
# instead, the same unweighted-mean-of-present-bands total() already uses
# for every other multi-age real indicator (js/data.js).
# KURVAN CHANGE 2 (see docstring above): Kurvan's nine AGES bands -> the
# dodsorsaker 5-year ids that pool into each one. Same band boundaries as
# fetch_socialstyrelsen_psych.py's AGE_GROUPS; "85+" pools three ids here
# (85-89/90-94/95+) instead of psych's one, because this dataset splits
# that tail further than the psychiatric-care register does.
SUICIDE_AGE_GROUPS = {
    "0-14": [1, 2, 3], "15-24": [4, 5], "25-34": [6, 7], "35-44": [8, 9],
    "45-54": [10, 11], "55-64": [12, 13], "65-74": [14, 15], "75-84": [16, 17],
    "85+": [18, 19, 20],
}
SUICIDE_YEARS = list(range(1997, datetime.now().year + 1))

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
    print("  self-harm and undetermined-intent hospitalisations, by sex")
    assert_diagnos_segment()
    years = ",".join(str(y) for y in SELF_HARM_YEARS)
    ages = ",".join(str(a) for a in SELF_HARM_AGES)
    rows = []
    for cause in SELF_HARM_CAUSES:
        # kon/1,2,3 (Män/Kvinnor/Båda könen), not kon/3 alone — confirmed
        # live 2026-08-24 that this dataset's kon accepts a comma list, same
        # as region/alder/ar do (see docstring: not true of every dataset on
        # this API, re-checked here specifically). Row count triples but
        # stays well under the 5,000/page cap (19 years x 2 ages x 22
        # regions x 3 sexes = 2,508).
        batch = get(
            f"/{SELF_HARM_DATASET}/resultat/diagnos/{cause}/alder/{ages}"
            f"/kon/1,2,3/matt/{SELF_HARM_MATT}/ar/{years}/region/{REGION_IDS}"
            f"/vardform/{SELF_HARM_VARDFORM}",
            f"self-harm {cause}",
        )
        rows.extend(batch)
        got = sorted({r["ar"] for r in batch}) if batch else []
        print(f"    {cause}: {len(batch)} rows, "
              f"{got[0] if got else '-'}-{got[-1] if got else '-'}, "
              f"{len({r['regionId'] for r in batch})} regions")
        time.sleep(1.5)
    return rows


def fetch_suicide():
    # KURVAN CHANGE 2 (see docstring above): every dodsorsaker age id, not
    # just 15-19 — one request per (cause, age id, matt), same shape as
    # fetch_socialstyrelsen_psych.py's fetch_age_bands(), so each response
    # stays well under the 5,000-row page cap (30 years x 1 age x 22 regions
    # x 3 sexes = 1,980 rows) instead of requesting alder as one comma list
    # (which self-harm's 2-age fetch can get away with; 20 ages here can't).
    print("  suicide and undetermined-intent deaths, all ages, by sex")
    years = ",".join(str(y) for y in SUICIDE_YEARS)
    age_ids = sorted({aid for ids in SUICIDE_AGE_GROUPS.values() for aid in ids})
    rows = []
    for cause in SUICIDE_CAUSES:
        for age_id in age_ids:
            for matt in (1, 2):   # 1 = deaths, 2 = deaths per 100 000
                # kon/1,2,3, not kon/3 alone — confirmed live 2026-08-24 this
                # dataset's kon also accepts a comma list.
                batch = get(
                    f"/{SUICIDE_DATASET}/resultat/diagnos/{cause}/alder/{age_id}"
                    f"/kon/1,2,3/matt/{matt}/ar/{years}/region/{REGION_IDS}",
                    f"suicide {cause} age{age_id} matt{matt}",
                )
                rows.extend(batch)
                time.sleep(0.8)
            print(f"    {cause} age {age_id}: cumulative {len(rows)} rows")
    return rows


def windows_from(years):
    """Consecutive WINDOW-length spans over a sorted year list."""
    years = sorted(years)
    for i in range(len(years) - WINDOW + 1):
        span = years[i:i + WINDOW]
        if span[-1] - span[0] == WINDOW - 1:
            yield span


def roll_self_harm(rows, county_names):
    """Rolling windows over a RATE series. The window value is the mean of the
    annual rates, which is right here because the denominator (the age band's
    population) is close to constant across five years within a county.

    Keyed by sex now, not assumed total — fetch_self_harm() requests
    kon/1,2,3 (see its own comment for why that's safe on this dataset).
    """
    series = {}
    for r in rows:
        county = REGION_ID_TO_COUNTY.get(r.get("regionId"))
        cause = SELF_HARM_CAUSES.get(r.get("diagnosId"))
        age = SELF_HARM_AGES.get(r.get("alderId"))
        sex = SEX.get(r.get("konId"))
        val = num(r.get("varde"))
        if not (county and cause and age and sex) or val is None:
            continue
        series.setdefault((county, cause, age, sex), {})[int(r["ar"])] = val

    out = []
    for (county, cause, age, sex), by_year in sorted(series.items()):
        # KURVAN CHANGE: the original skips county == "00" (national) here.
        # Kurvan wants that row for its national reference line, so it stays.
        for span in windows_from(by_year):
            vals = [by_year[y] for y in span if y in by_year]
            if len(vals) < WINDOW:
                continue
            out.append({
                "region": county_names.get(county, county) if county != "00" else "Sverige",
                "county_code": county,
                "indicator": f"{cause}_hosp_per_100k",
                "window": f"{span[0]}-{span[-1]}",
                "midpoint_year": span[WINDOW // 2],
                "value": round(sum(vals) / len(vals), 1),
                "count": None,           # this dataset publishes rates, not counts
                "suppressed": False,
                "age_group": age,
                "sex": sex,
            })
    return out


def pool_suicide_age_bands(rows):
    """KURVAN CHANGE 2 (see docstring above): raw per-age-id rows -> one
    (deaths, recovered-population) pair per (county, cause, sex, Kurvan age
    band, year), before roll_suicide() ever sees them.

    Deaths sum directly across the raw age ids in a band (a count is a
    count). Population does not — it's recovered per raw age id as
    count / rate x 100,000 (same trick fetch_socialstyrelsen_psych.py's
    pool() uses) and summed across ages, wherever a given age/year actually
    has a recoverable rate. TRAP 2 (an absent county-year means zero deaths,
    not missing) is applied per raw age id here, at the same granularity the
    original discovered it at for the whole (county, cause, sex) series —
    the API's "no row = no deaths" behaviour has no reason to stop applying
    once age is added as another filter dimension.

    Returns counts/pops keyed by (county, cause, sex, band) -> {year: value},
    in exactly the shape roll_suicide() already expects from its own
    counts/rates dicts, so its windowing/suppression logic below is
    otherwise unchanged.
    """
    raw_counts, raw_rates = {}, {}
    for r in rows:
        county = REGION_ID_TO_COUNTY.get(r.get("regionId"))
        cause = SUICIDE_CAUSES.get(str(r.get("diagnosId")))
        sex = SEX.get(r.get("konId"))
        age_id = r.get("alderId")
        val = num(r.get("varde"))
        if not (county and cause and sex and age_id) or val is None:
            continue
        target = raw_counts if r.get("mattId") == 1 else raw_rates
        target.setdefault((county, cause, sex, age_id), {})[int(r["ar"])] = val

    counts, pops = {}, {}
    for band_name, age_ids in SUICIDE_AGE_GROUPS.items():
        for cause in set(SUICIDE_CAUSES.values()):
            for sex in SEX.values():
                for county in REGION_ID_TO_COUNTY.values():
                    if not any((county, cause, sex, aid) in raw_counts for aid in age_ids):
                        continue   # nothing fetched for this county/cause/sex at all
                    deaths_by_year, pop_by_year = {}, {}
                    for y in SUICIDE_YEARS:
                        deaths_y, pop_y = 0.0, 0.0
                        for aid in age_ids:
                            d = raw_counts.get((county, cause, sex, aid), {}).get(y, 0.0)  # TRAP 2
                            rt = raw_rates.get((county, cause, sex, aid), {}).get(y)
                            deaths_y += d
                            if d > 0 and rt:
                                pop_y += d / rt * 1e5
                        deaths_by_year[y] = deaths_y
                        if pop_y > 0:
                            pop_by_year[y] = pop_y
                    counts[(county, cause, sex, band_name)] = deaths_by_year
                    pops[(county, cause, sex, band_name)] = pop_by_year
    return counts, pops


def roll_suicide(rows, county_names):
    """Rolling windows over COUNTS, with the disclosure floor applied.

    Trap 2 lives here (now inside pool_suicide_age_bands() above, since age
    banding happens before this function ever sees the data). The year grid
    comes from the national series, which is complete, and a county-year
    missing from that grid is filled with 0 rather than treated as unknown.
    Keyed by sex now (fetch_suicide() requests kon/1,2,3) and by Kurvan age
    band (KURVAN CHANGE 2), so the grid/deaths/population are all computed
    per sex per band — a smaller county's single-sex, single-band count hits
    the disclosure floor far more often than an unsplit count did, which is
    the floor working as intended on genuinely smaller sub-populations, not
    a bug.

    The window rate is POOLED, not a mean of annual rates: the annual
    population is recovered as count / rate x 100,000 wherever both are
    published (now band-level, from pool_suicide_age_bands()), and the
    window rate is summed deaths over summed population. Years with no
    recoverable population are filled from the nearest year in the same
    county/band. A county/band's population moves a per cent or two a year,
    which is nothing beside the Poisson noise the windowing exists to damp.
    """
    counts, rates_pop = pool_suicide_age_bands(rows)

    out = []
    for cause in set(SUICIDE_CAUSES.values()):
        for sex in SEX.values():
            for band in SUICIDE_AGE_GROUPS:
                grid = sorted(counts.get(("00", cause, sex, band), {}))
                if not grid:
                    print(f"    note: no national series for {cause}/{sex}/{band}; windows skipped")
                    continue

                for (county, c, s, b), by_year in sorted(counts.items()):
                    if c != cause or s != sex or b != band:
                        continue
                    # KURVAN CHANGE 1: the original also excludes county == "00" here.
                    # county's own count series (including "00" = Riket) is kept below.

                    deaths = {y: by_year.get(y, 0.0) for y in grid}
                    pop = dict(rates_pop.get((county, cause, sex, band), {}))
                    pop = {y: v for y, v in pop.items() if y in grid}
                    if not pop:
                        print(f"    note: no recoverable population for county {county} / {cause} / {sex} / {band}; skipped")
                        continue
                    for y in grid:                                     # nearest-year fill
                        if y not in pop:
                            nearest = min(pop, key=lambda k: abs(k - y))
                            pop[y] = pop[nearest]

                    for span in windows_from(grid):
                        total_deaths = sum(deaths[y] for y in span)
                        total_pop = sum(pop[y] for y in span)
                        if total_pop <= 0:
                            continue
                        suppressed = total_deaths < SUPPRESS_BELOW and county != "00"
                        out.append({
                            "region": county_names.get(county, county) if county != "00" else "Sverige",
                            "county_code": county,
                            "indicator": f"{cause}_per_100k",
                            "window": f"{span[0]}-{span[-1]}",
                            "midpoint_year": span[WINDOW // 2],
                            # The rate is ALWAYS published.
                            "value": round(total_deaths / total_pop * 1e5, 1),
                            # The count is not, below the floor.
                            "count": None if suppressed else int(total_deaths),
                            "suppressed": suppressed,
                            "age_group": band,
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
