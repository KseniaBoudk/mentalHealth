# -*- coding: utf-8 -*-
"""Turn the fetched Socialstyrelsen panels into Kurvan's real-data cube(s).

Kurvan (kurvan.html) has no server and no build step of its own — it is a
handful of <script> tags. So instead of a JSON file fetched at runtime (which
CORS blocks when the prototype is opened straight off disk), this writes
plain JS files that each assign one constant, loaded the same way as every
other file in js/.

===============================================================================
ONE FILE PER SOURCE, NOT ONE js/real_mh_data.js — READ BEFORE "FIXING" THIS
===============================================================================
Used to write a single ../js/real_mh_data.js with all nine `const REAL_X`
blocks concatenated — simple, but a single blocking <script> that had grown
to 5.1MB (psych at one diagnosis group, antidepressants at one ATC code) and
was about to roughly quadruple once both split into real sub-types (see
pipeline/README.md's "why per-type series exist" section) — one indicator's
worth of JSON parse blocking the very first paint, for every indicator, on
every page load, regardless of which one anybody actually looks at first.

Each source now gets its OWN file under ../js/data/ instead. js/shell.js
loads them with dynamically-created <script> tags AFTER the first render
(not statically from kurvan.html — see js/shell.js's REAL_SOURCES/loadReal-
SourcesLazily()), each one's onload flipping just that indicator from
synthetic to real and re-rendering, rather than one multi-megabyte parse
gating the whole page. js/data.js's REAL_X blocks were changed from a
one-shot IIFE to a rebuildX() function callable again once its file lands,
to make this possible — see that file's own comment for why every reader
(cell(), total(), isRealActive(), ...) needed no changes at all to pick up
a value that arrives after the page has already painted.

Reads:  ../data/processed/socialstyrelsen_mh.json         (fetch_socialstyrelsen_mh.py)
        ../data/processed/socialstyrelsen_psych.json      (fetch_socialstyrelsen_psych.py)
        ../data/processed/socialstyrelsen_lakemedel.json  (fetch_socialstyrelsen_lakemedel.py)
        ../data/processed/vantetider_bup.json  (convert_vantetider_bup.py — MANUAL source,
                                                 see that script's own docstring)
        ../data/processed/hbsc.json             (fetch_hbsc.py)
        ../data/processed/scb_population.json   (fetch_scb_population.py)
Writes: ../js/data/real_mh.js, real_psych.js, real_hlv.js, real_lakemedel.js,
        real_fk.js, real_context.js, real_bup.js, real_hbsc.js, real_pop.js
        (REAL_MH, REAL_PSYCH_MH, REAL_LAKEMEDEL_MH, REAL_BUP_WAIT,
         REAL_HBSC_MH, REAL_POP_MH, ... — one const per file)

Run:  python prototype/pipeline/build_kurvan_data.py

Either processed file may be missing — each becomes an empty row list rather
than blocking the other. js/data.js checks each row count independently and
falls back to the labelled-synthetic generator per indicator, not per file:
run only fetch_socialstyrelsen_mh.py and self-harm/suicide go real while
psych stays synthetic, or vice versa.
"""
import json
import os
from datetime import datetime, timezone

HERE = os.path.dirname(__file__)
PROCESSED = os.path.join(HERE, "..", "data", "processed")
OUT_DIR = os.path.join(HERE, "..", "js", "data")

