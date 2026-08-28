# -*- coding: utf-8 -*-
"""Vården i siffror: the "Psykiatrin i siffror" measure set — region-grain,
annual figures for adult and child/adolescent psychiatry: outpatient visits,
share of the population seen, inpatient beds and occupancy, mean length of
stay, compulsory-care (LPT) share, and agency-staff cost ratio (hyrkostnader).

===============================================================================
WHY THIS EXISTS / WHAT IT DOES AND DOESN'T COVER
===============================================================================
SKR's "Psykiatrin i siffror" is published only as annual PDF reports (VUP /
BUP / RPV) — no API, no data file. BUT a chunk of the same underlying data is
surfaced on Vården i siffror (vardenisiffror.se) under an information source
literally named "Psykiatrin i siffror", and THAT has a public JSON API.

Covered here (region grain, annual): outpatient visits per capita, share of
residents seen in psychiatry, inpatient beds per capita, bed occupancy, mean
length of stay, LPT (compulsory care) share, and "hyrkostnader" (agency-staff
cost as a % of own-staff cost).

NOT covered — still only in the SKR PDFs: absolute STAFF HEADCOUNT / FTE per
region, and absolute COST (kr) per region. (Licensed-staff headcount by
profession has its own scraper, fetch_socialstyrelsen_personal.py.)

===============================================================================
API, VERIFIED LIVE 2026-08-28 — all unauthenticated
===============================================================================
Base: https://api.vardenisiffror.se/webapi   (the SPA resolves host+"/webapi";
      an empty `x-bvo-ticket` header is accepted for public reads.)

  GET  /api/informationsource
       -> [{name, description, measureIds:[guid,...], latestPeriodTypes}, ...]
       Find the entry whose name == "Psykiatrin i siffror".

  POST /api/measures/measures        body: ["<guid>", ...]   (a BARE JSON array)
       -> [{measureId, name, measureDefinition, measureUnit, soughtValue}, ...]

  POST /api/measurements/measurementswithmetadata
       body: {"measureIds":[guid,...], "units":["SE","01",...,"25"],
              "periodType":"Year", "dateFrom":"2010-01-01", "dateTo":"2025-12-31"}
       -> [{organizationId, measureId, measurements:[
              {value, numerator, denominator, confidenceInterval:{low,high},
               period:{start,end}, periodType, type}, ...]}, ...]
       `units` are Kurvan's own region codes ("01".."25") plus "SE" = national.
       An empty `measurements` list just means no data for that cell.
       `periodType` MUST be sent (a request without it 500s).

Output: ../data/processed/vardenisiffror_psykiatri.json — one record per
        measure/region/year: {measure_id, measure, measure_unit, definition,
        county_code, year, value, numerator, denominator, ci_lo, ci_hi,
        fetched}. NOT read by js/data.js yet (staged, not shown).
Run:    python pipeline/fetch_vardenisiffror_psykiatri.py
Then:   python pipeline/build_kurvan_data.py
"""
import json
import os
from datetime import date

import requests

API = "https://api.vardenisiffror.se/webapi"
HEADERS = {"Content-Type": "application/json", "x-bvo-ticket": "",
           "Origin": "https://vardenisiffror.se", "Referer": "https://vardenisiffror.se/"}
SOURCE_NAME = "Psykiatrin i siffror"
UNITS = ["SE"] + ["01", "03", "04", "05", "06", "07", "08", "09", "10", "12",
                  "13", "14", "17", "18", "19", "20", "21", "22", "23", "24", "25"]
DATE_FROM, DATE_TO = "2008-01-01", f"{date.today().year}-12-31"

HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
FETCHED = date.today().isoformat()


def get_source_measure_ids(session):
    r = session.get(f"{API}/api/informationsource", headers=HEADERS, timeout=60)
    r.raise_for_status()
    for src in r.json():
        if src.get("name") == SOURCE_NAME:
            return src["measureIds"]
    raise SystemExit(f"FATAL: information source {SOURCE_NAME!r} not found — the "
                     f"Vården i siffror catalogue changed. Re-check "
                     f"{API}/api/informationsource before trusting this.")


def get_measure_meta(session, measure_ids):
    r = session.post(f"{API}/api/measures/measures", headers=HEADERS,
                     json=measure_ids, timeout=60)
    r.raise_for_status()
    return {m["measureId"]: m for m in r.json()}


def fetch_series(session, measure_ids):
    body = {"measureIds": measure_ids, "units": UNITS, "periodType": "Year",
            "dateFrom": DATE_FROM, "dateTo": DATE_TO}
    r = session.post(f"{API}/api/measurements/measurementswithmetadata",
                     headers=HEADERS, json=body, timeout=120)
    r.raise_for_status()
    return r.json()


def to_records(series, meta):
    out = []
    for block in series:
        county = "00" if block["organizationId"] == "SE" else block["organizationId"]
        mid = block["measureId"]
        m = meta.get(mid, {})
        for pt in block.get("measurements", []):
            year = int(pt["period"]["start"][:4])
            ci = pt.get("confidenceInterval") or {}
            out.append({
                "measure_id": mid,
                "measure": m.get("name"),
                "measure_unit": m.get("measureUnit"),
                "definition": m.get("measureDefinition"),
                "county_code": county,
                "year": year,
                "value": pt.get("value"),
                "numerator": pt.get("numerator"),
                "denominator": pt.get("denominator"),
                "ci_lo": ci.get("low"),
                "ci_hi": ci.get("high"),
                "fetched": FETCHED,
            })
    return out


def main():
    print(f"[vis-psykiatri] Vården i siffror — {SOURCE_NAME}")
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (compatible; kurvan-pipeline)"

    measure_ids = get_source_measure_ids(session)
    print(f"[vis-psykiatri] {len(measure_ids)} measures in the source")
    meta = get_measure_meta(session, measure_ids)

    series = fetch_series(session, measure_ids)
    with open(os.path.join(RAW_DIR, "vardenisiffror_psykiatri_raw.json"), "w", encoding="utf-8") as f:
        json.dump(series, f, ensure_ascii=False, indent=1)

    records = to_records(series, meta)
    if not records:
        raise SystemExit("FATAL: no measurements returned — check the API shape "
                         "(periodType is required) before trusting this.")

    out_path = os.path.join(PROCESSED_DIR, "vardenisiffror_psykiatri.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    measures = sorted({r["measure"] for r in records})
    years = sorted({r["year"] for r in records})
    print(f"[vis-psykiatri] wrote {out_path}  ({len(records)} records, "
          f"{len(measures)} measures, years {years[0]}..{years[-1]})")
    for name in measures:
        print(f"    - {name}")
    print("[vis-psykiatri] now run:  python pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
