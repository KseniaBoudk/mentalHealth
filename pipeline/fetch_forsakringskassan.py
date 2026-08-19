# -*- coding: utf-8 -*-
"""Försäkringskassan: share of ongoing sickness-benefit cases attributed to
stress reactions (ICD-10 F43), county grain.

NOT a PxWeb source (the other four fetchers in this folder all are) — this is
an EntryScape "rowstore" dataset, a different, simpler REST/JSON API several
Swedish agencies publish through. One flat GET per page, no query-body shape
to build.

===============================================================================
WHAT WAS VERIFIED LIVE, NOT ASSUMED (2026-08-19)
===============================================================================
  - Dataset id bc40aa99-d0a1-4ee0-853c-2d4306c7fad2, endpoint:
    https://catalog.forsakringskassan.se/rowstore/dataset/<id>
    Confirmed live via `curl -H "Accept: application/json" ...` — returns
    {"next": <next page url or null>, "resultCount": N, "results": [...]}.
  - Fields per row: kvartal, ar, lan_kod, lan_text, kommun_kod, kommun_text,
    andel_f43_{man,kvinna,samtliga}, antal_f43_{man,kvinna,samtliga}.
    andel_f43_* is a PERCENTAGE — share of that area's ongoing sickness-
    benefit cases whose diagnosis is F43 — NOT a population rate and NOT
    comparable to the register-based per-100k/per-1000 indicators elsewhere
    in this project. antal_f43_* is the underlying case count.
  - County-level aggregate rows exist alongside individual municipalities:
    kommun_text == "Samtliga kommuner" with kommun_kod ending "00" (e.g.
    "0100" = Stockholms län; "0000" = Riket/national, lan_kod "00"). This
    script only fetches those — county+national — matching every other
    indicator's grain in this project. lan_kod is the same two-digit county
    code Kurvan's own REGIONS array already uses; no id-remapping needed.
  - Coverage confirmed by resultCount: 60 quarterly rows per area = exactly
    2005 Q1 through 2019 Q4. This dataset does NOT extend into the 2020s —
    flag this plainly wherever the indicator is labelled real, the same way
    every other indicator's real-data gaps are documented rather than hidden.
  - No age breakdown, no confidence interval published directly — antal_f43_*
    (a case count) is kept per record so js/data.js's existing
    realRowToCell()-style count->SE approximation (already used for
    psychiatric care) can produce one, rather than adding new CI math here.

Output: ../data/processed/forsakringskassan_f43.json
Run:    python prototype/pipeline/fetch_forsakringskassan.py
"""
import json
import os

import requests

BASE_URL = "https://catalog.forsakringskassan.se/rowstore/dataset/bc40aa99-d0a1-4ee0-853c-2d4306c7fad2"
HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

SEX_FIELDS = {"T": "samtliga", "K": "kvinna", "M": "man"}


def num(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def fetch_all():
    """County + national aggregate rows only (kommun_text == 'Samtliga
    kommuner'), paginated via the API's own 'next' links."""
    rows = []
    url = f"{BASE_URL}?kommun_text=Samtliga+kommuner&_limit=200"
    while url:
        resp = requests.get(url, headers={"Accept": "application/json"}, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        rows.extend(data.get("results", []))
        url = data.get("next")
    return rows


def to_records(raw_rows):
    """Quarterly rows -> one record per county/sex/year: average the share
    (andel_f43) across that year's quarters, sum the case count (antal_f43).
    Kurvan's cell()/total() are year-keyed, not quarter-keyed — annual is
    the grain every other indicator already uses."""
    groups = {}
    for row in raw_rows:
        county_code = row.get("lan_kod")
        year = num(row.get("ar"))
        if county_code is None or year is None:
            continue
        for sex, field in SEX_FIELDS.items():
            share = num(row.get(f"andel_f43_{field}"))
            count = num(row.get(f"antal_f43_{field}"))
            if share is None:
                continue
            key = (county_code, sex, int(year))
            g = groups.setdefault(key, {"shares": [], "count": 0})
            g["shares"].append(share)
            g["count"] += count or 0

    out = []
    for (county_code, sex, year), g in groups.items():
        out.append({
            # Keep "00" for the national row, same raw convention every
            # other fetcher here uses — js/data.js's realTotalFK() does its
            # own "SE"->"00" translation at lookup time; renaming it here
            # too made the two translations cancel out wrong instead of
            # matching (this broke the national line — see commit history).
            "county_code": county_code,
            "indicator": "sjukfranvaro_f43_pct",
            "year": year,
            "value": sum(g["shares"]) / len(g["shares"]),
            "count": int(g["count"]) if g["count"] else None,
            "sex": sex,
        })
    return out


def main():
    print("[forsakringskassan] county-grain share of ongoing sick-leave cases with diagnosis F43")
    raw_rows = fetch_all()
    with open(os.path.join(RAW_DIR, "forsakringskassan_f43_raw.json"), "w", encoding="utf-8") as f:
        json.dump(raw_rows, f, ensure_ascii=False, indent=1)

    records = to_records(raw_rows)
    out_path = os.path.join(PROCESSED_DIR, "forsakringskassan_f43.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    years = sorted({r["year"] for r in records})
    print(f"[forsakringskassan] wrote {out_path}  ({len(records)} records, "
          f"years {years[0]}..{years[-1]})")
    if years[-1] >= 2020:
        print("[forsakringskassan] NOTE: coverage now extends past 2019 — "
              "update this script's docstring and js/data.js's real-caveat "
              "text, both currently say it stops at 2019.")
    print("[forsakringskassan] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
