# Kurvan

A single-page Swedish mental-health data dashboard. Vanilla JS + hand-rolled
SVG, no framework, no build step — [kurvan.html](kurvan.html) is opened
directly in a browser.

## Load order

`kurvan.html` loads scripts in dependency order:

```
js/real_mh_data.js → js/data.js → js/lang.js → js/state.js → js/charts.js → js/views.js → js/shell.js
```

## Architecture

- **`js/state.js`** — `S`, the current UI state (tab, indicator, age, sex,
  year, region, language, theme, standardisation toggle).
- **`js/lang.js`** — `T`, the full SV/EN copy lookup table. No UI string
  lives outside this file.
- **`js/data.js`** — the Swedish county SVG paths, plus the data-access layer:
  prefers real data from `real_mh_data.js` per indicator/region/year/age/sex
  when present, else falls back to a seeded synthetic generator.
- **`js/charts.js`** — raw SVG chart primitives (line chart, dot plot with
  confidence intervals, choropleth map, scatter with regression line). No
  charting library.
- **`js/views.js`** — builds each tab's HTML from the primitives above.
- **`js/shell.js`** — renders the page shell/nav, wires up event listeners.
  `render()` is the re-render entrypoint, called after any state change.

## Tabs

`laget`, `over_tid`, `karta`, `behov`, `sjukskrivning`, `sammanhang`,
`vantetider`, `metod`, `regioner` — all built now. `sjukskrivning` (sickness
absence: Försäkringskassan F43 data, real 2005–present, amber `fk`
instrument colour), `sammanhang` (context: Kolada population density +
low-education share, region grain, 2023, unweighted municipality means —
deliberately not shaped like `IND`/`REAL_*`, see `CONTEXT`/`CONTEXT_META` in
`js/data.js`), and `vantetider` (BUP — child/adolescent psychiatry —
waiting times: Socialstyrelsen, region grain, median days to a completed
first visit, monthly over a rolling ~12-month window only, no age/sex
split, see `BUP_WAIT` in `js/data.js`; sourced by a MANUAL CSV export, not
a script — see `pipeline/convert_vantetider_bup.py`'s docstring) all have
their own dedicated view functions outside the `IND`-driven generic tabs.

## Data pipeline

`pipeline/` (Python, run offline, not part of the live page) fetches real
government data — Socialstyrelsen (psychiatric care, self-harm, suicide,
antidepressant dispensing), Folkhälsomyndigheten (survey anxiety/worry), and
Försäkringskassan (F43 sickness absence, not PxWeb like the others) — into
`data/processed/*.json`.
`pipeline/build_kurvan_data.py` compiles that into `js/real_mh_data.js`. See
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
