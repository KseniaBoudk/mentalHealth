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
        ../data/processed/folkhalsodata_equity.json  (fetch_folkhalsodata_equity.py)
        ../data/processed/vantetider_bup.json  (convert_vantetider_bup.py — MANUAL source,
                                                 see that script's own docstring)
        ../data/processed/hbsc.json             (fetch_hbsc.py)
        ../data/processed/scb_population.json   (fetch_scb_population.py)
        ../data/processed/bup_facilities.json   (../BUPS/fetch_bup_facilities.py)
Writes: ../js/data/real_mh.js, real_psych.js, real_psych_codes.js,
        real_hlv.js, real_equity.js, real_lakemedel.js, real_fk.js,
        real_context.js, real_bup.js, real_hbsc.js, real_pop.js,
        real_bup_facilities.js
        (REAL_MH, REAL_PSYCH_MH, REAL_PSYCH_CODES, REAL_LAKEMEDEL_MH,
         REAL_EQUITY_MH, REAL_BUP_WAIT, REAL_HBSC_MH, REAL_POP_MH, ...
         — one const per file)

Run:  python prototype/pipeline/build_kurvan_data.py

Either processed file may be missing. A source whose processed JSON is gone
but whose js/data/real_X.js is ALREADY committed is left untouched — a
partial run (fetch + rebuild just one source) no longer reverts every other
committed real file to an empty synthetic stub, which used to be this
pipeline's sharpest edge. A genuine fresh clone (no compiled file yet) still
gets an empty stub. To deliberately push a source back to synthetic, delete
its js/data/real_X.js and rebuild. js/data.js checks each row count
independently and falls back to the labelled-synthetic generator per
indicator, not per file: run only fetch_socialstyrelsen_mh.py and
self-harm/suicide go real while psych stays synthetic, or vice versa.

===============================================================================
COMPACT TUPLE ROWS FOR REAL_PSYCH_MH/REAL_LAKEMEDEL_MH — READ BEFORE "FIXING"
===============================================================================
These are the two sources with a real diagnosis/medication-type split (78
ICD-10 codes, five ATC classes — see fetch_socialstyrelsen_psych.py/
fetch_socialstyrelsen_lakemedel.py's own docstrings), and it shows: at one
row per region/age-band/sex/year/type, the plain-object-per-row shape every
other source here still uses put them at 8.6MB/7.8MB even at psych's old
six-group granularity — repeating seven full key names, and a long
spelled-out `indicator` string like "psych_substance_use_per_100k", on
every single one of ~66,000 rows apiece. Now more rows still (78 groups,
not 6), so this compaction matters more than ever, not less.

encode_type_age_rows() rewrites just these two sources' rows into
`[county_code, type_idx, year, age_idx, sex, value, count]` tuples, with
`type_idx`/`age_idx` pointing into two small dictionaries (`"types"`,
`"ages"`) added to the payload alongside `"rows"` — built FROM the data
itself (distinct `indicator`/`age_group` values seen), not copy-pasted from
PSYCH_TYPES/MED_TYPES/AGES in js/data.js, so the file stays self-describing
rather than silently depending on two lists in different languages staying
in the same order forever. `rebuildREAL_PSYCH()`/`rebuildREAL_ANTIDEP()`
(js/data.js) decode a row by indexing into those two arrays; everything
downstream of that (the idx/idxAll construction) is unchanged — this is a
read-format change, not a data or logic change. Cuts both files roughly 4x.
Every other source here is already small (under 1MB) and stays plain
objects — not worth the same churn.
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
        "compact_mh": True,   # see encode_mh_rows()'s own docstring for why
    },
    {
        "var": "REAL_PSYCH_MH",
        "file": "socialstyrelsen_psych.json",
        "out": "real_psych.js",
        "source": "Socialstyrelsen Statistikdatabasen (Patientregistret, diagnoserislutenoppenvard, F00-F99)",
        "note": "Real, region-grain rates for specialist psychiatric care, all nine of\n"
                "   Kurvan's age bands and all three sexes, annual. ONLY the F00-F99\n"
                "   chapter here (diagnos=05 -> js/data.js reads it straight as \"all\").\n"
                "   The 78 individual 3-character codes are a SEPARATE file\n"
                "   (real_psych_codes.js, below) that js/data.js loads on demand.\n"
                "   Fetched by fetch_socialstyrelsen_psych.py. Compact tuples — see\n"
                "   this module's docstring (\"COMPACT TUPLE ROWS\").",
        # indicator "psych_05_per_100k" -> type key "05" (js/data.js maps
        # that to "all"). Same prefix/suffix as the codes file below.
        "compact_types": {"prefix": "psych_", "suffix": "_per_100k"},
    },
    {
        "var": "REAL_PSYCH_CODES",
        "file": "socialstyrelsen_psych_codes.json",
        "out": "real_psych_codes.js",
        "source": "Socialstyrelsen Statistikdatabasen (Patientregistret, diagnoserislutenoppenvard, 3-char F-codes)",
        "note": "The 78 individual 3-character ICD-10 code series for specialist\n"
                "   psychiatric care (F32, F41, F43, ...), grouped under their 11 real\n"
                "   blocks in the UI (js/lang.js's psychBlocks / js/data.js's\n"
                "   PSYCH_CODE_BLOCK). ~14 MB, so js/shell.js's loadPsychCodes() pulls\n"
                "   this ON DEMAND — only when the type picker is in play — rather than\n"
                "   in the eager lazy batch. Same compact-tuple shape as real_psych.js.",
        # indicator strings look like "psych_F32_per_100k" — strip this
        # prefix/suffix to recover the code ("F32") that becomes an idx[type]
        # key in js/data.js.
        "compact_types": {"prefix": "psych_", "suffix": "_per_100k"},
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
        "var": "REAL_EQUITY_MH",
        "file": "folkhalsodata_equity.json",
        "out": "real_equity.js",
        "source": "Folkhälsomyndigheten Folkhälsodata (Nationella folkhälsoenkäten / HLV, "
                  "\"Svår ängslan, oro eller ångest\" — by education, income, birth country)",
        "note": "Real, NATIONAL-grain (no region breakdown on these tables) shares for the\n"
                "   same self-reported severe anxiety/worry/dread question as REAL_HLV_MH,\n"
                "   split instead by education level, income quintile, or country of birth.\n"
                "   Real data only for 2021/2022/2024 (see fetch_folkhalsodata_equity.py's\n"
                "   docstring — this category's coverage on these three tables is sparser\n"
                "   than on the region table). Fetched by fetch_folkhalsodata_equity.py.",
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
                "   API as the other real Socialstyrelsen indicators here. Rows are compact\n"
                "   tuples, not objects — see this module's own docstring (\"COMPACT TUPLE\n"
                "   ROWS\").",
        # indicator strings look like "antidepressants_per_1000" — strip
        # this suffix to recover the short type name ("antidepressants")
        # that becomes an idx[type] key in js/data.js.
        "compact_types": {"prefix": "", "suffix": "_per_1000"},
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
        "var": "REAL_HLV_PSYCH",
        "file": "folkhalsodata_hlv_psych.json",
        "out": "real_hlv_psych.js",
        "source": "Folkhälsomyndigheten Folkhälsodata (HLV, hlv1psyxreg.px — suicidal "
                  "thoughts / attempts, low wellbeing, sleep problems)",
        "note": "Real, region-grain shares for five MORE self-reported HLV categories\n"
                "   beyond the `distress` one real_hlv.js already carries — suicidal\n"
                "   thoughts, suicide attempts, low psychological wellbeing, and sleep\n"
                "   problems (broad / mild / severe). All three sexes, no age breakdown,\n"
                "   ~4-year pooled survey windows. `low_wellbeing_pct` was last published\n"
                "   in the 2015-2018 window (kept regardless — see the fetcher's docstring).\n"
                "   Fetched by fetch_folkhalsodata_hlv_psych.py. NOT read by js/data.js\n"
                "   yet — on disk, not shown.",
    },
    {
        "var": "REAL_HLV_PSYCH_AGE",
        "file": "folkhalsodata_hlv_psych_age.json",
        "out": "real_hlv_psych_age.js",
        "source": "Folkhälsomyndigheten Folkhälsodata (HLV, hlv1psyaald.px — national, "
                  "annual, coarse age bands)",
        "note": "Real, NATIONAL-grain (no region dimension) ANNUAL series for the same\n"
                "   HLV categories as REAL_HLV_PSYCH plus loneliness (68/69) — the only\n"
                "   table that publishes loneliness, and only for 2024 so far. Coarse own\n"
                "   age bands (16-29, 30-44, 45-64, 65-84, 85-, plus totals), all three\n"
                "   sexes. Fetched by fetch_folkhalsodata_hlv_psych.py. NOT read by\n"
                "   js/data.js yet — on disk, not shown.",
    },
    {
        "var": "REAL_FK_DIAGNOS",
        "file": "forsakringskassan_diagnos.json",
        "out": "real_fk_diagnos.js",
        "source": "Försäkringskassan (ongoing sickness-benefit cases by ICD-10 chapter, "
                  "sjp-pagaende-sjukfall-diagnos)",
        "note": "Real, county-grain share (%) and count of ongoing sickness-benefit cases\n"
                "   in the whole psychiatric chapter F00-F99 (not only F43 as real_fk.js),\n"
                "   plus the all-diagnoses total it's a share of. All three sexes, annual\n"
                "   (averaged from monthly), 2005 through the current year, no age\n"
                "   breakdown. Fetched by fetch_forsakringskassan_diagnos.py. NOT read by\n"
                "   js/data.js yet — on disk, not shown.",
    },
    {
        "var": "REAL_FK_AE",
        "file": "forsakringskassan_aktivitetsersattning.json",
        "out": "real_fk_ae.js",
        "source": "Försäkringskassan (aktivitetsersättning recipients by ICD-10 chapter, "
                  "sa-bestand-diagnos)",
        "note": "Real, county-grain aktivitetsersättning (disability benefit, ages 19-29)\n"
                "   December-snapshot recipient counts, F00-F99 share, and monthly belopp\n"
                "   (1000s SEK), split all-diagnoses vs psychiatric. All three sexes,\n"
                "   annual, 2003 through the current year. Fetched by\n"
                "   fetch_forsakringskassan_aktivitetsersattning.py. NOT read by js/data.js\n"
                "   yet — on disk, not shown.",
    },
    {
        "var": "REAL_VIS_PSYKIATRI",
        "file": "vardenisiffror_psykiatri.json",
        "out": "real_vis_psykiatri.js",
        "source": "Vården i siffror (vardenisiffror.se) — information source \"Psykiatrin i siffror\"",
        "note": "Real, region-grain ANNUAL psychiatry activity/capacity figures surfaced\n"
                "   from SKR's \"Psykiatrin i siffror\" via Vården i siffror's public JSON\n"
                "   API (the SKR reports themselves are PDF-only): outpatient visits per\n"
                "   capita, share of residents seen, inpatient beds per capita and\n"
                "   occupancy, mean length of stay, LPT (compulsory-care) share, and\n"
                "   agency-staff cost ratio — adult and child/adolescent psychiatry.\n"
                "   Does NOT include absolute staff headcount or absolute cost per region\n"
                "   (still PDF-only). Fetched by fetch_vardenisiffror_psykiatri.py. NOT\n"
                "   read by js/data.js yet — on disk, not shown.",
    },
    {
        "var": "REAL_PERSONAL",
        "file": "socialstyrelsen_personal.json",
        "out": "real_personal.js",
        "source": "Socialstyrelsen (sdb.socialstyrelsen.se/if_per — legitimerad, sysselsatt "
                  "hälso- och sjukvårdspersonal)",
        "note": "Real, county-grain HEADCOUNT of employed licensed staff by psychiatry-\n"
                "   relevant profession (psychologist, psychotherapist, counsellor,\n"
                "   psychiatrist, child/adolescent psychiatrist, psychiatric specialist\n"
                "   nurse) and year, summed across the source's ten 5-year age bands (it\n"
                "   has no all-ages row). Scraped, not an API — see\n"
                "   fetch_socialstyrelsen_personal.py's docstring for the legacy-form\n"
                "   recipe and the single-value-only constraint. NOT read by js/data.js\n"
                "   yet — on disk, not shown.",
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
    {
        "var": "REAL_BUP_FACILITIES",
        "file": "bup_facilities.json",
        "out": "real_bup_facilities.js",
        "source": "1177.se Hitta vård API (/api/hjv/search), caretype=Psykiatri, barn och ungdom",
        "note": "Real, FACILITY-grain (not region-grain like everything else here) list of\n"
                "   every BUP clinic 1177.se lists — name, address, phone, coordinates,\n"
                "   county code. Backs the clinic-count stat and clinic directory on the\n"
                "   Väntetider (BUP) tab (js/data.js's rebuildBUP_FACILITIES()). Not an\n"
                "   IND indicator — same deliberately-outside-IND shape as CONTEXT/BUP_WAIT/\n"
                "   HBSC. Fetched by ../BUPS/fetch_bup_facilities.py (that folder's own\n"
                "   README explains the full standalone deliverable this is one output of).",
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


def encode_type_age_rows(rows, prefix, suffix):
    """Rewrite object rows into compact [county_code, type_idx, year,
    age_idx, sex, value, count] tuples for REAL_PSYCH_MH/REAL_LAKEMEDEL_MH —
    see this module's own "COMPACT TUPLE ROWS" docstring section for why.
    Returns (tuple_rows, types, ages); types/ages are built from the data
    itself, not any hardcoded list, so the output stays self-describing.
    """
    def short_type(indicator):
        s = indicator
        if prefix and s.startswith(prefix):
            s = s[len(prefix):]
        if suffix and s.endswith(suffix):
            s = s[:-len(suffix)]
        return s

    types = sorted({short_type(r["indicator"]) for r in rows})
    type_idx = {t: i for i, t in enumerate(types)}
    ages = sorted({r["age_group"] for r in rows})
    age_idx = {a: i for i, a in enumerate(ages)}
    tuple_rows = [
        [r["county_code"], type_idx[short_type(r["indicator"])], r["year"],
         age_idx[r["age_group"]], r["sex"], r["value"], r["count"]]
        for r in rows
    ]
    return tuple_rows, types, ages


def encode_mh_rows(rows):
    """Rewrite REAL_MH's (self-harm/suicide) object rows into compact
    [county_code, indicator_idx, midpoint_year, age_idx, sex, value, count,
    suppressed] tuples — same "why" as encode_type_age_rows() above
    (COMPACT TUPLE ROWS docstring section), a separate function because
    this source's own fields don't fit that one's fixed shape: `year` there
    vs `midpoint_year` here, and two fields that one never sees at all —
    `suppressed` (a real per-row disclosure flag, must survive) and
    `window` (a string like "2008-2012", which does NOT need to survive:
    verified against every row in data/processed/socialstyrelsen_mh.json
    that window == f"{midpoint_year-2}-{midpoint_year+2}" with zero
    exceptions, so js/data.js's rebuildREAL() reconstructs it instead of
    storing it a second time).

    This source went from "already small, not worth the churn" (this
    module's own COMPACT TUPLE ROWS docstring section, written when this
    was true) to the single largest file in js/data/ — 5.47MB, bigger than
    real_psych.js despite half the row count — once suicide's real age
    coverage widened from one band to all nine (fetch_socialstyrelsen_mh.py,
    "KURVAN CHANGE 2"), roughly 9x-ing this source's row count. Worth the
    same treatment now for the same reason psych/lakemedel got it.

    Returns (tuple_rows, indicators, ages); both built from the data
    itself, not hardcoded, same self-describing convention as
    encode_type_age_rows().
    """
    indicators = sorted({r["indicator"] for r in rows})
    ind_idx = {s: i for i, s in enumerate(indicators)}
    ages = sorted({r["age_group"] for r in rows})
    age_idx = {a: i for i, a in enumerate(ages)}
    tuple_rows = [
        [r["county_code"], ind_idx[r["indicator"]], r["midpoint_year"],
         age_idx[r["age_group"]], r["sex"], r["value"], r["count"], r["suppressed"]]
        for r in rows
    ]
    return tuple_rows, indicators, ages


def main():
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    os.makedirs(OUT_DIR, exist_ok=True)
    written = []
    kept = []
    for spec in SOURCES:
        in_path = os.path.join(PROCESSED, spec["file"])
        out_path = os.path.join(OUT_DIR, spec["out"])
        # Processed input gone, but a compiled js/data/real_X.js is already
        # committed: leave it exactly as-is. Rewriting it as an empty stub
        # here (the old behaviour) silently reverted committed real data to
        # synthetic on any PARTIAL run — the pipeline's sharpest edge, since
        # data/processed/ is gitignored and git couldn't warn you it was
        # incomplete. A fresh clone (no compiled file yet) still gets a stub
        # below. To deliberately force a source back to synthetic, delete
        # its js/data/real_X.js and rebuild.
        if not os.path.exists(in_path) and os.path.exists(out_path):
            print(f"[build_kurvan_data] {spec['file']} not found — KEPT existing "
                  f"{spec['out']} untouched (delete that file to force a synthetic stub).")
            kept.append(spec["out"])
            continue
        rows = load(spec["file"])
        compact = spec.get("compact_types")
        if compact and rows:
            rows, types, ages = encode_type_age_rows(rows, compact["prefix"], compact["suffix"])
            payload = {"generated_at": now, "source": spec["source"], "types": types, "ages": ages, "rows": rows}
        elif spec.get("compact_mh") and rows:
            rows, indicators, ages = encode_mh_rows(rows)
            payload = {"generated_at": now, "source": spec["source"], "indicators": indicators, "ages": ages, "rows": rows}
        else:
            payload = {"generated_at": now, "source": spec["source"], "rows": rows}
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
    print(f"[build_kurvan_data] {len(written)} files written, {total_bytes:,} bytes total")
    if kept:
        print(f"[build_kurvan_data] {len(kept)} file(s) KEPT as committed (no fresh input): "
              + ", ".join(kept))
    print("[build_kurvan_data] reopen kurvan.html to see the result.")


if __name__ == "__main__":
    main()
