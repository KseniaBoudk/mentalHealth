# -*- coding: utf-8 -*-
"""Försäkringskassan: ongoing sickness-benefit cases by ICD-10 diagnosis
CHAPTER — the whole F-chapter (all psychiatric diagnoses), not only the
stress-reaction subset F43 that fetch_forsakringskassan.py already fetches.

===============================================================================
WHAT WAS VERIFIED LIVE, NOT ASSUMED (2026-08-27)
===============================================================================
This is a sibling table of the F43 one and behaves identically — same API,
same query technique (a live browser Network capture, NOT the API's own
meta.json alone; several plausible guesses return HTTP 200 with an empty `[]`,
see fetch_forsakringskassan.py's docstring for that trap in full).

  - Dataset: `sjp-pagaende-sjukfall-diagnos`; data endpoint
    `.../api/sprstatistikrapportera/public/v1/sjp-pagaende-sjukfall-diagnos/
    SJPPagSjukfallDiagnosLan.json` — the "SJPPagSjukfallDiagnosLan" filename
    is the *län* breakdown table meta.json lists under `filter.uppdelning`
    (the other two, ...Alder / ...Langd, are age and case-length breakdowns
    this script does not fetch).
  - Query params (confirmed live): `ar`, `manad` (2-digit), `kon_kod`
    (`ALL`/`K`/`M`), `diagnoskapitel_kod`, `lan_kod` (`ALL` = Riket, else the
    same 2-digit county codes as every other fetcher here). All accept a
    comma-joined value list in one request.
  - `diagnoskapitel_kod` values are ICD-10 chapter ranges: `ALL` (samtliga),
    `F00-F99` (Psykiska sjukdomar och syndrom samt beteendestörningar), and 21
    others. This script fetches **`ALL` and `F00-F99` only** — the whole
    psychiatric chapter plus the all-diagnoses total it's a share of. Adding
    the other chapters is a one-line change to DIAGNOSIS_CHAPTERS below; they
    were left out to keep the compiled js/data/*.js small (this source is not
    wired to any reader yet regardless).
  - `andel` here = that chapter's share (%) of the county's ongoing
    sickness-benefit cases in that month (F00-F99 was 49.9 % nationally in
    June 2024, i.e. `antal` F00-F99 / `antal` ALL). NOT a population rate —
    not comparable to the per-100k register indicators elsewhere in Kurvan,
    same caveat the F43 fetcher carries.
  - Response row shape: `{"dimensions": {ar, manad, kon_kod,
    diagnoskapitel_kod, lan_kod, ...}, "observations": {"andel": {rojd,
    value}, "antal": {rojd, value}}}`. A `rojd: true` (suppressed) cell is
    dropped, not included — no such cell was seen in a full 2005-2026 pull,
    same as the F43 table, but the check is kept.
  - Batched one request per year (22 requests, ~seconds each) rather than one
    giant request: the extra `diagnoskapitel_kod` dimension makes the full
    cross-product large enough that a single call is worth avoiding.

Output: ../data/processed/forsakringskassan_diagnos.json — one record per
        county/chapter/sex/year: {county_code, diagnosis_chapter, indicator,
        year, value (andel %), count (antal), sex, months}. `months` = how
        many distinct calendar months of that year went into the average
        (< 12 => partial/in-progress year), same convention and reasoning as
        fetch_forsakringskassan.py's `months` field.
Run:    python pipeline/fetch_forsakringskassan_diagnos.py
Then:   python pipeline/build_kurvan_data.py
"""
import json
import os
import time
from datetime import datetime

import requests

BASE_URL = ("https://www.forsakringskassan.se/api/sprstatistikrapportera"
            "/public/v1/sjp-pagaende-sjukfall-diagnos/SJPPagSjukfallDiagnosLan.json")
HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

COUNTY_CODES = ["01", "03", "04", "05", "06", "07", "08", "09", "10", "12",
                "13", "14", "17", "18", "19", "20", "21", "22", "23", "24", "25"]
KON = {"ALL": "T", "K": "K", "M": "M"}
YEARS = list(range(2005, datetime.now().year + 1))

