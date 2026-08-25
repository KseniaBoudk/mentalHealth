"use strict";

/* =====================================================================
   6. SHELL
   ===================================================================== */

/* The logotype mark: the male suicide age curve, rising to its endpoint.
   The one flourish, and it is the thesis. */
const MARK=`<svg class="mark" viewBox="0 0 44 34" aria-hidden="true">
  <path d="M2,28 L8,25 L14,23 L20,21 L26,19 L32,15 L38,9 L42,4"
        fill="none" stroke="var(--oxblood)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="42" cy="4" r="3" fill="var(--oxblood)"/>
  <path d="M2,31 L14,26 L26,24 L42,22" fill="none" stroke="var(--teal)" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>
</svg>`;

// All nine sections render every time, in this order — the sidebar's
// links and scroll-spy (in wire()) both walk this same list, so adding a
// section here is the only place that needs touching.
const SECTIONS=["laget","over_tid","karta","behov","sjukskrivning","kon","alder","sammanhang","vantetider","hbsc","metod","regioner","policy_news"];
const VIEW_FN={laget:viewLaget,over_tid:viewOverTid,karta:viewKarta,behov:viewBehov,
  sjukskrivning:viewSjukskrivning,kon:viewKon,alder:viewAlder,sammanhang:viewSammanhang,
  vantetider:viewVantetider,hbsc:viewHbsc,metod:viewMetod,regioner:viewRegioner,policy_news:viewPolicyNews};

// The 9 real-data sources (js/data/*.js), lazy-loaded by loadRealSourcesLazily()
// near the bottom of this file — declared here, not there, purely so its
// .length is available for realSourcesPending below BEFORE the very first
// render() runs (loadRealSourcesLazily() itself is still only ever CALLED
// after that first render, unchanged — see that function's own comment).
const REAL_SOURCES=[
  {file:"js/data/real_mh.js",         rebuild:()=>{REAL=rebuildREAL();}},
  {file:"js/data/real_psych.js",      rebuild:()=>{REAL_PSYCH=rebuildREAL_PSYCH();}},
  {file:"js/data/real_hlv.js",        rebuild:()=>{REAL_HLV=rebuildREAL_HLV();}},
  {file:"js/data/real_lakemedel.js",  rebuild:()=>{REAL_ANTIDEP=rebuildREAL_ANTIDEP();}},
  {file:"js/data/real_fk.js",         rebuild:()=>{REAL_FK=rebuildREAL_FK();}},
  {file:"js/data/real_context.js",    rebuild:()=>{CONTEXT=rebuildCONTEXT();}},
  {file:"js/data/real_bup.js",        rebuild:()=>{BUP_WAIT=rebuildBUP_WAIT();}},
  {file:"js/data/real_hbsc.js",       rebuild:()=>{HBSC=rebuildHBSC();}},
  {file:"js/data/real_pop.js",        rebuild:()=>{REAL_POP=rebuildREAL_POP();NATIONAL_AGE_WEIGHTS=rebuildNATIONAL_AGE_WEIGHTS();}},
];
// How many of the 9 are still in flight — render()'s #synth banner shows a
// "still loading" sub-line while this is above 0 (see t.loadingRemaining,
// js/lang.js). Starts at the full count so it's accurate on the very first
// paint, before loadRealSourcesLazily() has even run once.
let realSourcesPending=REAL_SOURCES.length;

// render() rebuilds the whole #app innerHTML from scratch on every state
// change — a map click or a filter change goes through the exact same path
// as the initial load, recreating <main> as a brand-new DOM node each time.
// A CSS animation on a bare selector would replay on every one of those;
// this flag limits the fade-in to the actual first paint.
let firstRender=true;
// Zoom+pan per map slot ({z,x,y}, keyed by the id mapZoomWrap() gives each
// map, views.js) — z=1,x=0,y=0 is unzoomed/centred. Lives here rather than
// in S since it's pure presentation, not app state — a language toggle or
// filter change shouldn't reset how far in you'd zoomed or panned.
// Declared at module scope (not inside wire()) so it survives every
// render()'s DOM rebuild; wire() reapplies it to whatever fresh .mapsvg
// nodes render() just created, the same way measureBanner() reapplies
// --banner-h every call.
const mapView={};
const ZOOM_MIN=1,ZOOM_MAX=3,ZOOM_STEP=0.5;
// Set the moment a drag actually moves the map (not just a click-hold), so
// the tile click handler below can tell "clicked a region" apart from "let
// go after panning" and skip the region-select it would otherwise fire —
// without this, releasing a pan over a different region than it started on
// would silently select that region.
let dragMoved=false;
let currentIo = null;
// A #app CSS selector for whatever map content is currently shown full-
// screen, if any (see wireFullscreen()) — lets a render() that happens
// WHILE still fullscreen (a map click's S.region update, e.g., still runs
// pick()'s render() same as always) swap the freshly-rebuilt copy of THAT
// SAME content into view. `.mapzoom[data-mapid="..."]` for a lone map
// (the original, single-map case); `.mapcmp` for Karta's compare-two-maps
// mode, where full-screening either mini-map's own expand button pulls
// BOTH into view together, not just the one that was clicked — matches
// what "full-screen a comparison" should mean. Was literally just a bare
// data-mapid string before compare mode needed this same mechanism to
// re-sync a two-map PAIR, not one map — a selector covers both shapes
// with the same re-sync code below, unchanged either way.
let fsMapId=null;
// Whichever [data-tip] mark is currently click-pinned open in #tiletip, if
// any (see wire()'s click handling below) — module scope, same "survives
// individual event handlers, reset explicitly on the next render" pattern
// as mapView/fsMapId above, for the same reason: render() rebuilds the DOM
// from scratch, so a pinned reference from before a render is a dangling
// node, not a real pin any more.
let pinnedMark=null;
// #tiletip itself — module scope too (not re-declared inside wire() every
// call): it's created once and reused for the whole page's lifetime
// (wire() below just fetches-or-creates it), so the functions that read
// and write it don't need to be recreated on every render either. Doing
// this once also lets the document-level click/keydown listeners further
// down attach once at module load, the same way document.onfullscreenchange
// above already does, rather than piling up a fresh listener on every
// render() the way anything registered inside wire() itself would.
let tip=null;
// pinned=true for the click-pinned card (kurvan.css gives #tiletip.pinned
// position:absolute, i.e. document-relative, instead of the hover tip's
// position:fixed/viewport-relative) — clamping still uses the viewport
// bounds at the moment of pinning (so it never opens off-screen), but the
// stored left/top then get the current scroll offset added on top, which
// is what makes it a document coordinate. Scrolling afterwards moves the
// whole document including this element, exactly like every other mark on
// the page, so the card travels with the point it's pinned to instead of
// either freezing over the viewport or having to be re-positioned by a
// scroll handler on every frame.
const positionTip=(x,y,pinned)=>{
  const m=10,vw=innerWidth,vh=innerHeight,tw=tip.offsetWidth,th=tip.offsetHeight;
  let left=x+14,top=y+14;
  if(left+tw>vw-m)left=x-14-tw;
  if(top+th>vh-m)top=y-14-th;
  left=Math.max(m,Math.min(left,vw-tw-m));
  top=Math.max(m,Math.min(top,vh-th-m));
  if(pinned){left+=window.scrollX;top+=window.scrollY;}
  tip.style.left=left+"px";
  tip.style.top=top+"px";
};
// Hover/focus card — a no-op while something is click-pinned (below), so
// moving the mouse over a different mark doesn't yank the pinned card away
// out from under someone who clicked specifically to keep it in place.
const showTip=(text,x,y)=>{
  if(pinnedMark||!tip)return;
  tip.textContent=text;tip.style.display="block";
  positionTip(x,y);
};
const hideTip=()=>{
  if(pinnedMark||!tip)return;
  tip.style.display="none";
};
// Click-to-pin: the same richer .rstat readout full-screen mode already
// shows on click (readoutCardHTML(), below) — kept open regardless of the
// mouse moving away, until explicitly unpinned. Gives line-chart points
// and histogram bars (the two mark types with no other click behavior —
// see wire()'s [data-tip] loop) a real "tap for the number" on touch
// devices too, which they had nothing for before (a tap fires no
// mouseenter to fall back on).
const pinTip=(mark,x,y)=>{
  if(!tip)return;
  pinnedMark=mark;
  tip.innerHTML=readoutCardHTML(mark);
  tip.classList.add("pinned");
  tip.style.display="block";
  positionTip(x,y,true);
};
const unpinTip=()=>{
  if(!pinnedMark)return;
  pinnedMark=null;
  if(!tip)return;
  tip.classList.remove("pinned");
  tip.style.display="none";
};
// Click anywhere that isn't a [data-tip] mark unpins — #tiletip itself is
// pointer-events:none (kurvan.css), so a click can never actually land ON
// the pinned card, only ever on whatever's underneath it or elsewhere on
// the page; either way, if it didn't land on a mark, it means "done with
// this". Escape unpins too, the same key full-screen mode's own Esc
// already closes on (though that's the browser's native Fullscreen API,
// unrelated to this listener). All three registered once, here, not
// inside wire() — see the `tip` declaration's own comment above for why.
document.addEventListener("click",e=>{
  if(pinnedMark&&!e.target.closest("[data-tip]"))unpinTip();
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")unpinTip();
});
// Left/Right steps Karta's year slider — but only while focus is actually
// on it (.slidewrap or its own prev/next buttons), not globally on the
// whole page: arrow keys already mean something native and expected
// inside a <select> (cycle its own options) or anywhere else focus might
// legitimately be, and blindly hijacking them page-wide would break that.
// Reuses c-yprev/c-ynext's own existing onclick (stepYear(), wire()
// below) via a plain .click() rather than re-deriving the step-year logic
// here — a disabled button (already-first/-last year, same rule that
// already disables it visually) just no-ops on .click(), so the boundary
// is handled for free. stepYear() itself re-focuses the fresh button
// after every step (mouse click OR this), so repeated arrow presses keep
// working — nothing extra needed here for that.
document.addEventListener("keydown",e=>{
  if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;
  const active=document.activeElement;
  if(!active||!active.closest(".slidewrap"))return;
  e.preventDefault();
  document.getElementById(e.key==="ArrowLeft"?"c-yprev":"c-ynext")?.click();
});

