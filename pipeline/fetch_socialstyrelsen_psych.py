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
    This script does not fetch "05" itself, or even the 11 blocks one
    level under it (F00-F09, F10-F19, ... F99-F99 — Socialstyrelsen's own
    "grupp" children of "05", confirmed live 2026-08-25). It goes one
    level deeper still, to the 78 individual 3-character ICD-10 codes
    that sit under THOSE 11 blocks (DIAGNOS_CODES below) — e.g. F32
    "Depressiv episod" is one of seven codes under block F30-F39, not
    F30-F39 itself. Confirmed live 2026-08-27 against /diagnos: every one
    of the 78 has a `grupp` naming exactly one of the 11 block ids (never
    "05" directly, never a sibling chapter), and `/resultat` accepts a
    3-character code as a `diagnos` value the same way it accepts a block
    id — e.g. `diagnos/F32/...` returns F32's own rate, distinct from its
    parent block's combined rate. DIAGNOS_BLOCKS below carries each
    block's own sv/en label (also captured live) and CODE_TO_BLOCK maps
    every one of the 78 codes to its one parent block id — both travel
    into js/lang.js/js/data.js unchanged (see those files) so Kurvan's
    type picker can group the 78 codes under their 11 blocks as
    <optgroup> headers, without hardcoding the mapping a second time.
    This retires the two labelling caveats the older 6-block version of
    this script carried (the F50-F59 block being fetched under the name
    "eating disorders" and F90-F98 under "ADHD/childhood-onset", when
    each was really the whole broader chapter) — moot now that every
    fetched value is a single, precisely-named code, not an approximate
    block-wide stand-in.
    Kurvan's own "all psychiatric care" figure is still not fetched
    directly either — js/data.js reconstructs it by summing every one of
    these real per-code series (same pattern the age-band pooling below
    already uses), not by an extra API call for "05" itself.
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
band at a time rather than teach get() to follow nasta_sida — now 78 times
over, once per DIAGNOS_CODES entry (~38 requests per code x 78 codes =
~2,964 total; roughly an hour, not several minutes, at this script's
existing 0.8-1.0s pace between requests). `diagnos` DOES accept a
comma-separated multi-value list even at this 3-character-code granularity
(confirmed live: `diagnos/F32,F41,F84/...` returns all three distinctly) —
batching ~4 codes per request (staying under the 5,000-row page limit
above) would cut this to roughly 20 batches x 38 requests ≈ 760, well
under 15 minutes. Left as one-code-per-request for now, matching the
simpler loop the 6-block version already used and had proven correct;
batching is a real, available speedup for later, not implemented here.

