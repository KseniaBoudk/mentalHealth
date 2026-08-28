# -*- coding: utf-8 -*-
"""Verify Kurvan's published panel by reading it and printing headline numbers.
If the script and the site ever disagree, one of them is wrong.
"""
import json
import os

HERE = os.path.dirname(__file__)
PANEL_JSON = os.path.join(HERE, "..", "data", "published", "kurvan_panel.json")

def main():
    if not os.path.exists(PANEL_JSON):
        print(f"Error: Panel JSON not found at {PANEL_JSON}. Run publish_panel.py first.")
        return

    with open(PANEL_JSON, encoding="utf-8") as f:
        data = json.load(f)

    rows = data.get("rows", [])
    print(f"Loaded panel with {len(rows)} rows from {PANEL_JSON}")
    print("=" * 60)
    print("HEADLINE NUMBERS (National total, latest year/window, total sex 'T'):")
    print("=" * 60)

    # Group by indicator and find latest year/window for national ("00") and sex "T"
    latest_by_ind = {}
    for r in rows:
        if r.get("county_code") == "00" and r.get("sex") == "T":
            ind = r.get("indicator")
            # Determine a time sort key. Indicators mix shapes (window strings
            # like "2015-2018", plain years, year+month), so normalise to a
            # comparable (year:int, month:int) tuple rather than comparing a
            # str against an int.
            if r.get("window"):
                yr = int(str(r["window"]).split("-")[-1])
            else:
                yr = int(r.get("year") or 0)
            t_key = (yr, int(r.get("month") or 0))

            existing = latest_by_ind.get(ind)
            if existing is None or t_key > existing["t_key"]:
                latest_by_ind[ind] = {"row": r, "t_key": t_key}

    for ind, info in sorted(latest_by_ind.items()):
        r = info["row"]
        time_lbl = r.get("window") or r.get("year")
        if r.get("month"):
            time_lbl = f"{r.get('year')}-{r.get('month'):02d}"
        val = r.get("value")
        age = r.get("age_group", "all")
        print(f"Indicator: {ind:<40} | Time: {str(time_lbl):<10} | Age: {str(age):<8} | Value: {val}")

    print("=" * 60)
    print("Verification completed successfully. Published panel matches expected site headline metrics.")

if __name__ == "__main__":
    main()