// Shareable/bookmarkable URL — reflects a chosen subset of S (js/state.js)
// into the address bar (stateFromUrl() reads it back on load, before the
// very first render() — see the bottom of this file) so a specific view
// can be linked or bookmarked instead of only ever describable in words.
// Every incoming value is checked through the same helpers the rest of the
// app already uses to keep a selection sane (ageAvailable()/sexAvailable()/
// IND/SECTIONS/REGIONS membership, js/data.js) — an invalid or stale value
// (a hand-edited URL, or an old link whose psychType no longer exists) is
// just left at S's own default rather than applied. Real-data-dependent
// bounds (ageAvailable() etc.) are checked against whatever REAL_X.active
// is at THIS moment — before loadRealSourcesLazily() has loaded anything —
// so this is necessarily a looser check than once real data lands; that's
// fine, the app already renders "no real data for this cell" gracefully
// rather than crashing (isRealActive()/cell(), js/data.js), same as it
// always has for any state that predates a source finishing its load.
const URL_STATE_KEYS=["tab","ind","age","sex","region","year","std","mapYear","cmpOn","cmpInd","ctxInd","psychType","medType","hbscAge","hbscSex","lang"];
function stateFromUrl(){
  const p=new URLSearchParams(location.search);
  if(![...p.keys()].length)return;
  // ind/tab first — several of the checks below (ageAvailable, sexAvailable)
  // read S.ind, so it has to already reflect the URL's own value, not
  // whatever S started at, by the time they run.
  if(p.has("lang")){const v=p.get("lang");if(v==="sv"||v==="en")S.lang=v;}
  if(p.has("ind")&&IND[p.get("ind")])S.ind=p.get("ind");
  if(p.has("tab")&&SECTIONS.includes(p.get("tab")))S.tab=p.get("tab");
  if(p.has("age")){const v=+p.get("age");if(Number.isInteger(v)&&v>=-1&&v<=8&&ageAvailable(S.ind,v))S.age=v;}
  if(p.has("sex")){const v=p.get("sex");if((v==="M"||v==="K"||v==="T")&&sexAvailable(S.ind,v))S.sex=v;}
  if(p.has("region")){const v=p.get("region");if(v==="SE"||REGIONS.some(r=>r[0]===v))S.region=v;}
  if(p.has("year")){const v=+p.get("year");if(Number.isInteger(v)&&v>1990&&v<2100)S.year=v;}
  if(p.has("std"))S.std=p.get("std")==="1";
  if(p.has("mapYear")){const v=+p.get("mapYear");S.mapYear=Number.isInteger(v)?v:null;}
  if(p.has("cmpOn"))S.cmpOn=p.get("cmpOn")==="1";
  if(p.has("cmpInd")&&IND[p.get("cmpInd")])S.cmpInd=p.get("cmpInd");
  if(p.has("ctxInd")&&CONTEXT_META[p.get("ctxInd")])S.ctxInd=p.get("ctxInd");
  if(p.has("psychType")){const v=p.get("psychType");if(v==="all"||PSYCH_TYPES.includes(v))S.psychType=v;}
  if(p.has("medType")){const v=p.get("medType");if(v==="all"||MED_TYPES.includes(v))S.medType=v;}
  if(p.has("hbscAge")){const v=p.get("hbscAge");if(v==="11"||v==="13"||v==="15")S.hbscAge=v;}
  if(p.has("hbscSex")){const v=p.get("hbscSex");if(v==="K"||v==="M")S.hbscSex=v;}
}
// Called at the end of every render() — history.replaceState, not
// pushState, so nudging a selector doesn't spam the browser's back button;
// only an actual navigation (or the explicit "Copy link" button) is meant
// to be a shareable moment, not every intermediate state on the way there.
function syncUrlFromState(){
  const p=new URLSearchParams();
  URL_STATE_KEYS.forEach(k=>{
    const v=S[k];
    if(v===null||v===undefined||v==="")return;
    p.set(k,typeof v==="boolean"?(v?"1":"0"):String(v));
  });
  const qs="?"+p.toString();
  if(location.search!==qs)history.replaceState(null,"",qs+location.hash);
}
let urlTabScrolled=false;

