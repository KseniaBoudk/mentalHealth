# -*- coding: utf-8 -*-
"""Folkhälsomyndigheten's Folkhälsodata: HLV survey, "Svår ängslan, oro
eller ångest" (severe anxiety/worry/dread — the same underlying question as
Kurvan's region-grain `distress` indicator, see fetch_folkhalsodata_hlv.py),
broken down by education, income, and country of birth INSTEAD of region.

PxWeb API, same host/table family as fetch_folkhalsodata_hlv.py — reread
that file first, its docstring covers the shared quirks (the ".." missing
sentinel, the four Andel/CI rows that must be paired back together, this
table family's own Kön id scheme). This file only documents what's
DIFFERENT about these three sibling tables.

===============================================================================
THREE SIBLING TABLES, NOT THREE ARBITRARY CHOICES — VERIFIED LIVE 2026-08-27
===============================================================================
Same folder as hlv1psyxreg.px (A_Folkhalsodata/B_HLV/dPsykhals/), each
trading the REGION dimension for a different demographic split. Confirmed by
fetching each table's own metadata (GET .../<table>.px) rather than guessing
Swedish category names — do the same before trusting this against a much
later run, PxWeb table shapes do change:

    hlv1psyfutb.px  Utbildning (education):  00 Totalt, 01 Förgymnasial,
                    02 Gymnasial, 03 Eftergymnasial
    hlv1psybeko.px  Ekonomi (economy) — 14 categories on this dimension,
                    most of them different cuts of the same underlying idea
                    (crisis/no-crisis, can/can't cover a surprise expense,
                    low/high income, cash-margin yes/no) — this script only
                    pulls the income-quintile cut (closest open match to
                    "income" as usually meant), NOT all 14: 00 Totalt,
                    07-11 Inkomstkvintil 1-5.
    hlv1psycfod.px  Födelseland (country of birth):  00 Totalt, 01 Sverige,
                    02 Övriga Norden, 03 Övriga Europa, 04 Övriga världen

All three share this shape, POSITION not name (see fetch_folkhalsodata_hlv.py
on why): [0] Psykisk hälsa category, [1] Andel och konfidensintervall
(measure), [2] the breakdown dimension itself (Utbildning/Ekonomi/
Födelseland), [3] Ålder, [4] Kön, [5] År. This is NOT the region table's
shape (region at [0], no Ålder dimension at all) — these three add an age
dimension the region table doesn't have, and drop region entirely (national
figures only, confirmed: no region/county variable exists on any of these
three tables).

CATEGORY stays "58" (Svår ängslan, oro eller ångest), same choice and same
reasoning as fetch_folkhalsodata_hlv.py — confirmed present on all three
tables' Psykisk hälsa dimension with the same id. Its COVERAGE is not the
same on these three tables as on the region table, though: the region
table has 15/15 windows for category 58, but these three breakdown tables
only have real (non-"..") data for category 58 in 2021, 2022, and 2024 —
verified live 2026-08-27, every other year of the 18 queried came back as
PxWeb's missing-value sentinel for every category/sex combination tried.
Do not swap CATEGORY to chase better coverage (e.g. "46" Mycket stressad,
also flagged 15/15-continuous in fetch_folkhalsodata_hlv.py's docstring) —
that would mean this source and the region-grain `distress` source no
longer describe the same underlying question, which defeats the point of
sharing the "distress_pct" indicator name. Three real years is what this
specific breakdown is; say so in the UI rather than paper over it.

Ålder differs per table (each offers a different set of "crude vs.
age-standardised, 16 or 25 and up" options) — this script always picks the
CRUDE (not age-standardised), broadest available adult range per table,
matching the region table's own convention of publishing distress as a
directly-observed share, never age-standardised (see js/data.js's REAL_HLV
docstring). The picked codes are NOT the same number across tables — verify
against each table's own metadata, don't assume alignment:
    hlv1psyfutb.px  Ålder id "09"  = "Ej åldersstandardiserad 25- år"
    hlv1psybeko.px  Ålder id "13"  = "Ej åldersstandardiserad 16- år"
    hlv1psycfod.px  Ålder id "30"  = "16- år"  (this table has no
                    standardised/non-standardised split at all, just one
                    crude 16+ option)

Kön ids are the same 00/01/02 = Totalt/Kvinnor/Män scheme
fetch_folkhalsodata_hlv.py already uses on the region table (unlike
Socialstyrelsen's tables elsewhere in this folder, where 1=Män/2=Kvinnor —
still not that here).

År is single calendar years on these three tables (2004..2024, with real
gaps — 2017/2019/2023 missing per the live metadata), NOT the windowed
"2021-2024"-style labels the region table publishes. Taken live from each
table's own metadata, never hardcoded, same discipline as
fetch_folkhalsodata_hlv.py.

Output: ../data/processed/folkhalsodata_equity.json — flat rows, one
breakdown category at a time:
    {indicator, breakdown, category, category_label_sv, sex, year,
     value, ci_lo, ci_hi, n}
`indicator` stays "distress_pct" (same underlying survey question as the
region-grain source) — `breakdown` ("education"|"income"|"birth_country")
and `category` are what distinguish a row here from a REAL_HLV_MH row.
Plain-object-per-row, same shape every source but psych/antidep already
uses — flows through build_kurvan_data.py with no changes to that script,
see its own module docstring.

Run:    python prototype/pipeline/fetch_folkhalsodata_equity.py
"""
import json
import os

import requests

BASE_URL = "https://fohm-app.folkhalsomyndigheten.se/Folkhalsodata/api/v1/sv"
HERE = os.path.dirname(__file__)
RAW_DIR = os.path.join(HERE, "..", "data", "raw")
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

