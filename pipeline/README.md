# Kurvan's data pipeline

Kurvan (`../kurvan.html`) started as a pure design exhibit: every number in
`../js/data.js` was fabricated on a seeded hash, deliberately shaped to look
like five real Swedish mental-health indicators without being any of them.
Every chart said so ("synthetic data") and the footer said not to quote it.

This folder pulls real numbers for **four of those five**:

- **Self-harm hospitalisation** and **suicide** — `fetch_socialstyrelsen_mh.py`,
  Socialstyrelsen Statistikdatabasen (Patientregistret / Dödsorsaksregistret),
  county grain, ages 12–19 only, total sex only, five-year windows.
- **Specialist psychiatric care** — `fetch_socialstyrelsen_psych.py`, same API,
  dataset `diagnoserislutenoppenvard`, diagnosis chapter F00-F99. County grain,
  all nine of Kurvan's age bands, all three sexes, annual. The best fit of the
  four — see that script's docstring for the live-verified dataset/dimension
  ids.
- **Severe anxiety, worry or dread** (backs Kurvan's `distress` indicator) —
  `fetch_folkhalsodata_hlv.py`, Folkhälsomyndigheten's Folkhälsodata (a
  *different* agency and a different PxWeb instance from the three above —
  don't assume its dimension ids or sex-code order carry over). County grain,
  all three sexes, no age breakdown at all (the source table doesn't have
  one), ~4-year survey windows.

Only **antidepressants dispensed** has no fetcher here. Read on for why, and
for why `distress` isn't named what you might expect from the code.

A seventh script, `fetch_kolada_context.py`, backs the Context tab's two
demographic/socioeconomic layers (population density, low-education
share) — Kolada, region grain, 2023, unweighted mean of each region's
municipalities (via `kommuner.csv`). Not mental-health indicators, so not
part of the `IND` shape the other six use.

A sixth script, `fetch_forsakringskassan.py`, is unrelated to those five —
it backs a new indicator, `sjukfranvaro` (share of ongoing sickness-benefit
cases with a stress-reaction/F43 diagnosis), not a retrofit of an existing
one. Different agency, different API technology (an EntryScape "rowstore"
REST/JSON dataset, not PxWeb), and a real but dated coverage window: county
grain, all three sexes, annual (averaged from the source's quarterly rows),
but **2005–2019 only** — this source does not extend into the 2020s. No age
breakdown. See that script's own docstring for the verified field names and
dataset id.

## Why `distress` doesn't say "poor mental wellbeing" any more

That was Kurvan's original label, matching HLV's own category "Nedsatt
psykiskt välbefinnande" — which is real, and stopped being published in the
regional table after the 2015-2018 survey window. Wiring it up as originally
labelled would mean showing a decade-stale number under a "real data" tag.

`fetch_folkhalsodata_hlv.py` fetches a different HLV category instead — "Svår
ängslan, oro eller ångest" (severe anxiety, worry or dread) — which is
continuously published through 2021-2024, and relabels the indicator to match
what's actually shown (`js/lang.js`'s `ind.distress`, `rDistress`, `gapX`,
`notNumB.distress`, `mRows.distress` all changed together). Read that script's
docstring for the full per-category coverage check before picking a different
one.

## Why antidepressants still aren't real

Läkemedelsregistret (the prescribed drug register) is not exposed through any
queryable API at all — only as large bulk CSV downloads (2006-2024, several
GB) from `socialstyrelsen.se/statistik-och-data/statistik/for-utvecklare/`.
Wiring it up is a bulk-file-parsing job, structurally different from the four
fetchers here, and hasn't been attempted. `antidep` stays on the fabricated
generator, clearly labelled as such on every chart.

## What "real" means here, precisely

Read each fetch script's docstring before changing anything in it — two of
the four carry API traps that silently return wrong-but-plausible numbers if
you get a URL segment wrong. The short version of what each hands back:

**Self-harm / suicide** (`fetch_socialstyrelsen_mh.py`):
- County grain, plus one national row per indicator (this copy keeps the
  national row the upstream script computes and discards; see "KURVAN CHANGE"
  in its docstring for why).
- Self-harm: ages 12–14 and 15–17 only. Suicide: ages 15–19 only. Nothing for
  anyone older — Kurvan's fabricated generator draws a full 0–14-through-85+
  curve for both; the real registers this project can reach never do.
- Sex "T" (total) only. No real male/female split.
- Five-year rolling windows, plotted at the midpoint year, not annual.
- Self-harm rates are never suppressed. Suicide counts below 10 per window are
  withheld — the rate is still published.

**Psychiatric care** (`fetch_socialstyrelsen_psych.py`), the best fit:
- County grain plus a national row, published directly this time, not
  reconstructed.
- All nine of Kurvan's age bands and all three sexes — the register's own
  bands are five years wide; this script pools pairs of them into Kurvan's
  wider bands using the same population-recovery trick the suicide windowing
  above already uses.
- Annual, 2008 onward. No window, no disclosure floor on this dataset.

**Severe anxiety / distress** (`fetch_folkhalsodata_hlv.py`), the odd one out:
- Different agency (FoHM, not Socialstyrelsen), different PxWeb instance,
  different sex-code numbering — see the script's docstring before reusing
  any convention from the other three.
- County grain plus a national row. All three sexes.
- **No age breakdown at all** — the region table simply doesn't have one.
  Kurvan's age selector and per-age-band chart go empty for this indicator
  once real; that's correct, not a bug.
- ~4-year windows pooling two survey waves, unevenly spaced (there are real
  gaps in the cadence — take the window list from the API, don't assume a
  fixed step).

`js/data.js` enforces all of this: once real data is loaded for an indicator,
asking for an age band, sex, or year the source doesn't publish returns
`null` ("no data"), never a fabricated fallback number sitting next to a real
one under the same label. `views.js` reads a `real`/`synthetic` flag per
chart, never guesses — and two specific charts (the self-harm/suicide
life-course exhibit on the "Läget" tab, and the distress-vs-antidepressants
treatment-gap scatter wherever it appears) are pinned to the fabricated
generator on purpose even once their indicators are real elsewhere, because
mixing a real value into a chart whose story depends on the fabricated
generator's internal correlations would be more misleading than staying
synthetic. See `fakeCell()` and `fakeTotal()`'s docstrings in `js/data.js`.

## Running it

```
pip install -r requirements.txt
python fetch_socialstyrelsen_mh.py     # self-harm + suicide, ~2 minutes
python fetch_socialstyrelsen_psych.py  # psychiatric care, ~1 minute, ~40 requests
python fetch_folkhalsodata_hlv.py      # severe anxiety, ~15 seconds, 1 request
python fetch_forsakringskassan.py      # sickness absence (F43), ~10 seconds, paginated
python fetch_kolada_context.py         # context layers, ~5 seconds, 2 requests
python build_kurvan_data.py            # writes ../js/real_mh_data.js
```

Then reopen `../kurvan.html`. `../js/real_mh_data.js` is checked in with
whatever was fetched last, so the prototype works without Python on a fresh
checkout — regenerate it whenever you want fresher numbers. Each fetcher is
independent: run only one and `build_kurvan_data.py` still works, and only
that fetcher's indicator(s) go real. Skip a fetcher entirely and its
indicator(s) simply stay on the labelled-synthetic generator, exactly as they
always did.