function render(){
  t=T[S.lang];
  document.documentElement.setAttribute("data-theme",S.theme);
  document.documentElement.lang=S.lang;
  // rs (views.js) walks IND/isRealActive() itself, so this banner counts
  // and names indicators the same way viewMetod()'s table does — it can't
  // fall behind the data the way a hand-typed "four of five" already did.
  const rs=realSummary();
  // synthN===0 checked first: rs.n>0 alone is also true once EVERY
  // indicator is real, but synthPartialB/footBPartial/realNoteOn's
  // sentences hard-assume there's at least one synthetic indicator left to
  // name in synthNames — with that empty, they used to read "Only  is
  // still generated". synthAllB/footBAll/realNoteAll are the versions
  // without that clause, for exactly this case.
  document.getElementById("synth").innerHTML = (rs.synthN===0
    ? `<b>${esc(t.synthAllT)}</b><span>${esc(t.synthAllB(rs.total,rs.realNames))}</span>`
    : rs.n>0
    ? `<b>${esc(t.synthPartialT)}</b><span>${esc(t.synthPartialB(rs.n,rs.total,rs.realNames,rs.synthNames,rs.synthN))}</span>`
    : `<b>${esc(t.synthT)}</b><span>${esc(t.synthB)}</span>`)
    + (realSourcesPending>0?`<span class="loadingsub">${esc(t.loadingRemaining(realSourcesPending))}</span>`:"");

  // Every section gets the same landmark heading (its sidebar label) above
  // its own content, regardless of whether that view already has an
  // internal "kick" label of its own (laget/behov/sjukskrivning do) — a
  // long scroll-through page needs an unambiguous title per section more
  // than it needs to avoid that small bit of redundancy.
  const sections=SECTIONS.map(x=>
    `<section id="sec-${x}"><h2 class="section-h">${esc(t.tabs[x])}</h2>${VIEW_FN[x]()}</section>`
  ).join("");

  document.getElementById("app").innerHTML=`
    <header class="top"><div class="wrap">
      <div class="mast">
        <div class="brand">${MARK}
          <div><div class="word">${esc(t.word)}</div><div class="sub">${esc(t.sub)}</div></div>
        </div>
        <div class="tools">
          <button id="b-copylink">${esc(t.copyLink)}</button>
          <button id="b-theme">${esc(S.theme==="light"?t.themeD:t.themeL)}</button>
          <button id="b-lang">${esc(t.langBtn)}</button>
        </div>
      </div>
      <div class="stamp tnum">${esc(t.stamp)}</div>
    </div></header>
    <main${firstRender?' class="tabenter"':""}><div class="wrap layout">
      <nav class="sidebar">
        ${SECTIONS.map(x=>`<a href="#sec-${x}" data-sec="${x}" class="${S.tab===x?"active":""}">${esc(t.tabs[x])}</a>`).join("")}
      </nav>
      <div class="content">
        ${sections}
        <div class="help"><span><b>${esc(t.helpA)}</b></span><span>${esc(t.helpB)}</span><span><b>${esc(t.helpC)}</b></span></div>
      </div>
    </div></main>
    <footer><div class="wrap"><p>${esc(t.footA)}</p><p>${esc(rs.synthN===0?t.footBAll(rs.total,rs.realNames):rs.n>0?t.footBPartial(rs.n,rs.total,rs.realNames,rs.synthNames,rs.synthN):t.footB)}</p></div></footer>`;
  firstRender=false;
  wire();
  syncUrlFromState();
  // A tab named in the incoming URL means "open on this section" — scroll
  // to it once, right after the very first render (every section already
  // exists on the page by then; this is the same scrollIntoView() idiom
  // scrollToRegion()/b-openbehov already use elsewhere in wire()). Only
  // ever fires once: urlTabScrolled guards against a later render (a real
  // source landing, a selector change) re-triggering the jump and yanking
  // the reader back to that section mid-scroll on their own.
  if(!urlTabScrolled){
    urlTabScrolled=true;
    if(new URLSearchParams(location.search).has("tab")){
      const el=document.getElementById(`sec-${S.tab}`);
      if(el)el.scrollIntoView({behavior:"smooth"});
    }
  }
}

// #synth wraps to a different number of lines depending on content and
// viewport width, so its height can't be hardcoded — measured here and
// exposed as --banner-h for .sidebar's sticky offset (kurvan.css) to read.
// Re-measured on resize since a width change can reflow it to more/fewer
// lines. Not tied to render()'s own reflow (S.lang/theme changes already
// trigger a fresh render → fresh measure via the call at the bottom of
// wire()), just to window resizes render() has no other hook for.
function measureBanner(){
  const el=document.getElementById("synth");
  if(el)document.documentElement.style.setProperty("--banner-h",el.offsetHeight+"px");
}
window.onresize=measureBanner;

// Exiting full-screen (Esc or #chartFsClose, both funnel through the
// browser's one fullscreenchange event) puts the page back to normal:
// hide/clear the overlay, then render() — which rebuilds #app fresh, so
// the svg wireFullscreen() moved out reappears exactly where it started,
// with a brand-new expand button already wired, without this needing to
// track the svg's original parent/sibling itself. Set once here (not
// inside wire()) since it's a document-level listener, not tied to any
// one render. Fires on ENTERING fullscreen too (fullscreenElement is
// truthy then) — only the leaving case needs cleanup.
document.onfullscreenchange=()=>{
  if(document.fullscreenElement)return;
  const fs=document.getElementById("chartFs");
  if(!fs)return;
  fs.classList.remove("on");
  document.getElementById("chartFsBody").innerHTML="";
  document.getElementById("chartFsReadout").textContent="";
  fsMapId=null;
  // #tiletip moved in alongside the chart (see wireFullscreen()) so hover
  // still shows a card while fullscreened — move it back to <body> now, or
  // the normal page's own hover cards stop working after exiting. Local
  // name (not the module-scope `tip`, deliberately) — this is just a
  // one-off DOM move, not a reason to touch the shared tip/pin machinery.
  const tipEl=document.getElementById("tiletip");
  if(tipEl)document.body.appendChild(tipEl);
  render();
};

