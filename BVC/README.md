# BVC clinics in Sweden — a standalone facility list

Every BVC (barnavårdscentral / child health centre — routine well-baby and
child health checkups) in Sweden, as published by **SPARK**
([spark.barnhalsovard.se](https://spark.barnhalsovard.se)), a travel-time
accessibility tool by Sergio Flores / Uppsala Health Economics, Uppsala
University. **Not part of Kurvan's own app** — a separate research
deliverable, sibling to `../BUPS/`.

**BVC is not BUP.** BVC = routine child health care (checkups,
vaccinations, ages 0–6). BUP = child & adolescent *psychiatry*. Different
facility type entirely — see `../BUPS/` for that one.

## Files

- `bvc_kliniker_sverige.csv` / `.json` — the data, 1,032 clinics.
- `fetch_bvc_facilities.py` — the script that produced them. Re-run any
  time with `python fetch_bvc_facilities.py` (a few seconds — SPARK
  publishes its whole list as one file, no rate-limited lookups needed
  this time).

## What's in it

Two kinds of columns, kept clearly separate:

**Plain facility facts** (comparable to `../BUPS/`'s columns): `hsaId`,
`name`, `ownership` (Region/Privat), `isFamiljecentral` (part of a
co-located family centre), `address`, `phone`, `lat`/`lon`, `lanCode`/
`kommunCode`/`kommungrupp` (Kurvan-compatible region codes), `unitCode`
(SPARK's own stable id), `url_1177`, `coord_source`, `fetched_at`.

**SPARK's own accessibility-model outputs** (prefixed `spark_`, kept as
extra columns but this is SPARK's own analysis, not independently
verified here): `spark_startYear`/`spark_endYear`, `spark_weightedDemand`,
`spark_rj` (its E2SFCA catchment ratio), `spark_children05` (population
0–5 in the catchment), `spark_verify_1177`.

## Identifier note

Use **`unitCode`**, not `hsaId`, to key/dedupe this data — it's 100%
present and unique across all 1,032 records. `hsaId` (Sweden's official
HSA registry id) is missing on ~15% of records — SPARK evidently couldn't
resolve an official HSA entry for every clinic it lists (plausibly
private/digital-first providers like "Kry Vårdcentral", not fully in that
registry). This is unlike `../BUPS/`, sourced straight from 1177/HSA,
which has 100% hsaId coverage.

## Source & caveats

Source: SPARK's own public data file, `spark.barnhalsovard.se/data/
bvc.json` — a single JSON array, no pagination or auth needed. SPARK's own
records carry `coord_source: "1177_hsa_<date>"`: it sources its
coordinates from the same 1177/HSA data `../BUPS/` uses directly, so this
isn't an independent cross-check of that source, just the same method
applied to the other facility type by a different (academic) team.

This is a snapshot of SPARK's own published data as of `fetched_at` on
each record — not something this project fetched or verified
independently beyond the sanity checks below. SPARK itself labels its
whole tool "Pilotversion" (pilot version) — treat accordingly.

**Sanity-checked**: row count matches SPARK's own stated total (1,032);
zero duplicate `unitCode`s; zero out-of-Sweden coordinates.
