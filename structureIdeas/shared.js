"use strict";

/* Shared data-prep for the three overview-structure sketches in this folder.
   Loaded after real_mh_data.js/data.js/lang.js/state.js/charts.js/views.js
   (same load order as kurvan.html, minus shell.js — these pages don't want
   shell.js's own render()/wire() bootstrap, just its dependencies). Reuses
   the app's real functions (total(), validYears(), unitLabel(), isRealActive(),
   INST_COLOR, INST_NAME, t.notNumB, srcLine) rather than re-deriving anything
   — these are sketches of STRUCTURE, not a separate data pipeline. */

// The five original indicators this task is about — sjukfranvaro (Försäkrings-
// kassan) was added later as a deliberately-different sixth measure (see
// CLAUDE.md), not one of "the five indicators" this overview is for.
const OVERVIEW_INDS = ["distress", "antidep", "psych", "selfharm", "suicide"];

/** One summary object per indicator: national (SE) total over time, latest
    value + CI, real/synthetic flag, and the existing t.notNumB[k] caveat —
    reused as the "how this measure is limited, and so how it can diverge
    from the others" note, rather than inventing new copy for it. No
    correlation/statistics claims here on purpose: this is a structure
    sketch, and treating any cross-indicator read as a finding is exactly
    what tomorrow's plan says to hold off on. */
function buildOverviewData() {
  return OVERVIEW_INDS.map(k => {
    const I = IND[k], col = INST_COLOR[I.inst];
    const years = validYears(k);
    const pts = years.map(y => {
      const c = total(k, "SE", y, "T", false);
      return (c && !c.suppressed) ? [y, c.value] : null;
    });
    const valid = pts.filter(Boolean);
    const last = valid[valid.length - 1] || null;
    const prev = valid.length > 1 ? valid[valid.length - 2] : null;
    const cLatest = last ? total(k, "SE", last[0], "T", false) : null;

    // Direction since the previous available point, "within interval" style
    // exactly like viewRegioner's own change-bars (views.js) — a real
    // no-change reading, not silence.
    let dir = null;
    if (last && prev && cLatest) {
      const within = Math.abs(last[1] - prev[1]) < (cLatest.hi - cLatest.lo) / 2;
      dir = within ? "flat" : (last[1] > prev[1] ? "up" : "down");
    }

    return {
      key: k, name: t.ind[k], color: col, inst: I.inst, instName: INST_NAME[I.inst],
      real: isRealActive(k), unit: unitLabel(k),
      pts, latest: cLatest, latestYear: last ? last[0] : null,
      prevYear: prev ? prev[0] : null, dir,
      note: t.notNumB[k], source: srcLine(k),
    };
  });
}

const DIR_GLYPH = { up: "↑", down: "↓", flat: "→" };

// New copy for these sketches only (not merged into js/lang.js — this
// folder is throwaway exploration, per tomorrow's plan). Bilingual anyway,
// matching the app's own convention that no UI string is English-only.
const OV_COPY = {
  sv: {
    title: "Fem mått, en bild",
    lede: "Fem sätt att mäta samma breda problem, inte fem versioner av samma tal. De bygger på olika instrument och missar olika saker — därför är det intressant när de inte säger samma sak, inte vilket av dem som är \"värst\".",
  },
  en: {
    title: "Five measures, one picture",
    lede: "Five ways of measuring the same broad problem, not five versions of the same number. They're built on different instruments and miss different things — which is why it's interesting when they don't agree, not which one is \"worst\".",
  },
};
const ovT = OV_COPY[S.lang];