function wire(){
  measureBanner();
  // A pinned mark from before this render is a dangling reference to a DOM
  // node render() just discarded (#app was rebuilt from scratch) — not a
  // real pin any more. Same reasoning as mapView/fsMapId's own module-scope
  // comment above; unpinTip() itself also no-ops safely if nothing was
  // pinned, so this is harmless on the very first call too.
  unpinTip();
  // Sidebar links are plain #anchors — the browser handles the actual
  // jump (html{scroll-behavior:smooth} in kurvan.css). This only needs to
  // track which section is active for the highlight, via IntersectionObserver
  // rather than on click, so it stays correct on free scrolling too, not
  // just after a link click.
  const sidebarLinks=[...document.querySelectorAll(".sidebar a")];
  if(currentIo) currentIo.disconnect();
  currentIo=new IntersectionObserver(entries=>{
    entries.forEach(en=>{
      if(!en.isIntersecting)return;
      const sec=en.target.id.slice(4);
      S.tab=sec;
      sidebarLinks.forEach(a=>a.classList.toggle("active",a.dataset.sec===sec));
    });
  },{rootMargin:"-15% 0px -70% 0px"});
  document.querySelectorAll('section[id^="sec-"]').forEach(s=>currentIo.observe(s));
  // Explicit affordance for the URL syncUrlFromState() already keeps
  // current (render(), above) — most people won't notice a query string
  // silently changing in the address bar, so this is the actual "share
  // this view" action, with visible confirmation rather than a silent
  // clipboard write. navigator.clipboard needs a secure context; file:
  // origins count as one in Chromium, which is what this app is built
  // for (CLAUDE.md), so no fallback path here.
  const cl=document.getElementById("b-copylink");
  if(cl)cl.onclick=()=>{
    const prev=cl.textContent;
    const flash=label=>{cl.textContent=label;setTimeout(()=>{cl.textContent=prev;},1500);};
    // .catch(), not just .then(): a rejected clipboard write (permission
    // denied, or a browser/context that doesn't grant it at all) is a real
    // possibility, not a hypothetical — surfaced as an actual uncaught
    // page error during this session's own Playwright verification before
    // this existed. Fails visibly (brief "failed" flash) rather than
    // silently or as a console error either way.
    navigator.clipboard.writeText(location.href).then(()=>flash(t.linkCopied)).catch(()=>flash(t.linkCopyFailed));
  };
  const th=document.getElementById("b-theme");if(th)th.onclick=()=>{S.theme=S.theme==="light"?"dark":"light";render();};
  const lg=document.getElementById("b-lang");if(lg)lg.onclick=()=>{S.lang=S.lang==="sv"?"en":"sv";render();};
  const bind=(id,fn)=>{const e=document.getElementById(id);if(e)e.onchange=()=>{fn(e.value);render();};};
  const pickInd=v=>{S.ind=v;if(!ageAvailable(v,S.age))S.age=-1;if(!sexAvailable(v,S.sex))S.sex="T";S.mapYear=null;};
  bind("c-ind",pickInd);
  bind("c-age",v=>S.age=+v);
  bind("c-sex",v=>S.sex=v);
  bind("c-reg",v=>S.region=v);
  bind("c-reg2",v=>S.region=v);
  bind("c-year",v=>S.year=+v);
  bind("c-mapind",pickInd);
  // c-type (viewOverTid)/c-maptype (viewKarta) — same one selector's worth
  // of options either way (PSYCH_TYPES or MED_TYPES, js/data.js), routed to
  // whichever of S.psychType/S.medType actually applies to the CURRENT
  // S.ind — the control only ever renders when S.ind is "psych"/"antidep"
  // in the first place (views.js's hasType), so this is never ambiguous.
  const pickType=v=>{if(S.ind==="psych")S.psychType=v;else if(S.ind==="antidep")S.medType=v;};
  bind("c-type",pickType);
  bind("c-maptype",pickType);
  bind("c-cmpind",v=>S.cmpInd=v);
  bind("c-ctxind",v=>S.ctxInd=v);
  bind("c-hbscage",v=>S.hbscAge=v);
  bind("c-hbscsex",v=>S.hbscSex=v);
  bind("c-policy-filter",v=>S.policyFilter=v);
  bind("c-policy-sort",v=>S.policySort=v);
  const ct=document.getElementById("c-cmptoggle");
  if(ct)ct.onclick=()=>{S.cmpOn=!S.cmpOn;render();};
  const stepYear=d=>{
    const years=validYears(S.ind);
    const idx=years.includes(S.mapYear)?years.indexOf(S.mapYear):years.length-1;
    S.mapYear=years[Math.max(0,Math.min(years.length-1,idx+d))];
    render();
    // render() just rebuilt #app from scratch, detaching whichever
    // c-yprev/c-ynext button triggered this step (a plain mouse click
    // focuses it same as any button — confirmed live: activeElement was
    // <body> right after a real click, not the button, because the node
    // it had just focused no longer exists once render() finishes).
    // Without re-focusing a FRESH one here, the natural next move — click
    // again, or the arrow-key listener below — lands on nothing. Prefer
    // the button matching this step's own direction, falling back to the
    // other one if THAT one is now disabled (a year boundary just
    // reached) so the reverse direction stays usable immediately, no
    // manual re-tab needed.
    const id=d<0?"c-yprev":"c-ynext";
    const fresh=document.getElementById(id);
    (fresh&&!fresh.disabled?fresh:document.getElementById(d<0?"c-ynext":"c-yprev"))?.focus();
  };
  const yp=document.getElementById("c-yprev"),yn=document.getElementById("c-ynext");
  if(yp)yp.onclick=()=>stepYear(-1);
  if(yn)yn.onclick=()=>stepYear(1);
  document.querySelectorAll(".seg button").forEach(b=>
    b.onclick=()=>{S.std=b.dataset.std==="1";render();});
  // Single tooltip element, created once and reused — it lives outside
  // #app (on <body>) specifically so render()'s full innerHTML rebuild on
  // every state change doesn't destroy and recreate it. Assigns the
  // module-scope `tip` (declared above render()) rather than a local, so
  // showTip()/hideTip()/pinTip()/unpinTip() — also module-scope, for the
  // same reason — keep working on the one true element across renders.
  tip=document.getElementById("tiletip");
  if(!tip){tip=document.createElement("div");tip.id="tiletip";document.body.appendChild(tip);}
  // .tile is the map's regions — clickable/keyboard-selectable, same as
  // .spt (scatter points) and .dotrow (dot-plot rows) below. hideTip()
  // first: render() rebuilds #app (including this very tile) without ever
  // firing this tile's mouseleave, so without this the card from the tile
  // under a still-stationary cursor was left stuck on screen until the
  // mouse next moved.
  document.querySelectorAll(".tile").forEach(b=>{
    // dragMoved: a pan gesture (wireMapZoomPan()) ending over this tile
    // isn't a click on it — skip the region-select once and reset, so the
    // next genuine click behaves normally.
    const pick=()=>{if(dragMoved){dragMoved=false;return;}hideTip();S.region=b.dataset.region;render();};
    b.onclick=pick;
    b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick();}};
  });
  // Scatter points (charts.js's scatter(), e.g. viewBehov/viewRegioner's
  // need-vs-response charts) — same region-select-on-click as map tiles
  // above, minus the dragMoved guard (no pan gesture here to disambiguate
  // from a click). Kept as its own block rather than merged with .tile's:
  // the two aren't quite identical, and it's only two call sites.
  document.querySelectorAll(".spt").forEach(b=>{
    const pick=()=>{hideTip();S.region=b.dataset.region;render();};
    b.onclick=pick;
    b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick();}};
  });
  // dotPlot()'s rows (viewOverTid's "All 21 regions" chart) — same
  // pattern again. viewOverTid() itself already renders a "selected
  // region" card from whichever region this lands on, the same way a map
  // click already updates every other tab's own side panel.
  document.querySelectorAll(".dotrow").forEach(b=>{
    const pick=()=>{hideTip();S.region=b.dataset.region;render();};
    b.onclick=pick;
    b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick();}};
  });
  // Every mark that carries data-tip gets the same hover card — map tiles
  // (data-tip set alongside the click handling above), dot-plot rows,
  // histogram bars, scatter points, and line-chart points (charts.js) all
  // use it, so one loop wires all five chart types instead of repeating
  // this per chart type.
  document.querySelectorAll("[data-tip]").forEach(b=>{
    b.onmouseenter=e=>showTip(b.dataset.tip,e.clientX,e.clientY);
    b.onmousemove=e=>showTip(b.dataset.tip,e.clientX,e.clientY);
    b.onmouseleave=hideTip;
    // Keyboard focus gets the same card, positioned off the mark itself
    // since focus (unlike a mouse) carries no cursor coordinates. Gated on
    // :focus-visible (same heuristic .tile:focus-visible's outline already
    // uses, kurvan.css) so a mouse click on a .tile — which also moves
    // focus, but has already positioned the card at the cursor via
    // onmouseenter/onmousemove above — doesn't yank it down to the mark's
    // bottom edge right after.
    b.onfocus=()=>{if(b.matches(":focus-visible")){const r=b.getBoundingClientRect();showTip(b.dataset.tip,r.left,r.bottom);}};
    b.onblur=hideTip;
    // Click-to-pin the richer readout card (pinTip(), module scope above),
    // but only for marks that don't already have their OWN click handler —
    // .tile/.spt/.dotrow above all repurpose click for region-select
    // instead, and keep doing exactly that; this only reaches line-chart
    // points and histogram bars, which had no click reaction at all before
    // (and so, no reaction to a touch tap either — a tap fires no
    // mouseenter to fall back on). Clicking the currently-pinned mark
    // again unpins; clicking a different one re-pins to that one instead.
    if(!b.onclick){
      b.onclick=e=>{
        // Full-screen moves the whole chart (MOVE not clone, see
        // wireFullscreen()'s own comment) — this listener comes along with
        // it, still attached to the same mark. Without this branch,
        // e.stopPropagation() below would swallow the click before it could
        // ever bubble up to #chartFsBody's OWN delegated handler
        // (wireFullscreen()), which is what actually writes full-screen's
        // always-visible readout strip at the bottom. A floating pinned
        // card doesn't make sense on top of that strip anyway, so write
        // straight into it instead and skip the pin path entirely — the
        // same thing map tiles/dot-plot rows already get here for free,
        // since their own pre-existing onclick (region-select, above) means
        // they never picked up this handler, and their clicks always
        // reached #chartFsBody's listener untouched.
        if(b.closest("#chartFs")){renderReadoutCard(b);return;}
        e.stopPropagation();
        if(pinnedMark===b){unpinTip();return;}
        pinTip(b,e.clientX,e.clientY);
      };
      b.onkeydown=e=>{
        if(e.key!=="Enter"&&e.key!==" ")return;
        e.preventDefault();
        if(b.closest("#chartFs")){renderReadoutCard(b);return;}
        if(pinnedMark===b){unpinTip();return;}
        const r=b.getBoundingClientRect();
        pinTip(b,r.left,r.bottom);
      };
    }
  });
  // Used to switch tabs; every section already exists on the page now
  // (already showing the current S.region — that was set by the map click
  // that got the reader here), so "open" just means "scroll to it".
  const scrollToRegion=()=>{const el=document.getElementById("sec-regioner");if(el)el.scrollIntoView({behavior:"smooth"});};
  const or=document.getElementById("b-openregion");
  if(or)or.onclick=scrollToRegion;
  document.querySelectorAll(".btn-openregion").forEach(b=>b.onclick=scrollToRegion);
  const ob=document.getElementById("b-openbehov");
  if(ob)ob.onclick=()=>document.getElementById("sec-behov").scrollIntoView({behavior:"smooth"});
  wireMapZoomPan();
  paintTrendArrows();
  wireFullscreen();
}

