# -*- coding: utf-8 -*-
"""Publish Kurvan's master data panel as CSV and JSON with an embedded data dictionary."""
import json, os, re, csv, glob

HERE = os.path.dirname(__file__)
# Pipeline moved from one js/real_mh_data.js to one file per source under
# js/data/ (see build_kurvan_data.py's module docstring). Read them all.
REAL_JS_GLOB = os.path.join(HERE, "..", "js", "data", "real_*.js")
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
    "generated_at": {"description": "When this source's js/data/real_*.js was compiled", "unit": "ISO datetime", "source": "build_kurvan_data.py", "years": "All", "suppression_rule": "None"},
    "fetched": {"description": "Date the underlying data was pulled/exported (manual sources carry the hand-export date)", "unit": "YYYY-MM-DD", "source": "Fetcher/converter", "years": "All", "suppression_rule": "None"},
    "valid_until": {"description": "Date past which a manual-export source may no longer be current (site greys the figure)", "unit": "YYYY-MM-DD", "source": "convert_vantetider_bup.py", "years": "Manual sources only", "suppression_rule": "None"},
    "series_status": {"description": "live | closed | snapshot — 'closed' series ended at end_year and are historical, not stale", "unit": "string", "source": "Fetcher", "years": "Varies", "suppression_rule": "None"},
    "end_year": {"description": "Final year of a closed series", "unit": "YYYY", "source": "Fetcher", "years": "closed series only", "suppression_rule": "None"}
}
# Row fields to pass straight through to the panel if present on a source row.
PASSTHROUGH = ["fetched", "valid_until", "series_status", "end_year"]

def load_county_names():
    names = {"00": "Sverige"}
    if os.path.exists(KOMMUNER_CSV):
        with open(KOMMUNER_CSV, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                code = r.get("code", "")[:2]
                reg = r.get("region", "")
                if code and reg: names.setdefault(code, reg)
    return names

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    county_names = load_county_names()

    files = sorted(glob.glob(REAL_JS_GLOB))
    if not files:
        print(f"Error: no files match {REAL_JS_GLOB}. Run build_kurvan_data.py first.")
        return

    all_rows = []
    for path in files:
        with open(path, encoding="utf-8") as f:
            content = f.read()
        m = re.search(r'const\s+(\w+)\s*=\s*', content)
        if not m:
            continue
        var_name = m.group(1)
        try:
            payload = json.loads(content[m.end():].rstrip().rstrip(";").strip())
        except Exception as e:
            print(f"Error parsing {os.path.basename(path)} ({var_name}): {e}")
            continue

        gen = payload.get("generated_at")
        rows = payload.get("rows", [])
        # Two row shapes: plain objects, or the compact tuples used by
        # real_mh.js / real_psych.js / real_lakemedel.js (see
        # build_kurvan_data.py). Decode the tuples back with the payload's
        # own "types"/"ages"/"indicators" side tables.
        types = payload.get("types"); ages = payload.get("ages"); inds = payload.get("indicators")
        for r in rows:
            if isinstance(r, dict):
                d = r
            elif inds is not None:            # encode_mh_rows(): [cc, ind_idx, midyr, age_idx, sex, value, count, suppressed]
                d = {"county_code": r[0], "indicator": inds[r[1]], "year": r[2],
                     "age_group": ages[r[3]], "sex": r[4], "value": r[5],
                     "count": r[6], "suppressed": r[7] if len(r) > 7 else False}
            elif types is not None:           # encode_type_age_rows(): [cc, type_idx, year, age_idx, sex, value, count]
                d = {"county_code": r[0], "indicator": types[r[1]], "year": r[2],
                     "age_group": ages[r[3]], "sex": r[4], "value": r[5], "count": r[6]}
            else:
                continue
            code = d.get("county_code", "00")
            row = {
                "indicator": d.get("indicator"),
                "county_code": code,
                "county_name": county_names.get(code, "Sverige"),
                "year": d.get("year"),
                "window": d.get("window"),
                "month": d.get("month"),
                "age_group": d.get("age_group"),
                "sex": d.get("sex"),
                "value": d.get("value"),
                "count": d.get("count"),
                "suppressed": d.get("suppressed", False),
                "generated_at": gen,
            }
            for k in PASSTHROUGH:
                if d.get(k) is not None:
                    row[k] = d[k]
            all_rows.append(row)

    json_path = os.path.join(OUT_DIR, "kurvan_panel.json")
    csv_path = os.path.join(OUT_DIR, "kurvan_panel.csv")
    
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"dataset": "Kurvan Swedish Mental Health Panel", "dictionary": DATA_DICTIONARY, "rows": all_rows}, f, ensure_ascii=False, indent=2)
    print(f"Wrote JSON panel: {json_path} ({len(all_rows)} rows)")
    
    fieldnames = ["indicator", "county_code", "county_name", "year", "window", "month", "age_group", "sex", "value", "count", "suppressed", "generated_at", "fetched", "valid_until", "series_status", "end_year"]
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in all_rows:
            writer.writerow({k: r.get(k) if r.get(k) is not None else "" for k in fieldnames})
    print(f"Wrote CSV panel: {csv_path}")

if __name__ == "__main__":
    main()
