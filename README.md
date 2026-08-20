# Kurvan

**Psykisk hälsa i Sverige** — a prototype public-health observatory exploring
how self-reported mental-health experience, healthcare response, outcomes
and social context vary over time and geography in Sweden, without ranking
municipalities or implying observed differences are causal.

Kurvan is a single-page app: vanilla JavaScript, hand-rolled SVG charts, no
framework and no build step. Open [`kurvan.html`](kurvan.html) directly in a
browser.

## Status

This is a working prototype, not a finished product. It currently covers a
subset of the fuller plan described in the project's design document (see
[`CLAUDE.md`](CLAUDE.md) for the interpretation rules that plan sets out):

| Tab | Status |
|---|---|
| Läget (The picture) | Built |
| Över tid (Over time) | Built |
| Karta (Map) | Built |
| Regioner (Regions) | Built |
| Metod (Method) | Built |
| Behov & vård (Need & care) | Built |
| Sjukskrivning (Sickness absence) | Built |
| Sammanhang (Context) | Built |

## Data

Five of six indicators run on real, open Swedish government data —
self-reported severe anxiety/worry (Folkhälsomyndigheten), specialist
psychiatric care, hospitalisation for self-harm, and death by suicide
(Socialstyrelsen), and sickness absence with a stress-reaction diagnosis
(Försäkringskassan) — fetched by the scripts in [`pipeline/`](pipeline/) and
compiled into `js/real_mh_data.js`. Antidepressant dispensing has no
queryable API available and stays on a clearly-labelled synthetic generator.
See [`pipeline/README.md`](pipeline/README.md) for exactly what "real" means
per indicator (age coverage, sex coverage, time windows, and the caveats
that come with each).

Every chart is labelled real or synthetic; nothing fabricated is ever shown
without that label.

## Running it

No build step, no server required:

```
open kurvan.html   # or just double-click it / drag it into a browser
```

To refresh the real data:

```
cd pipeline
pip install -r requirements.txt
python fetch_socialstyrelsen_mh.py
python fetch_socialstyrelsen_psych.py
python fetch_folkhalsodata_hlv.py
python fetch_forsakringskassan.py
python fetch_kolada_context.py
python build_kurvan_data.py
```

Then reopen `kurvan.html`. `js/real_mh_data.js` is checked in with whatever
was fetched last, so the app works on a fresh checkout without Python.

## Repo structure

- [`kurvan.html`](kurvan.html), [`kurvan.css`](kurvan.css) — the page and its styling.
- [`js/`](js/) — the app: state, language strings (SV/EN), data access, chart
  primitives, views, and the page shell. See [`CLAUDE.md`](CLAUDE.md) for the
  architecture and load order, or [`FILES.txt`](FILES.txt) for a walkthrough
  of every individual file.
- [`pipeline/`](pipeline/) — Python scripts that fetch real government data
  and compile it into `js/real_mh_data.js`. Run offline, not part of the live
  page.
- [`data/`](data/) — raw and processed intermediate files from the pipeline
  (gitignored except for the final compiled output).

## Design principles

The interface deliberately avoids a few things: ranking municipalities,
treating survey distress and clinical diagnosis as interchangeable,
calculating a "treatment gap" by subtracting care use from survey
prevalence, and implying that a geographic correlation is a cause. See the
`metod` tab in the app, or `CLAUDE.md`, for the full set of conventions any
new copy or feature should follow.

---

Built on the open-data observatory architecture developed for the Swedish
Child Health Observatory. A separate, independent project.