CATEGORY = "58"   # Svår ängslan, oro eller ångest — see fetch_folkhalsodata_hlv.py
MEASURE_SHARE, MEASURE_CI_LO, MEASURE_CI_HI, MEASURE_N = "01", "02", "03", "04"
SEX = {"00": "T", "01": "K", "02": "M"}   # same scheme as fetch_folkhalsodata_hlv.py

# One entry per sibling table: which breakdown values to pull (id -> our
# own stable machine key, kept separate from the Swedish label so the
# frontend can translate/order them without parsing PxWeb text), and which
# single Ålder id to lock in (crude, broadest range — see module docstring).
TABLES = [
    {
        "path": "A_Folkhalsodata/B_HLV/dPsykhals/hlv1psyfutb.px",
        "breakdown": "education",
        "age_id": "09",
        "categories": {"00": "total", "01": "primary", "02": "secondary", "03": "post_secondary"},
    },
    {
        "path": "A_Folkhalsodata/B_HLV/dPsykhals/hlv1psybeko.px",
        "breakdown": "income",
        "age_id": "13",
        "categories": {"00": "total", "07": "q1", "08": "q2", "09": "q3", "10": "q4", "11": "q5"},
    },
    {
        "path": "A_Folkhalsodata/B_HLV/dPsykhals/hlv1psycfod.px",
        "breakdown": "birth_country",
        "age_id": "30",
        "categories": {"00": "total", "01": "sweden", "02": "other_nordic", "03": "other_europe", "04": "other_world"},
    },
]


def get_metadata(table_path):
    resp = requests.get(f"{BASE_URL}/{table_path}", timeout=60)
    resp.raise_for_status()
    return resp.json()


def num(val):
    """PxWeb's missing-value sentinel is the literal string '..'."""
    if val is None or val == "..":
        return None
    try:
        return float(str(val).replace(",", "."))
    except (ValueError, TypeError):
        return None


def fetch_table(meta, table_path, age_id, category_ids):
    var = meta["variables"]
    year_values = var[5]["values"]
    # Swedish label for each breakdown id, straight from the table's own
    # metadata — not hand-typed, so a future table-shape change surfaces as
    # a KeyError here rather than a silently wrong caption.
    labels = dict(zip(var[2]["values"], var[2]["valueTexts"]))
    query = {
        "query": [
            {"code": var[0]["code"], "selection": {"filter": "item", "values": [CATEGORY]}},
            {"code": var[1]["code"], "selection": {"filter": "item",
             "values": [MEASURE_SHARE, MEASURE_CI_LO, MEASURE_CI_HI, MEASURE_N]}},
            {"code": var[2]["code"], "selection": {"filter": "item", "values": list(category_ids)}},
            {"code": var[3]["code"], "selection": {"filter": "item", "values": [age_id]}},
            {"code": var[4]["code"], "selection": {"filter": "item", "values": list(SEX)}},
            {"code": var[5]["code"], "selection": {"filter": "item", "values": year_values}},
        ],
        "response": {"format": "json"},
    }
    resp = requests.post(f"{BASE_URL}/{table_path}", json=query, timeout=60)
    resp.raise_for_status()
    return resp.json(), labels


def to_records(raw, labels, breakdown, category_ids):
    """PxWeb cells (one number each) -> one record per category/sex/year,
    pairing the four 'Andel och konfidensintervall' rows back together."""
    groups = {}
    for cell in raw.get("data", []):
        _cat, measure, breakdown_id, _age, sex_id, year = cell["key"]
        val = num(cell["values"][0])
        sex = SEX.get(sex_id)
        our_key = category_ids.get(breakdown_id)
        if not sex or not our_key:
            continue
        key = (breakdown_id, sex, year)
        groups.setdefault(key, {})[measure] = val

    out = []
    for (breakdown_id, sex, year), vals in groups.items():
        share = vals.get(MEASURE_SHARE)
        if share is None:
            continue   # PxWeb's ".." — this cell genuinely was not published
        out.append({
            "indicator": "distress_pct",
            "breakdown": breakdown,
            "category": category_ids[breakdown_id],
            "category_label_sv": labels[breakdown_id],
            "sex": sex,
            "year": int(year),
            "value": share,
            "ci_lo": vals.get(MEASURE_CI_LO),
            "ci_hi": vals.get(MEASURE_CI_HI),
            "n": int(vals[MEASURE_N]) if vals.get(MEASURE_N) is not None else None,
        })
    return out


def main():
    print("[folkhalsodata-equity] national-grain distress, by education / income / birth country")
    all_records = []
    for t in TABLES:
        meta = get_metadata(t["path"])
        raw, labels = fetch_table(meta, t["path"], t["age_id"], t["categories"])
        with open(os.path.join(RAW_DIR, f"folkhalsodata_equity_{t['breakdown']}_raw.json"), "w", encoding="utf-8") as f:
            json.dump(raw, f, ensure_ascii=False, indent=1)
        records = to_records(raw, labels, t["breakdown"], t["categories"])
        years = sorted({r["year"] for r in records})
        print(f"[folkhalsodata-equity] {t['breakdown']}: {len(records)} records, "
              f"years {years[0]}..{years[-1]} ({len(years)} of them)" if records
              else f"[folkhalsodata-equity] {t['breakdown']}: 0 records — check age_id/categories against live metadata")
        all_records.extend(records)

    out_path = os.path.join(PROCESSED_DIR, "folkhalsodata_equity.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=1)
    print(f"[folkhalsodata-equity] wrote {out_path}  ({len(all_records)} records total)")
    print("[folkhalsodata-equity] now run:  python prototype/pipeline/build_kurvan_data.py")


if __name__ == "__main__":
    main()