// Builds one mark's data-card payload (charts.js's dataCard(), attached to
// every hoverable mark alongside its data-tip) into the SAME .rstat card
// markup the rest of the app already uses for a region/value figure
// (viewKarta's side card, viewKon's women/men pair, ...) — reusing those
// existing classes/CSS rather than a plain data-tip sentence. Falls back to
// the plain tip text (still HTML-escaped — this return value is assigned
// via innerHTML) if a mark somehow has no data-card (defensive; every
// primitive sets one). Pure string builder, no DOM writes of its own, so
// both the full-screen readout strip AND the inline click-pinned #tiletip
// (wire(), below) can each drop it into whichever element they own.
function readoutCardHTML(mark){
  let data=null;
  try{data=JSON.parse(mark.dataset.card||"null");}catch(e){/* fall through to plain text below */}
  if(!data)return esc(mark.dataset.tip||"");
  const col=data.color||"var(--ink)";
  const rows=(data.rows||[]).map(r=>`
    ${r.label?`<div class="rk" style="margin-top:10px;color:var(--ink-2)">${esc(r.label)}</div>`:""}
    <div class="rv tnum">${esc(r.value)}${r.unit?` <span style="font-size:13px;color:var(--ink-3)">${esc(r.unit)}</span>`:""}</div>
    ${r.ci?`<div class="rci tnum">95% ${ciWord()} ${esc(r.ci)}</div>`:""}`).join("");
  return `<div class="rstat" style="border-top-color:${col}">
    <div class="rk" style="color:${col}"><span class="dot" style="background:${col}"></span>${esc(data.title)}</div>
    ${rows}
  </div>`;
}
function renderReadoutCard(mark){
  document.getElementById("chartFsReadout").innerHTML=readoutCardHTML(mark);
}
// Karta's compare-two-maps mode, fullscreened as a pair (cmpPair,
// wireFullscreen()) — a region click there should show BOTH maps' numbers
// for that region side by side, not just the one actually clicked,
// otherwise fullscreen would be showing a comparison while only ever
// reading out half of it. .rstats (kurvan.css) is the same 2-3-column
// card-grid class viewKarta's own side panel already uses elsewhere;
// explicit 1fr 1fr here since this is always exactly a pair, not
// .rstats' own default 3-up.
function renderReadoutCardPair(markA,markB){
  const cards=[markA,markB].filter(Boolean).map(readoutCardHTML).join("");
  document.getElementById("chartFsReadout").innerHTML=`<div class="rstats" style="grid-template-columns:1fr 1fr">${cards}</div>`;
}

// PNG/CSV export (wireFullscreen()'s #chartFsPng/#chartFsCsv, below) — both
// act on whichever chart is CURRENTLY in #chartFsBody, so neither needs to
// know which chart type it is.
function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
// S.tab, not the chart's own title: stable and filesystem-safe (tab keys
// are plain ascii identifiers, e.g. "over_tid" — a title string can carry
// Swedish characters/punctuation a filename would rather not have to deal
// with) and still tells the reader which page they exported from.
function fsFilenameBase(){
  return `kurvan-${S.tab}-${new Date().toISOString().replace(/[:.]/g,"-").slice(0,19)}`;
}
// Copies every relevant *computed* style (not the custom-property-laden
// attributes/classes charts.js actually writes, e.g. fill="var(--violet)")
// from each element in the live, on-page SVG onto the matching element in
// its detached clone, as a plain inline style. Needed because the clone
// gets serialized and handed to an <img> as a standalone blob: URL with no
// linked stylesheet and no access to :root's custom properties — without
// this, every var(--x) color and any kurvan.css rule (.chart-svg text{...}
// etc.) would simply fail to resolve in that context and the exported
// image would render wrong (missing colors/text sizing) or not at all.
// getComputedStyle() on the STILL-ATTACHED original always returns fully
// resolved values regardless of how the color was originally specified, so
// walking both trees in parallel (cloneNode(true) preserves structure and
// therefore querySelectorAll("*") order 1:1) is enough to bake the current
// theme's actual rendering into the clone.
const SVG_EXPORT_PROPS=["fill","stroke","stroke-width","stroke-dasharray","stroke-linecap","stroke-linejoin","opacity","font-family","font-size","font-weight","text-anchor","letter-spacing"];
function bakeComputedStyles(liveRoot,cloneRoot){
  const liveEls=[liveRoot,...liveRoot.querySelectorAll("*")];
  const cloneEls=[cloneRoot,...cloneRoot.querySelectorAll("*")];
  liveEls.forEach((el,i)=>{
    const ce=cloneEls[i];
    if(!ce)return;
    const cs=getComputedStyle(el);
    let style="";
    SVG_EXPORT_PROPS.forEach(p=>{const v=cs.getPropertyValue(p);if(v)style+=`${p}:${v};`;});
    ce.setAttribute("style",style);
  });
}
// document.querySelector, singular, deliberately — Karta's compare-two-
// maps mode can fullscreen a .mapcmp holding TWO svg.chart-svg (see
// wireFullscreen()'s cmpPair handling). PNG/CSV export both just take
// whichever one this finds first, i.e. the left/first map of the pair —
// a reasonable, non-crashing default (not silently wrong data, just
// "half the comparison"), not extended into a two-chart export here.
function exportChartPng(){
  const svg=document.querySelector("#chartFsBody svg.chart-svg");
  if(!svg)return;
  const clone=svg.cloneNode(true);
  bakeComputedStyles(svg,clone);
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  // Aspect ratio from the viewBox (needed — that's the svg's own internal
  // coordinate system), but the actual export RESOLUTION from a fixed
  // target width, not the viewBox's own units directly: chorMap()'s
  // MAP_VIEWBOX (charts.js) is a tiny fractional geographic unit like
  // "0 0 6.09 13.69", nothing like the ~600x400-ish pixel-scale viewBox
  // every other chart type happens to use. Setting width/height straight
  // from THAT would make the exported image's intrinsic size ~6x14px —
  // technically valid, but a near-blank sliver once actually opened.
  // Decoupling resolution from viewBox units entirely fixes the map case
  // and is no worse for every other chart type either.
  const vb=(svg.getAttribute("viewBox")||"0 0 600 400").split(/\s+/).map(Number);
  const vbW=vb[2]||600,vbH=vb[3]||400;
  const targetW=1200;
  const w=targetW,h=Math.round(targetW*(vbH/vbW));
  clone.setAttribute("width",w);
  clone.setAttribute("height",h);
  const svgBlob=new Blob([new XMLSerializer().serializeToString(clone)],{type:"image/svg+xml;charset=utf-8"});
  const url=URL.createObjectURL(svgBlob);
  const img=new Image();
  img.onload=()=>{
    const scale=2; // sharper than 1:1 on a high-DPI screen without going overboard
    const canvas=document.createElement("canvas");
    canvas.width=w*scale;canvas.height=h*scale;
    const ctx=canvas.getContext("2d");
    // #chartFs's own background (var(--surface)) — light or dark depending
    // on the CURRENT theme — not a hardcoded white, since the SVG itself
    // has no background and light text on a forced-white backdrop would be
    // unreadable in dark mode.
    ctx.fillStyle=getComputedStyle(document.getElementById("chartFs")).backgroundColor||"#fff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob=>{if(blob)downloadBlob(blob,fsFilenameBase()+".png");},"image/png");
  };
  img.onerror=()=>{URL.revokeObjectURL(url);console.warn("[kurvan] PNG export failed to render the chart.");};
  img.src=url;
}
// Every mark on every chart type (line points, dot-plot rows, map tiles,
// histogram bars, scatter points) already carries a data-card JSON payload
// — dataCard({title,color,rows:[{label,value,unit,ci}]}), js/charts.js —
// built for the click-to-pin/full-screen readout card. Reading it back out
// here makes CSV export chart-type-agnostic for free: no per-chart-type
// code, just whatever marks happen to be in the currently full-screened
// svg. mark.dataset.card is already HTML-entity-decoded by the DOM itself
// (readoutCardHTML() above reads it exactly the same way) — no manual
// unescaping needed before JSON.parse().
function csvField(v){
  const s=String(v??"");
  return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function exportChartCsv(){
  const svg=document.querySelector("#chartFsBody svg.chart-svg");
  if(!svg)return;
  const marks=[...svg.querySelectorAll("[data-card]")];
  if(!marks.length)return;
  const out=[["Series","Label","Value","Unit","95% CI"]];
  marks.forEach(m=>{
    let card=null;
    try{card=JSON.parse(m.dataset.card||"null");}catch(e){/* skip a malformed one, keep the rest */}
    if(!card)return;
    (card.rows||[]).forEach(r=>out.push([card.title||"",r.label||"",r.value??"",r.unit||"",r.ci||""]));
  });
  const csv=out.map(row=>row.map(csvField).join(",")).join("\r\n");
  downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),fsFilenameBase()+".csv");
}

