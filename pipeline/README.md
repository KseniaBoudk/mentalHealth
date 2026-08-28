# Kurvan's data pipeline

Kurvan (`../kurvan.html`) started as a pure design exhibit: every number in
`../js/data.js` was fabricated on a seeded hash, deliberately shaped to look
like five real Swedish mental-health indicators without being any of them.
Every chart said so ("synthetic data") and the footer said not to quote it.

This folder now pulls real numbers for **all five of those**:

- **Self-harm hospitalisation** and **suicide** — `fetch_socialstyrelsen_mh.py`,
  Socialstyrelsen Statistikdatabasen (Patientregistret / Dödsorsaksregistret),
  county grain, all three sexes, five-year windows. Self-harm stays ages
  12–19 only (that register is child/adolescent-specific); suicide covers
  all nine of Kurvan's age bands (widened from 15-19-only — see "KURVAN
  CHANGE 2" in that script's docstring), which is what makes it
  age-standardisable the same way psych/antidep are (`STD_CAPABLE_REAL` in
  `js/data.js`).
- **Specialist psychiatric care** — `fetch_socialstyrelsen_psych.py`, same API,
  dataset `diagnoserislutenoppenvard`, diagnosis chapter F00-F99 — split into
  **78 individual 3-character ICD-10 codes** (DIAGNOS_CODES) rather than
  fetched as one combined number or as the 11 broader blocks one level up;
  `js/data.js` sums all 78 back into an "all" total for every chart that
  doesn't ask for a specific code, and groups them under their 11 real
  ICD-10 blocks (DIAGNOS_BLOCKS/CODE_TO_BLOCK) as `<optgroup>` headers in
  the type picker. County grain, all nine of Kurvan's age bands, all three
  sexes, annual. The best fit of the five — see that script's docstring for
  the live-verified dataset/dimension ids and the code→block structure.
  This retired the two labelling caveats an earlier 6-block version of this
  script carried (a block fetched under a narrower name than its true
  ICD-10 scope, e.g. "eating disorders" really being the broader F50-F59
  chapter) — moot now that every fetched value is a single, precisely-named
  code.
