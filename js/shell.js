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

// All eight sections render every time, in this order — the sidebar's
// links and scroll-spy (in wire()) both walk this same list, so adding a
// section here is the only place that needs touching.
const SECTIONS=["laget","over_tid","karta","behov","sjukskrivning","sammanhang","metod","regioner"];
const VIEW_FN={laget:viewLaget,over_tid:viewOverTid,karta:viewKarta,behov:viewBehov,
  sjukskrivning:viewSjukskrivning,sammanhang:viewSammanhang,metod:viewMetod,regioner:viewRegioner};

// render() rebuilds the whole #app innerHTML from scratch on every state
// change — a map click or a filter change goes through the exact same path
// as the initial load, recreating <main> as a brand-new DOM node each time.
// A CSS animation on a bare selector would replay on every one of those;
// this flag limits the fade-in to the actual first paint.
let firstRender=true;
function render(){
  t=T[S.lang];
  document.documentElement.setAttribute("data-theme",S.theme);
  document.documentElement.lang=S.lang;
  document.getElementById("synth").innerHTML = REAL.active
    ? `<b>${esc(t.synthPartialT)}</b><span>${esc(t.synthPartialB)}</span>`
    : `<b>${esc(t.synthT)}</b><span>${esc(t.synthB)}</span>`;

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
    <footer><div class="wrap"><p>${esc(t.footA)}</p><p>${esc(REAL.active?t.footBPartial:t.footB)}</p></div></footer>`;
  firstRender=false;
  wire();
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

function wire(){
  measureBanner();
  // Sidebar links are plain #anchors — the browser handles the actual
  // jump (html{scroll-behavior:smooth} in kurvan.css). This only needs to
  // track which section is active for the highlight, via IntersectionObserver
  // rather than on click, so it stays correct on free scrolling too, not
  // just after a link click.
  const sidebarLinks=[...document.querySelectorAll(".sidebar a")];
  const io=new IntersectionObserver(entries=>{
    entries.forEach(en=>{
      if(!en.isIntersecting)return;
      const sec=en.target.id.slice(4);
      S.tab=sec;
      sidebarLinks.forEach(a=>a.classList.toggle("active",a.dataset.sec===sec));
    });
  },{rootMargin:"-15% 0px -70% 0px"});
  document.querySelectorAll('section[id^="sec-"]').forEach(s=>io.observe(s));
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
  bind("c-cmpind",v=>S.cmpInd=v);
  const ct=document.getElementById("c-cmptoggle");
  if(ct)ct.onclick=()=>{S.cmpOn=!S.cmpOn;render();};
  const stepYear=d=>{
    const years=validYears(S.ind);
    const idx=years.includes(S.mapYear)?years.indexOf(S.mapYear):years.length-1;
    S.mapYear=years[Math.max(0,Math.min(years.length-1,idx+d))];
    render();
  };
  const yp=document.getElementById("c-yprev"),yn=document.getElementById("c-ynext");
  if(yp)yp.onclick=()=>stepYear(-1);
  if(yn)yn.onclick=()=>stepYear(1);
  document.querySelectorAll(".seg button").forEach(b=>
    b.onclick=()=>{S.std=b.dataset.std==="1";render();});
  // Single tooltip element, created once and reused — it lives outside
  // #app (on <body>) specifically so render()'s full innerHTML rebuild on
  // every state change doesn't destroy and recreate it.
  let tip=document.getElementById("tiletip");
  if(!tip){tip=document.createElement("div");tip.id="tiletip";document.body.appendChild(tip);}
  const showTip=(text,x,y)=>{tip.textContent=text;tip.style.left=(x+14)+"px";tip.style.top=(y+14)+"px";tip.style.display="block";};
  const hideTip=()=>{tip.style.display="none";};
  document.querySelectorAll(".tile").forEach(b=>{
    const pick=()=>{S.region=b.dataset.region;render();};
    b.onclick=pick;
    b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick();}};
    b.onmouseenter=e=>showTip(b.dataset.tip,e.clientX,e.clientY);
    b.onmousemove=e=>showTip(b.dataset.tip,e.clientX,e.clientY);
    b.onmouseleave=hideTip;
    // Keyboard focus gets the same card, positioned off the tile itself
    // since focus (unlike a mouse) carries no cursor coordinates.
    b.onfocus=()=>{const r=b.getBoundingClientRect();showTip(b.dataset.tip,r.left,r.bottom);};
    b.onblur=hideTip;
  });
  // Used to switch tabs; every section already exists on the page now
  // (already showing the current S.region — that was set by the map click
  // that got the reader here), so "open" just means "scroll to it".
  const or=document.getElementById("b-openregion");
  if(or)or.onclick=()=>document.getElementById("sec-regioner").scrollIntoView({behavior:"smooth"});
  const ob=document.getElementById("b-openbehov");
  if(ob)ob.onclick=()=>document.getElementById("sec-behov").scrollIntoView({behavior:"smooth"});
  paintTrendArrows();
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

render();