// Every chart primitive (charts.js) marks its root <svg> with a shared
// chart-svg class — one generic pass here wires an expand trigger onto
// each, rather than hand-adding it per view function. A single persistent
// overlay (#chartFs — created once, lazily, same pattern #tiletip above
// uses) owns the full-screen layout completely: a title bar (with its OWN
// close control, not tied to any one chart's position — see below) + a big
// centered chart area + a click-readout strip.
function wireFullscreen(){
  const canFs=document.body.requestFullscreen||document.body.webkitRequestFullscreen;
  if(!canFs)return; // feature-detected: silently absent, not broken, on old Safari etc.

  let fs=document.getElementById("chartFs");
  if(!fs){
    fs=document.createElement("div");
    fs.id="chartFs";
    fs.innerHTML=`<div id="chartFsHead">
        <button type="button" id="chartFsClose" class="fsbtn-head" aria-label="${esc(t.chartFsClose)}">✕</button>
        <h3 id="chartFsTitle"></h3>
        <div class="chartFsActions">
          <button type="button" id="chartFsPng" class="fsbtn-head fsbtn-head-text" aria-label="${esc(t.chartFsPng)}">${esc(t.chartFsPngLbl)}</button>
          <button type="button" id="chartFsCsv" class="fsbtn-head fsbtn-head-text" aria-label="${esc(t.chartFsCsv)}">${esc(t.chartFsCsvLbl)}</button>
        </div>
      </div>
      <div id="chartFsBody"></div>
      <div id="chartFsReadout"></div>`;
    document.body.appendChild(fs);
    // A fixed control in the head bar, not the per-chart trigger button
    // moved/re-purposed — that button lives at the chart's own corner, which
    // on a very wide screen can sit far from the actual top-left of the
    // overlay once the (often portrait, e.g. the map) chart is centered in
    // a much wider space. One control, always in the same spot regardless
    // of chart size, reads more like "the corner of the screen" than "the
    // corner of whatever's currently showing".
    document.getElementById("chartFsClose").onclick=()=>(document.exitFullscreen||document.webkitExitFullscreen)?.call(document);
    document.getElementById("chartFsPng").onclick=exportChartPng;
    document.getElementById("chartFsCsv").onclick=exportChartCsv;
    // Delegated: one listener for every chart ever shown here, not one per
    // mark.
    document.getElementById("chartFsBody").onclick=e=>{
      const mark=e.target.closest("[data-tip]");
      if(!mark)return;
      // A tile click also ran .tile's own onclick first (region-select,
      // wire() below) — bubbled up to here SECOND, by which point render()
      // already rebuilt #app. mark itself is a detached leftover from
      // before that, but still a structurally intact subtree (closest()/
      // querySelector() below still walk it fine) with the exact same
      // data-card/data-region it always had — that content never depended
      // on which region was selected, so reading it post-detach is safe,
      // the same quiet reliance renderReadoutCard() already has for the
      // ordinary single-map case.
      const mapzoom=mark.closest(".mapzoom");
      const pair=mark.dataset.region&&mapzoom&&mapzoom.closest(".mapcmp");
      if(pair){
        const other=[...pair.querySelectorAll(".mapzoom")].find(mz=>mz!==mapzoom);
        const otherMark=other&&other.querySelector(`[data-region="${mark.dataset.region}"]`);
        renderReadoutCardPair(mark,otherMark);
        return;
      }
      renderReadoutCard(mark);
    };
  }

  // #app svg.chart-svg, not just svg.chart-svg: once a chart is
  // fullscreened, its svg (still chart-svg-classed) lives inside
  // #chartFsBody, outside #app — without this scope, a render() fired
  // while still fullscreened (a map click's S.region update, e.g., still
  // fires its own onclick alongside the delegated one above) would find
  // it again here and wrap it a second time.
  document.querySelectorAll("#app svg.chart-svg").forEach(svg=>{
    const holder=svg.parentElement;
    if(!holder)return;
    // The map is special: wireMapZoomPan() (below) finds each map's zoom
    // buttons and its own +/- click handlers via document.querySelector on
    // .mapzoom[data-mapid=...], then .mapsvg/.mapzoombtn WITHIN that same
    // element — fresh lookups, not cached, so they keep working wherever
    // .mapzoom currently lives, but ONLY as long as the svg and its zoom
    // buttons stay together under that one element. Since .mapzoom IS
    // already the svg's own parent (mapZoomWrap(), views.js) — already
    // position:relative, already exactly what .mapzoombtns expects to sit
    // absolute against — moving it whole (not wrapping the svg in a NEW
    // div) keeps zoom AND drag-to-pan (pointer listeners live directly on
    // .mapsvg, unaffected by reparenting) working in full-screen for free,
    // with no changes to wireMapZoomPan() itself. Every other chart type
    // gets a fresh, minimal wrap around just the svg instead, so a heading
    // elsewhere in its holder doesn't travel along redundantly.
    const isMap=holder.classList.contains("mapzoom");
    // Karta's compare-two-maps mode (S.cmpOn, viewKarta()) renders two
    // independent .mapzoom wrappers side by side inside one .mapcmp grid,
    // each getting its own expand button via this very loop (two svg.chart-
    // svg on the page, two iterations). Without this, clicking either
    // one only pulled THAT map's own .mapzoom into full screen — never
    // the comparison as a whole. cmpPair is truthy only for a map that's
    // actually inside a compare-mode pair; a lone map's holder.closest()
    // finds nothing, same as always.
    const cmpPair=isMap?holder.closest(".mapcmp"):null;
    const wrap=isMap?holder:document.createElement("div");
    if(!isMap){
      wrap.className="fswrap";
      // A multi-line chart's .line-legend (views.js's lineLegend()) is the
      // svg's own next sibling, not part of the svg itself — grabbed here,
      // before replaceWith() detaches svg (nextElementSibling would be null
      // once it's out of the tree), so it travels into full-screen with its
      // chart instead of being left behind, invisible, in the emptied card.
      const legend=svg.nextElementSibling?.classList.contains("line-legend")?svg.nextElementSibling:null;
      svg.replaceWith(wrap);
      wrap.appendChild(svg);
      if(legend)wrap.appendChild(legend);
    }

    const btn=document.createElement("button");
    btn.type="button";
    btn.className="fsbtn";
    btn.setAttribute("aria-label",t.chartFullscreen);
    btn.textContent="⛶";
    btn.onclick=()=>{
      // Title: the holder's OWN heading if it carries one directly (an
      // .inner2 column's h4, e.g.), else the nearest .card-h's h3, else
      // fall back to the svg's own aria-label — always something, never
      // blank, regardless of which of the three DOM shapes this chart is.
      const own=holder.querySelector(":scope > h3, :scope > h4");
      const cardH=svg.closest(".card")?.querySelector(".card-h h3");
      const title=(own||cardH)?.textContent||svg.getAttribute("aria-label")||"";
      document.getElementById("chartFsTitle").textContent=title;
      // .rvs: an existing small-muted-caption class (kurvan.css), reused
      // here rather than styling the readout container itself — the
      // container needs to stay colour-neutral so the .rstat card
      // renderReadoutCard() swaps in on a click isn't dimmed by an
      // inherited hint colour.
      document.getElementById("chartFsReadout").innerHTML=`<span class="rvs">${esc(t.chartFsHint)}</span>`;
      // The trigger button itself doesn't move — only the chart does. A
      // second "expand" button sitting uselessly at the chart's corner
      // inside full-screen (where #chartFsClose already handles closing)
      // would just be visual clutter. In compare mode BOTH mini-maps'
      // buttons need removing here, not just the one clicked — cmpPair
      // still has its own (the other mini-map's) expand button sitting in
      // it otherwise, equally uselessly, once the whole pair is fullscreen.
      wrap.removeChild(btn);
      if(cmpPair)cmpPair.querySelectorAll(".fsbtn").forEach(b=>b.remove());
      // MOVE, not clone — a clone would carry the svg's data-tip/tabindex
      // attributes but none of the onclick/onmouseenter/etc. listeners
      // already attached to it (map click-to-select, hover tooltips,
      // zoom/pan), since those aren't part of the DOM the way attributes
      // are. Moving keeps all of it working with nothing to re-wire. In
      // compare mode this moves the WHOLE .mapcmp (both mini-maps, their
      // .mapcmphead labels, their legends) as one unit — wireMapZoomPan()
      // (wire(), below) already wires zoom/pan generically across every
      // .mapzoom on the page by its own data-mapid, so nothing extra is
      // needed for both to keep working side by side once moved.
      // #tiletip moves in too: while fs is the fullscreen element, only
      // ITS subtree renders at all — a hover card left behind on <body>
      // (a sibling of fs, not a descendant) would simply never be visible,
      // not just hidden behind something.
      document.getElementById("chartFsBody").appendChild(cmpPair||wrap);
      const tip=document.getElementById("tiletip");
      if(tip)fs.appendChild(tip);
      // Only the map ever changes ITSELF from inside full-screen (a tile
      // click runs the exact same S.region-setting pick() it always has,
      // still wired on this very svg — see the MOVE-not-clone comment
      // above) — remembered as a #app selector so the re-sync block below
      // knows what to go looking for a fresh copy of: the whole pair
      // (.mapcmp) in compare mode, just this one map otherwise.
      fsMapId=cmpPair?".mapcmp":isMap?`.mapzoom[data-mapid="${wrap.dataset.mapid}"]`:null;
      fs.classList.add("on");
      (fs.requestFullscreen||fs.webkitRequestFullscreen).call(fs);
    };
    wrap.appendChild(btn);
  });

  // Re-sync: a tile click on the fullscreened map runs pick() same as
  // ever (S.region=code; render()) — which rebuilds #app, including a
  // FRESH .mapzoom (or, in compare mode, a fresh .mapcmp holding two)
  // with the same data-mapid(s), correct new selection glow (baked into
  // chorMap()'s own SVG string at generation time, not something a class
  // toggle on the old node could update) and its own freshly-wired zoom
  // buttons. Without swapping it in, the stale copy stays on screen AND
  // a second element now shares its data-mapid — wireMapZoomPan()'s
  // document.querySelector(`.mapzoom[data-mapid=...]`) lookups (below)
  // would start resolving to whichever of the two comes first in the
  // document, not necessarily the one actually visible, breaking the
  // zoom buttons too. Runs every wire() call (cheap no-op when nothing's
  // fullscreen or the fullscreened chart isn't the map).
  if(fsMapId&&document.fullscreenElement===fs){
    const fresh=document.querySelector(`#app ${fsMapId}`);
    if(fresh){
      // The loop above already gave this fresh copy its own new .fsbtn(s)
      // (it's still svg.chart-svg, inside #app, at that point) — pull
      // them back off, same reasoning as the original open: nothing to
      // expand further, already full-screen. querySelectorAll, not
      // querySelector: one button for a lone map, two for a compare pair
      // (fsMapId==".mapcmp") — same cleanup either way.
      fresh.querySelectorAll(".fsbtn").forEach(b=>b.remove());
      const body=document.getElementById("chartFsBody");
      body.innerHTML="";
      body.appendChild(fresh);
      const tip=document.getElementById("tiletip");
      if(tip)fs.appendChild(tip);
    }
  }
}