# ICD-10 chapter ranges as Försäkringskassan's `diagnoskapitel_kod` spells
# them -> the Kurvan indicator name for that slice. See docstring before
# widening this past the psychiatric chapter + the all-diagnoses total.
DIAGNOSIS_CHAPTERS = {
    "ALL": "sjukfranvaro_all_pct",
    "F00-F99": "sjukfranvaro_f_pct",
}


def num(val):
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def fetch_year(year):
    lan_kod = ",".join(["ALL"] + COUNTY_CODES)
    params = {
        "ar": str(year),
        "manad": ",".join(f"{m:02d}" for m in range(1, 13)),
        "kon_kod": "ALL,K,M",
        "diagnoskapitel_kod": ",".join(DIAGNOSIS_CHAPTERS),
        "lan_kod": lan_kod,
    }
    resp = requests.get(BASE_URL, params=params, headers={"Accept": "application/json"}, timeout=60)
    resp.raise_for_status()
    return resp.json()


def to_records(raw_rows):
    """Monthly rows -> one record per county/chapter/sex/year: average the
    share across that year's published months, sum the case count. Same
    month-averaging / partial-year handling as fetch_forsakringskassan.py."""
    groups = {}
    dropped_suppressed = 0
    for row in raw_rows:
        d = row["dimensions"]
        county_code = "00" if d["lan_kod"] == "ALL" else d["lan_kod"]
        sex = KON.get(d["kon_kod"])
        chapter = d.get("diagnoskapitel_kod")
        year = num(d.get("ar"))
        month = d.get("manad")
        if sex is None or year is None or month is None or chapter not in DIAGNOSIS_CHAPTERS:
            continue
        andel, antal = row["observations"]["andel"], row["observations"]["antal"]
        if andel.get("rojd") or antal.get("rojd"):
            dropped_suppressed += 1
            continue
        share, count = num(andel.get("value")), num(antal.get("value"))
        if share is None:
            continue
        key = (county_code, chapter, sex, int(year))
        g = groups.setdefault(key, {"shares": [], "count": 0, "months": set()})
        g["shares"].append(share)
        g["count"] += count or 0
        g["months"].add(month)

    if dropped_suppressed:
        print(f"    note: {dropped_suppressed} row(s) flagged rojd=true, dropped")

    out = []
    partial_years = set()
    for (county_code, chapter, sex, year), g in groups.items():
        n_months = len(g["months"])
        if n_months < 12:
            partial_years.add(year)
        out.append({
            "county_code": county_code,
            "diagnosis_chapter": chapter,
            "indicator": DIAGNOSIS_CHAPTERS[chapter],
            "year": year,
            "value": sum(g["shares"]) / len(g["shares"]),
            "count": int(g["count"]) if g["count"] else None,
            "sex": sex,
            "months": n_months,
        })
    if partial_years:
        print(f"    note: partial year(s) {sorted(partial_years)} — fewer than 12 "
              f"months published yet; each record says how many via `months`")
    return out


def main():
    print("[fk-diagnos] county-grain ongoing sick-leave cases by ICD-10 chapter "
          f"({', '.join(DIAGNOSIS_CHAPTERS)})")
    t0 = time.time()
    all_rows = []
    for year in YEARS:
        rows = fetch_year(year)
        all_rows.extend(rows)
        print(f"  {year}: {len(rows)} rows")
    print(f"  fetched {len(all_rows)} rows in {time.time()-t0:.1f}s")
    with open(os.path.join(RAW_DIR, "forsakringskassan_diagnos_raw.json"), "w", encoding="utf-8") as f:
        json.dump(all_rows, f, ensure_ascii=False, indent=1)

    records = to_records(all_rows)
    out_path = os.path.join(PROCESSED_DIR, "forsakringskassan_diagnos.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    years = sorted({r["year"] for r in records})
    chapters = sorted({r["diagnosis_chapter"] for r in records})
    print(f"[fk-diagnos] wrote {out_path}  ({len(records)} records, "
          f"years {years[0]}..{years[-1]}, chapters {chapters})")
    print("[fk-diagnos] now run:  python pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
