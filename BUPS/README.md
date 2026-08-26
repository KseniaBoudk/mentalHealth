# BUP clinics in Sweden — a standalone facility list

Every BUP (barn- och ungdomspsykiatri / child & adolescent psychiatry)
outpatient clinic listed on **1177.se**, with name, address, phone, and
precise coordinates. **Not part of Kurvan's own app** — this is a separate
research deliverable, kept in its own folder.

## Files

- `bup_kliniker_sverige.csv` / `.json` — the actual data, 298 clinics.
- `fetch_bup_facilities.py` — the script that produced them. Re-run it any
  time with `python fetch_bup_facilities.py` to refresh (takes a few
  minutes — most of that is the rate-limited county lookup, see below).

## What's in it

One row per clinic: `hsa_id` (Sweden's official national healthcare
facility ID), `name`, `ownership` (Region/Privat), `address`, `street`,
`postal_code`, `city`, `lan_code` (Kurvan's own two-digit county codes),
`lat`/`lon`, `has_coordinates`, `phone` (local + international format),
`care_type_tags`, `url_1177` (link to the clinic's own 1177 page),
`coord_source`, `fetched_at`.

**282 of 298** have precise coordinates, sourced directly from 1177's own
API. **16 don't** — almost all of these are "En väg in" (single-point-of-
contact) phone triage lines or digital-only treatment programs with no
physical clinic to place on a map, not a gap in the harvest.

`lan_code` is reverse-geocoded from each clinic's own coordinates
(OpenStreetMap Nominatim) — accurate for the large majority, but not
authoritative; a postal-code guess is used only as a fallback for the
handful of records with no coordinates at all.

## Scope

Only 1177's "Psykiatri, barn och ungdom" category — the direct match to
what Kurvan's own waiting-time indicator (`BUP_WAIT`) measures. Three
related-but-distinct 1177 categories are **not** included by design:
Neuropsykiatri barn och ungdom, Akutverksamhet vid sjukhus (barn- och
ungdomspsykiatri), and Psykoterapi barn och ungdom.

## Source & caveats

Source: 1177.se's "Hitta vård" search API (`/api/hjv/search`), a public,
unauthenticated JSON endpoint — no scraping of rendered HTML needed, see
the script's own docstring for exactly how it was found. This is **a
snapshot as of the `fetched_at` date on each record**, not a live or
historical source — clinics open, close, and change address over time,
and 1177 is Sweden's official care-finder but isn't guaranteed to list
every last small private provider.

## Method note (Uppsala's SPARK tool)

[spark.barnhalsovard.se](https://spark.barnhalsovard.se) — a travel-time
accessibility tool for **BVC** (child health centres, a different facility
type from BUP) by Uppsala Health Economics — independently sources its own
facility coordinates from the same 1177/HSA data this script uses
(`"coord_source":"1177_hsa_..."` in its own `bvc.json`). Confirms this is
a sound, precedented source for this exact class of problem. SPARK's own
accessibility modelling (travel-time matrices, E2SFCA index, isochrones)
is a separate, much larger undertaking and out of scope here — this
folder is the facility list only.
