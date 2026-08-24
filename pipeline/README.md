# Kurvan's data pipeline

Kurvan (`../kurvan.html`) started as a pure design exhibit: every number in
`../js/data.js` was fabricated on a seeded hash, deliberately shaped to look
like five real Swedish mental-health indicators without being any of them.
Every chart said so ("synthetic data") and the footer said not to quote it.

This folder now pulls real numbers for **all five of those**:

- **Self-harm hospitalisation** and **suicide** — `fetch_socialstyrelsen_mh.py`,
  Socialstyrelsen Statistikdatabasen (Patientregistret / Dödsorsaksregistret),
  county grain, ages 12–19 only, all three sexes, five-year windows.
- **Specialist psychiatric care** — `fetch_socialstyrelsen_psych.py`, same API,
  dataset `diagnoserislutenoppenvard`, diagnosis chapter F00-F99. County grain,
  all nine of Kurvan's age bands, all three sexes, annual. The best fit of the
  five — see that script's docstring for the live-verified dataset/dimension
  ids.
- **Severe anxiety, worry or dread** (backs Kurvan's `distress` indicator) —
  `fetch_folkhalsodata_hlv.py`, Folkhälsomyndigheten's Folkhälsodata (a
  *different* agency and a different PxWeb instance from the three above —
  don't assume its dimension ids or sex-code order carry over). County grain,
  all three sexes, no age breakdown at all (the source table doesn't have
  one), ~4-year survey windows.
- **Antidepressants dispensed** — `fetch_socialstyrelsen_lakemedel.py`, same
  API/agency as self-harm/suicide/psych, dataset `lakemedel`, ATC N06A.
  County grain, all nine of Kurvan's age bands, all three sexes, annual since
  2006 — as comfortable a fit as psychiatric care. See "Why antidepressants
  are real now" below for why this took longer than the other four.

Read on for why `distress` isn't named what you might expect from the code.

A seventh script, `fetch_kolada_context.py`, backs the Context tab's two
demographic/socioeconomic layers (population density, low-education
share) — Kolada, region grain, 2023, unweighted mean of each region's
municipalities (via `kommuner.csv`). Not mental-health indicators, so not
part of the `IND` shape the other six use.

A sixth script, `fetch_forsakringskassan.py`, is unrelated to those five —
it backs a new indicator, `sjukfranvaro` (share of ongoing sickness-benefit
cases with a stress-reaction/F43 diagnosis), not a retrofit of an existing
one. Different agency, different API technology, and NOT PxWeb: county
grain, all three sexes, annual (averaged from the source's monthly rows),
2005 through the current year. This used to stop at 2019 — that dataset
turned out to be a frozen historical extract; the fetcher now hits
Försäkringskassan's newer statistics-database API instead, recovered from a
live browser Network-tab capture (its query shape isn't discoverable from
its own metadata endpoint alone — see that script's docstring for the trap
this involved and why "200 OK with an empty array" doesn't mean "no
endpoint here"). No age breakdown. See that script's own docstring for the
verified field names, endpoint, and query parameters.

An eighth script, `convert_vantetider_bup.py`, is a different SPECIES of
script from the other seven — **read its docstring before assuming it works
like the others.** It backs BUP (barn- och ungdomspsykiatri, child/
adolescent psychiatry) waiting times, and:

- **It does not fetch anything.** Its source (Socialstyrelsen's
  väntetider-barn-och-ungdomspsykiatrin database) is a classic ASP.NET
  WebForms page with no JSON API — getting data out of it means a human
  using its own built-in CSV export in a real browser (its postback
  tokens are single-use and session-tied, not scriptable the way the
  other sources' plain URL parameters are). The "fetch" step is a
  documented manual procedure; this script only converts the resulting
  CSV (checked in at `../data/raw/vantetider_bup_manual_export.csv`)
  into the same tidy JSON shape the others produce.
- **It goes stale and needs a human to refresh it.** Every other
  indicator here can be updated by just re-running its script. This one
  can't — refreshing it means repeating the manual export (steps are in
  the script's own docstring) and re-running the converter.
- **The source itself is a rolling ~12-month window**, not deep history
  — its own page said "monthly data July 2025 - June 2026" as of the
  2026-08-24 pull. This is a current-snapshot indicator, not something
  to build a multi-year trend chart against.
- Median waiting time (days) for a COMPLETED first visit, region grain,
  monthly, all sexes/ages combined (that's what was requested in this
  particular export — a different pull could ask for a sex/age split).
  Small/northern regions (Blekinge, Västernorrland, Norrbotten) had
  several months suppressed as too few contacts to publish.

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

## Why antidepressants are real now

Läkemedelsregistret's own *microdata* really is only available as large bulk
CSV downloads (2006-2024, several GB) from
`socialstyrelsen.se/statistik-och-data/statistik/for-utvecklare/` — that part
of the old assumption here was correct. What was wrong was assuming that was
the only way in: Socialstyrelsen's statistics database (the same
`sdb.socialstyrelsen.se/api/v1/` API self-harm/suicide/psych already use) has
a separate, ordinary aggregate table for exactly this — `lakemedel`, filtered
to ATC N06A — with no bulk download needed. See
`fetch_socialstyrelsen_lakemedel.py`'s docstring for what was verified live
before writing it, including a real trap of its own: this dataset's rate
measure comes in four flavours (patients vs. dispensing events, each per-1000
or raw), and the wrong one reads ~5x too high against everything the
synthetic generator had shown up to that point.

One thing that does NOT change with this: `viewBehov()`'s need-vs-response
scatter still calls the fabricated generator for antidepressants on purpose,
same as before — see the caveat two paragraphs down.

## What "real" means here, precisely

Read each fetch script's docstring before changing anything in it — three of
the five carry API traps that silently return wrong-but-plausible numbers if
you get a URL segment (or, for antidepressants, a measure id) wrong. The
short version of what each hands back:

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

**Antidepressants dispensed** (`fetch_socialstyrelsen_lakemedel.py`), also a
comfortable fit:
- County grain plus a national row. All nine of Kurvan's age bands (pooled
  from the register's own 5-year bands, same trick psychiatric care uses)
  and all three sexes.
- No pre-aggregated "all ages" figure on this dataset (unlike psychiatric
  care's) — the fetcher reconstructs one itself, pooled across all eighteen
  5-year bands instead of just pairs of two.
- Annual, 2006 onward. No window, no disclosure floor.
- Measures dispensed prescriptions (whoever prescribed them), not a
  diagnosis — rises when treatment improves as well as when health worsens.
  Already said in `js/lang.js`'s `notNumB.antidep`, now doubly true once real.

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
python fetch_socialstyrelsen_lakemedel.py  # antidepressants, ~1 minute, 36 requests
python fetch_forsakringskassan.py      # sickness absence (F43), ~2 seconds, single request
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
