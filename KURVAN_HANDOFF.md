# Kurvan handoff

Current state, the one operational trap to know about, and what the next
owner should do first.

> Written at handoff. All commit SHAs and branch names below were current
> as of `master` = `f32b8d6`.

## At a glance

| | |
|---|---|
| **Project** | Single-page Swedish mental-health data dashboard. Vanilla JS + hand-rolled SVG, **no build step** — open `kurvan.html` in a browser. Offline Python data pipeline in `pipeline/`. |
| **Repo** | <https://github.com/KseniaBoudk/mentalHealth> |
| **Docs in repo** | `CLAUDE.md` (architecture), `FILES.txt` (per-file walkthrough), `pipeline/README.md` + `pipeline/COLLABORATION.md` |
| **Master at** | `f32b8d6` — "Fix the map going blank for a type/region cell with no real data" |

---

## 01 · What changed in the last session

One feature branch, ready to merge: **`psych-codes-ondemand`** (from current
`master`, one commit `20d32db`, pushed).

Master already had "psychiatric care by 78 ICD-10 codes, grouped by block"
(commit `09b3740`) — but its `real_psych.js` still held the old 6-category
data, so every code showed "no data" and it needed a ~1 hour fetch to come
alive. This branch fixes that and makes it cheap:

- `real_psych.js` → **just the F00–F99 chapter** (`diagnos=05`, ~375 KB).
  `js/data.js` reads it straight as `"all"` — the register's own real
  total, not a sum of codes (which would double-count comorbid patients).
- `real_psych_codes.js` → the **78 code series** (~14.6 MB, new file).
  `loadPsychCodes()` in `js/shell.js` pulls it the first time the type
  picker is in play, then re-merges and re-renders. "All types" works
  before then, off the small eager file.
- Master's `PSYCH_TYPES` / `PSYCH_CODE_BLOCK` / picker markup / labels /
  URL & cache keys are **untouched** — this is a data-file split plus a
  real `"all"`, nothing more.
- Pipeline: `fetch_socialstyrelsen_psych.py` now also fetches `diagnos=05`
  and writes two processed files; `build_kurvan_data.py` gained the
  `REAL_PSYCH_CODES` source.

An earlier branch, `additional-f-codes`, was a parallel reimplementation of
the same feature from an old base — **superseded, do not merge**. It also
carried some chart-clarity tweaks (axis titles on the age/month charts,
"per 100,000 *inhabitants*" wording, distinct `%` labels for the two
scale-100 indicators) that were *not* ported because they collide with
master's own chart changes. Worth revisiting later if wanted; commits
`d49bfb8` / `7781784`.

---

## 02 · Branches — what to do with each

| Branch | State | Action |
|---|---|---|
| `psych-codes-ondemand` | **Ready** — fast-forwards onto master, zero conflicts. PR not yet opened. | Browser-check (see §4), then merge. PR: <https://github.com/KseniaBoudk/mentalHealth/pull/new/psych-codes-ondemand> |
| `additional-f-codes` | **Obsolete** — parallel reimplementation, pushed to origin. | Delete: `git branch -D additional-f-codes` and `git push origin --delete additional-f-codes` |
| `master` | **Current** — `f32b8d6` | — |
| *~20 other origin branches* | **Stale** old feature branches (mobile-view, code-optimisation, visual-theme-changes, …) | Prune per team preference — none block anything. |

---

## 03 · The data pipeline & the blanking trap

Two stages:

- **`pipeline/fetch_*.py`** — hit government APIs (Socialstyrelsen,
  Folkhälsomyndigheten, Försäkringskassan, SCB, Kolada), write
  `data/processed/*.json`. These are **gitignored** — large, and
  regenerable.
- **`pipeline/build_kurvan_data.py`** — reads *every* `data/processed/*.json`
  and compiles each into a `js/data/real_*.js` file. Those **are
  committed** — they're what the browser loads.

> ### ⚠ The trap
>
> If `build_kurvan_data.py` runs and an input JSON is *missing*, it does
> **not** error — it writes an **empty** `real_X.js` (`"rows":[]`), and
> `js/data.js` silently falls back to the synthetic generator for that
> indicator. Great for a fresh clone; a quiet data-loss risk if you run a
> full build with a *partial* `data/processed/` and commit the result.
>
> `data/processed/` is gitignored, so **git cannot warn you** that it's
> incomplete.

On the machine this handoff was written from, `data/processed/` is
**partial** — a bare `python pipeline/build_kurvan_data.py` there would
blank these committed files:

