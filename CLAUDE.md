# Kurvan

A single-page Swedish mental-health data dashboard. Vanilla JS + hand-rolled
SVG, no framework, no build step — [kurvan.html](kurvan.html) is opened
directly in a browser.

## Load order

`kurvan.html` loads scripts in dependency order:

```
js/data.js → js/lang.js → js/state.js → js/charts.js → js/views.js → js/shell.js
```

`js/data/*.js` — the nine real-data sources, one small file per source (see
"Data pipeline" below) — are NOT in that static list. `js/shell.js` loads
them lazily, with dynamically-created `<script>` tags, right after the very
first `render()`, so the page never blocks its first paint on parsing all
of them at once. Every `js/data.js` `REAL_X`/`CONTEXT`/`BUP_WAIT`/`HBSC`
value is reassignable (`rebuildX()` functions, not one-shot IIFEs)
specifically so a source can flip from synthetic to real after the page has
already painted, mid-session, without a page reload.

## Architecture

- **`js/state.js`** — `S`, the current UI state (tab, indicator, age, sex,
  year, region, language, theme, standardisation toggle).
- **`js/lang.js`** — `T`, the full SV/EN copy lookup table. No UI string
  lives outside this file.
- **`js/data.js`** — the Swedish county SVG paths, plus the data-access layer:
  prefers real data from `js/data/*.js` per indicator/region/year/age/sex
  when present, else falls back to a seeded synthetic generator.
- **`js/charts.js`** — raw SVG chart primitives (line chart, dot plot with
  confidence intervals, choropleth map, scatter with regression line). No
  charting library.
- **`js/views.js`** — builds each tab's HTML from the primitives above.
- **`js/shell.js`** — renders the page shell/nav, wires up event listeners.
  `render()` is the re-render entrypoint, called after any state change.

## Tabs

`laget`, `over_tid`, `karta`, `behov`, `sjukskrivning`, `sammanhang`,
`vantetider`, `hbsc`, `metod`, `regioner`, `policy_news` — all built now.
`sjukskrivning` (sickness absence: Försäkringskassan F43 data, real
2005–present, amber `fk` instrument colour, latest year flagged `partial`
when Försäkringskassan hasn't published a full 12 months of it yet — see
`REAL_FK` in `js/data.js`), `sammanhang` (context: Kolada population
density + low-education share, region grain, 2023, unweighted municipality
means — deliberately not shaped like `IND`/`REAL_*`, see
`CONTEXT`/`CONTEXT_META` in `js/data.js`), `vantetider` (BUP — child/
adolescent psychiatry — waiting times: Socialstyrelsen, region grain,
median days to a completed first visit, monthly over a rolling ~12-month
window only, no age/sex split, see `BUP_WAIT` in `js/data.js`; sourced by a
MANUAL CSV export, not a script — see `pipeline/convert_vantetider_bup.py`'s
docstring; its map draws a real, clickable "no data" tile — not an omitted
shape — for a region suppressed in the current month), `hbsc` (Skolbarns
hälsovanor: Folkhälsomyndigheten, region grain, share of 11/13/15-year-olds
reporting feeling low at least weekly, teal `survey` instrument colour — a
SINGLE snapshot, one survey window only, own 11/13/15 age keys rather than
Kurvan's nine `AGES` bands, see `HBSC` in `js/data.js`), and `policy_news`
(policy/news tracking, unrelated to the `IND` indicators) all have their
own dedicated view functions outside the `IND`-driven generic tabs.

## Data pipeline

`pipeline/` (Python, run offline, not part of the live page) fetches real
government data — Socialstyrelsen (psychiatric care, self-harm, suicide,
psychiatric medication dispensing), Folkhälsomyndigheten (survey anxiety/
worry and, separately, the HBSC child survey), Försäkringskassan (F43
sickness absence, not PxWeb like the others), and SCB (population by
region/age/sex, not a mental-health measure — the denominator behind real
age-standardisation, `standardRate()` in `js/data.js`, available for
`psych`/`antidep` only: the two real indicators with full nine-band age
coverage) — into `data/processed/*.json`. Psychiatric care and medication
are each split into real sub-type series (six diagnosis types, five ATC
medication classes — `PSYCH_TYPES`/`MED_TYPES` in `js/data.js`,
`S.psychType`/`S.medType`, a type picker on Över tid/Karta) rather than one
combined number each; `js/data.js` sums the real sub-types into an "all"
pseudo-type for every other chart that references psych/antidep as a
single figure.
`pipeline/build_kurvan_data.py` compiles that into `js/data/*.js` (one file
per source — loaded lazily, see "Load order" above). See
`pipeline/README.md` for per-indicator caveats (age ranges, sex coverage,
time windows) — `viewBehov()`'s need-vs-response scatter is the one
exception that stays on the fabricated generator for both axes regardless,
on purpose (see that function's own comment in `js/views.js`).

## Interpretation rules

The design deliberately avoids ranking municipalities/regions, causal
language, and "treatment gap" framing — use "need vs. response" instead. Any
new copy or feature should follow the same conventions (see `metod` tab and
`t.causalNote` in `lang.js`).

## More detail

[FILES.txt](FILES.txt) has an exhaustive per-file walkthrough.

## Build/test

None — there's no build step, test suite, or linter. Verify changes by
opening `kurvan.html` in a browser.