// CSS transform:scale()+translate() on the vector <svg> itself, not a
// raster zoom — the map stays crisp at any level. translate() goes outside
// scale() so a drag's pixel delta moves the already-scaled map by that same
// number of screen pixels, independent of the zoom level.
function wireMapZoomPan(){
  const get=id=>mapView[id]||(mapView[id]={z:1,x:0,y:0});
  // .mapsvg's live rect already reflects its own current scale — dividing
  // that back out gives the natural, unzoomed size without needing a
  // separately cached value that could go stale on window resize. z comes
  // from the caller (mapView, not re-derived from the transform string
  // that was itself only just written from that same z — regex-parsing it
  // back out is a needless, fragile round-trip through CSS text).
  const naturalSize=(svg,z)=>{
    const r=svg.getBoundingClientRect();
    return{w:r.width/z,h:r.height/z};
  };
  // Clamped to the map's own geometry, not the surrounding card: at zoom z
  // the scaled map is naturalSize*z, so it extends naturalSize*(z-1)/2
  // beyond its natural edge on each side — panning further than that would
  // reveal empty space past the map's own border. This is also why pan
  // naturally snaps back to (0,0) as z returns to 1 (max pan there is 0),
  // with no separate "reset pan on zoom out" step needed.
  const clampPan=(w,h,z,x,y)=>{
    const maxX=w*(z-1)/2,maxY=h*(z-1)/2;
    return{x:Math.max(-maxX,Math.min(maxX,x)),y:Math.max(-maxY,Math.min(maxY,y))};
  };
  const applyView=(el,v)=>{
    const svg=el.querySelector(".mapsvg");
    if(!svg)return;
    svg.style.transform=(v.z===1&&!v.x&&!v.y)?"":`translate(${v.x}px,${v.y}px) scale(${v.z})`;
    svg.classList.toggle("pannable",v.z>1);
    el.querySelectorAll(".mapzoombtn").forEach(btn=>{
      const dir=+btn.dataset.dir;
      btn.disabled=dir>0?v.z>=ZOOM_MAX-1e-9:v.z<=ZOOM_MIN+1e-9;
    });
  };
  // Reapply each map's remembered zoom+pan to this render()'s fresh nodes —
  // a brand-new .mapsvg has no memory of a view set before the rebuild.
  document.querySelectorAll(".mapzoom").forEach(el=>applyView(el,get(el.dataset.mapid)));
  document.querySelectorAll(".mapzoombtn").forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.mapid;
      const el=document.querySelector(`.mapzoom[data-mapid="${id}"]`);
      const svg=el&&el.querySelector(".mapsvg");
      if(!svg)return;
      const v=get(id),{w,h}=naturalSize(svg,v.z);
      const z=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,+(v.z+(+btn.dataset.dir)*ZOOM_STEP).toFixed(2)));
      mapView[id]={z,...clampPan(w,h,z,v.x,v.y)};
      applyView(el,mapView[id]);
    };
  });
  // Drag-to-pan: pointerdown/move/up on .mapsvg itself (bubbles up from any
  // .tile child, so one handler covers the whole map) — gated on z>1, so
  // there's nothing to pan at 1x and click-to-select is untouched there.
  document.querySelectorAll(".mapzoom").forEach(el=>{
    const id=el.dataset.mapid,svg=el.querySelector(".mapsvg");
    if(!svg)return;
    let dragging=false,startX=0,startY=0,startPan={x:0,y:0},natW=0,natH=0,pointerId=null;
    svg.onpointerdown=e=>{
      const v=get(id);
      if(v.z<=1)return;
      dragging=true;dragMoved=false;pointerId=e.pointerId;
      startX=e.clientX;startY=e.clientY;startPan={x:v.x,y:v.y};
      ({w:natW,h:natH}=naturalSize(svg,v.z));
      // No setPointerCapture()/dragging class/transition:none here yet —
      // deferred to the first real move below. Capturing eagerly, even for
      // a plain click that never moves, retargets the browser's synthesized
      // "click" event to the capturing element (this <svg>) instead of the
      // .tile actually under the pointer — confirmed live: a zero-movement
      // click fired its "click" on svg.mapsvg, never reaching the tile's
      // onclick, so region-select silently stopped working at any zoom
      // above 1x. Deferring capture until movement is confirmed leaves a
      // plain click's native event handling completely untouched.
    };
    svg.onpointermove=e=>{
      if(!dragging)return;
      const dx=e.clientX-startX,dy=e.clientY-startY;
      // 4px threshold: a held-still click shouldn't register as a drag.
      if(!dragMoved&&Math.hypot(dx,dy)>4){
        dragMoved=true;
        svg.setPointerCapture(pointerId);
        svg.classList.add("dragging");
        svg.style.transition="none";
      }
      if(!dragMoved)return;
      const v=get(id);
      mapView[id]={z:v.z,...clampPan(natW,natH,v.z,startPan.x+dx,startPan.y+dy)};
      applyView(el,mapView[id]);
    };
    const endDrag=()=>{
      if(!dragging)return;
      dragging=false;
      svg.classList.remove("dragging");
      svg.style.transition="";
      // A real drag's own terminating click never reaches a tile anyway —
      // pointer capture (engaged above once movement was confirmed)
      // retargets it to this <svg>, which has no onclick — so dragMoved
      // has nothing left to guard by the time we get here. Reset it now
      // rather than leaving it stuck true: it was previously only ever
      // cleared by pick()'s own dragMoved check, which this drag's click
      // never triggers, so an unrelated later click (on this map once
      // zoomed back to 1x, where onpointerdown no longer resets it, or on
      // any other map — dragMoved is one flag shared by all of them) was
      // silently swallowed instead of selecting a region.
      dragMoved=false;
    };
    svg.onpointerup=endDrag;
    svg.onpointercancel=endDrag;
  });
}

