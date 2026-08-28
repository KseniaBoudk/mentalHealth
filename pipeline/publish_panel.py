# -*- coding: utf-8 -*-
"""Publish Kurvan's master data panel as CSV and JSON with an embedded data dictionary.

Reads straight from ../data/processed/*.json — the per-source files each
fetch_*.py script already writes — rather than from any of the ../js/data/*.js
files build_kurvan_data.py generates from them. This used to point at a single
../js/real_mh_data.js, but that file was deleted in commit dc882d0 when the
pipeline moved to one JS file per source (see build_kurvan_data.py's own
docstring), which silently broke this script: REAL_JS_PATH pointed at nothing,
so main() printed an error and wrote no panel at all. Going one step further
upstream, to data/processed/, sidesteps that split for good (a future JS-side
reshuffle can't break this again) and also sidesteps real_psych.js/
real_lakemedel.js's compact-tuple-row encoding (see build_kurvan_data.py) —
data/processed/*.json is always plain objects-per-row, for every source.

collect_rows() is imported directly by verify_panel.py so that script's
"recompute from source" check reuses this exact mapping rather than
re-implementing it a second time and silently drifting from it.
"""
import json, os, csv

HERE = os.path.dirname(__file__)
PROCESSED_DIR = os.path.join(HERE, "..", "data", "processed")
OUT_DIR = os.path.join(HERE, "..", "data", "published")
KOMMUNER_CSV = os.path.join(HERE, "kommuner.csv")

DATA_DICTIONARY = {
    "indicator": {"description": "Indicator key", "unit": "string", "source": "Various authorities", "years": "1997+", "suppression_rule": "Indicator-specific"},
    "county_code": {"description": "Two-digit region code (00=National, 01-25=County)", "unit": "code", "source": "SCB", "years": "All", "suppression_rule": "None"},
    "county_name": {"description": "County display name", "unit": "string", "source": "SCB", "years": "All", "suppression_rule": "None"},
    "year": {"description": "Calendar or midpoint year", "unit": "YYYY", "source": "Registers", "years": "1997+", "suppression_rule": "None"},
    "window": {"description": "Rolling multi-year window", "unit": "YYYY-YYYY", "source": "Socialstyrelsen", "years": "1997+", "suppression_rule": "None"},
    "month": {"description": "Calendar month for monthly data", "unit": "1-12", "source": "Socialstyrelsen", "years": "2025+", "suppression_rule": "None"},
    "age_group": {"description": "Age band", "unit": "string", "source": "Registers", "years": "Varies", "suppression_rule": "None"},
    "sex": {"description": "Sex (T=Total, M=Men, K=Women)", "unit": "char", "source": "Registers", "years": "All", "suppression_rule": "None"},
    "value": {"description": "Statistical value (rate/share/days/density)", "unit": "Various", "source": "Government open data", "years": "Varies", "suppression_rule": "Withheld if count < 10"},
    "count": {"description": "Absolute case count where published", "unit": "integer", "source": "Registers", "years": "Varies", "suppression_rule": "null if < 10"},
    "suppressed": {"description": "Disclosure suppression flag", "unit": "boolean", "source": "Socialstyrelsen", "years": "All", "suppression_rule": "true if suppressed"},
    "fetched": {"description": "Date the underlying data was pulled/exported (manual sources carry the hand-export date)", "unit": "YYYY-MM-DD", "source": "Fetcher/converter", "years": "Where the source carries it", "suppression_rule": "None"},
    "valid_until": {"description": "Date past which a manual-export source may no longer be current (the site greys the figure then)", "unit": "YYYY-MM-DD", "source": "convert_vantetider_bup.py", "years": "Manual sources only", "suppression_rule": "None"},
    "series_status": {"description": "live | closed | snapshot — a 'closed' series ended at end_year and is historical, not stale", "unit": "string", "source": "Fetcher", "years": "Where the source carries it", "suppression_rule": "None"},
    "end_year": {"description": "Final year of a closed series", "unit": "YYYY", "source": "Fetcher", "years": "closed series only", "suppression_rule": "None"}
}