Output: ../data/processed/socialstyrelsen_psych.json        (diagnos=05, the
        F00-F99 chapter only -> js/data/real_psych.js, Kurvan's eager batch)
        ../data/processed/socialstyrelsen_psych_codes.json  (the 78 codes ->
        js/data/real_psych_codes.js, loaded on demand — see js/data.js 1c)
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

# DIAGNOS "05" (F00-F99, all psychiatric diagnoses) -> its 78 individual
# 3-character codes, each its own indicator series (see docstring for the
# live verification that /resultat accepts a code directly and that every
# one's own `grupp` names a real parent block, never "05" itself).
DIAGNOS_CODES = [
    "F00", "F01", "F02", "F03", "F04", "F05", "F06", "F07", "F09", "F10",
    "F11", "F12", "F13", "F14", "F15", "F16", "F17", "F18", "F19", "F20",
    "F21", "F22", "F23", "F24", "F25", "F28", "F29", "F30", "F31", "F32",
    "F33", "F34", "F38", "F39", "F40", "F41", "F42", "F43", "F44", "F45",
    "F48", "F50", "F51", "F52", "F53", "F54", "F55", "F59", "F60", "F61",
    "F62", "F63", "F64", "F65", "F66", "F68", "F69", "F70", "F71", "F72",
    "F73", "F78", "F79", "F80", "F81", "F82", "F83", "F84", "F88", "F89",
    "F90", "F91", "F92", "F93", "F94", "F95", "F98", "F99",
]
# Each of the 11 real blocks one level up from the 78 codes above (parent
# "05" = the whole F00-F99 chapter) — sv/en labels captured live the same
# way the codes themselves were, id order matching the chapter's own
# numbering. Not read by this script itself (nothing here groups by
# block) — carried through only so js/lang.js's psychBlocks and
# js/data.js's PSYCH_BLOCKS/PSYCH_CODE_BLOCK don't have to be independently
# re-verified against the API; copy from here, not the other way round, if
# either ever needs regenerating.
DIAGNOS_BLOCKS = {
    "0501": ("Organiska, inklusive symtomatiska, psykiska störningar", "Organic, including symptomatic, mental disorders"),
    "0502": ("Psykiska störningar och beteendestörningar orsakade av psykoaktiva substanser", "Mental and behavioural disorders due to psychoactive substance use"),
    "0503": ("Schizofreni, schizotypa störningar och vanföreställningssyndrom", "Schizophrenia, schizotypal and delusional disorders"),
    "0504": ("Förstämningssyndrom", "Mood [affective] disorders"),
    "0505": ("Neurotiska, stressrelaterade och somatoforma syndrom", "Neurotic, stress-related and somatoform disorders"),
    "0506": ("Beteendestörningar förenade med fysiologiska rubbningar och fysiska faktorer", "Behavioural syndromes associated with physiological disturbances and physical factors"),
    "0507": ("Personlighetsstörningar och beteendestörningar hos vuxna", "Disorders of adult personality and behaviour"),
    "0508": ("Psykisk utvecklingsstörning", "Mental retardation"),
    "0509": ("Störningar av psykisk utveckling", "Disorders of psychological development"),
    "0510": ("Beteendestörningar och emotionella störningar med debut vanligen under barndom och ungdomstid", "Behavioural and emotional disorders with onset usually occurring in childhood and adolescence"),
    "0511": ("Ospecificerad psykisk störning", "Unspecified mental disorder"),
}
# code -> its one parent block id, from the same live check (each code's
# own `grupp` field) — used by assert_diagnos_filters() below to confirm
# every code's block membership matches what js/data.js's
# PSYCH_CODE_BLOCK also says, so the two copies can't silently drift apart.
CODE_TO_BLOCK = {
    "F00": "0501", "F01": "0501", "F02": "0501", "F03": "0501", "F04": "0501", "F05": "0501",
    "F06": "0501", "F07": "0501", "F09": "0501", "F10": "0502", "F11": "0502", "F12": "0502",
    "F13": "0502", "F14": "0502", "F15": "0502", "F16": "0502", "F17": "0502", "F18": "0502",
    "F19": "0502", "F20": "0503", "F21": "0503", "F22": "0503", "F23": "0503", "F24": "0503",
    "F25": "0503", "F28": "0503", "F29": "0503", "F30": "0504", "F31": "0504", "F32": "0504",
    "F33": "0504", "F34": "0504", "F38": "0504", "F39": "0504", "F40": "0505", "F41": "0505",
    "F42": "0505", "F43": "0505", "F44": "0505", "F45": "0505", "F48": "0505", "F50": "0506",
    "F51": "0506", "F52": "0506", "F53": "0506", "F54": "0506", "F55": "0506", "F59": "0506",
    "F60": "0507", "F61": "0507", "F62": "0507", "F63": "0507", "F64": "0507", "F65": "0507",
    "F66": "0507", "F68": "0507", "F69": "0507", "F70": "0508", "F71": "0508", "F72": "0508",
    "F73": "0508", "F78": "0508", "F79": "0508", "F80": "0509", "F81": "0509", "F82": "0509",
    "F83": "0509", "F84": "0509", "F88": "0509", "F89": "0509", "F90": "0510", "F91": "0510",
    "F92": "0510", "F93": "0510", "F94": "0510", "F95": "0510", "F98": "0510", "F99": "0511",
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
    """Three trap checks, the first two on 2023 national all-ages data:

    1. Each of the 78 DIAGNOS_CODES must be a proper, smaller-than,
       positive subset of diagnos=99 (all diagnoses combined) — same
       sanity bound the old single-DIAGNOS="05" and six-block versions of
       this check both used, still a valid bound at any granularity.
    2. A duplicate-rate warning (not fatal, unlike check 1): at 6 broad
       blocks, two matching rates could only mean a copy-pasted code or a
       broken filter, so that used to raise. At 78 individual, often rare,
       codes rounded to one decimal, two genuinely different diagnoses
       coincidentally tying is plausible on its own — this still prints
       every match so a real broken-filter pattern (many codes tied, not
       just one coincidental pair) is easy to spot, but doesn't abort the
       whole run over a single legitimate coincidence.
    3. Every code's live `grupp` (its parent block, per /diagnos) must
       match what CODE_TO_BLOCK above already says — this is what actually
       guards the "grouped under their blocks" structure js/lang.js/
       js/data.js depend on; a mismatch here means those two copies have
       drifted from the source and must be regenerated from a fresh check,
       not hand-patched.
    """
    live_diagnos = get(f"/{DATASET}/diagnos", "diagnos dimension metadata")
    live_block_of = {d["id"]: d.get("grupp") for d in live_diagnos}
    for code in DIAGNOS_CODES:
        live_block = live_block_of.get(code)
        expected_block = CODE_TO_BLOCK.get(code)
        if live_block != expected_block:
            raise SystemExit(
                f"FATAL: diagnos={code}'s live grupp is {live_block!r}, but "
                f"CODE_TO_BLOCK says {expected_block!r}. The source has "
                f"reorganised its ICD-10 grouping since this was last "
                f"verified — regenerate CODE_TO_BLOCK (and js/data.js's "
                f"PSYCH_CODE_BLOCK, js/lang.js's psychBlocks) from a fresh "
                f"/diagnos check before publishing anything from this "
                f"script."
            )
    print(f"  trap check: all {len(DIAGNOS_CODES)} codes' live grupp matches CODE_TO_BLOCK")

    total = get(f"/{DATASET}/resultat/diagnos/99/alder/{ALL_AGES_ID}"
                f"/kon/3/matt/{MATT_RATE}/ar/2023/region/0", "trap check (99, all diagnoses)")
    tv = num(total[0]["varde"]) if total else None
    values = {}
    for code in DIAGNOS_CODES:
        rows = get(f"/{DATASET}/resultat/diagnos/{code}/alder/{ALL_AGES_ID}"
                    f"/kon/3/matt/{MATT_RATE}/ar/2023/region/0", f"trap check ({code})")
        values[code] = num(rows[0]["varde"]) if rows else None
    print(f"  trap check: diagnos=99 (all) -> {tv}")
    for code in DIAGNOS_CODES:
        print(f"    diagnos={code} -> {values[code]}")

    if tv is None:
        raise SystemExit("FATAL: could not read diagnos=99 (all diagnoses) reference value.")
    for code, v in values.items():
        if v is None or not (0 < v < tv):
            raise SystemExit(
                f"FATAL: diagnos={code} is not a smaller positive subset of "
                f"diagnos=99 for 2023 national data. Stop and re-verify "
                f"against the API before publishing anything from this "
                f"script."
            )
    seen = {}
    for code, v in values.items():
        dup = seen.get(v)
        if dup is not None:
            print(
                f"  NOTE: diagnos={code} returned the same rate ({v}) as "
                f"diagnos={dup} — plausible coincidence at this many, often "
                f"rare, codes; only worth investigating if many codes tie "
                f"at once, not just this one pair."
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
    `indicator` tags which of the 78 DIAGNOS_CODES this batch is —
    js/data.js sums all of them back into an "all" pseudo-type rather than
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


def fetch_series(diagnos, label):
    """Fetch one `diagnos` value (a code, or "05" for the whole chapter) and
    turn it into processed records: the register's own 0-85+ row plus the
    nine pooled Kurvan age bands."""
    print(f"  --- {label} ---")
    all_ages_raw = fetch_all_ages(diagnos, label)
    band_raw = fetch_age_bands(diagnos, label)
    return all_ages_raw, band_raw


def main():
    print("[socialstyrelsen-psych] region-grain specialist psychiatric care — "
          f"F00-F99 chapter + {len(DIAGNOS_CODES)} ICD-10 codes, {len(DIAGNOS_BLOCKS)} blocks")
    assert_diagnos_filters()
    county_names = load_county_names()

    all_ages_raw_by_group = {}
    band_raw_by_group = {}

    # chapter: diagnos=05 -> js/data.js reads this straight as "all" (the
    # register's own total, not a sum of the 78 codes).
    aa, bb = fetch_series("05", "05 (F00-F99 chapter)")
    all_ages_raw_by_group["05"] = aa
    band_raw_by_group["05"] = bb
    chapter = (all_ages_records(aa, county_names, "psych_05_per_100k")
               + pool(bb, county_names, "psych_05_per_100k"))

    # the 78 individual codes -> their own file, loaded on demand.
    code_recs = []
    for code in DIAGNOS_CODES:
        indicator = f"psych_{code}_per_100k"
        aa, bb = fetch_series(code, code)
        all_ages_raw_by_group[code] = aa
        band_raw_by_group[code] = bb
        code_recs += all_ages_records(aa, county_names, indicator)
        code_recs += pool(bb, county_names, indicator)

    with open(os.path.join(RAW_DIR, "socialstyrelsen_psych_raw.json"), "w", encoding="utf-8") as f:
        json.dump({"all_ages": all_ages_raw_by_group, "age_bands": band_raw_by_group}, f, ensure_ascii=False, indent=1)

    chapter_path = os.path.join(PROCESSED_DIR, "socialstyrelsen_psych.json")
    with open(chapter_path, "w", encoding="utf-8") as f:
        json.dump(chapter, f, ensure_ascii=False, indent=1)
    codes_path = os.path.join(PROCESSED_DIR, "socialstyrelsen_psych_codes.json")
    with open(codes_path, "w", encoding="utf-8") as f:
        json.dump(code_recs, f, ensure_ascii=False, indent=1)

    print(f"\n[socialstyrelsen-psych] wrote {chapter_path}  ({len(chapter)} rows: F00-F99 chapter)")
    print(f"[socialstyrelsen-psych] wrote {codes_path}  ({len(code_recs)} rows across {len(DIAGNOS_CODES)} codes)")
    print("[socialstyrelsen-psych] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
