# -*- coding: utf-8 -*-
"""Socialstyrelsen: licensed health-care STAFF headcount by region, profession
and year — the psychiatry-relevant professions (psychologists,
psychotherapists, health-care counsellors, psychiatrists, child-&-adolescent
psychiatrists, psychiatric-care specialist nurses), plus doctors and nurses as
context totals.

===============================================================================
THIS SCRAPES A LEGACY FORM. READ BEFORE CHANGING ANYTHING. VERIFIED 2026-08-28.
===============================================================================
Source: sdb.socialstyrelsen.se/if_per/ ("Statistikdatabas för hälso- och
sjukvårdspersonal"). There is NO JSON API and no bulk file for this database
(the sdb.socialstyrelsen.se/api/v1 statistics API lists 15 datasets, none of
them personnel). BUT — unlike the BUP väntetider database — this form is
**not** standard ASP.NET WebForms: a live inspection found

  * NO __VIEWSTATE, NO __EVENTVALIDATION, NO anti-forgery token,
  * a plain <form method="post" action="resultat.aspx">,

so it IS scriptable from a bare session. The recipe below was reverse-
engineered from one browser "copy as cURL" of a submitted query plus a dozen
probe requests.

WHAT WORKS: a **single value per dimension** per request. The form's own JS
assembles a correlated cluster of hidden fields (`ha*`, `hv*2`, `*_TOP`, ...)
for multi-select that the server cross-validates; every attempt to reproduce a
multi-year / multi-region / multi-age request by hand returned HTTP 500. So
this fetcher loops one request per
(profession x region x year x age-band x sex) and sums the age bands itself —
there is no "all ages" option on the age dimension (`AGI`), only the ten 5-year
bands 6..15 (<30, 30-34, ... 70-w), and AGI genuinely restricts the count
(AGI=6 -> 734, AGI=8 -> 2036, AGI=11 -> 1330 for psykolog/Riket/2024).

That makes this SLOW: with the defaults below (8 professions x 22 regions x
5 years x 10 age bands x 1 sex) it is ~8 800 requests, roughly 40-60 minutes.
Trim PROFESSIONS / YEARS / REGION_CODES to go faster (drop "LK"/"SJ" to save
~2 200). County grain here needs this loop; the alternative is a manual
multi-select CSV export from the same page (2 minutes in a browser) — see
MANUAL FALLBACK at the bottom.

THE FIELD RECIPE (all values single, everything else from FORM_TEMPLATE):
  PERIOD=5          register "Personal med legitimation ... 1995-"
  MATT=1|2         1 = Antal, 2 = Antal per 100 000 invånare
  hvGRP=";CODE;"  hvGRP2=";i_CODE_1;"  haGRP="1"     profession
  OMR="n"  vOMR=";n;"   OMR_SJ=""  vOMR_SJ=""         region (0=Riket, else
                                                      Kurvan's county codes)
  AR="y"  vAR=";y;"                                    year (AR_15/AR_16 bounds
                                                      left at 2015/2024)
  AGI="b"  vAGI=";b;"                                  age band 6..15
  KON=1|2|3  vKON=";k;"  KON_15=k  vKON_15=";k;"      1=Män 2=Kvinnor 3=Båda

Response: a one-cell HTML <table id="ph1_GridView1"> — the number uses a
non-breaking-space thousands separator.

Only the **headcount** (Antal) is fetched, not "per 100 000": that measure is
a per-age-band rate and there is no all-ages row to read it from, so summing
the ten bands (as we must for headcount) would be meaningless for a rate.
Compute per-capita downstream from SCB population if needed.

Output: ../data/processed/socialstyrelsen_personal.json — one record per
        county/profession/year/sex: {county_code, profession,
        profession_label, year, sex, headcount, age_bands_summed, fetched}.
        NOT read by js/data.js yet (staged, not shown).
Run:    python pipeline/fetch_socialstyrelsen_personal.py
Then:   python pipeline/build_kurvan_data.py
"""
import json
import os
import re
import time
from datetime import date
from html import unescape

import requests

BASE = "https://sdb.socialstyrelsen.se/if_per/"
URL = BASE + "resultat.aspx"
HERE = os.path.dirname(__file__)
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(PROCESSED_DIR, exist_ok=True)
FETCHED = date.today().isoformat()

# PERIOD 5 ("legitimerad personal") profession codes -> label. The code goes
# into hvGRP as ";CODE;" and hvGRP2 as ";i_CODE_1;". Trim this list to go
# faster. Order: the psychiatry-specific ones first, then two context totals.
PROFESSIONS = {
    "PS":     "Psykolog",
    "PT":     "Psykoterapeut",
    "HK":     "Hälso- och sjukvårdskurator",
    "0053LK": "Specialistläkare, psykiatri",
    "0052LK": "Specialistläkare, barn- och ungdomspsykiatri",
    "0079SJ": "Specialistsjuksköterska, psykiatrisk vård",
    # context totals — uncomment to also fetch (adds ~len(REGION)*len(YEARS)*10
    # requests each):
    # "LK":   "Läkare (alla)",
    # "SJ":   "Sjuksköterska (alla)",
}
REGION_CODES = ["0", "1", "3", "4", "5", "6", "7", "8", "9", "10", "12", "13",
                "14", "17", "18", "19", "20", "21", "22", "23", "24", "25"]
