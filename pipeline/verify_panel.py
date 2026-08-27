# -*- coding: utf-8 -*-
"""Verify Kurvan's published panel against a fresh recompute from data/processed/*.json.

Loads data/published/kurvan_panel.json (what publish_panel.py wrote) and
independently recomputes the same rows straight from data/processed/*.json via
publish_panel.collect_rows() -- the published file plays no part in that
recompute, so this is a real check of "did publishing preserve the source
data", not a report on the published file's own numbers. For each indicator's
latest national (county_code "00"), total-sex ("T") row, the two sides' value/
count/age_group/time are compared and a PASS/FAIL is printed; the script exits
1 if anything disagrees, 0 otherwise. If the script and the site ever
disagree, one of them is wrong -- this is what actually checks that.
"""
import json
import os
import sys

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
import publish_panel

PANEL_JSON = os.path.join(HERE, "..", "data", "published", "kurvan_panel.json")

def time_key(r):
    if r.get("month"):
        return (r.get("year"), r.get("month"))
    return r.get("window") or r.get("year") or 0

def latest_by_indicator(rows):
    latest = {}
    for r in rows:
        if r.get("county_code") == "00" and r.get("sex") == "T":
            ind = r.get("indicator")
            t_key = time_key(r)
            existing = latest.get(ind)
            if existing is None or t_key > existing["t_key"]:
                latest[ind] = {"row": r, "t_key": t_key}
    return latest

def values_match(a, b, tol=0.01):
    if a is None or b is None:
        return a == b
    try:
        return abs(float(a) - float(b)) < tol
    except (TypeError, ValueError):
        return a == b

def main():
    if not os.path.exists(PANEL_JSON):
        print(f"Error: Panel JSON not found at {PANEL_JSON}. Run publish_panel.py first.")
        sys.exit(1)

    with open(PANEL_JSON, encoding="utf-8") as f:
        published = json.load(f).get("rows", [])
    fresh = publish_panel.collect_rows()

    published_latest = latest_by_indicator(published)
    fresh_latest = latest_by_indicator(fresh)

    print(f"Comparing {len(published)} published rows against {len(fresh)} freshly-recomputed rows from data/processed/*.json")
    print("=" * 72)

    failures = 0
    indicators = sorted(set(published_latest) | set(fresh_latest))
    for ind in indicators:
        pub = published_latest.get(ind)
        fr = fresh_latest.get(ind)
        if pub is None:
            print(f"FAIL  {ind:<40} only in fresh recompute (missing from published panel)")
            failures += 1
            continue
        if fr is None:
            print(f"FAIL  {ind:<40} only in published panel (missing from fresh recompute)")
            failures += 1
            continue

        pr, fri = pub["row"], fr["row"]
        reasons = []
        if not values_match(pr.get("value"), fri.get("value")):
            reasons.append(f"value {pr.get('value')} != {fri.get('value')}")
        if pr.get("count") != fri.get("count"):
            reasons.append(f"count {pr.get('count')} != {fri.get('count')}")
        if pr.get("age_group") != fri.get("age_group"):
            reasons.append(f"age_group {pr.get('age_group')} != {fri.get('age_group')}")
        if pub["t_key"] != fr["t_key"]:
            reasons.append(f"time {pub['t_key']} != {fr['t_key']}")

        if reasons:
            print(f"FAIL  {ind:<40} " + "; ".join(reasons))
            failures += 1
        else:
            time_lbl = pr.get("window") or pr.get("year")
            if pr.get("month"):
                time_lbl = f"{pr.get('year')}-{pr.get('month'):02d}"
            print(f"PASS  {ind:<40} | Time: {str(time_lbl):<10} | Age: {str(pr.get('age_group', 'all')):<8} | Value: {pr.get('value')}")

    print("=" * 72)
    if failures:
        print(f"{failures} of {len(indicators)} indicators disagree between the published panel and data/processed/*.json.")
        sys.exit(1)
    else:
        print(f"All {len(indicators)} indicators match between the published panel and data/processed/*.json.")

if __name__ == "__main__":
    main()
