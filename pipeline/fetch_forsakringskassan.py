# -*- coding: utf-8 -*-
"""Försäkringskassan: share of ongoing sickness-benefit cases attributed to
stress reactions (ICD-10 F43), county grain.

===============================================================================
WHAT WAS VERIFIED LIVE, NOT ASSUMED (2026-08-24)
===============================================================================
This used to hit an EntryScape "rowstore" dataset (id
bc40aa99-d0a1-4ee0-853c-2d4306c7fad2) that turned out to be a FROZEN
historical extract stopping at 2019 Q4 — re-running that fetcher unmodified
against the live API in 2026 still only returns 2005-2019, confirmed live,
not just stale. Försäkringskassan's own newer statistics dashboard
(forsakringskassan.se/statistik-och-analys/statistikdatabas) clearly has
current data (checked through mid-2025), but it's a JS-driven front end with
no documented API — the query shape below was recovered from a live browser
Network-tab capture (DevTools → copy as cURL), not guessed from the API's own
meta.json alone (several guesses based on meta.json's dimension list came
back HTTP 200 with an empty `[]`, indistinguishable from "no data" without
the capture).

  - Endpoint: `.../api/sprstatistikrapportera/public/v1/
    sjp-pagaende-sjukfall-diagnos-f43/SJPPagSjukfallDiagnosF43.json` — NOT
    `data.json`, which the API's own meta.json gives no hint of; the real
    filename is the "table" name meta.json lists under `filter.uppdelning`.
  - No cookies, session, or special headers needed — confirmed live with a
    bare GET (no `Referer`/`X-Requested-With`/etc.) and it still returns
    real data. The captured cURL carried a session cookie only because the
    browser had one; it isn't checked server-side.
  - Query params: `ar` (year), `manad` (month, 2-digit, 01-12), `kon_kod`
    (`ALL`=total, `K`=women, `M`=men), `lan_kod` (`ALL`=national, else the
    SAME 2-digit county codes as every other fetcher here), `kommun_kod`.
  - THE TRAP: `kommun_kod` is `<municipality>_<county>`, not
    `<county>_<municipality>` — `ALL_01` (all municipalities IN county 01)
    is correct; `01_ALL` silently returns `[]`, same "200 with wrong-but-
    plausible-looking emptiness" shape as this project's other API traps.
    National is `lan_kod=ALL` + `kommun_kod=ALL_ALL`; county lan_kod=NN
    pairs with `kommun_kod=ALL_NN`. Confirmed live that comma-joining a
    full parallel list of both (`lan_kod=ALL,01,03,...` +
    `kommun_kod=ALL_ALL,ALL_01,ALL_03,...`) returns one row per pair in a
    single request, not a cross-product.
  - The full range fetched below (2005-2026, all 12 months, all 3 kon_kod,
    all 21 counties + national) is 16,962 rows in ONE request, ~1 second,
    no pagination — no need to batch this the way the Socialstyrelsen
    fetchers batch by age band to stay under a page-size cap.
  - No suppression observed: every row in that full fetch had
    `rojd: false` on both measures, even a county/sex/month cell as small
    as 5 cases (Gotland, men, August 2011). Treated as "no disclosure
    floor on this dataset" — same situation as psych/lakemedel — but kept
    an explicit check in `to_records()` for `rojd: true` regardless, in
    case a future month/geography does trigger it; such a cell is dropped
    rather than silently included.
  - Spot-checked 2015 national/total against the OLD (frozen) dataset's
    same cell: 16.18% here vs. 16.40% there. Expected, not a bug — the old
    fetcher averaged QUARTERLY snapshots into an annual figure, this one
    averages MONTHLY snapshots; same underlying statistic, finer sampling,
    small difference in the annual mean of a metric that moves within the
    year. Not a discontinuity worth flagging to readers, the same way
    swapping self-harm/suicide's disclosure floor granularity wasn't.
  - `andel_*`/`antal_*` (old field names) are gone; the new shape is
    `{"dimensions": {ar, manad, kon_kod, lan_kod, ...}, "observations":
    {"andel": {"rojd", "value"}, "antal": {"rojd", "value"}}}`. `andel` is
    the same "share of ongoing sickness-benefit cases with an F43
    diagnosis, %" definition as before (confirmed via this table's own
    meta.json description) — not a population rate, not comparable to the
    register-based per-100k/per-1000 indicators elsewhere in this project.

Output: ../data/processed/forsakringskassan_f43.json — same shape as
        before ({county_code, indicator, year, value, count, sex}) plus one
        new field, `months` (how many distinct calendar months of that year
        went into `value`'s average — under 12 means a partial year; see
        to_records()'s docstring). js/data.js's REAL_FK reader does need a
        change for this one, to carry `months` through and let the UI flag
        an in-progress year.
Run:    python prototype/pipeline/fetch_forsakringskassan.py
"""
import json
import os
import time
from datetime import datetime