def load_county_names():
    names = {"00": "Sverige"}
    if os.path.exists(KOMMUNER_CSV):
        with open(KOMMUNER_CSV, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                code = r.get("code", "")[:2]
                reg = r.get("region", "")
                if code and reg: names.setdefault(code, reg)
    return names

def mk_row(indicator=None, county_code="00", year=None, window=None, month=None,
           age_group=None, sex=None, value=None, count=None, suppressed=False,
           fetched=None, valid_until=None, series_status=None, end_year=None):
    return {"indicator": indicator, "county_code": county_code, "year": year,
            "window": window, "month": month, "age_group": age_group, "sex": sex,
            "value": value, "count": count, "suppressed": suppressed,
            "fetched": fetched, "valid_until": valid_until,
            "series_status": series_status, "end_year": end_year}

def _prov(r):
    """Row-level provenance some sources carry (see COLLABORATION.md) — passed
    straight through to the panel so the export states its own age."""
    return dict(fetched=r.get("fetched"), valid_until=r.get("valid_until"),
                series_status=r.get("series_status"), end_year=r.get("end_year"))

def _load(filename):
    path = os.path.join(PROCESSED_DIR, filename)
    if not os.path.exists(path):
        print(f"Note: {filename} not found, skipping that source.")
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)

# --- one mapper per data/processed/*.json source -----------------------------
# Each returns rows already shaped for the shared output schema above. Field
# names genuinely differ per source (fetch script/authority), so this stays
# one small function per source rather than one generic config-driven mapper.

def map_mh_rows(filename="socialstyrelsen_mh.json"):
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    year=r.get("midpoint_year"), window=r.get("window"),
                    age_group=r.get("age_group"), sex=r.get("sex"), value=r.get("value"),
                    count=r.get("count"), suppressed=r.get("suppressed", False))
            for r in _load(filename)]

def map_psych_rows(filename="socialstyrelsen_psych.json"):
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    year=r.get("year"), age_group=r.get("age_group"), sex=r.get("sex"),
                    value=r.get("value"), count=r.get("count"))
            for r in _load(filename)]

def map_lakemedel_rows(filename="socialstyrelsen_lakemedel.json"):
    return map_psych_rows(filename)  # identical shape (region, county_code, indicator, year, age_group, sex, value, count)

def map_vantetider_rows(filename="vantetider_bup.json"):
    # convert_vantetider_bup.py now also tags rows with care_area/phase (folded
    # into `indicator` already) and carries fetched/valid_until — a MANUAL
    # source, see COLLABORATION.md's freshness section.
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    year=r.get("year"), month=r.get("month"), sex=r.get("sex"),
                    value=r.get("value"), **_prov(r))
            for r in _load(filename)]

def map_hbsc_rows(filename="hbsc.json"):
    # hbsc.json's own "year" is a 2-year survey window string ("2021-2022"),
    # not a calendar year — put it in the output's "window" field instead,
    # consistent with how mh/hlv represent windows, and leave "year" empty so
    # verify_panel.py's int-sortable time key isn't handed a string.
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    window=r.get("year"), age_group=r.get("age_group"), sex=r.get("sex"),
                    value=r.get("value"))
            for r in _load(filename)]

def map_f43_rows(filename="forsakringskassan_f43.json"):
    # "months" (how many of the year's 12 months are published so far, i.e.
    # the partial-year flag surfaced elsewhere by t.partialTag) has no home
    # in the current schema and is dropped here.
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    year=r.get("year"), sex=r.get("sex"), value=r.get("value"),
                    count=r.get("count"))
            for r in _load(filename)]

def map_kolada_rows(filename="kolada_context.json"):
    # No "sex" field in this source at all — default to "T" (total), matching
    # the existing "no split published -> total" convention used elsewhere.
    # "n_kommuner" (how many municipalities the mean was over) has no schema
    # home and is dropped here.
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    year=r.get("year"), sex="T", value=r.get("value"))
            for r in _load(filename)]

def map_hlv_rows(filename="folkhalsodata_hlv.json"):
    # "n" is a survey sample size, not an event count, but it's the closest
    # analog to "count" this source has -- a judgment call. ci_lo/ci_hi are
    # outside the current schema and dropped to keep this fix schema-neutral.
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    year=r.get("midpoint_year"), window=r.get("window"), sex=r.get("sex"),
                    value=r.get("value"), count=r.get("n"))
            for r in _load(filename)]

def map_hlv_psych_rows(filename="folkhalsodata_hlv_psych.json"):
    # Five more HLV categories at region grain (see fetch_folkhalsodata_hlv_psych.py):
    # same window/midpoint shape as map_hlv_rows, plus series_status/end_year
    # (low_wellbeing_pct is a CLOSED series ending 2018) and `fetched`.
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    year=r.get("midpoint_year"), window=r.get("window"), sex=r.get("sex"),
                    value=r.get("value"), count=r.get("n"), **_prov(r))
            for r in _load(filename)]