SOURCES = [
    {
        "var": "REAL_MH",
        "file": "socialstyrelsen_mh.json",
        "out": "real_mh.js",
        "source": "Socialstyrelsen Statistikdatabasen (Patientregistret + Dödsorsaksregistret)",
        "note": "Real, region-grain rates for self-harm hospitalisation and suicide.\n"
                "   Fetched by fetch_socialstyrelsen_mh.py.",
    },
    {
        "var": "REAL_PSYCH_MH",
        "file": "socialstyrelsen_psych.json",
        "out": "real_psych.js",
        "source": "Socialstyrelsen Statistikdatabasen (Patientregistret, diagnoserislutenoppenvard, F00-F99)",
        "note": "Real, region-grain rates for specialist psychiatric care, all nine of\n"
                "   Kurvan's age bands and all three sexes, annual, split into six\n"
                "   diagnosis-type series plus a synthesised \"all\" total. Fetched by\n"
                "   fetch_socialstyrelsen_psych.py.",
    },
    {
        "var": "REAL_HLV_MH",
        "file": "folkhalsodata_hlv.json",
        "out": "real_hlv.js",
        "source": "Folkhälsomyndigheten Folkhälsodata (Nationella folkhälsoenkäten / HLV, "
                  "\"Svår ängslan, oro eller ångest\")",
        "note": "Real, region-grain shares for self-reported severe anxiety/worry/dread,\n"
                "   all three sexes, no age breakdown (this table doesn't have one), ~4-year\n"
                "   survey windows. Fetched by fetch_folkhalsodata_hlv.py — read that\n"
                "   script's docstring before assuming any other HLV category behaves the\n"
                "   same way; several stopped being published years ago.",
    },
    {
        "var": "REAL_LAKEMEDEL_MH",
        "file": "socialstyrelsen_lakemedel.json",
        "out": "real_lakemedel.js",
        "source": "Socialstyrelsen Statistikdatabasen (Läkemedelsregistret, ATC N05/N06)",
        "note": "Real, region-grain rates for psychiatric medication dispensed, all nine\n"
                "   of Kurvan's age bands and all three sexes, annual, split into five\n"
                "   medication-class series (antidepressants, ADHD medication,\n"
                "   antipsychotics, anxiety medication, sleep medication) plus a\n"
                "   synthesised \"all\" total. Fetched by fetch_socialstyrelsen_lakemedel.py.\n"
                "   Was assumed to need a multi-gigabyte bulk download (the microdata\n"
                "   register does) — this is a separate, small aggregate table on the same\n"
                "   API as the other real Socialstyrelsen indicators here.",
    },
    {
        "var": "REAL_FK_MH",
        "file": "forsakringskassan_f43.json",
        "out": "real_fk.js",
        "source": "Försäkringskassan (share of ongoing sickness-benefit cases, diagnosis F43)",
        "note": "Real, county-grain share (%) of ongoing sickness-benefit cases with a\n"
                "   stress-reaction (F43) diagnosis, all three sexes, annual (averaged from\n"
                "   monthly), 2005 through the current year. No age breakdown. Fetched by\n"
                "   fetch_forsakringskassan.py.",
    },
    {
        "var": "REAL_CONTEXT_MH",
        "file": "kolada_context.json",
        "out": "real_context.js",
        "source": "Kolada (population density; share of residents 25-64 with low education)",
        "note": "Real, region-grain context indicators, not mental-health measures — one\n"
                "   demographic (population density), one socioeconomic (low-education share),\n"
                "   2023 only. Region figures are an UNWEIGHTED mean of that region's\n"
                "   municipalities, not population-weighted — a real simplification, not\n"
                "   hidden (see n_kommuner per row). Fetched by fetch_kolada_context.py.",
    },
    {
        "var": "REAL_BUP_WAIT",
        "file": "vantetider_bup.json",
        "out": "real_bup.js",
        "source": "Socialstyrelsen (väntetider barn- och ungdomspsykiatrin — BUP waiting times)",
        "note": "Real, region-grain MEDIAN DAYS waited for a completed first visit,\n"
                "   monthly, no age/sex breakdown, from a rolling ~12-month window (not\n"
                "   deep history). NOT fetched by a script — see\n"
                "   convert_vantetider_bup.py's docstring: this source has no API, and\n"
                "   the underlying CSV export needs a human to redo periodically to stay\n"
                "   current.",
    },
    {
        "var": "REAL_HBSC_MH",
        "file": "hbsc.json",
        "out": "real_hbsc.js",
        "source": "Folkhälsomyndigheten Folkhälsodata (Skolbarns hälsovanor / HBSC, \"Känt sig nere\")",
        "note": "Real, region-grain share (%) of 11/13/15-year-olds reporting feeling low\n"
                "   at least weekly, by sex. A SINGLE SNAPSHOT (one survey window,\n"
                "   2021-2022 as of writing) — not a trend. Own age keys (11/13/15), not\n"
                "   Kurvan's nine AGES bands. Fetched by fetch_hbsc.py.",
    },
    {
        "var": "REAL_POP_MH",
        "file": "scb_population.json",
        "out": "real_pop.js",
        "source": "SCB (Statistiska centralbyrån) Statistikdatabasen (BE0101A — BefolkningNy/BefolkningCKM)",
        "note": "Real, region-grain POPULATION (not a mental-health measure) by Kurvan's\n"
                "   nine age bands and both sexes, annual — the denominator behind real\n"
                "   age-standardisation for psych/antidep (js/data.js's standardRate()).\n"
                "   Fetched by fetch_scb_population.py.",
    },
]


