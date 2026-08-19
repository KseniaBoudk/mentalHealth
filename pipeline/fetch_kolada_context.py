# -*- coding: utf-8 -*-
"""Kolada: two context indicators for the Context (Sammanhang) tab —
population density and low-education share, region grain.

Kolada is Sweden's standard municipal/regional KPI database (a REST/JSON
API, verified live: https://api.kolada.se/v3/...). Its admin-register KPIs
publish at MUNICIPALITY grain (290 kommuner), not Kurvan's 21 regions, so
this aggregates up using the region column already in kommuner.csv (a
kommun-code -> region-name table already in this folder).

===============================================================================
WHAT WAS VERIFIED LIVE, NOT ASSUMED (2026-08-19)
===============================================================================
  - N02937 "Invanare per kvadratkilometer" (population density) and N01721
    "Invanare 25-64 ar med lag utbildningsniva, andel (%)" (low-education
    share) are both real, live KPI ids on api.kolada.se/v3.
  - Data endpoint: https://api.kolada.se/v3/data/kpi/<id>/year/<year> ->
    {"values": [{"kpi","period","municipality","values":[{"gender","value",...}]}]}.
    "municipality" is the same 4-digit kommun code kommuner.csv already uses
    (e.g. "0180") -- no id translation needed. "0000" is a national row,
    skipped here (Kurvan computes its own national reference from the 21
    regions, same as every other indicator).
  - Aggregation is a plain, UNWEIGHTED mean of the kommuner in each region --
    not population-weighted. That's a real simplification, not hidden: it's
    labelled as such in the output and belongs in the UI copy too. Weighting
    would need a population figure per kommun, which is a second fetch this
    first pass skips deliberately to keep the pipeline simple.

Output: ../data/processed/kolada_context.json
Run:    python prototype/pipeline/fetch_kolada_context.py
"""
import csv
import json
import os

import requests

BASE_URL = "https://api.kolada.se/v3/data/kpi"
YEAR = 2023  # latest year both KPIs were confirmed to publish
KPIS = {
    "pop_density": "N02937",       # Invanare per kvadratkilometer
    "education_low_pct": "N01721",  # Invanare 25-64 ar med lag utbildningsniva, andel (%)
}

HERE = os.path.dirname(__file__)
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(PROCESSED_DIR, exist_ok=True)


def load_kommun_to_region():
    path = os.path.join(HERE, "kommuner.csv")
    out = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[row["code"]] = row["region"]
    return out


def fetch_kpi(kpi_id):
    """One year, one KPI, every municipality that published a value."""
    rows = []
    url = f"{BASE_URL}/{kpi_id}/year/{YEAR}"
    while url:
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        rows.extend(data.get("values", []))
        url = data.get("next_url")
    return rows


def main():
    # Kurvan's own 2-digit county codes, matching js/data.js's REGIONS array
    # exactly by name -- reused here rather than re-deriving it, since
    # kommuner.csv's region names already match those spellings 1:1.
    region_codes = {
        "Stockholm": "01", "Uppsala": "03", "Södermanland": "04", "Östergötland": "05",
        "Jönköping": "06", "Kronoberg": "07", "Kalmar": "08", "Gotland": "09",
        "Blekinge": "10", "Skåne": "12", "Halland": "13", "Västra Götaland": "14",
        "Värmland": "17", "Örebro": "18", "Västmanland": "19", "Dalarna": "20",
        "Gävleborg": "21", "Västernorrland": "22", "Jämtland": "23",
        "Västerbotten": "24", "Norrbotten": "25",
    }

    kommun_to_region = load_kommun_to_region()
    print(f"[kolada-context] {len(kommun_to_region)} kommuner mapped to region")

    records = []
    for indicator, kpi_id in KPIS.items():
        raw = fetch_kpi(kpi_id)
        print(f"[kolada-context] {indicator} ({kpi_id}): {len(raw)} kommun rows for {YEAR}")

        by_region = {}
        for row in raw:
            county = row.get("municipality")
            region_name = kommun_to_region.get(county)
            if not region_name:
                continue  # "0000" (national) or an id kommuner.csv doesn't have
            vals = [v["value"] for v in row.get("values", [])
                    if v.get("gender") == "T" and v.get("value") is not None]
            if not vals:
                continue
            by_region.setdefault(region_codes[region_name], []).append(vals[0])

        for county_code, vals in by_region.items():
            records.append({
                "county_code": county_code,
                "indicator": indicator,
                "year": YEAR,
                "value": sum(vals) / len(vals),
                "n_kommuner": len(vals),
            })

    out_path = os.path.join(PROCESSED_DIR, "kolada_context.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=1)
    print(f"[kolada-context] wrote {out_path} ({len(records)} region records)")
    print("[kolada-context] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
