# Kurvan handoff

Current state, the one operational trap to know about, and what the next
owner should do first.

> Written at handoff. `master` = `fe8e50e` (the on-demand psych split is
> merged); `pipeline-stub-guard` is the one branch still to merge.

## At a glance

| | |
|---|---|
| **Project** | Single-page Swedish mental-health data dashboard. Vanilla JS + hand-rolled SVG, **no build step** — open `kurvan.html` in a browser. Offline Python data pipeline in `pipeline/`. |
| **Repo** | <https://github.com/KseniaBoudk/mentalHealth> |
| **Docs in repo** | `CLAUDE.md` (architecture), `FILES.txt` (per-file walkthrough), `pipeline/README.md` + `pipeline/COLLABORATION.md` |
| **Master at** | `fe8e50e` — psych 78-code on-demand split + this doc. One branch left to merge: `pipeline-stub-guard`. |

---

## 01 · What changed in the last session

**`psych-codes-ondemand`** — merged into `master` (`20d32db` + `fe8e50e`).
Makes the 78-code psychiatric-care picker actually work, cheaply.

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
| `psych-codes-ondemand` | **Merged into `master`** (`fe8e50e`) — the on-demand split + `KURVAN_HANDOFF.md`. | Delete local + origin. |
| `pipeline-stub-guard` | The Karta year fix + the `build_kurvan_data.py` keep-behaviour + these doc updates. Fast-forwards onto `master`. | Merge, then delete. |
| `fix-karta-region-card-year` | Folded into `pipeline-stub-guard` (cherry-picked). | Delete local + origin — don't merge separately. |
| `additional-f-codes` | **Obsolete** — parallel reimplementation of the psych feature, pushed to origin. | Delete: `git branch -D additional-f-codes` and `git push origin --delete additional-f-codes`. Its chart-clarity tweaks (axis titles, "per 100,000 *inhabitants*", distinct `%` labels — commits `d49bfb8` / `7781784`) are worth revisiting later; they were not ported because they collide with master's own chart changes. |
| *~20 other origin branches* | **Stale** old feature branches (mobile-view, code-optimisation, visual-theme-changes, …) | Prune per team preference — none block anything. |

---

## 03 · The data pipeline & the blanking trap

Two stages:

- **`pipeline/fetch_*.py`** — hit government APIs (Socialstyrelsen,
  Folkhälsomyndigheten, Försäkringskassan, SCB, Kolada), write
  `data/processed/*.json`. These are **gitignored** — large, and
  regenerable.
- **`pipeline/build_kurvan_data.py`** — for each source with a present
  `data/processed/*.json`, compiles it into a `js/data/real_*.js` file
  (committed — what the browser loads). A source with **no** processed
  file is **left untouched** if a compiled `real_*.js` is already
  committed (prints `KEPT ...`); only a genuine fresh clone with no
  compiled file at all gets an empty `"rows":[]` stub.

> ### The old trap — now defused
>
> Until `pipeline-stub-guard`, `build_kurvan_data.py` rewrote *every*
> `real_*.js` unconditionally, stubbing any whose input JSON was missing.
> Since `data/processed/` is gitignored, a partial run (refetch one
> source, rebuild) would silently revert every *other* committed real
> file to synthetic, and git couldn't warn you. That's fixed: missing
> input → the committed file is kept as-is.

To deliberately push a source back to synthetic: delete its
`js/data/real_*.js` and rebuild — the build then recreates it as a stub.

### Full data rebuild

- The complete ordered command list is in `pipeline/README.md` → "Running
  it" (all fetchers + `build_kurvan_data.py`, with timing estimates —
  psych ≈ 1 h is the slow one).
- Two sources have no plain fetcher in that list: **`convert_vantetider_bup.py`**
  (BUP waiting times — needs a human CSV export first, see its docstring)
  and **`../BUPS/fetch_bup_facilities.py`** (BUP clinic list, outside
  `pipeline/`). Both are committed as real data; re-run only to refresh.
- A **partial** rebuild is now safe: refetch one source, run
  `build_kurvan_data.py`, and only that source's `real_*.js` changes.

---

## 04 · Verified vs. not verified

**✓ Checked** — `python -m py_compile` on the pipeline scripts (and a live
run of `build_kurvan_data.py` confirming it now keeps inputless files);
brace
balance on the changed JS; and a **Python simulation of
`rebuildREAL_PSYCH`** against the two generated files: `"all"` resolves
from the chapter file alone, all 78 codes resolve after the codes file
merges, and `"all"` is byte-identical before and after the merge (no
double-count).

**⚠ Not checked** — no browser was available in the session. The DOM
wiring is **unconfirmed live**: the `loadPsychCodes()` trigger in
`wire()`, the re-render when the codes file lands, and the "Loading
diagnosis codes…" placeholder option.

**Do this after merging:** open `kurvan.html` → *Över tid* tab → set
indicator to *Psykiatrisk specialistvård* → open the *Typ* picker → pick a
specific code (e.g. `F32`) → confirm the charts fill in (after a brief
pause the first time). Repeat on the *Karta* tab. On the *Karta* tab, also
click a region and confirm the *Svår ängslan* line shows a number, not `—`
(the fix for that is in `pipeline-stub-guard`).

---

## 05 · Next steps

- Merge `pipeline-stub-guard` into `master`, then browser-check (§4).
- Delete the merged/obsolete branches: `psych-codes-ondemand`,
  `fix-karta-region-card-year`, `pipeline-stub-guard` (after merge),
  `additional-f-codes` — local and origin.
- *Optional:* port the chart-clarity tweaks (axis titles, "per 100,000
  inhabitants", distinct `%` labels) off `additional-f-codes` onto master —
  genuinely useful, needs manual reconciliation with master's chart-tick /
  legend changes.
- *Optional:* `fetch_socialstyrelsen_psych.py` fetches the 78 codes one
  request each (~1 h). Its docstring describes batching via comma-joined
  `diagnos=` as an available speedup.
- The committed `real_psych.js` / `real_psych_codes.js` were built from
  psych data already fetched on the machine — real, current as of that
  fetch. Re-run the fetcher whenever you want them refreshed; the build
  now leaves the other sources alone (§3).

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
