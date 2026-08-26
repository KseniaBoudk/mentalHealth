"use strict";

/* =====================================================================
   3. STATE
   ===================================================================== */
function initLang(){
  try{
    const saved=localStorage.getItem("kurvan_lang");
    if(saved==="sv"||saved==="en")return saved;
    const n=(navigator.languages&&navigator.languages[0])||navigator.language||"";
    return String(n).toLowerCase().startsWith("sv")?"sv":"en";
  }
  catch(e){return "en";}
}
function initTheme(){
  try{
    const saved=localStorage.getItem("kurvan_theme");
    if(saved==="light"||saved==="dark")return saved;
    return (window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";
  }
  catch(e){return "light";}
}
const S={lang:initLang(),theme:initTheme(),tab:"laget",ind:"antidep",age:6,sex:"T",year:2024,std:true,region:"24",mapYear:null,cmpOn:false,cmpInd:null,ctxInd:"pop_density",policyFilter:"all",policySort:"desc",hbscAge:"15",hbscSex:"K",psychType:"all",medType:"all"};
// hbscAge/hbscSex: viewHbsc's own map picker (js/views.js) — HBSC's source
// has only 11/13/15 and K/M, neither of which fit S.age/S.sex's own
// ranges (S.age indexes AGES' nine bands; S.sex has a "T" HBSC doesn't
// publish), so it gets its own pair of state fields rather than reusing
// those. Defaults to 15/K: the oldest cohort and the sex with the higher
// share, the more informative default reading on first load.
// psychType/medType: viewOverTid()/viewKarta()'s diagnosis-type/
// medication-type picker, PSYCH_TYPES/MED_TYPES (js/data.js) plus "all"
// (the default — the six/five real types summed, see rebuildREAL_PSYCH()'s
// own comment on why that sum is exact, not an approximation). Only
// consulted when S.ind is "psych"/"antidep"; harmless and unread otherwise.
// mapYear: null means "latest available for the current indicator" — the
// Karta tab's own year, kept separate from `year` (Over time's) so scrubbing
// the map slider doesn't silently move the Over time tab's year underneath it.
let t=T[S.lang];
