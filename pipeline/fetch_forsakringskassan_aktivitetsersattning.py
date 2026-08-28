# -*- coding: utf-8 -*-
"""Försäkringskassan: recipients of AKTIVITETSERSÄTTNING (activity
compensation — the disability benefit for 19-29-year-olds whose work capacity
is long-term impaired), county grain, split by ICD-10 diagnosis chapter so the
psychiatric (F00-F99) share is visible. ~80 % of recipients have a psychiatric
diagnosis, so this is very much a mental-health series.

===============================================================================
WHAT WAS VERIFIED LIVE, NOT ASSUMED (2026-08-27)
===============================================================================
Same API family and same "recover the query from a browser Network capture,
not meta.json alone" caveat as the other two Försäkringskassan fetchers here.

  - Dataset: `sa-bestand-diagnos` (the "SA" family covers sjukersättning +
    aktivitetsersättning together); data endpoint
    `.../api/sprstatistikrapportera/public/v1/sa-bestand-diagnos/
    SAbestandmanaddiagnoslan.json` — the "...lan" filename is the län
    breakdown table from meta.json's `filter.uppdelning`.
  - Query params (confirmed live, this order): `delforman`
    (`A` = Aktivitetsersättning, `S` = Sjukersättning, `ALL` = both — this
    script fetches `A` only), `ar`, `manad` (2-digit), `kon_kod`
    (`ALL`/`K`/`M`), `diagnoskapitel` (NOTE: `diagnoskapitel`, no `_kod`
    suffix — differs from the sjp-* tables), `lan` (`ALL` = Riket, else
    2-digit county codes; NOTE: `lan`, not `lan_kod`). All accept a
    comma-joined list.
  - `bestånd` = a stock, not a flow: each month is "how many people were
    receiving it that month". Published back to 2003. The convention on
    Försäkringskassan's own page is the DECEMBER value as the year's figure;
    this script takes December, or the latest published month for a
    still-open year (recorded per record in `snapshot_month`).
  - Three measures on this table: `antal` (recipients), `andel` (that
    chapter's % of the county's recipients), `belopp` ("Belopp i 1000-tal
    kr" — monthly disbursement for that cell, in thousands of SEK). All three
    are carried through. Spot check: national `delforman=A`, Dec 2024 —
    33 053 recipients total, 26 288 (79.5 %) with an F00-F99 diagnosis,
    belopp 317 591 (i.e. ~318 MSEK that month).
  - `diagnoskapitel` = `ALL` and `F00-F99` only are fetched (whole chapter +
    the total it's a share of); widen via DIAGNOSIS_CHAPTERS below.
  - Row shape: `{"dimensions": {delforman, ar, manad, kon_kod,
    diagnoskapitel, lan, ...}, "observations": {"antal": {rojd, value},
    "andel": {...}, "belopp": {...}}}`. `rojd: true` cells dropped.

Output: ../data/processed/forsakringskassan_aktivitetsersattning.json — one
        record per county/chapter/sex/year:
        {county_code, diagnosis_chapter, indicator, year, snapshot_month,
         recipients, share_pct, belopp_1000kr, sex}.
Run:    python pipeline/fetch_forsakringskassan_aktivitetsersattning.py
Then:   python pipeline/build_kurvan_data.py
"""
import json
import os
import time
from datetime import datetime

import requests

BASE_URL = ("https://www.forsakringskassan.se/api/sprstatistikrapportera"
            "/public/v1/sa-bestand-diagnos/SAbestandmanaddiagnoslan.json")
HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

COUNTY_CODES = ["01", "03", "04", "05", "06", "07", "08", "09", "10", "12",
                "13", "14", "17", "18", "19", "20", "21", "22", "23", "24", "25"]
KON = {"ALL": "T", "K": "K", "M": "M"}
YEARS = list(range(2003, datetime.now().year + 1))
DELFORMAN = "A"   # Aktivitetsersättning only. "S" = sjukersättning, "ALL" = both.

