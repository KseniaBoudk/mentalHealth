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

`laget`, `over_tid`, `karta`, `behov`, `sjukskrivning`, `sammanhang`, `metod`,
`regioner`. `sammanhang` (context) is still a placeholder "under
construction" page, reserved for the observatory plan's socioeconomic-context
section — everything else is built, including `sjukskrivning` (sickness
absence: Försäkringskassan F43 data, real 2005–2019, amber `fk` instrument
colour, its own `viewSjukskrivning()`).

## Data pipeline

`pipeline/` (Python, run offline, not part of the live page) fetches real
government data — Socialstyrelsen (psychiatric care, self-harm, suicide),
Folkhälsomyndigheten (survey anxiety/worry), and Försäkringskassan (F43
sickness absence, an EntryScape REST/JSON API, not PxWeb like the others) —
into `data/processed/*.json`. `pipeline/build_kurvan_data.py` compiles that
into `js/real_mh_data.js`. Antidepressant dispensing has no fetcher yet and
stays synthetic. See `pipeline/README.md` for per-indicator caveats (age
ranges, sex coverage, time windows).

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
