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

SELF_HARM_DATASET = "yttreorsakertillskadorochforgiftningar"
SELF_HARM_CAUSES = {"VXY2": "self_harm", "VXY4": "undetermined_intent"}
SELF_HARM_MATT = 7          # patients per 100 000
SELF_HARM_VARDFORM = "SVOV"  # see the docstring before changing this
SELF_HARM_YEARS = list(range(2008, datetime.now().year + 1))

SUICIDE_DATASET = "dodsorsaker"
SUICIDE_CAUSES = {"2026": "suicide", "2028": "undetermined_intent"}
# Live-verified 2026-08-26 against /api/v1/sv/{SUICIDE_DATASET}/alder: ids
# 1-20 are 5-year bands, "0-4" through "95+", covering every age with no
# gap and no combined "all ages" id (unlike fetch_socialstyrelsen_psych.py's
# id 19 = "0-85+" — see this file's own "ALL-AGES ROW" docstring section for
# how "0-85+" is produced here instead: SUICIDE_AGE_GROUPS's own entry below,
# not a client-side average).
# KURVAN CHANGE 2 (see docstring above): Kurvan's nine AGES bands -> the
# dodsorsaker 5-year ids that pool into each one. Same band boundaries as
# fetch_socialstyrelsen_psych.py's AGE_GROUPS; "85+" pools three ids here
# (85-89/90-94/95+) instead of psych's one, because this dataset splits
# that tail further than the psychiatric-care register does.
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
    "0-85+": list(range(1, 21)),   # see SELF_HARM_AGE_GROUPS's matching comment above
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
    # KURVAN CHANGE 2 (see docstring above): every dodsorsaker age id, not
    # just 15-19 — one request per (cause, age id, matt), same shape as
    # fetch_socialstyrelsen_psych.py's fetch_age_bands(), so each response
    # stays well under the 5,000-row page cap (30 years x 1 age x 22 regions
    # x 3 sexes = 1,980 rows) instead of requesting alder as one comma list
    # (which self-harm's 2-age fetch can get away with; 20 ages here can't).
    # age_ids is derived from SUICIDE_AGE_GROUPS (deduplicated) rather than a
    # hardcoded range so it can't drift out of sync with the bands below —
    # includes 1-20 either way, since "0-85+" is just those same 20 ids.
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


def pool_suicide_age_bands(rows):
    """KURVAN CHANGE 2 (see docstring above): raw per-age-id rows -> one
    (deaths, recovered-population) pair per (county, cause, sex, Kurvan age
    band, year), before roll_suicide() ever sees them. SUICIDE_AGE_GROUPS'
    "0-85+" entry (see its own comment above) runs through this exact same
    path — it's just another band, pooling all 20 register ids instead of a
    handful.

    Deaths sum directly across the raw age ids in a band (a count is a
    count). Population does not — it's recovered per raw age id as
    count / rate x 100,000 (same trick fetch_socialstyrelsen_psych.py's
    pool() uses) and summed across ages, wherever a given age/year actually
    has a recoverable rate. TRAP 2 (an absent county-year means zero deaths,
    not missing) is applied per raw age id here, at the same granularity the
    original discovered it at for the whole (county, cause, sex) series —
    the API's "no row = no deaths" behaviour has no reason to stop applying
    once age is added as another filter dimension. This is also what makes
    a single age id 404ing outright (confirmed live: ages 0-4 x suicide,
    every region/year) harmless rather than silently zeroing out any band
    that contains it: the zero-fill loop below runs over every year that HAS
    been published somewhere in the response, not "whatever years happened
    to show up for this one age id", so a wholly-absent age id just
    contributes 0 deaths for every published year, same as one with real
    but sparse gaps.

    TRAP 2 does NOT extend to a year the register hasn't reached yet, though
    — dodsorsaker runs roughly two years behind (live-checked 2026-08-26:
    nothing published for 2025 or 2026 on any region/age/sex/cause). The
    fill loop below stops at the latest year actually present in the raw
    response rather than SUICIDE_YEARS' full range through the current
    year, so an unpublished recent year is left OUT of every window instead
    of silently reading as "zero suicides" and dragging the rate down —
    caught by the "2022-2026" window showing an implausible mid-single-
    digit rate before this fix.

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
        age_id = int(r.get("alderId")) if r.get("alderId") is not None else None
        val = num(r.get("varde"))
        if not (county and cause and sex and age_id) or val is None:
            continue
        target = raw_counts if r.get("mattId") == 1 else raw_rates
        target.setdefault((county, cause, sex, age_id), {})[int(r["ar"])] = val

    # TRAP 2 ("absent means zero") only holds for a year the register has
    # actually reached — dodsorsaker runs roughly two years behind (live-
    # checked 2026-08-26: nothing published for 2025 or 2026 yet, on ANY
    # region/age/sex/cause). SUICIDE_YEARS itself runs through the current
    # calendar year so fetch_suicide() doesn't have to guess the cutoff in
    # advance; the zero-fill loop below stops at the latest year that
    # actually has at least one published row instead, so an unpublished
    # recent year is left OUT of every window rather than silently read as
    # "zero suicides" and dragging the rate down.
    years_published = {y for series in raw_counts.values() for y in series}
    last_year = max(years_published) if years_published else SUICIDE_YEARS[-1]
    fill_years = [y for y in SUICIDE_YEARS if y <= last_year]

    counts, pops = {}, {}
    for band_name, age_ids in SUICIDE_AGE_GROUPS.items():
        for cause in set(SUICIDE_CAUSES.values()):
            for sex in SEX.values():
                for county in REGION_ID_TO_COUNTY.values():
                    if not any((county, cause, sex, aid) in raw_counts for aid in age_ids):
                        continue   # nothing fetched for this county/cause/sex at all
                    deaths_by_year, pop_by_year = {}, {}
                    for y in fill_years:
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
    band (KURVAN CHANGE 2, including the "0-85+" all-ages band), so the
    grid/deaths/population are all computed per sex per band — a smaller
    county's single-sex, single-band count hits the disclosure floor far
    more often than an unsplit count did, which is the floor working as
    intended on genuinely smaller sub-populations, not a bug.

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