| Blanks | What's lost | Re-fetch with |
|---|---|---|
| `real_hlv.js` | "severe anxiety" (distress) indicator | `fetch_folkhalsodata_hlv.py` |
| `real_lakemedel.js` | antidepressants / all medication | `fetch_socialstyrelsen_lakemedel.py` |
| `real_fk.js` | F43 sickness absence | `fetch_forsakringskassan.py` |
| `real_pop.js` | age-standardisation (psych/antidep/suicide) | `fetch_scb_population.py` |
| `real_context.js` | Sammanhang tab | `fetch_kolada_context.py` |
| `real_hbsc.js` | HBSC tab | `fetch_hbsc.py` |
| `real_bup_facilities.js` | BUP clinic list | `../BUPS/fetch_bup_facilities.py` |
| `real_equity.js` | equity / jämlikhet pipeline | `fetch_folkhalsodata_equity.py` |

The branch itself is **clean**: after generating the two psych files,
every other `js/data/*.js` was reverted to master, so the diff is only
`real_psych.js` + `real_psych_codes.js`. And `master`'s committed data
files are all correct. The trap only bites someone who runs a full build
with partial inputs and commits it.

### Safe way to regenerate data

- Run **all** the `fetch_*.py` first (repopulate `data/processed/` fully),
  then `build_kurvan_data.py`. Some fetches are slow — psych ≈ 1 h, staff
  headcount ≈ 10–40 min, self-harm/suicide ≈ 2 min.
- Or, after any partial build: `git checkout -- js/data/` for every file
  you didn't mean to touch.
- Or simply don't run a full build on a machine with incomplete
  `data/processed/`.

---

## 04 · Verified vs. not verified

**✓ Checked** — `python -m py_compile` on both pipeline scripts; brace
balance on the changed JS; and a **Python simulation of
`rebuildREAL_PSYCH`** against the two generated files: `"all"` resolves
from the chapter file alone, all 78 codes resolve after the codes file
merges, and `"all"` is byte-identical before and after the merge (no
double-count).

**⚠ Not checked** — no browser was available in the session. The DOM
wiring is **unconfirmed live**: the `loadPsychCodes()` trigger in
`wire()`, the re-render when the codes file lands, and the "Loading
diagnosis codes…" placeholder option.

**First thing to do:** open `kurvan.html` → *Över tid* tab → set indicator
to *Psykiatrisk specialistvård* → open the *Typ* picker → pick a specific
code (e.g. `F32`) → confirm the charts fill in (after a brief pause the
first time). Repeat on the *Karta* tab. Then it's safe to merge.

---

## 05 · Next steps

- Browser-check (§4) and **merge `psych-codes-ondemand`**.
- **Delete `additional-f-codes`** (local + origin).
- Repopulate `data/processed/` fully on whatever machine becomes the
  pipeline machine, so a future build doesn't blank anything.
- *Optional:* port the chart-clarity tweaks (axis titles, "per 100,000
  inhabitants", distinct `%` labels) off `additional-f-codes` onto master —
  genuinely useful, needs manual reconciliation with master's chart-tick /
  legend changes.
- *Optional:* `fetch_socialstyrelsen_psych.py` fetches the 78 codes one
  request each (~1 h). Its docstring describes batching via comma-joined
  `diagnos=` as an available speedup.
- The committed `real_psych_codes.js` was built from psych data already
  fetched on the machine — it's real and current as of that fetch. Re-run
  the fetcher whenever you want it refreshed.

---

## 06 · Where things live

| Path | |
|---|---|
| `kurvan.html` | entry point — open directly, no server needed |
| `js/state.js` | `S` — current UI state (tab, indicator, filters, theme, language) |
| `js/lang.js` | `T` — every UI string, SV + EN. No copy lives outside this file. |
| `js/data.js` | data-access layer: real data from `js/data/*.js` per cell, else a seeded synthetic generator. `rebuildREAL_*`. |
| `js/charts.js` | hand-rolled SVG chart primitives (line, dot-plot, choropleth, scatter) |
| `js/views.js` | per-tab HTML builders |
| `js/shell.js` | render loop, nav, event wiring, lazy data loaders (`REAL_SOURCES`, `loadPsychCodes`) |
| `js/data/real_*.js` | generated real data (committed). Do not hand-edit. |
| `data/processed/*.json` | pipeline intermediate (gitignored) |
| `pipeline/` | offline Python — fetchers + `build_kurvan_data.py`. Not part of the live page. |

There is no build step, test suite, or linter for the page — verification
is opening `kurvan.html` in a browser.
