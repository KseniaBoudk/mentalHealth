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
function render(){
  t=T[S.lang];
  document.documentElement.setAttribute("data-theme",S.theme);
  document.documentElement.lang=S.lang;
  // rs (views.js) walks IND/isRealActive() itself, so this banner counts
  // and names indicators the same way viewMetod()'s table does — it can't
  // fall behind the data the way a hand-typed "four of five" already did.
  const rs=realSummary();
  document.getElementById("synth").innerHTML = rs.n>0
    ? `<b>${esc(t.synthPartialT)}</b><span>${esc(t.synthPartialB(rs.n,rs.total,rs.realNames,rs.synthNames,rs.synthN))}</span>`
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
    <footer><div class="wrap"><p>${esc(t.footA)}</p><p>${esc(rs.n>0?t.footBPartial(rs.n,rs.total,rs.realNames,rs.synthNames,rs.synthN):t.footB)}</p></div></footer>`;
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
  bind("c-ctxind",v=>S.ctxInd=v);
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
  // Clamped to the viewport: near the right/bottom edge, the default
  // cursor-relative offset would otherwise push the card partly off
  // screen. Flip to the other side of the cursor first, then clamp — a
  // card wider/taller than the remaining space still ends up fully inside
  // the viewport margin instead of just less-wrong.
  const showTip=(text,x,y)=>{
    tip.textContent=text;tip.style.display="block";
    const m=10,vw=innerWidth,vh=innerHeight,tw=tip.offsetWidth,th=tip.offsetHeight;
    let left=x+14,top=y+14;
    if(left+tw>vw-m)left=x-14-tw;
    if(top+th>vh-m)top=y-14-th;
    tip.style.left=Math.max(m,Math.min(left,vw-tw-m))+"px";
    tip.style.top=Math.max(m,Math.min(top,vh-th-m))+"px";
  };
  const hideTip=()=>{tip.style.display="none";};
  // .tile is the map's regions — clickable/keyboard-selectable, unlike the
  // dot-plot rows, histogram bars and scatter points below, which only ever
  // show info. hideTip() first: render() rebuilds #app (including this very
  // tile) without ever firing this tile's mouseleave, so without this the
  // card from the tile under a still-stationary cursor was left stuck on
  // screen until the mouse next moved.
  document.querySelectorAll(".tile").forEach(b=>{
    // dragMoved: a pan gesture (wireMapZoomPan()) ending over this tile
    // isn't a click on it — skip the region-select once and reset, so the
    // next genuine click behaves normally.
    const pick=()=>{if(dragMoved){dragMoved=false;return;}hideTip();S.region=b.dataset.region;render();};
    b.onclick=pick;
    b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick();}};
  });
  // Every mark that carries data-tip gets the same hover card — map tiles
  // (data-tip set alongside the click handling above), dot-plot rows,
  // histogram bars and scatter points (charts.js) all use it, so one loop
  // wires all four chart types instead of repeating this per chart type.
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
    // bottom edge right after. Dot-plot/histogram/scatter marks carry no
    // tabindex, so onfocus/onblur are simply inert for them.
    b.onfocus=()=>{if(b.matches(":focus-visible")){const r=b.getBoundingClientRect();showTip(b.dataset.tip,r.left,r.bottom);}};
    b.onblur=hideTip;
  });
  // Used to switch tabs; every section already exists on the page now
  // (already showing the current S.region — that was set by the map click
  // that got the reader here), so "open" just means "scroll to it".
  const or=document.getElementById("b-openregion");
  if(or)or.onclick=()=>document.getElementById("sec-regioner").scrollIntoView({behavior:"smooth"});
  const ob=document.getElementById("b-openbehov");
  if(ob)ob.onclick=()=>document.getElementById("sec-behov").scrollIntoView({behavior:"smooth"});
  wireMapZoomPan();
  paintTrendArrows();
}

// CSS transform:scale()+translate() on the vector <svg> itself, not a
// raster zoom — the map stays crisp at any level. translate() goes outside
// scale() so a drag's pixel delta moves the already-scaled map by that same
// number of screen pixels, independent of the zoom level.
function wireMapZoomPan(){
  const get=id=>mapView[id]||(mapView[id]={z:1,x:0,y:0});
  // .mapsvg's live rect already reflects its own current scale (or 1, on a
  // brand-new node with no transform yet) — dividing that back out gives
  // the natural, unzoomed size without needing a separately cached value
  // that could go stale on window resize.
  const naturalSize=svg=>{
    const m=/scale\(([\d.]+)\)/.exec(svg.style.transform);
    const z=m?+m[1]:1, r=svg.getBoundingClientRect();
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
      const v=get(id),{w,h}=naturalSize(svg);
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
      ({w:natW,h:natH}=naturalSize(svg));
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

render();