- **Severe anxiety, worry or dread** (backs Kurvan's `distress` indicator) —
  `fetch_folkhalsodata_hlv.py`, Folkhälsomyndigheten's Folkhälsodata (a
  *different* agency and a different PxWeb instance from the three above —
  don't assume its dimension ids or sex-code order carry over). County grain,
  all three sexes, no age breakdown at all (the source table doesn't have
  one), ~4-year survey windows.
- **Psychiatric medication dispensed** — `fetch_socialstyrelsen_lakemedel.py`,
  same API/agency as self-harm/suicide/psych, dataset `lakemedel` — split
  into **five ATC-class series** (ATC_GROUPS: antidepressants N06A, ADHD
  medication N06BA, antipsychotics N05A, anxiety medication N05B, sleep
  medication N05C), same "all" reconstruction as psych above. County grain,
  all nine of Kurvan's age bands, all three sexes, annual since 2006 — as
  comfortable a fit as psychiatric care. See "Why antidepressants are real
  now" below for why this took longer than the other four to begin with.

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

A ninth script, `fetch_hbsc.py`, backs a new dedicated tab — Skolbarns
hälsovanor (HBSC), the WHO-collaborative survey of 11/13/15-year-olds.
Same host as `fetch_folkhalsodata_hlv.py` (Folkhälsomyndigheten's
Folkhälsodata), a different table (`C_HBSC`, not `B_HLV`). Fetches one
item — the share reporting feeling low at least weekly — out of the
survey's eight self-reported complaints, deliberately not a composite
across them (see that script's own docstring for why). County grain, both
sexes, own age keys (11/13/15, not Kurvan's nine AGES bands — they don't
fit; see `js/data.js`'s `HBSC` docstring). **A single snapshot**: only one
regional survey window is published so far (2021-2022), not a trend.

A tenth script, `fetch_scb_population.py`, is not a mental-health fetcher
at all — it backs `standardRate()` in `js/data.js`, real age-
standardisation for `psych`/`antidep` (the only two real indicators with
full nine-band age coverage). SCB (Statistics Sweden)'s `BE0101A`
population table, county grain, Kurvan's nine age bands (pooled from
SCB's own single-year ages), both sexes, annual 2006-2024 — deliberately
NOT extended to 2025 via the sibling `BefolkningCKM` table, which turns
out to have a structurally different shape (see that script's own
docstring for exactly how). A missing population year simply means that
year can't be standardised, same "no data, not a fabricated number" rule
every other real source here follows.

An eleventh script, `fetch_folkhalsodata_equity.py`, backs a new tab —
Jämlikhet (equity) — showing the same underlying survey question as
`distress` (severe anxiety, worry or dread), but broken down by
education, income quintile, and country of birth instead of region. Same
agency/host as `fetch_folkhalsodata_hlv.py` (Folkhälsomyndigheten's
Folkhälsodata), three sibling PxWeb tables in the same table family
(`hlv1psyfutb.px`/`hlv1psybeko.px`/`hlv1psycfod.px`), each trading the
region dimension for its own breakdown. **National figures only** — none
of the three tables carries a region dimension at all. Crude (not
age-standardised) adult ages, and NOT the same age floor across all
three — 25+ for education, 16+ for income and country of birth (verify
against each table's own metadata before assuming these line up; see
that script's docstring for the exact Ålder ids). The caveat worth
repeating in the UI, not just here: of the 18 calendar years on offer
(2004-2024), only three — **2021, 2022, and 2024** — actually have
published data for this survey question on these breakdown tables; every
other year comes back as PxWeb's missing-value sentinel. Not part of the
`IND` shape the other indicators use, same precedent as the Context
tab's Kolada layers above.

## More data, staged in the pipeline but not yet shown (2026-08-27)

Four more sources were added to `build_kurvan_data.py` and compile to their
own `js/data/real_*.js` files, but **nothing in `js/data.js` reads them yet**
— no reader function, no `lang.js` strings, no view. They are on disk in
final form; surfacing them in the UI is a separate later pass. Each one's
`js/data/real_*.js` sits unused (and not even listed in `js/shell.js`'s
`REAL_SOURCES`, so it isn't lazy-loaded) until that pass happens.

- **`fetch_folkhalsodata_hlv_psych.py`** — five more HLV self-reported
  categories beyond the `distress` one `fetch_folkhalsodata_hlv.py` already
  does: suicidal thoughts, suicide attempts, low psychological wellbeing,
  and sleep problems (broad/mild/severe). Same PxWeb host, same
  `dPsykhals/` folder. Writes **two** files: `folkhalsodata_hlv_psych.json`
  (region grain, pooled windows, from `hlv1psyxreg.px`) and
  `folkhalsodata_hlv_psych_age.json` (national grain, annual, coarse age
  bands, from `hlv1psyaald.px` — the only table that carries **loneliness**,
  and only for 2024 so far). ~15 s, 2 requests.
  - **Fails loud, doesn't warn** — `assert_expected_coverage()` raises
    `SystemExit` (writing nothing) if a category expected to still be
    published comes back thin/stale, or if a category recorded as *closed*
    unexpectedly gains new data. Same principle as
    `fetch_socialstyrelsen_lakemedel.py`'s ATC trap check.
  - **`low_wellbeing_pct` is published as a CLOSED series.** It was Kurvan's
    original `distress` label and Folkhälsomyndigheten stopped publishing it
    regionally after the 2015-2018 window (see the next section). Every row
    carries `series_status:"closed"` and `end_year:2018` so the UI can show
    it as a finished historical series, not stale "real" data. `loneliness_*`
    rows carry `series_status:"snapshot"`.
  - Every row carries `fetched` (the run date) so a figure can show its own
    age inline rather than in a footnote.
- **`fetch_forsakringskassan_diagnos.py`** — ongoing sickness-benefit cases
  for the whole psychiatric chapter **F00-F99** (not only F43 like
  `fetch_forsakringskassan.py`), plus the all-diagnoses total it's a share
  of. `sjp-pagaende-sjukfall-diagnos` dataset, a sibling of the F43 table
  and identical in shape. County grain, all sexes, annual-from-monthly,
  2005-present, no age split. ~6 s, batched one request per year.
- **`fetch_forsakringskassan_aktivitetsersattning.py`** —
  **aktivitetsersättning** (disability benefit for 19-29-year-olds; ~80 %
  of recipients have a psychiatric diagnosis) December-snapshot recipient
  counts, F00-F99 share, and monthly `belopp` (1000s SEK), county grain, all
  sexes, annual back to 2003. `sa-bestand-diagnos` dataset, `delforman=A`.
  ~9 s, batched by year. Some small county/sex/chapter cells come back
  `rojd: true` (suppressed) and are dropped.

### The four without a plain API — resolved / partly resolved (2026-08-28)

Two of the four now have working fetchers; the other two are as far as they go
without a manual export.

- **Adult-psychiatry waiting times + BUP treatment / assessment goals** —
  `convert_vantetider_bup.py` was **generalised** to take them. It now
  auto-discovers extra CSVs in `data/raw/` (`vantetider_bup_assessment_export.csv`,
  `vantetider_bup_treatment_export.csv`, `vantetider_vuxenpsyk_forstabesok_export.csv`)
  and merges them, tagging each row with `care_area` + `phase`. The manual
  export procedure for each is in that script's docstring. Still needs a
  human to do the browser export (the source's selection UI is 600+ nameless
  client-side checkboxes) — but the moment the CSVs are dropped in, the
  converter and the rest of the pipeline handle them. Every row also now
  carries `fetched` + `valid_until`; past `valid_until` the Väntetider tab
  greys its charts and says the figure may be out of date
  (`js/data.js` `BUP_WAIT.stale`, `js/views.js` `viewVantetider`).
- **Socialstyrelsen licensed / employed health-care staff** — **BUILT**:
  `fetch_socialstyrelsen_personal.py`. `sdb.socialstyrelsen.se/if_per/` turned
  out NOT to be standard WebForms — no `__VIEWSTATE`, no `__EVENTVALIDATION`,
  no token, a plain `<form method="post" action="resultat.aspx">` — so it is
  scriptable from a bare session. The catch: only **one value per dimension
  per request** works (every multi-select attempt 500s — the form's JS builds
  a correlated hidden-field cluster the server cross-validates), and the age
  dimension has no all-ages row, so the script loops
  profession × region × year × 10 age-bands and sums. That makes it SLOW
  (~9 000 requests / ~40 min at the widest; the committed defaults are
  trimmed to 6 psychiatry professions × 22 regions × 3 years). County-grain
  **headcount** of employed licensed psychologists / psychotherapists /
  counsellors / psychiatrists / child-&-adolescent psychiatrists / psychiatric
  specialist nurses. `per 100 000` is deliberately not fetched (it's a
  per-age-band rate with no all-ages row — can't be summed). A
  magnitude trap-check (`assert_sane`) fails the run if the recipe drifts.
- **`vardenisiffror.se` / "Psykiatrin i siffror"** — **BUILT**:
  `fetch_vardenisiffror_psykiatri.py`. Vården i siffror has a fully public
  JSON API at `https://api.vardenisiffror.se/webapi/` (empty `x-bvo-ticket`
  accepted), and one of its information sources is literally
  "Psykiatrin i siffror" — 18 region-grain annual measures: outpatient
  visits per capita, share of residents seen, inpatient beds per capita and
  occupancy, mean length of stay, LPT (compulsory-care) share, and
  "hyrkostnader" (agency-staff cost as a % of own-staff cost), adult and
  child/adolescent. **Not** in it: absolute staff headcount/FTE, absolute
  cost (kr) per region.
- **SKR "Psykiatrin i siffror" (the PDF reports)** — **still skipped**. VUP /
  BUP / RPV annual PDFs on skr.se, no API, no Excel appendix (the
  accessibility-adapted PDFs *do* have a text layer, so a `pdfplumber`/
  `camelot` converter is feasible but bespoke per report family and needs
  every extracted number verified). The two figures the API route can't give
  — **absolute staffing headcount/FTE and absolute cost per region** — live
  only here. A future `convert_skr_psykiatrin_i_siffror.py` is the only
  route to them.

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
  national row the upstream script computes and discards; see "KURVAN CHANGE
  1" in its docstring for why).
- Self-harm: ages 12–14 and 15–17 only — Kurvan's fabricated generator draws
  a full 0–14-through-85+ curve, but the real hospitalisation register this
  project reaches is child/adolescent-only. Suicide: all nine of Kurvan's
  age bands (widened from 15-19-only — dodsorsaker's own age dimension
  always covered every age; see "KURVAN CHANGE 2" in that script's
  docstring for the pooling that unlocked it), so suicide (unlike
  self-harm) is age-standardisable, same as psych/antidep.
- All three sexes (M/K/T) — `kon/1,2,3`, confirmed live to work on both
  underlying datasets.
- Five-year rolling windows, plotted at the midpoint year, not annual.
- Self-harm rates are never suppressed. Suicide counts below 10 per
  county/age-band/sex window are withheld — the rate is still published.
  Widening suicide to nine age bands means materially more suppressed
  cells than before (thin cells at the youngest and oldest bands
  especially), which is the disclosure floor working as intended on
  genuinely smaller sub-populations, not a regression.

**Psychiatric care** (`fetch_socialstyrelsen_psych.py`), the best fit:
- County grain plus a national row, published directly this time, not
  reconstructed.
- All nine of Kurvan's age bands and all three sexes — the register's own
  bands are five years wide; this script pools pairs of them into Kurvan's
  wider bands using the same population-recovery trick the suicide windowing
  above already uses.
- Annual, 2008 onward. No window, no disclosure floor on this dataset.
- Fetched at the individual 3-character ICD-10 code level (78 codes), not
  the 11 broader blocks one level up — `js/data.js` groups the 78 under
  their blocks for the UI picker and sums them into the "all" total; see
  that script's own docstring for the live code→block verification.

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
python fetch_socialstyrelsen_psych.py  # psychiatric care, ~1 hour, ~2,964 requests (78 ICD-10 codes)
python fetch_folkhalsodata_hlv.py      # severe anxiety, ~15 seconds, 1 request
python fetch_socialstyrelsen_lakemedel.py  # medication, ~4-5 minutes, ~180 requests (5 ATC classes)
python fetch_forsakringskassan.py      # sickness absence (F43), ~2 seconds, single request
python fetch_kolada_context.py         # context layers, ~5 seconds, 2 requests
python fetch_hbsc.py                   # HBSC "felt low", ~5 seconds, 2 requests
python fetch_scb_population.py         # population denominator, ~15 seconds, 5 requests
python fetch_folkhalsodata_equity.py   # equity (education/income/birth-country), ~10 seconds, 3 requests
python fetch_folkhalsodata_hlv_psych.py            # HLV suicidal thoughts/attempts, low wellbeing, sleep, loneliness, ~15 seconds, 2 requests
python fetch_forsakringskassan_diagnos.py          # sickness absence, whole F00-F99 chapter, ~6 seconds, 22 requests
python fetch_forsakringskassan_aktivitetsersattning.py  # aktivitetsersättning recipients by diagnosis, ~9 seconds, 24 requests
python fetch_vardenisiffror_psykiatri.py           # "Psykiatrin i siffror" via Vården i siffror API — visits/beds/LST/hyrkostnad, ~10 seconds, 3 requests
python fetch_socialstyrelsen_personal.py           # licensed psychiatry STAFF headcount by region — SLOW, ~10-40 min, thousands of requests (scrapes if_per)

# Two more sources have no plain fetcher in this list:
#  - BUP waiting times: convert_vantetider_bup.py — NOT an API script. A
#    human first exports a CSV from the source (see its docstring); the
#    converter then turns that CSV into data/processed/vantetider_bup.json.
#  - BUP clinic list: ../BUPS/fetch_bup_facilities.py (outside pipeline/)
#    writes data/processed/bup_facilities.json.
# Both are already committed as real data; only re-run when refreshing them.

python build_kurvan_data.py            # writes ../js/data/*.js (one file per source)
```

`build_kurvan_data.py` rewrites `../js/data/real_*.js` only for sources
whose `data/processed/*.json` is present. A source with **no** processed
file is **left untouched** if a compiled `real_*.js` is already committed
(it prints `KEPT ...`); a genuine fresh clone with no compiled file gets an
empty `rows` stub. So a partial run — refetch one source, rebuild — no
longer reverts the others to synthetic, and `data/processed/` being
gitignored is no longer a trap. To deliberately push a source back to
synthetic, delete its `../js/data/real_*.js` and rebuild.

Then reopen `../kurvan.html`. `../js/data/*.js` is checked in with whatever
was fetched last, so the prototype works without Python on a fresh
checkout — regenerate it whenever you want fresher numbers. Each fetcher is
independent: run only one and `build_kurvan_data.py` still works, and only
that fetcher's indicator(s) go real. Skip a fetcher entirely and its
indicator(s) simply stay on the labelled-synthetic generator, exactly as they
always did.
