# Kurvan data collection — how it works, for collaborators

This is the practical guide to `pipeline/`. Read `README.md` first for the
per-indicator caveats; this file is about the *mechanics* — how a source gets
from a government website into the dashboard, what the conventions are, and
how to add or refresh one.

---

## The pipeline in one picture

```
government source ──(fetch_*.py / convert_*.py)──> data/processed/<source>.json
                                                          │
                                          build_kurvan_data.py
                                                          │
                                                          ▼
                                   js/data/real_<source>.js   (const REAL_<X> = {...})
                                                          │
                                    js/shell.js loads it lazily after first paint
                                                          │
                                          js/data.js rebuild<X>() indexes it
                                                          │
                                    views read it via cell()/total()/… helpers
```

- **`data/raw/`** and **`data/processed/`** are git-ignored (regenerable).
  The **one exception** is `data/raw/vantetider_bup_manual_export.csv` — it
  can't be re-fetched, so it's committed (see `.gitignore`).
- **`js/data/real_*.js` IS committed** — the dashboard runs from a fresh
  checkout with no Python. Regenerate it when you want fresher numbers.
- Each source is independent: run one fetcher, run `build_kurvan_data.py`,
  and only that source goes real. Skip a fetcher and its indicator stays on
  the labelled-synthetic generator.

> **Trap when running `build_kurvan_data.py` on a partial checkout:** it
> rewrites *every* `js/data/real_*.js`. A source whose
> `data/processed/*.json` is missing on your machine is rewritten to an
> empty `rows: []` — which silently drops real committed data. Either run
> every fetcher first, or `git checkout -- js/data/` the files you didn't
> refetch before committing.

---

## Three species of source

| Species | Example | Refresh | Notes |
|---|---|---|---|
| **Plain JSON API** | `fetch_forsakringskassan*.py`, `fetch_socialstyrelsen_*.py` (PxWeb / SDB), `fetch_vardenisiffror_psykiatri.py` | re-run the script | The happy path. |
| **Legacy-form scrape** | `fetch_socialstyrelsen_personal.py` | re-run the script (slow) | No API but no anti-forgery token either — a plain form POST. Only **one value per dimension per request** works; the script loops and sums. ~10-40 min. |
| **Manual export + converter** | `convert_vantetider_bup.py` | a human re-does a browser CSV export, then re-runs the converter | Source is a real WebForms app with session-tied postback tokens — not scriptable. The converter only reshapes the checked-in CSV. Goes stale; see `valid_until` below. |

---

## Conventions every source follows

- **Region codes** are Kurvan's own two-digit county codes: `00` = Sverige /
  Riket, `01`..`25` = counties (`js/data.js` `REGIONS`). Most sources use
  this scheme directly; the ones that don't are remapped in their fetcher
  (documented in that fetcher's docstring).
- **Sex** is `T` (total), `K` (women), `M` (men). Note FoHM's HLV uses
  `00/01/02` and Socialstyrelsen uses `1=Män/2=Kvinnor/3=Totalt` — each
  fetcher maps to `T/K/M` on the way out. Don't assume one source's codes
  carry to another.
- **"No data" is never faked.** If a source doesn't publish a cell (age,
  year, region, sex), the reader returns `null`, never a synthetic number
  under a real label. Suppressed cells (`rojd:true`, `..`, `N`) are dropped.
- **Fail loud, don't warn.** If a fetch could be silently wrong (wrong
  measure id, a category that quietly stopped being published), the script
  `raise SystemExit(...)` and writes nothing — see
  `fetch_socialstyrelsen_lakemedel.py`'s `assert_atc_filter()`,
  `fetch_folkhalsodata_hlv_psych.py`'s `assert_expected_coverage()`,
  `fetch_socialstyrelsen_personal.py`'s `assert_sane()`.
- **Row-level provenance.** Rows carry `fetched` (ISO date the data was
  pulled/exported). Manual-export rows also carry `valid_until`; series that
  have stopped being published carry `series_status:"closed"` + `end_year`
  (e.g. HLV `low_wellbeing_pct`, closed 2018), or `"snapshot"` for a
  single-point series.
- **"Staged, not shown."** Several sources compile to `js/data/real_*.js`
  but have **no `js/data.js` reader, no `lang.js` strings, no view** yet —
  the data is on disk in final form, wiring it into the UI is a separate
  pass. Their `build_kurvan_data.py` `note` says so, and they're not in
  `js/shell.js`'s `REAL_SOURCES` (so not even lazy-loaded).

---

## Freshness / staleness of manual sources

`convert_vantetider_bup.py` stamps each row with:
- `fetched` — the CSV's export date (file mtime).
- `valid_until` — newest data month + `VALID_MONTHS` (6) grace.

`js/data.js` `rebuildBUP_WAIT()` exposes `BUP_WAIT.fetched` /
`.validUntil` / `.stale` (`stale` = today past `valid_until`).
`js/views.js` `viewVantetider()` shows the fetch date next to each figure
and, when `stale`, greys the charts and shows a "may be out of date —
re-export to refresh" banner. `pipeline/publish_panel.py` carries the same
fields into `data/published/kurvan_panel.{json,csv}` so the exported panel
also states its own age.