def load(filename):
    path = os.path.join(PROCESSED, filename)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            rows = json.load(f)
        print(f"[build_kurvan_data] read {len(rows)} rows from {path}")
        return [strip_dead_fields(r) for r in rows]
    print(f"[build_kurvan_data] {path} not found — this source stays empty "
          f"(its indicator(s) fall back to the labelled-synthetic generator).")
    return []


# Fields some fetchers include (for their own debugging, or because the
# upstream/shared script that produced them carries it) that js/data.js
# never reads — grepped for `.region` across every js/*.js file that
# touches a real-data row before adding this, zero hits outside
# `S.region`/`RBY`/etc., which are unrelated (region lookups keyed off
# county_code, not this field). Dropped here, not at the fetch scripts,
# so data/processed/*.json stays the fuller, more debuggable shape and
# only the page-weight-sensitive compiled output under ../js/data/ (still
# pure page-weight even lazy-loaded, see module docstring above) shrinks.
# "region" is the county's full display name — already recoverable from
# county_code via REGIONS/RBY in js/data.js, so repeating it on every one
# of ~31,500 rows was pure duplication.
DEAD_ROW_FIELDS = {"region"}


def strip_dead_fields(row):
    return {k: v for k, v in row.items() if k not in DEAD_ROW_FIELDS}


def main():
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    os.makedirs(OUT_DIR, exist_ok=True)
    written = []
    for spec in SOURCES:
        rows = load(spec["file"])
        payload = {"generated_at": now, "source": spec["source"], "rows": rows}
        out_path = os.path.join(OUT_DIR, spec["out"])
        with open(out_path, "w", encoding="utf-8") as f:
            f.write('"use strict";\n\n')
            f.write("/* Generated by prototype/pipeline/build_kurvan_data.py. Do not hand-edit.\n")
            f.write(f"   One file per source (see this script's own module docstring for why) —\n")
            f.write(f"   this one is just {spec['var']}. Regenerate with:\n")
            f.write("     python prototype/pipeline/fetch_socialstyrelsen_mh.py\n")
            f.write("     python prototype/pipeline/fetch_socialstyrelsen_psych.py\n")
            f.write("     python prototype/pipeline/build_kurvan_data.py\n\n")
            f.write("   Empty `rows` means this source's fetcher has not been run on this\n")
            f.write("   machine yet — js/data.js falls back to the labelled-synthetic\n")
            f.write("   generator for that indicator only, rather than showing nothing or\n")
            f.write("   fabricating something under a \"real data\" label. */\n\n")
            f.write(f"/* {spec['note']} */\n")
            f.write(f"const {spec['var']} = ")
            # Compact, not indent=1: js/shell.js loads this with a
            # dynamically-created <script> tag as soon as the page has
            # painted (see the module docstring above), so its size is
            # still pure page-weight even split up — pretty-printing
            # thousands of rows added a quarter more bytes for zero
            # benefit, since nobody reads this file (the "Do not hand-edit"
            # note above is the whole point).
            f.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
            f.write(";\n")
        size = os.path.getsize(out_path)
        written.append((spec["out"], len(rows), size))
        print(f"[build_kurvan_data] wrote {out_path}  ({len(rows)} rows, {size:,} bytes)")

    total_bytes = sum(size for _, _, size in written)
    print(f"[build_kurvan_data] {len(written)} files, {total_bytes:,} bytes total")
    print("[build_kurvan_data] reopen kurvan.html to see the result.")


if __name__ == "__main__":
    main()