def map_hlv_psych_age_rows(filename="folkhalsodata_hlv_psych_age.json"):
    # National-only, annual, coarse own age bands (incl. loneliness, 2024 only).
    return [mk_row(indicator=r.get("indicator"), county_code="00",
                    year=r.get("year"), age_group=r.get("age_label"), sex=r.get("sex"),
                    value=r.get("value"), count=r.get("n"), **_prov(r))
            for r in _load(filename)]

def map_fk_diagnos_rows(filename="forsakringskassan_diagnos.json"):
    # Whole F00-F99 chapter (+ all-diagnoses total), same shape as map_f43_rows.
    # `months` (partial-year flag) has no schema home and is dropped.
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    year=r.get("year"), sex=r.get("sex"), value=r.get("value"),
                    count=r.get("count"))
            for r in _load(filename)]

def map_fk_ae_rows(filename="forsakringskassan_aktivitetsersattning.json"):
    # Aktivitetsersättning: `recipients` is the headline number (-> value AND
    # count); `share_pct` and `belopp_1000kr` have no schema home and are
    # dropped. `snapshot_month` -> month.
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    year=r.get("year"), month=r.get("snapshot_month"), sex=r.get("sex"),
                    value=r.get("recipients"), count=r.get("recipients"))
            for r in _load(filename)]

def map_vardenisiffror_rows(filename="vardenisiffror_psykiatri.json"):
    # "Psykiatrin i siffror" via Vården i siffror. `measure` is the human name;
    # ci_lo/ci_hi/numerator/denominator have no schema home and are dropped
    # (same schema-neutral choice as map_hlv_rows).
    return [mk_row(indicator=r.get("measure"), county_code=r.get("county_code", "00"),
                    year=r.get("year"), value=r.get("value"), **_prov(r))
            for r in _load(filename)]

def map_personal_rows(filename="socialstyrelsen_personal.json"):
    # Licensed psychiatry staff headcount (scraped, see fetch_socialstyrelsen_personal.py).
    # `headcount` -> value AND count; `profession_label` is the human name.
    return [mk_row(indicator=r.get("profession_label"), county_code=r.get("county_code", "00"),
                    year=r.get("year"), sex=r.get("sex"),
                    value=r.get("headcount"), count=r.get("headcount"), **_prov(r))
            for r in _load(filename)]

def map_population_rows(filename="scb_population.json"):
    # Not a mental-health indicator -- it's the age-standardisation
    # denominator (see CLAUDE.md). Written but deliberately NOT registered in
    # SOURCES below, so it stays out of the published panel by default; flip
    # it on by adding it to SOURCES if population coverage is ever wanted here.
    return [mk_row(indicator=r.get("indicator"), county_code=r.get("county_code", "00"),
                    year=r.get("year"), age_group=r.get("age_group"), sex=r.get("sex"),
                    value=r.get("value"))
            for r in _load(filename)]

# bup_facilities.json is a facility roster (hsa_id/name/address/lat/lon/...),
# not indicator/value/year rows -- it doesn't fit this panel's row shape at
# all, so it has no mapper and is excluded entirely.

SOURCES = [
    map_mh_rows,
    map_psych_rows,
    map_lakemedel_rows,
    map_vantetider_rows,
    map_hbsc_rows,
    map_f43_rows,
    map_kolada_rows,
    map_hlv_rows,
    map_hlv_psych_rows,
    map_hlv_psych_age_rows,
    map_fk_diagnos_rows,
    map_fk_ae_rows,
    map_vardenisiffror_rows,
    map_personal_rows,
]

def collect_rows():
    county_names = load_county_names()
    rows = []
    for mapper in SOURCES:
        for r in mapper():
            code = r["county_code"]
            r["county_name"] = county_names.get(code, "Sverige")
            rows.append(r)
    return rows

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    all_rows = collect_rows()

    json_path = os.path.join(OUT_DIR, "kurvan_panel.json")
    csv_path = os.path.join(OUT_DIR, "kurvan_panel.csv")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"dataset": "Kurvan Swedish Mental Health Panel", "dictionary": DATA_DICTIONARY, "rows": all_rows}, f, ensure_ascii=False, indent=2)
    print(f"Wrote JSON panel: {json_path} ({len(all_rows)} rows)")

    fieldnames = ["indicator", "county_code", "county_name", "year", "window", "month", "age_group", "sex", "value", "count", "suppressed", "fetched", "valid_until", "series_status", "end_year"]
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in all_rows:
            writer.writerow({k: r.get(k) if r.get(k) is not None else "" for k in fieldnames})
    print(f"Wrote CSV panel: {csv_path}")

if __name__ == "__main__":
    main()