YEARS = [2024, 2023, 2022]   # widen back to 2015 once a first run is verified
AGE_BANDS = ["6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]
SEXES = {"3": "T"}   # add "1":"M","2":"K" to also fetch the sex split (x3 requests)
REQUEST_PAUSE = 0.1  # be polite to a 25-year-old ASP.NET box

# POST template — the exact field set from the captured browser request
# (only textPERIOD / textMATT / JSText, which the server does not validate,
# are stubbed). Every probe that changed only the dozen fields query()
# overrides succeeded; changing anything else here tended to 500.
FORM_TEMPLATE = {
    "valuePERIOD": "1|2|3|4|5|6", "textPERIOD": "a|b|c|d|e|f",
    "aktPERIOD": "1|1|1|1|1|1", "grpPERIOD": "|||||", "infoPERIOD": "|||||", "aAntRadPERIOD": "",
    "PERIOD": "5", "VARDFORM": "2",
    "valueMATT": "1|2", "textMATT": "Antal|Antal per 100 000", "aktMATT": "1|1",
    "grpMATT": "0|1", "infoMATT": "|", "aAntRadMATT": "",
    "MATT": "1", "OMR": "1", "OMR_SJ": "92", "REGI_15": "0", "REGI": "0",
    "AGI": "8", "KON_15": "3", "KON": "3",
    "AR_15": "2015", "AR_16": "2024", "AR": "2024", "AR_PRIM": "2024", "TYP": "TABELL",
    "vYRKE_PRIM": "", "haYRKE_PRIM": "0", "hvYRKE_PRIM": "", "hvYRKE_PRIM2": "",
    "vYRKE_PRIM_CHG": "", "YRKE_PRIM_TOP": "", "vVARDFORM": "2",
    "vYRKE": "", "haYRKE": "0", "hvYRKE": "", "hvYRKE2": "", "vYRKE_CHG": "", "YRKE_TOP": "",
    "vAR_PRIM": ";2024;", "vOMR_RLK": "", "haOMR_RLK": "", "hvOMR_RLK": "", "hvOMR_RLK2": "",
    "vOMR_RLK_CHG": "", "OMR_RLK_TOP": "", "vPERIOD": "4", "vMATT": "1",
    "vGRP": "", "vGRP_SJ15": "", "vGRP_SJ": "", "vGRP_LK": "", "vGRP_TL": "",
    "vOMR": ";1;", "vOMR_SJ": ";92;", "vOMR_ST": "", "haOMR": "", "haOMR_SJ": "", "haOMR_ST": "",
    "haGRP": "1", "hvGRP": ";AP;", "hvGRP2": ";i_AP_1;",
    "haGRP_SJ15": "0", "hvGRP_SJ15": "", "hvGRP_SJ152": "", "haGRP_SJ": "0", "hvGRP_SJ": "",
    "hvGRP_SJ2": "", "haGRP_LK": "0", "hvGRP_LK": "", "hvGRP_LK2": "", "haGRP_TL": "0",
    "hvGRP_TL": "", "hvGRP_TL2": "",
    "hvOMR": "", "hvOMR2": "", "hvOMR_SJ": "", "hvOMR_SJ2": "", "hvOMR_ST": "", "hvOMR_ST2": "",
    "vAR_15": ";2015;", "vAR_16": ";2024;", "vAR": ";2024;", "vREGI_15": ";0;", "vREGI": ";0;",
    "haSTAT": "1", "hvSTAT": ";0;", "hvSTAT2": ";j_0_1;",
    "haSNI": "0", "hvSNI": "", "hvSNI2": "", "haSNI_SJ": "0", "hvSNI_SJ": "", "hvSNI_SJ2": "",
    "vAGI": ";8;", "vKON_15": ";3;", "vKON": ";3;",
    "vGRP_CHG": "", "GRP_TOP": "144", "vOMR_CHG": "", "vOMR_MA": "", "OMR_TOP": "",
    "vSTAT_CHG": "", "STAT_TOP": "", "vSNI_CHG": "", "SNI_TOP": "",
    "clientScreenWidth": "1200", "clientScreenHeight": "900", "sprak": "",
    "JSText": "x", "JSTextSok": "x",
}

_NUM_RE = re.compile(r'<table[^>]*id="ph1_GridView1"[^>]*>(.*?)</table>', re.S)
_CELL_RE = re.compile(r'<td[^>]*align="right"[^>]*>([^<]*)</td>')


def parse_number(text):
    m = _NUM_RE.search(text)
    if not m:
        return None
    cells = _CELL_RE.findall(m.group(1))
    if not cells:
        return None
    raw = unescape(cells[-1]).replace("\xa0", "").replace(" ", "").replace(",", ".").strip()
    if raw in ("", "..", "-", "N"):
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def query(session, grp_code, region, year, agi, kon, matt):
    f = dict(FORM_TEMPLATE)
    f.update({
        "MATT": matt, "vMATT": matt,
        "hvGRP": f";{grp_code};", "hvGRP2": f";i_{grp_code}_1;", "haGRP": "1",
        "OMR": region, "vOMR": f";{region};", "OMR_SJ": "", "vOMR_SJ": "",
        "AR": str(year), "vAR": f";{year};",
        "AGI": agi, "vAGI": f";{agi};",
        "KON": kon, "vKON": f";{kon};", "KON_15": kon, "vKON_15": f";{kon};",
    })
    r = session.post(URL, data=f, headers={"Referer": BASE,
                     "Origin": "https://sdb.socialstyrelsen.se"}, timeout=60)
    if r.status_code != 200:
        return None
    return parse_number(r.text)


def profession_totals(session, grp_code, region, year, kon, matt):
    """Sum the ten age bands into one all-ages figure. A single band failing
    (None) is tolerated; ALL bands None -> None (nothing published)."""
    vals = []
    for agi in AGE_BANDS:
        v = query(session, grp_code, region, year, agi, kon, matt)
        if v is not None:
            vals.append(v)
        time.sleep(REQUEST_PAUSE)
    return sum(vals) if vals else None


def assert_sane(session):
    """Magnitude trap — the läkemedel-fetcher lesson: a wrong field can still
    return a plausible-looking number. Psykolog / Riket / 2024, summed over
    all ages, both sexes, was ~13 000-15 000 in Socialstyrelsen's own 2024
    personnel report. Fail loud if we're an order of magnitude off."""
    total = profession_totals(session, "PS", "0", 2024, "3", "1")
    print(f"  trap check: psykolog Riket 2024 all-ages Antal = {total}")
    if total is None or not (8000 <= total <= 30000):
        raise SystemExit(
            f"FATAL: sanity check failed (psykolog/Riket/2024 all-ages = {total}, "
            f"expected ~13 000-15 000). A field in FORM_TEMPLATE / query() is "
            f"probably wrong — do NOT trust this run. Re-verify against "
            f"sdb.socialstyrelsen.se/if_per/ before publishing.")


def main():
    print("[sos-personal] scraping sdb.socialstyrelsen.se/if_per/ — SLOW "
          f"(~{len(PROFESSIONS)*len(REGION_CODES)*len(YEARS)*len(AGE_BANDS)*len(SEXES)} requests)")
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (compatible; kurvan-pipeline)"
    session.get(BASE, timeout=30)   # obtain the LB stickiness cookie

    assert_sane(session)

    records = []
    t0 = time.time()
    for grp_code, label in PROFESSIONS.items():
        for region in REGION_CODES:
            county_code = "00" if region == "0" else (region if len(region) == 2 else f"0{region}")
            for year in YEARS:
                for kon, sex in SEXES.items():
                    head = profession_totals(session, grp_code, region, year, kon, "1")
                    if head is None:
                        continue
                    records.append({
                        "county_code": county_code,
                        "profession": grp_code,
                        "profession_label": label,
                        "year": year,
                        "sex": sex,
                        "headcount": int(head),
                        "age_bands_summed": len(AGE_BANDS),
                        "fetched": FETCHED,
                    })
            print(f"  {label:44s} region {region:>2s} done  ({time.time()-t0:.0f}s, {len(records)} rows)")

    if not records:
        raise SystemExit("FATAL: no rows scraped — the form or the recipe changed.")

    out_path = os.path.join(PROCESSED_DIR, "socialstyrelsen_personal.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)
    print(f"[sos-personal] wrote {out_path}  ({len(records)} records, {time.time()-t0:.0f}s)")
    print("[sos-personal] now run:  python pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()

# ---------------------------------------------------------------------------
# MANUAL FALLBACK (faster than the scrape, needs a browser):
#   1. https://sdb.socialstyrelsen.se/if_per/  ->  register "Personal med
#      legitimation eller yrkesbevis ... 1995-".
#   2. Yrke: pick the professions; Region: select all; År: select all;
#      Ålder: select all (or leave "visa åldersgrupper" off); Kön: Båda könen;
#      Mått: Antal + Antal per 100 000.  Pivot Region x År.
#   3. "Spara tabellen som: csv"  ->  data/raw/socialstyrelsen_personal_export.csv
#   4. (a converter for that CSV would live here — not built yet.)