import requests

BASE_URL = ("https://www.forsakringskassan.se/api/sprstatistikrapportera"
            "/public/v1/sjp-pagaende-sjukfall-diagnos-f43/SJPPagSjukfallDiagnosF43.json")
HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

# Same county-code scheme as fetch_socialstyrelsen_mh.py's REGION_ID_TO_COUNTY
# (values here, not a regionId->code lookup — this API already speaks in
# two-digit county codes directly).
COUNTY_CODES = ["01", "03", "04", "05", "06", "07", "08", "09", "10", "12",
                "13", "14", "17", "18", "19", "20", "21", "22", "23", "24", "25"]
KON = {"ALL": "T", "K": "K", "M": "M"}
YEARS = list(range(2005, datetime.now().year + 1))


def num(val):
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def fetch_all():
    """One request for the whole table — see docstring for why this
    doesn't need to be batched the way the Socialstyrelsen fetchers are."""
    lan_kod = ",".join(["ALL"] + COUNTY_CODES)
    kommun_kod = ",".join(["ALL_ALL"] + [f"ALL_{c}" for c in COUNTY_CODES])
    params = {
        "ar": ",".join(str(y) for y in YEARS),
        "manad": ",".join(f"{m:02d}" for m in range(1, 13)),
        "kon_kod": "ALL,K,M",
        "lan_kod": lan_kod,
        "kommun_kod": kommun_kod,
    }
    resp = requests.get(BASE_URL, params=params, headers={"Accept": "application/json"}, timeout=60)
    resp.raise_for_status()
    return resp.json()


def to_records(raw_rows):
    """Monthly rows -> one record per county/sex/year: average the share
    (andel) across that year's months, sum the case count (antal). Kurvan's
    cell()/total() are year-keyed, not month-keyed — annual is the grain
    every other indicator already uses.

    The current calendar year is necessarily incomplete when this runs
    (there's no "wait for December" here — it fetches whatever's published
    so far) and averaging 5 published months the same way as a full 12
    silently passes off a partial-year figure as a finished one, with
    nothing distinguishing it from every prior closed year. `months` below
    is the actual count of distinct calendar months that went into each
    record's average, carried all the way through to js/data.js/lang.js so
    the UI can say so wherever this year's figure is shown, not just note
    it once somewhere easy to miss."""
    groups = {}
    dropped_suppressed = 0
    for row in raw_rows:
        d = row["dimensions"]
        county_code = "00" if d["lan_kod"] == "ALL" else d["lan_kod"]
        sex = KON.get(d["kon_kod"])
        year = num(d.get("ar"))
        month = d.get("manad")
        if sex is None or year is None or month is None:
            continue
        andel, antal = row["observations"]["andel"], row["observations"]["antal"]
        if andel.get("rojd") or antal.get("rojd"):
            dropped_suppressed += 1
            continue
        share, count = num(andel.get("value")), num(antal.get("value"))
        if share is None:
            continue
        key = (county_code, sex, int(year))
        g = groups.setdefault(key, {"shares": [], "count": 0, "months": set()})
        g["shares"].append(share)
        g["count"] += count or 0
        g["months"].add(month)

    if dropped_suppressed:
        print(f"    note: {dropped_suppressed} row(s) flagged rojd=true, dropped "
              f"(see docstring — none were expected)")

    out = []
    partial_years = set()
    for (county_code, sex, year), g in groups.items():
        n_months = len(g["months"])
        if n_months < 12:
            partial_years.add(year)
        out.append({
            "county_code": county_code,
            "indicator": "sjukfranvaro_f43_pct",
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
    print("[forsakringskassan] county-grain share of ongoing sick-leave cases with diagnosis F43")
    t0 = time.time()
    raw_rows = fetch_all()
    print(f"  fetched {len(raw_rows)} rows in {time.time()-t0:.1f}s")
    with open(os.path.join(RAW_DIR, "forsakringskassan_f43_raw.json"), "w", encoding="utf-8") as f:
        json.dump(raw_rows, f, ensure_ascii=False, indent=1)

    records = to_records(raw_rows)
    out_path = os.path.join(PROCESSED_DIR, "forsakringskassan_f43.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)

    years = sorted({r["year"] for r in records})
    print(f"[forsakringskassan] wrote {out_path}  ({len(records)} records, "
          f"years {years[0]}..{years[-1]})")
    print("[forsakringskassan] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
