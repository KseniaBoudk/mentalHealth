# -*- coding: utf-8 -*-
"""Every BVC (barnavårdscentral / child health centre — routine well-baby
and child health checkups, NOT psychiatric care) in Sweden, as published
by SPARK (spark.barnhalsovard.se), a travel-time accessibility tool built
by Sergio Flores / Uppsala Health Economics, Uppsala University.

STANDALONE — sibling to ../BUPS/, not part of Kurvan's own pipeline/.
BVC is a DIFFERENT facility type from BUP (barn- och ungdomspsykiatri,
child & adolescent PSYCHIATRY) — this is not a re-run of that task, it's
the other dataset the user separately asked for once SPARK turned out to
be BVC-only.

SOURCE: SPARK's own frontend loads its facility list from one plain,
public JSON file:
    https://spark.barnhalsovard.se/data/bvc.json
No pagination, no auth, no API discovery needed — confirmed live
2026-08-26, a single GET returns the full national list (SPARK's own
summary text: "Baserat på 1 032 mottagningar, 290 kommuner").

COORDINATES: SPARK's own records carry "coord_source":"1177_hsa_<date>" —
SPARK sources ITS coordinates from 1177.se/HSA data too (the same source
../BUPS/fetch_bup_facilities.py uses directly for BUP), so this is not an
independent cross-check of that method, just the same well-attested
source applied to the other facility type.

IDENTIFIER: unitCode, not hsaId, is the reliable per-record identifier
here — 100% present and unique across all 1,032 records. hsaId (Sweden's
official HSA registry id) is missing on ~15% of records: unlike ../BUPS/
(which comes straight from 1177/HSA and has 100% hsaId coverage), SPARK
evidently couldn't resolve an official HSA entry for every clinic it
lists — plausibly private/digital-first providers (e.g. "Kry Vårdcentral"
appears in this list) not fully in that registry. Do not dedupe or key on
hsaId for this dataset.

TWO KINDS OF FIELDS in each source record, kept distinct below:
  - plain facility facts (name, ownership, address, phone, coordinates,
    hsaId, kommun/län codes, isFamiljecentral) — directly comparable to
    ../BUPS/'s columns.
  - SPARK's OWN computed accessibility-model outputs (weightedDemand, rj,
    startYear/endYear, children05) — not facility facts, this project's
    own analysis for its travel-time index. Kept (not stripped) since
    it's real information SPARK publishes, but should never be read as
    something this project independently verified.

Run:    python fetch_bvc_facilities.py
Output: bvc_kliniker_sverige.json, bvc_kliniker_sverige.csv (this folder)
"""
import csv
import json
import os
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")
SOURCE_URL = "https://spark.barnhalsovard.se/data/bvc.json"

FACT_FIELDS = [
    "hsaId", "name", "ownership", "isFamiljecentral", "address",
    "phone", "lat", "lon", "lanCode", "kommunCode", "kommungrupp",
    "url1177", "unitCode",
]
SPARK_MODEL_FIELDS = ["startYear", "endYear", "weightedDemand", "rj", "children05"]


def main():
    print(f"[bvc-facilities] fetching {SOURCE_URL} ...")
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        records = json.loads(resp.read().decode("utf-8"))
    print(f"[bvc-facilities] got {len(records)} records")

    rows = []
    for r in records:
        row = {k: r.get(k) for k in FACT_FIELDS}
        for k in SPARK_MODEL_FIELDS:
            row[f"spark_{k}"] = r.get(k)
        row["url_1177"] = ("https://www.1177.se" + row["url1177"]) if row.get("url1177") else None
        del row["url1177"]
        row["coord_source"] = r.get("coord_source")
        row["spark_verify_1177"] = r.get("verify_1177")
        row["fetched_at"] = TODAY
        rows.append(row)

    # unitCode, not hsaId, is SPARK's real stable per-record identifier:
    # ~15% of records have no hsaId at all (SPARK evidently couldn't
    # resolve an official HSA registry entry for every listed facility -
    # unlike ../BUPS/, which comes straight from 1177/HSA and has 100%
    # coverage), so grouping by hsaId falsely collapses every hsaId-less
    # record into one "duplicate" bucket. unitCode has no such gap.
    unit_ids = [r["unitCode"] for r in rows]
    dupes = len(unit_ids) - len(set(unit_ids))
    n_no_hsa = sum(1 for r in rows if not r["hsaId"])
    print(f"[bvc-facilities] duplicate unitCode count: {dupes}")
    print(f"[bvc-facilities] records with no hsaId at all: {n_no_hsa}/{len(rows)}")

    out_of_bounds = [r["name"] for r in rows
                     if r["lat"] and r["lon"] and not (54 <= r["lat"] <= 70 and 9 <= r["lon"] <= 25)]
    print(f"[bvc-facilities] out-of-Sweden coordinates: {len(out_of_bounds)}")

    out_json = os.path.join(HERE, "bvc_kliniker_sverige.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({
            "source": SOURCE_URL,
            "source_project": "SPARK, spark.barnhalsovard.se (Sergio Flores / Uppsala Health Economics, Uppsala University)",
            "fetched_at": TODAY,
            "total_records": len(rows),
            "note": "BVC (child health centres) - NOT BUP (child/adolescent psychiatry), a different facility type; see ../BUPS/ for that. Columns prefixed spark_ are SPARK's own accessibility-model outputs (its travel-time/E2SFCA analysis), not independently verified facility facts.",
            "clinics": rows,
        }, f, ensure_ascii=False, indent=1)

    out_csv = os.path.join(HERE, "bvc_kliniker_sverige.csv")
    with open(out_csv, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    print(f"[bvc-facilities] wrote {out_json}")
    print(f"[bvc-facilities] wrote {out_csv}")


if __name__ == "__main__":
    main()