DIAGNOSIS_CHAPTERS = {
    "ALL": "aktivitetsersattning_all",
    "F00-F99": "aktivitetsersattning_f",
}


def num(val):
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def fetch_year(year):
    params = {
        "delforman": DELFORMAN,
        "ar": str(year),
        "manad": ",".join(f"{m:02d}" for m in range(1, 13)),
        "kon_kod": "ALL,K,M",
        "diagnoskapitel": ",".join(DIAGNOSIS_CHAPTERS),
        "lan": ",".join(["ALL"] + COUNTY_CODES),
    }
    resp = requests.get(BASE_URL, params=params, headers={"Accept": "application/json"}, timeout=60)
    resp.raise_for_status()
    return resp.json()


def to_records(raw_rows):
    """Monthly stock rows -> one record per county/chapter/sex/year, keeping
    the DECEMBER snapshot (or the latest published month for an open year)."""
    # (county, chapter, sex, year) -> {month: {recipients, share, belopp}}
    by_key = {}
    dropped_suppressed = 0
    for row in raw_rows:
        d = row["dimensions"]
        county_code = "00" if d["lan"] == "ALL" else d["lan"]
        sex = KON.get(d["kon_kod"])
        chapter = d.get("diagnoskapitel")
        year = num(d.get("ar"))
        month = d.get("manad")
        if sex is None or year is None or month is None or chapter not in DIAGNOSIS_CHAPTERS:
            continue
        obs = row["observations"]
        antal = obs.get("antal", {})
        if antal.get("rojd") or obs.get("belopp", {}).get("rojd"):
            dropped_suppressed += 1
            continue
        recipients = num(antal.get("value"))
        if recipients is None:
            continue
        key = (county_code, chapter, sex, int(year))
        by_key.setdefault(key, {})[month] = {
            "recipients": recipients,
            "share": num(obs.get("andel", {}).get("value")),
            "belopp": num(obs.get("belopp", {}).get("value")),
        }

    if dropped_suppressed:
        print(f"    note: {dropped_suppressed} row(s) flagged rojd=true, dropped")

    out = []
    partial_years = set()
    for (county_code, chapter, sex, year), months in by_key.items():
        snap = "12" if "12" in months else max(months)
        if snap != "12":
            partial_years.add(year)
        m = months[snap]
        out.append({
            "county_code": county_code,
            "diagnosis_chapter": chapter,
            "indicator": DIAGNOSIS_CHAPTERS[chapter],
            "year": year,
            "snapshot_month": int(snap),
            "recipients": int(m["recipients"]),
            "share_pct": m["share"],
            "belopp_1000kr": m["belopp"],
            "sex": sex,
        })
    if partial_years:
        print(f"    note: year(s) {sorted(partial_years)} have no December value yet — "
              f"used the latest published month (see each record's snapshot_month)")
    return out


def main():
    print("[fk-ae] county-grain aktivitetsersättning recipients by ICD-10 chapter "
          f"({', '.join(DIAGNOSIS_CHAPTERS)})")
    t0 = time.time()
    all_rows = []
    for year in YEARS:
        rows = fetch_year(year)
        all_rows.extend(rows)
    print(f"  fetched {len(all_rows)} rows in {time.time()-t0:.1f}s")
    with open(os.path.join(RAW_DIR, "forsakringskassan_aktivitetsersattning_raw.json"), "w", encoding="utf-8") as f:
        json.dump(all_rows, f, ensure_ascii=False, indent=1)

    records = to_records(all_rows)
    out_path = os.path.join(PROCESSED_DIR, "forsakringskassan_aktivitetsersattning.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    years = sorted({r["year"] for r in records})
    print(f"[fk-ae] wrote {out_path}  ({len(records)} records, years {years[0]}..{years[-1]})")
    print("[fk-ae] now run:  python pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