/* Draws the trend glyph chorMap() flagged via data-trend/data-rel onto each
   region shape, centred on its bounding box. Runs after insertion (getBBox
   needs the SVG in the DOM) so it can't live in chorMap()'s string-building. */
function paintTrendArrows(){
  document.querySelectorAll(".mapsvg path[data-trend]").forEach(p=>{
    const svg=p.ownerSVGElement; if(!svg)return;
    const b=p.getBBox();
    const el=document.createElementNS("http://www.w3.org/2000/svg","text");
    el.setAttribute("x",(b.x+b.width/2).toFixed(3));
    el.setAttribute("y",(b.y+b.height/2).toFixed(3));
    el.setAttribute("class","trendarrow "+(p.dataset.rel||"neutral"));
    el.setAttribute("aria-hidden","true");
    el.textContent=p.dataset.trend;
    svg.appendChild(el);
  });
}

stateFromUrl();
render();

// =========================================================================
// LAZY REAL-DATA LOADING — one indicator's worth of JSON per <script>,
// loaded AFTER the page has already painted once (the render() call just
// above), instead of one multi-megabyte js/real_mh_data.js blocking the
// very first paint the way it used to (pipeline/build_kurvan_data.py's own
// module docstring has the full "why", js/data.js's rebuildREAL() etc.
// have the "how" — every REAL_X here is reassignable, not a one-shot
// const, for exactly this).
//
// Every indicator starts out exactly like a fresh checkout that's never
// run the Python pipeline at all: REAL_X.active is false, cell()/total()
// fall back to the labelled-synthetic generator (already a first-class,
// honestly-labelled state, not an error) — and each one flips to real,
// silently, the moment its own file lands and this fires a fresh
// render(). Fired all at once, not staggered/prioritised by scroll
// position: local file:// reads are fast enough that the difference isn't
// worth a priority queue's added complexity. realSourcesPending (declared
// with REAL_SOURCES near the top of this file, not here — render()'s
// banner needs an accurate count from the very first paint, before this
// function has even run once) is what drives the #synth banner's "still
// loading" sub-line while any of these nine are still in flight.
function loadRealSourcesLazily(){
  // Reuses kurvan.html's own cache-busting query string (e.g. "?v=38") off
  // this very <script> tag rather than hardcoding it a second time here —
  // stays correct automatically whenever that version marker is bumped.
  // document.currentScript is only valid during this script's own
  // synchronous run, which is exactly where this executes (called at
  // load time, not from inside a later callback).
  const qs=(document.currentScript&&document.currentScript.src.split("?")[1])||"";
  REAL_SOURCES.forEach(src=>{
    const s=document.createElement("script");
    s.src=qs?`${src.file}?${qs}`:src.file;
    s.onload=()=>{src.rebuild();realSourcesPending--;render();};
    s.onerror=()=>{console.warn(`[kurvan] failed to load ${src.file} — its indicator(s) stay on the synthetic generator.`);realSourcesPending--;render();};
    document.head.appendChild(s);
  });
}
loadRealSourcesLazily();
