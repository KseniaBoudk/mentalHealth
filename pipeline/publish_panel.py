# -*- coding: utf-8 -*-
"""Publish Kurvan's master data panel as CSV and JSON with an embedded data dictionary."""
import json, os, re, csv

HERE = os.path.dirname(__file__)
REAL_JS_PATH = os.path.join(HERE, "..", "js", "real_mh_data.js")
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
    "suppressed": {"description": "Disclosure suppression flag", "unit": "boolean", "source": "Socialstyrelsen", "years": "All", "suppression_rule": "true if suppressed"}
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

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    county_names = load_county_names()
    
    if not os.path.exists(REAL_JS_PATH):
        print(f"Error: {REAL_JS_PATH} not found.")
        return
        
    with open(REAL_JS_PATH, encoding="utf-8") as f:
        content = f.read()

    matches = re.finditer(r'const\s+(REAL_\w+)\s*=\s*', content)
    extracted = {}
    for m in matches:
        var_name = m.group(1)
        start_idx = m.end()
        brace_count, in_string, escape, end_idx = 0, False, False, start_idx
        for i in range(start_idx, len(content)):
            char = content[i]
            if escape:
                escape = False
                continue
            if char == '\\':
                escape = True
                continue
            if char == '"':
                in_string = not in_string
                continue
            if not in_string:
                if char == '{': brace_count += 1
                elif char == '}': brace_count -= 1
                elif char == ';' and brace_count == 0:
                    end_idx = i
                    break
        try:
            extracted[var_name] = json.loads(content[start_idx:end_idx].strip())
        except Exception as e:
            print(f"Error parsing {var_name}: {e}")

    all_rows = []
    for var_name, payload in extracted.items():
        for r in payload.get("rows", []):
            code = r.get("county_code", "00")
            all_rows.append({
                "indicator": r.get("indicator"),
                "county_code": code,
                "county_name": county_names.get(code, "Sverige"),
                "year": r.get("year"),
                "window": r.get("window"),
                "month": r.get("month"),
                "age_group": r.get("age_group"),
                "sex": r.get("sex"),
                "value": r.get("value"),
                "count": r.get("count"),
                "suppressed": r.get("suppressed", False)
            })

    json_path = os.path.join(OUT_DIR, "kurvan_panel.json")
    csv_path = os.path.join(OUT_DIR, "kurvan_panel.csv")
    
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"dataset": "Kurvan Swedish Mental Health Panel", "dictionary": DATA_DICTIONARY, "rows": all_rows}, f, ensure_ascii=False, indent=2)
    print(f"Wrote JSON panel: {json_path} ({len(all_rows)} rows)")
    
    fieldnames = ["indicator", "county_code", "county_name", "year", "window", "month", "age_group", "sex", "value", "count", "suppressed"]
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in all_rows:
            writer.writerow({k: r.get(k) if r.get(k) is not None else "" for k in fieldnames})
    print(f"Wrote CSV panel: {csv_path}")

if __name__ == "__main__":
    main()