To refresh: redo the browser export (procedure in
`convert_vantetider_bup.py`'s docstring), overwrite the CSV in
`data/raw/`, re-run the converter + `build_kurvan_data.py`.

---

## Adding a new source

1. Write `pipeline/fetch_<source>.py` (or `convert_<source>.py`). Output
   `data/processed/<source>.json` — a flat list of row dicts. Use
   `county_code` / `sex` (`T/K/M`) / `year` (or `window` + `midpoint_year`)
   / `value` and whatever else the source gives. Add `fetched`. Add a
   fail-loud sanity check for anything that could be silently wrong.
   **Verify ids live** against the source's metadata endpoint and
   date-stamp what you checked in the docstring — several of these APIs
   return `200 OK` with plausible-but-wrong numbers on a wrong URL segment.
2. Add a `SOURCES` entry in `build_kurvan_data.py` (`var`, `file`, `out`,
   `source`, `note`). Plain object rows are fine; only add compact-tuple
   encoding if the file would exceed ~1 MB.
3. Run `python pipeline/build_kurvan_data.py`. Confirm
   `js/data/real_<source>.js` has a non-empty `rows`.
4. (Later pass, to actually show it) add a `rebuild<X>()` in `js/data.js`,
   a `REAL_SOURCES` entry in `js/shell.js`, `lang.js` strings, and a view.
5. Update `README.md` (per-source caveats + the run list), `FILES.txt`,
   and this file's status table.

---

## Per-source status

Real, wired, shown:

| Indicator / tab | Source | Script |
|---|---|---|
| self-harm, suicide | Socialstyrelsen Patient-/Dödsorsaksregistret | `fetch_socialstyrelsen_mh.py` |
| specialist psychiatric care (6 diagnosis types) | Socialstyrelsen `diagnoserislutenoppenvard` | `fetch_socialstyrelsen_psych.py` |
| severe anxiety (`distress`) | FoHM Folkhälsodata HLV | `fetch_folkhalsodata_hlv.py` |
| psychiatric medication (5 ATC classes) | Socialstyrelsen Läkemedelsregistret | `fetch_socialstyrelsen_lakemedel.py` |
| F43 sickness absence | Försäkringskassan statistikdatabas | `fetch_forsakringskassan.py` |
| Sammanhang context layers | Kolada | `fetch_kolada_context.py` |
| BUP first-visit waiting times | Socialstyrelsen väntetider (MANUAL) | `convert_vantetider_bup.py` |
| HBSC "felt low" | FoHM Skolbarns hälsovanor | `fetch_hbsc.py` |
| age-standardisation denominator | SCB `BE0101A` | `fetch_scb_population.py` |
| BUP clinic directory | 1177.se | `../BUPS/fetch_bup_facilities.py` |

Real, compiled to `js/data/`, **staged — not shown yet**:

| Data | Source | Script |
|---|---|---|
| HLV suicidal thoughts / attempts / low wellbeing / sleep (+ loneliness, national) | FoHM Folkhälsodata HLV | `fetch_folkhalsodata_hlv_psych.py` |
| whole F00-F99 sickness absence (not just F43) | Försäkringskassan | `fetch_forsakringskassan_diagnos.py` |
| aktivitetsersättning recipients + cost + F-share | Försäkringskassan | `fetch_forsakringskassan_aktivitetsersattning.py` |
| psychiatry activity/capacity (visits, beds, occupancy, length of stay, LPT, hyrkostnad) | Vården i siffror "Psykiatrin i siffror" | `fetch_vardenisiffror_psykiatri.py` |
| licensed psychiatry staff headcount by region/profession | Socialstyrelsen `if_per` (scrape) | `fetch_socialstyrelsen_personal.py` |

**Asked for but NOT obtainable — missing, no substitute:**

- **Absolute psychiatry STAFFING (FTE / personnel counts) per region** and
- **Absolute psychiatry COST (kr) per region.**

  These live only in SKR's *Psykiatrin i siffror* annual PDF reports (VUP /
  BUP / RPV) on skr.se — no API, no data file, no Excel appendix.
  `fetch_vardenisiffror_psykiatri.py` gets the activity/capacity measures
  that SKR also publishes, and `fetch_socialstyrelsen_personal.py` gets
  *licensed-professional headcount* (a different cut — everyone with a
  licence working in health care, not psychiatry-department FTE), but
  neither gives the SKR staffing/cost-per-region tables. Extracting those
  needs a bespoke PDF-table parser (`pdfplumber`/`camelot`) with every
  number human-verified — deliberately not built.

Deferred, documented, need a manual browser export before they can proceed:

- **Adult-psychiatry waiting times** and **BUP treatment / assessment
  goals** — same WebForms database as BUP first-visit.
  `convert_vantetider_bup.py` already accepts the extra CSVs
  (`vantetider_bup_assessment_export.csv`,
  `vantetider_bup_treatment_export.csv`,
  `vantetider_vuxenpsyk_forstabesok_export.csv`) — just drop them in
  `data/raw/` and re-run.
