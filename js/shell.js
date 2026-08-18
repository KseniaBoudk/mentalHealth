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

function render(){
  t=T[S.lang];
  document.documentElement.setAttribute("data-theme",S.theme);
  document.documentElement.lang=S.lang;
  document.getElementById("synth").innerHTML = REAL.active
    ? `<b>${esc(t.synthPartialT)}</b><span>${esc(t.synthPartialB)}</span>`
    : `<b>${esc(t.synthT)}</b><span>${esc(t.synthB)}</span>`;

  const body=S.tab==="laget"?viewLaget()
    :S.tab==="over_tid"?viewOverTid()
    :S.tab==="karta"?viewKarta()
    :S.tab==="behov"?viewBehov()
    :S.tab==="sjukskrivning"?viewSjukskrivning()
    :S.tab==="sammanhang"?viewSammanhang()
    :S.tab==="regioner"?viewRegioner()
    :viewMetod();

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
      <nav class="tabs">
        ${["laget","over_tid","karta","behov","sjukskrivning","sammanhang","metod","regioner"].map(x=>`<button data-tab="${x}" class="${S.tab===x?"on":""}">${esc(t.tabs[x])}</button>`).join("")}
        <span class="stamp tnum">${esc(t.stamp)}</span>
      </nav>
    </div></header>
    <main><div class="wrap">
      ${body}
      <div class="help"><span><b>${esc(t.helpA)}</b></span><span>${esc(t.helpB)}</span><span><b>${esc(t.helpC)}</b></span></div>
    </div></main>
    <footer><div class="wrap"><p>${esc(t.footA)}</p><p>${esc(REAL.active?t.footBPartial:t.footB)}</p></div></footer>`;
  wire();
}

function wire(){
  document.querySelectorAll("nav.tabs button").forEach(b=>
    b.onclick=()=>{S.tab=b.dataset.tab;render();window.scrollTo({top:0,behavior:"instant"});});
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
  document.querySelectorAll(".tile").forEach(b=>{
    const pick=()=>{S.region=b.dataset.region;render();};
    b.onclick=pick;
    b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick();}};
  });
  const or=document.getElementById("b-openregion");
  if(or)or.onclick=()=>{S.tab="regioner";render();window.scrollTo({top:0,behavior:"instant"});};
  const ob=document.getElementById("b-openbehov");
  if(ob)ob.onclick=()=>{S.tab="behov";render();window.scrollTo({top:0,behavior:"instant"});};
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
