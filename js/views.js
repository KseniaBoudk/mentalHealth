"use strict";

/* =====================================================================
   5. VIEWS
   ===================================================================== */

/* isRealActive(k) is defined in data.js: true once this indicator is
   actually being served from REAL (js/real_mh_data.js has rows), not just
   eligible for it. Every label below reads it rather than IND[k].real
   alone, so a reader never sees "real data" before anyone has run the
   fetcher. */
// The survey (distress) is FoHM's, not Socialstyrelsen's — real now, so this
// citation has to be accurate, not just plausible-looking.
const INST_NAME={survey:"FoHM",reg:"Socialstyrelsen",mort:"Socialstyrelsen",fk:"Försäkringskassan"};
const srcLine=(k)=>`${esc(IND[k][S.lang==="sv"?"reg":"regEn"])} · ${INST_NAME[IND[k].inst]}`;
const srcStrip=(k,extra)=>`<div class="src"><b>${esc(t.notNum)}</b> ${esc(t.notNumB[k])}<br>${srcLine(k)} · <b>${esc(isRealActive(k)?t.realLbl:t.synthLbl)}</b>${isRealActive(k)&&t.realCaveat[k]?` · ${esc(t.realCaveat[k])}`:""}${extra?" · "+extra:""}</div>`;

// Every indicator's IND[k].scale (100/1000/100000) already encodes its unit
// — reused here rather than hand-listing a unit per indicator, so a new
// indicator only ever needs to set `scale` once and every chart's axis
// label picks it up automatically.
const unitLabel=(k)=>{
  const sc=IND[k].scale;
  return sc===100?"%":sc===1000?(S.lang==="sv"?"per 1 000":"per 1,000"):(S.lang==="sv"?"per 100 000":"per 100,000");
};

// The banner, footer, and Metod tab's "what's actually real" note all used
// to hand-count "four of five" and hand-list which indicators — the same
// sentence typed three times, none of them updated when sjukfranvaro went
// real. isRealActive(k) is already the single accurate source (viewMetod's
// table reads it); this walks IND once and hands back everything those
// three copy slots need, so none of them can drift from the code again.
const realSummary=()=>{
  const keys=Object.keys(IND);
  const real=keys.filter(isRealActive), synth=keys.filter(k=>!isRealActive(k));
  const conj=S.lang==="sv"?"och":"and";
  const join=list=>list.length<=1?list.join(""):list.slice(0,-1).join(", ")+` ${conj} `+list[list.length-1];
  // t.ind[k] is Title Case for the Metod table's own column; lowercase the
  // leading letter only when folding a name into a running sentence here.
  const lead=s=>s.charAt(0).toLowerCase()+s.slice(1);
  return {
    n:real.length, total:keys.length,
    realNames:join(real.map(k=>`${lead(t.ind[k])} (${INST_NAME[IND[k].inst]})`)),
    synthNames:join(synth.map(k=>lead(t.ind[k]))), synthN:synth.length
  };
};

// Shared by agePts/fakeAgePts below — identical shaping logic, differing
// only in which cell-getter feeds it. Trims trailing AND leading nulls (a
// real series break must stay a break, so only the outer run of "no data
// published for this age band at all" gets cut, not gaps in the middle).
function agePtsWith(getCell,k,regionCode,year,sex,std){
  const pts=[];
  for(let i=0;i<AGES.length;i++){
    const c=getCell(k,regionCode,year,i,sex,std);
    pts.push(c?[i,c.value]:null);
  }
  while(pts.length&&!pts[pts.length-1])pts.pop();
  let i0=0;while(i0<pts.length&&!pts[i0])i0++;
  return pts.slice(i0);
}
const agePts=(k,regionCode,year,sex,std)=>agePtsWith(cell,k,regionCode,year,sex,std);
/* Forces the fabricated generator even for indicators REAL can now answer.
   Used only by viewLaget's life-course exhibit — see fakeCell()'s docstring
   in data.js for why that one chart can never honestly go real. */
const fakeAgePts=(k,regionCode,year,sex,std)=>agePtsWith(fakeCell,k,regionCode,year,sex,std);

const legendStrip=()=>`<div class="legend">${t.legend.map(([k,b,r])=>
  `<span class="li"><span class="dot" style="background:${INST_COLOR[k==="survey"?"survey":k==="reg"?"reg":"mort"]}"></span><span><b>${esc(b)}</b> ${esc(r)}</span></span>`).join("")}</div>`;

// Five swatches, shared by every chorMap() card — matches the map's own
// fill exactly (chorMap() shades each tile by BAND_OP[quintile rank], a
// fixed 5-step opacity ladder, not a continuous value->shade function; an
// earlier continuous-gradient version of this legend looked nicer but
// implied a precision the map's actual shading doesn't have). Each swatch
// pairs a plain value-tier word (legendTiers) with its real number range
// and unit — not just bare numbers, and not "top/bottom X%" ranking
// language either (the plan's own rule against rank-based legend bands —
// these describe where a VALUE sits, not a ranking of regions).
const mapLegend=(rows,color,unit,nat)=>{
  const{ranges}=quintileBands(rows);
  return `<div class="tier-legend">
    <div class="tier-rows">
      ${ranges.map((rg,i)=>rg?`<div class="tier-row">
        <span class="tier-chip" style="background:${color};opacity:${BAND_OP[i]}"></span>
        <span class="tier-label">${esc(t.legendTiers[i])}</span>
        <span class="tier-range tnum">${fmt(rg.lo,1)}–${fmt(rg.hi,1)} ${esc(unit)}</span>
      </div>`:"").join("")}
    </div>
    <div class="gradient-note">
      <span>${esc(t.legendRankNote)}</span>
      ${nat!=null?`<span>${esc(t.natLine)} <b class="tnum">${fmt(nat,1)} ${esc(unit)}</b></span>`:""}
    </div>
  </div>`;
};

// Wraps a chorMap() SVG with +/- zoom buttons pinned to its corner. Zoom is
// pure presentation (how much of the already-real geography you're looking
// at, not a data or selection change), so it deliberately lives outside S
// and is wired directly in shell.js rather than going through render(). id
// must be unique per map slot on the page and STABLE across renders (not
// regenerated per render call) — shell.js keeps zoom level in a plain
// object keyed by this id, and reapplies it to the freshly-rendered map
// after every render() a click/filter/toggle triggers elsewhere, the same
// way measureBanner() reapplies --banner-h on every wire().
const mapZoomWrap=(svgHtml,id)=>`<div class="mapzoom" data-mapid="${esc(id)}">
  ${svgHtml}
  <div class="mapzoombtns">
    <button type="button" class="mapzoombtn" data-mapid="${esc(id)}" data-dir="1" aria-label="${esc(t.zoomIn)}">+</button>
    <button type="button" class="mapzoombtn" data-mapid="${esc(id)}" data-dir="-1" aria-label="${esc(t.zoomOut)}">−</button>
  </div>
</div>`;

// Key for the need/response scatter's three ring colours — reused by both
// viewBehov and viewRegioner, since both draw the same scatter() and both
// share the below/above/selected-region ambiguity it disambiguates.
// padding:18px matches .card-b's own horizontal padding — this sits
// outside .card-b (as a sibling, so it can span the full card width),
// so without it the dots start flush against the card's edge.
const scatterKey=()=>`<div class="legend" style="padding:10px 18px 4px">
  <span class="li"><span class="dot" style="background:var(--oxblood)"></span><span>${esc(t.scatterBelowKey)}</span></span>
  <span class="li"><span class="dot" style="background:var(--teal)"></span><span>${esc(t.scatterAboveKey)}</span></span>
  <span class="li"><span class="dot" style="background:var(--ink)"></span><span>${esc(t.mapPicked)}</span></span>
</div>`;

function viewLaget(){
  const xl=[[1,"15"],[3,"35"],[5,"55"],[8,"85+"]];
  // fakeAgePts/fakeCell throughout this chart, deliberately: it contrasts
  // self-harm's youth peak against suicide's old-age peak across the WHOLE
  // life course, and no real fetcher this project has reaches past age 19
  // for either series. See fakeCell()'s docstring in data.js.
  const shK=fakeAgePts("selfharm","SE",2024,"K"),shM=fakeAgePts("selfharm","SE",2024,"M");
  const suM=fakeAgePts("suicide","SE",2024,"M"),suK=fakeAgePts("suicide","SE",2024,"K");
  const shPeak=shK.filter(Boolean).reduce((a,p)=>p[1]>a[1]?p:a);
  const suPeak=suM.filter(Boolean)[suM.filter(Boolean).length-1];
  const oldMen=fakeCell("suicide","SE",2024,8,"M",false);
  const yw06=cell("antidep","SE",2006,1,"K",false),yw24=cell("antidep","SE",2024,1,"K",false);
  const growth=Math.round((yw24.value/yw06.value-1)*100);

  return `
  ${legendStrip()}
  <div class="hero">
    <div class="kick">${esc(t.kick)}</div>
    <h1>${esc(t.h1)}</h1>
    <p>${esc(t.hp)}</p>
  </div>

  <div class="card" style="margin-top:26px">
    <div class="card-h"><h3>${esc(t.twinT)}</h3><div class="u">${esc(t.perK)}</div></div>
    <div class="inner2">
      <div>
        <h4>${esc(t.shTitle)}</h4><div class="u">${srcLine("selfharm")}</div>
        ${lineChart(
          [{pts:shK,color:"var(--violet)",w:2.5,anno:{at:shPeak,dx:9,dy:-8,text:t.peakSh}},
           {pts:shM,color:"var(--violet)",dash:"5 3",w:1.9,label:t.men,labelAt:4}],
          {aria:"Self-harm admissions by age and sex",xlabels:xl,zero:true,h:205,unit:unitLabel("selfharm")})}
      </div>
      <div>
        <h4>${esc(t.suTitle)}</h4><div class="u">${srcLine("suicide")}</div>
        ${lineChart(
          [{pts:suM,color:"var(--oxblood)",w:2.6,anno:{at:suPeak,dx:-9,dy:-9,text:t.peakSu}},
           {pts:suK,color:"var(--oxblood)",dash:"5 3",w:1.9,label:t.women,labelAt:4}],
          {aria:"Suicide by age and sex",xlabels:xl,zero:true,h:205,unit:unitLabel("suicide")})}
      </div>
    </div>
    <div class="src"><b>${S.lang==="sv"?"Syntetiska data.":"Synthetic data."}</b> ${S.lang==="sv"
      ?"Heldragen linje kvinnor, streckad män. Samma skala vore missvisande: kurvornas form, inte nivå, är poängen."
      :"Solid line women, dashed men. The point is the shape of the curves, not their shared level."}</div>
  </div>

  <div class="pieces mt-fig" style="grid-template-columns:1fr 1fr">
    ${t.pieces.map((p,i)=>`
      <div class="piece">
        <div class="tag" style="color:${INST_COLOR[p.inst]}">${esc(p.tag)}</div>
        <h4>${esc(p.h)}</h4><p>${esc(p.p)}</p>
        <div class="num tnum" style="color:${INST_COLOR[p.inst]}">${i===0?fmt(oldMen.value,1):(growth>0?"+":"−")+Math.abs(growth)+" %"}</div>
        <div class="numl">${esc(p.numl)}</div>
      </div>`).join("")}
  </div>`;
}

function viewOverTid(){
  const k=S.ind,I=IND[k],col=INST_COLOR[I.inst];
  const years=validYears(k);
  if(!years.includes(S.year))S.year=years[years.length-1];
  const yr=S.year;

  const rowsAll=REGIONS.map(r=>{
    const c=S.age===-1?total(k,r[0],yr,S.sex,S.std):cell(k,r[0],yr,S.age,S.sex,S.std);
    return c&&{code:r[0],name:r[1],value:c.value,lo:c.lo,hi:c.hi,supp:c.suppressed};
  }).filter(Boolean);
  const shown=rowsAll.filter(r=>!r.supp).sort((a,b)=>b.value-a.value);
  const suppressed=rowsAll.filter(r=>r.supp).map(r=>r.name);
  const nat=S.age===-1?total(k,"SE",yr,S.sex,S.std):cell(k,"SE",yr,S.age,S.sex,S.std);

  // "SE" (Sweden) is a selectable pseudo-region here, not a RBY entry —
  // cell()/total() already treat it as the national aggregate everywhere
  // (map reference line, dot plot, etc.), so only the display name needs a
  // stand-in; t.natLine keeps it correctly localised rather than NAT[1],
  // which is hardcoded Swedish regardless of language.
  const R=S.region==="SE"?["SE",t.natLine]:RBY[S.region];
  const isNat=S.region==="SE";
  const band=[];const natT=[];
  for(let i=0;i<AGES.length;i++){
    const c=cell(k,"SE",yr,i,"T",S.std);
    if(c){band.push([i,c.lo*0.96,c.hi*1.04]);natT.push([i,c.value]);}}
  const seriesAge = S.sex==="T"
    ? [{pts:agePts(k,S.region,yr,"K",S.std),color:col,w:2.4,label:t.women,labelAt:2},
       {pts:agePts(k,S.region,yr,"M",S.std),color:col,dash:"5 3",w:1.9,label:t.men,labelAt:5}]
    : [{pts:agePts(k,S.region,yr,S.sex,S.std),color:col,w:2.4}];
  // Only annotates the FABRICATED age curve: the real HLV table has no age
  // dimension at all (see REAL_HLV in data.js), so there is no curve to
  // annotate once distress is real-active — band/seriesAge are empty there.
  const ageNotes = k==="distress" && !isRealActive(k)
    ? [{x:7.9,y:(band.length?band[band.length-1][2]:12),text:t.surveyEnd,anchor:"end"}] : [];

  const ts=[];
  validYears(k).forEach(y=>{
    const c=S.age===-1?total(k,S.region,y,S.sex,S.std):cell(k,S.region,y,S.age,S.sex,S.std);
    if(!c||c.suppressed){ts.push(null);return;}
    if(I.breakAt&&y>=I.breakAt&&ts.length&&ts[ts.length-1]&&ts[ts.length-1][0]<I.breakAt)ts.push(null);
    ts.push([y,c.value]);});
  const marks=[];
  if(I.breakAt)marks.push({x:I.breakAt-1,label:t.breakLbl});
  if(I.start<=2019)marks.push({x:2020,label:t.pandemicLbl});

  // null, not 0, when it isn't computable (fewer than 2 regions shown, or
  // the national total is itself suppressed/absent for this year) — a real
  // 0% spread is a genuine (if boring) reading, and shouldn't look the same
  // as "nothing to compare here".
  const spread=shown.length>1&&nat?Math.round((shown[0].value-shown[shown.length-1].value)/nat.value*100):null;
  const winNote=I.window?` · ${t.winLbl(yr)}`:"";

  return `
  <div class="ctrl">
    <div class="f"><label>${esc(t.lblInd)}</label><select id="c-ind">
      ${Object.keys(IND).map(x=>`<option value="${x}"${x===k?" selected":""}>${esc(t.ind[x])}</option>`).join("")}</select></div>
    <div class="f"><label>${esc(t.lblAge)}</label><select id="c-age">
      <option value="-1"${S.age===-1?" selected":""}>${esc(t.allAges)}</option>
      ${AGES.map((a,i)=>ageAvailable(k,i)?`<option value="${i}"${i===S.age?" selected":""}>${a}</option>`:"").join("")}</select></div>
    <div class="f"><label>${esc(t.lblSex)}</label><select id="c-sex"${!sexAvailable(k,"M")?" disabled":""}>
      <option value="T"${S.sex==="T"?" selected":""}>${esc(t.sexT)}</option>
      <option value="M"${S.sex==="M"?" selected":""}${!sexAvailable(k,"M")?" disabled":""}>${esc(t.sexM)}</option>
      <option value="K"${S.sex==="K"?" selected":""}${!sexAvailable(k,"K")?" disabled":""}>${esc(t.sexK)}</option></select></div>
    <div class="f"><label>${esc(t.lblReg)}</label><select id="c-reg">
      <option value="SE"${isNat?" selected":""}>${esc(t.natLine)}</option>
      ${REGIONS.map(r=>`<option value="${r[0]}"${r[0]===S.region?" selected":""}>${esc(r[1])}</option>`).join("")}</select></div>
    <div class="f"><label>${esc(t.lblYear)}</label><select id="c-year">
      ${years.slice().reverse().map(y=>`<option value="${y}"${y===yr?" selected":""}>${I.window?`${y-2}–${y+2}`:y}</option>`).join("")}</select></div>
    <div class="seg"${isRealActive(k)?' title="Real figures cover too few age bands to standardise"':""}>
      <button data-std="0" class="${S.std?"":"on"}"${isRealActive(k)?" disabled":""}>${esc(t.crude)}</button>
      <button data-std="1" class="${S.std?"on":""}"${isRealActive(k)?" disabled":""}>${esc(t.std)}</button>
    </div>
  </div>

  <div class="grid-ex">
    <div class="card">
      <div class="card-h"><h3>${esc(t.dotTitle)}</h3><div class="u">${esc(t.dotSub)}${esc(winNote)}</div></div>
      <div class="card-b">
        ${shown.length?dotPlot(shown,{nat:nat?nat.value:null,color:col,aria:"All regions with confidence intervals",unit:unitLabel(k)}):""}
        ${suppressed.length?`<div class="suppress"><b>${esc(t.suppLbl)}</b> ${suppressed.map(esc).join(", ")}</div>`:""}
      </div>
      <div class="src">${spread!=null?t.spreadNote(fmt(spread,0),S.std?1:0):""}</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h3>${esc(t.ageTitle)}</h3><div class="u">${esc(R[1])}${isNat?"":" "+esc(t.ageSub)}</div></div>
        <div class="card-b">${lineChart(seriesAge,
          {band:isNat?[]:band,aria:isNat?"Age curve for Sweden as a whole":"Age curves for the selected region against the national band",
           xlabels:[[1,"15"],[4,"45"],[6,"65"],[8,"85+"]],x0:0,x1:8,zero:true,h:185,notes:ageNotes,unit:unitLabel(k)})}
          ${isRealActive(k)&&t.realCaveat[k]?`<div class="suppress"><b>${esc(t.realLbl)}</b> ${esc(t.realCaveat[k])}</div>`:""}</div>
      </div>
      <div class="card">
        <div class="card-h"><h3>${esc(t.timeTitle)}</h3><div class="u tnum">${years[0]}–${years[years.length-1]}</div></div>
        <div class="card-b">${lineChart([{pts:ts,color:col,w:2.4,dot:true}],
          {aria:"Time series for the selected region with national events marked",
           marks,xlabels:[[years[0],String(years[0])],[Math.round((years[0]+years[years.length-1])/2),String(Math.round((years[0]+years[years.length-1])/2))],[years[years.length-1],String(years[years.length-1])]],h:185,unit:unitLabel(k)})}</div>
      </div>
    </div>
  </div>
  <div class="card mt-fig">${srcStrip(k,
    `<b>${esc(t.dl)}</b> · 21 ${S.lang==="sv"?"regioner":"regions"} × ${validYears(k).length} ${S.lang==="sv"?"år":"years"} × ${S.lang==="sv"?"ålder × kön":"age × sex"} · CSV`)}</div>`;
}

function viewRegioner(){
  const R=RBY[S.region];
  // The real Socialstyrelsen series lags several years behind "now" (that's
  // the register, not a bug — see REAL's docstring in data.js), so once it's
  // active this panel anchors on its latest common year rather than the
  // synthetic indicators' fixed 2024. The three still-fabricated indicators
  // read fine at any year the generator supports, so sharing one pair of
  // years keeps every row on this page comparable instead of guarding nulls
  // row by row.
  const latest = REAL.active ? REAL.latestYear : 2024;
  const prior = latest - 2;
  const peers=REGIONS.filter(r=>r[0]!==S.region)
    .map(r=>({r,d:Math.abs(r[4]-R[4])*1.4+Math.abs(r[3]-R[3])}))
    .sort((a,b)=>a.d-b.d).slice(0,4).map(p=>p.r);

  // A real-backed indicator can genuinely have no published figure for one
  // region/year (e.g. Gotland's distress window gap around 2020) — the
  // fallback here is "no data", never a fabricated stand-in.
  const NO_DATA={value:null,lo:null,hi:null,suppressed:false};
  const mine={},peer={};
  ["distress","antidep","suicide"].forEach(x=>{
    mine[x]=total(x,S.region,latest,"T",false)||NO_DATA;
    const vs=peers.map(p=>total(x,p[0],latest,"T",false)).filter(Boolean).map(c=>c.value);
    peer[x]=vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null;});
  const cmp=x=>{
    const m=mine[x],p=peer[x];
    if(m.value==null||p==null)return `<span class="flat">${esc(fmt(null))}</span>`;
    if(p>=m.lo&&p<=m.hi)return `<span class="flat">${esc(t.vsPeers)} <em>${fmt(p,1)}</em>. ${esc(t.notDiff)}</span>`;
    return `${esc(t.vsPeers)} <em>${fmt(p,1)}</em>. ${m.value>p?esc(t.higher):esc(t.lower)}`;};

  // fakeTotal, deliberately: same reasoning as viewLaget's identical scatter — see data.js.
  const gap=REGIONS.map(r=>{
    const d=fakeTotal("distress",r[0],latest,"T",false),a=fakeTotal("antidep",r[0],latest,"T",false);
    return {x:d.value,y:a.value,code:r[0],name:r[1]};});

  const chgDefs=[["distress","survey"],["antidep","reg"],["psych","reg"],["suicide","mort"]];
  const changes=chgDefs.map(([x,inst])=>{
    const a=total(x,S.region,latest,"T",false),b=total(x,S.region,prior,"T",false);
    // A real-backed indicator can genuinely have no published figure for one
    // of the two years in a small region (e.g. Gotland's distress window
    // gap around 2020) — that's missing data, not "no change".
    if(!a||!b) return {x,inst,d:null,within:false};
    const d=a.value-b.value;
    return {x,inst,d,within:Math.abs(d)<(a.hi-a.lo)/2};});

  return `
  <div class="rhead">
    <div>
      <div class="rname">${esc(R[1])}</div>
      <div class="rpeers">${esc(t.peers)} ${peers.map(p=>`<b>${esc(p[1])}</b>`).join(", ")}</div>
    </div>
    <div class="f" style="margin-left:auto"><label>${esc(t.lblReg)}</label>
      <select id="c-reg2">${REGIONS.map(r=>`<option value="${r[0]}"${r[0]===S.region?" selected":""}>${esc(r[1])}</option>`).join("")}</select></div>
  </div>

  <div class="rstats">
    <div class="rstat i-survey">
      <div class="rk" style="color:var(--teal)"><span class="dot" style="background:var(--teal)"></span>${esc(t.rDistress)}</div>
      <div class="rv tnum">${fmt(mine.distress.value,1,unitLabel("distress"))}</div>
      <div class="rci tnum">${esc(unitLabel("distress"))} · 95% ${S.lang==="sv"?"KI":"CI"} ${fmt(mine.distress.lo,1)}–${fmt(mine.distress.hi,1)} · 16–84</div>
      <div class="rvs">${cmp("distress")}</div>
    </div>
    <div class="rstat i-reg">
      <div class="rk" style="color:var(--violet)"><span class="dot" style="background:var(--violet)"></span>${esc(t.rTreated)}</div>
      <div class="rv tnum">${fmt(mine.antidep.value,1,unitLabel("antidep"))}</div>
      <div class="rci tnum">${esc(unitLabel("antidep"))} · 95% ${S.lang==="sv"?"KI":"CI"} ${fmt(mine.antidep.lo,1)}–${fmt(mine.antidep.hi,1)}</div>
      <div class="rvs">${cmp("antidep")}</div>
    </div>
    <div class="rstat i-mort">
      <div class="rk" style="color:var(--oxblood)"><span class="dot" style="background:var(--oxblood)"></span>${esc(t.rSuicide)}</div>
      <div class="rv tnum">${fmt(mine.suicide.value,1,unitLabel("suicide"))}</div>
      <div class="rci tnum">${esc(unitLabel("suicide"))} · ${esc(t.winLbl(latest))}</div>
      <div class="rvs">${cmp("suicide")}</div>
    </div>
  </div>

  <div class="card mt-fig">
    <div class="card-h"><h3>${esc(t.gapPos)}</h3><div class="u">${esc(t.gapPosU)}</div></div>
    <div class="card-b">${scatter(gap,{aria:"Region position: reported need against healthcare response",w:620,h:350})}</div>
    ${scatterKey()}
    <div class="src"><b>${S.lang==="sv"?"Syntetiska data":"Synthetic data"}</b> · ${S.lang==="sv"
      ?"Ringad region är den valda. Avståndet till linjen visar hur regionen förhåller sig till det genomsnittliga sambandet mellan behov och respons."
      :"The circled region is the selected one. Distance from the line shows how the region compares with the average association between need and response."} ${esc(t.causalNote)}</div>
    <button id="b-openbehov" class="mapopen">${esc(t.behovOpen)}</button>
  </div>
  <div class="card mt-fig">
    <div class="card-h"><h3>${esc(t.changed)}</h3><div class="u">${esc(t.changedU(prior,latest))}</div></div>
    <div class="card-b">
      <!-- LABEL_X 220, AXIS_X 300, MAX_W 65: the worst-case leftward bar
           reaches 300-65=235, a 15-unit margin clear of LABEL_X — checked
           as an absolute bound (AXIS_X-MAX_W vs LABEL_X), not per-row, so it
           holds regardless of any indicator's actual delta or multiplier.
           The value number sits in its own fixed column at NUM_X=380 — past
           AXIS_X+MAX_W (300+65=365), the furthest any bar can ever reach —
           so it's clear of every bar's own path in both directions, not
           just clear of the label the way the axis gap is. -->
      <svg viewBox="0 0 620 170" role="img" aria-label="${`Change since ${prior} for four indicators; changes inside the interval are greyed`}">
        <line x1="300" y1="14" x2="300" y2="142" stroke="var(--hair)" stroke-width="1"/>
        ${changes.map((c,i)=>{
          const y=32+i*30;
          if(c.d==null){
            return `<text x="220" y="${y+3}" text-anchor="end" font-family="var(--sans)" font-size="11" fill="var(--ink-2)">${esc(t.ind[c.x])}</text>
              <text x="380" y="${y+3}" font-family="var(--mono)" font-size="9.5" fill="var(--ink-3)">${esc(fmt(null))}</text>`;
          }
          const w=Math.min(65,Math.abs(c.d)*(c.x==="suicide"?12:6)+6);
          const x2=300+(c.d>0?w:-w);
          const col=c.within?"var(--ink-3)":INST_COLOR[c.inst];
          const op=c.within?".45":"1";
          // Each row appends its own unit (%, per 1,000, per 100,000) right
          // after the number — these four indicators aren't on comparable
          // scales, so without it "+340,6" and "−2,9" read as if they were.
          return `<line x1="300" y1="${y}" x2="${x2.toFixed(1)}" y2="${y}" stroke="${col}" stroke-width="2.6" opacity="${op}" stroke-linecap="round"/>
            <text x="380" y="${y+3}" font-family="var(--mono)" font-size="10" fill="${col}" opacity="${op}">${c.d>0?"+":"−"}${fmt(Math.abs(c.d),1)}</text>
            <text x="424" y="${y+3}" font-family="var(--sans)" font-size="8" fill="var(--ink-3)">${esc(unitLabel(c.x))}</text>
            ${c.within?`<text x="520" y="${y+3}" font-family="var(--sans)" font-size="9" fill="var(--ink-3)">${esc(t.withinCI)}</text>`:""}
            <text x="220" y="${y+3}" text-anchor="end" font-family="var(--sans)" font-size="11" fill="var(--ink-2)">${esc(t.ind[c.x])}</text>`;
        }).join("")}
      </svg>
    </div>
    <div class="src">${t.chgNote(changes.filter(c=>c.within).length)}</div>
  </div>`;
}

function viewKarta(){
  const k=S.ind, I=IND[k], col=INST_COLOR[I.inst];
  const years=validYears(k);
  const yrIdx=S.mapYear!=null&&years.includes(S.mapYear)?years.indexOf(S.mapYear):years.length-1;
  const yr=years[yrIdx];

  // Builds one indicator's region rows for a given year, trend arrows
  // included: each row compares against the previous *available* point for
  // that indicator (years can be irregular windows, so "prior" is never
  // just year-1) and reads direction against the same shift nationally —
  // a region can rise while the country falls, and that's the interesting
  // case, not the raw up/down. Shared by the primary map and, in compare
  // mode, the second one, so neither loses its arrows.
  const mapRows=(indK,yrVal,yrsList)=>{
    const idx=yrsList.indexOf(yrVal), priorYr=idx>0?yrsList[idx-1]:null;
    const nat=total(indK,"SE",yrVal,"T",S.std);
    const natPrior=priorYr?total(indK,"SE",priorYr,"T",S.std):null;
    const natDelta=nat&&natPrior?nat.value-natPrior.value:null;
    const trendOf=(code,c)=>{
      if(!priorYr)return null;
      const p=total(indK,code,priorYr,"T",S.std);
      if(!p||p.suppressed)return null;
      const d=c.value-p.value, within=Math.abs(d)<(c.hi-c.lo)/2;
      if(within)return{arrow:"→",rel:null};
      const arrow=d>0?"↑":"↓";
      if(natDelta==null||Math.abs(natDelta)<1e-9)return{arrow,rel:null};
      return{arrow,rel:(d>0)===(natDelta>0)?"with":"against"};
    };
    const rows=REGIONS.map(r=>{
      const c=total(indK,r[0],yrVal,"T",S.std);
      return c&&{code:r[0],name:r[1],value:c.value,lo:c.lo,hi:c.hi,supp:c.suppressed,trend:c.suppressed?null:trendOf(r[0],c)};
    }).filter(Boolean);
    return{rows,nat,priorYr};
  };

  const{rows,nat,priorYr}=mapRows(k,yr,years);

  // Compare mode: a second, independent indicator on its own mini map next
  // to the first, with its own trend arrows against its own history.
  const cmpK=S.cmpOn?(IND[S.cmpInd]&&S.cmpInd!==k?S.cmpInd:Object.keys(IND).find(x=>x!==k)):null;
  let cmpRows=null,cmpNat=null,cmpCol=null;
  if(cmpK){
    const cmpYears=validYears(cmpK);
    const cmpYr=cmpYears.includes(yr)?yr:cmpYears[cmpYears.length-1];
    cmpCol=INST_COLOR[IND[cmpK].inst];
    ({rows:cmpRows,nat:cmpNat}=mapRows(cmpK,cmpYr,cmpYears));
  }

  const R=RBY[S.region];
  const NO_DATA={value:null,lo:null,hi:null,suppressed:false};
  const mine={};
  const latest = REAL.active ? REAL.latestYear : 2024;    // see viewRegioner for why
  ["distress","antidep","suicide"].forEach(x=>{ mine[x]=total(x,S.region,latest,"T",false)||NO_DATA; });

  const stat=(key,label,color)=>`
    <div class="rstat i-${key==="distress"?"survey":key==="antidep"?"reg":"mort"}">
      <div class="rk" style="color:${color}"><span class="dot" style="background:${color}"></span>${esc(label)}</div>
      <div class="rv tnum">${fmt(mine[key].value,1,unitLabel(key))}</div>
      <div class="rci tnum">${esc(unitLabel(key))} · 95% ${S.lang==="sv"?"KI":"CI"} ${fmt(mine[key].lo,1)}–${fmt(mine[key].hi,1)}</div>
    </div>`;

  return `
  <div class="ctrl">
    <div class="f"><label>${esc(t.lblInd)}</label><select id="c-mapind">
      ${Object.keys(IND).map(x=>`<option value="${x}"${x===k?" selected":""}>${esc(t.ind[x])}</option>`).join("")}</select></div>
    <div class="seg"${isRealActive(k)?' title="Real figures cover too few age bands to standardise"':""}>
      <button data-std="0" class="${S.std?"":"on"}"${isRealActive(k)?" disabled":""}>${esc(t.crude)}</button>
      <button data-std="1" class="${S.std?"on":""}"${isRealActive(k)?" disabled":""}>${esc(t.std)}</button>
    </div>
    <div class="f slide">
      <label>${esc(t.lblYear)}</label>
      <div class="slidewrap">
        <button id="c-yprev" class="ystep" ${yrIdx<=0?"disabled":""} aria-label="${S.lang==="sv"?"Föregående år":"Previous year"}">‹</button>
        <span class="tnum yval">${I.window?esc(t.winLbl(yr)):yr}</span>
        <button id="c-ynext" class="ystep" ${yrIdx>=years.length-1?"disabled":""} aria-label="${S.lang==="sv"?"Nästa år":"Next year"}">›</button>
      </div>
    </div>
    <button id="c-cmptoggle" class="cmpbtn${S.cmpOn?" on":""}">${esc(t.cmpToggle)}</button>
  </div>

  <div class="grid-ex">
    <div class="card">
      <div class="card-h"><h3>${esc(t.mapTitle)}</h3>${cmpK?"":`<div class="u">${esc(t.ind[k])} (${esc(unitLabel(k))}) · ${I.window?esc(t.winLbl(yr)):yr}</div>`}</div>
      <div class="card-b">
        ${cmpK?`
        <div class="mapcmp">
          <div>
            <div class="mapcmphead">${esc(t.ind[k])} (${esc(unitLabel(k))})</div>
            ${mapZoomWrap(chorMap(rows,{color:col,nat:nat?nat.value:null,unit:unitLabel(k),aria:"Map of Sweden's 21 regions for "+t.ind[k]+", click a region to see its figures"}),"karta-cmp-a")}
            ${mapLegend(rows,col,unitLabel(k),nat?nat.value:null)}
          </div>
          <div>
            <div class="mapcmphead"><select id="c-cmpind">
              ${Object.keys(IND).filter(x=>x!==k).map(x=>`<option value="${x}"${x===cmpK?" selected":""}>${esc(t.ind[x])}</option>`).join("")}
            </select> (${esc(unitLabel(cmpK))})</div>
            ${mapZoomWrap(chorMap(cmpRows,{color:cmpCol,nat:cmpNat?cmpNat.value:null,unit:unitLabel(cmpK),aria:"Map of Sweden's 21 regions for "+t.ind[cmpK]+", click a region to see its figures"}),"karta-cmp-b")}
            ${mapLegend(cmpRows,cmpCol,unitLabel(cmpK),cmpNat?cmpNat.value:null)}
          </div>
        </div>`:`
        ${mapZoomWrap(chorMap(rows,{color:col,nat:nat?nat.value:null,unit:unitLabel(k),aria:"Map of Sweden's 21 regions, click a region to see its figures"}),"karta")}
        ${mapLegend(rows,col,unitLabel(k),nat?nat.value:null)}`}
      </div>
      <div class="src">${esc(t.mapNote(isRealActive(k)))} ${priorYr?esc(t.trendNote(priorYr,yr)):""} <b>${S.lang==="sv"?"Gränser":"Borders"}</b> © OpenStreetMap-bidragsgivare, ODbL.</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h3>${esc(R[1])}</h3><div class="u">${esc(t.mapPicked)}</div></div>
        <div class="card-b">
          <div class="rstats" style="grid-template-columns:1fr">
            ${stat("distress",t.rDistress,"var(--teal)")}
            ${stat("antidep",t.rTreated,"var(--violet)")}
            ${stat("suicide",t.rSuicide,"var(--oxblood)")}
          </div>
          <button id="b-openregion" class="mapopen">${esc(t.mapOpen)} →</button>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h3>${esc(t.histTitle)}</h3><div class="u">${esc(t.ind[k])} (${esc(unitLabel(k))})</div></div>
        <div class="card-b">${histogram(rows,{color:col,aria:"How many regions fall into each value band",unit:unitLabel(k),countLabel:t.histCount})}</div>
        <div class="src">${esc(t.histSub)}</div>
      </div>
    </div>
  </div>`;
}

function viewMetod(){
  const P=t.mProse;
  const rs=realSummary();
  const rows=Object.keys(IND).map(x=>{
    const I=IND[x],[grain,limit]=t.mRows[x];
    const real=isRealActive(x);
    return `<tr>
      <td class="in" style="border-left:3px solid ${INST_COLOR[I.inst]}">${esc(t.ind[x])}
        <span class="modechip ${real?"real":"synth"}">${esc(real?t.realLbl:t.synthLbl)}</span></td>
      <td>${esc(I[S.lang==="sv"?"reg":"regEn"])}</td>
      <td class="mono">${x==="suicide"?"1997":I.start}</td>
      <td class="mono">${esc(grain)}</td>
      <td class="lim">${esc(limit)}</td></tr>`;}).join("");
  return `
  <div class="prose">
    <h2>${esc(t.methodH)}</h2>
    <h3>${esc(P.a)}</h3><p>${esc(P.b)}</p>
    <h3>${esc(P.c)}</h3><p>${esc(P.d)}</p>
    <h3>${esc(P.e)}</h3><p>${esc(P.f)}</p>
    <div class="note"><div class="l">${esc(P.g)}</div><p>${esc(P.h)}</p></div>
    <div class="note"><div class="l">${esc(t.realNoteL)}</div><p>${esc(rs.n>0?t.realNoteOn(rs.n,rs.total,rs.realNames,rs.synthNames,rs.synthN):t.realNoteOff)}</p></div>
  </div>
  <div class="mwrap"><table class="m">
    <thead><tr><th>${esc(t.mIndicator)}</th><th>${esc(t.mSource)}</th><th>${esc(t.mFrom)}</th><th>${esc(t.mGrain)}</th><th>${esc(t.mLimit)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

/* Shared shell for nav sections that are planned (see FILES.txt / the
   observatory plan) but not yet built: real content still needs a new data
   source (Försäkringskassan for sjukskrivning, SCB/Kolada for sammanhang) or
   a structural move (behov's need-vs-response scatter currently lives inside
   viewLaget/viewRegioner). Keeping the tab visible and honestly labelled
   beats hiding the gap in the nav. */
// No heading of its own — the shell now wraps every section in a heading
// that already matches the tab name (see shell.js's render()).
function viewComing(){
  return `
  <div class="prose">
    <div class="note"><div class="l">${esc(t.comingT)}</div><p>${esc(t.comingB)}</p></div>
  </div>`;
}
function viewBehov(){
  // fakeTotal, deliberately: this scatter's whole premise (distance from the
  // regression line as need vs. response) only holds if both axes come
  // from the same internally-correlated fabricated generator. See
  // fakeTotal()'s docstring in data.js.
  const gap=REGIONS.map(r=>{
    const d=fakeTotal("distress",r[0],2024,"T",false),a=fakeTotal("antidep",r[0],2024,"T",false);
    return {x:d.value,y:a.value,code:r[0],name:r[1]};});
  const worst=(()=>{const n=gap.length,mx=gap.reduce((s,p)=>s+p.x,0)/n,my=gap.reduce((s,p)=>s+p.y,0)/n;
    let sxy=0,sxx=0;gap.forEach(p=>{sxy+=(p.x-mx)*(p.y-my);sxx+=(p.x-mx)**2;});
    const b=sxy/sxx,a=my-b*mx;
    return gap.slice().sort((p,q)=>(p.y-(a+b*p.x))-(q.y-(a+b*q.x)))[0];})();
  const gp=t.gapPiece;

  return `
  <div class="hero">
    <p>${esc(t.behovLead)}</p>
  </div>
  <div class="figrow" style="margin-top:20px">
    <div class="card">
      <div class="card-h"><h3>${esc(t.gapTitle)}</h3><div class="u">${esc(t.gapUnit)}</div></div>
      <div class="card-b">${scatter(gap,{aria:"Reported need against healthcare response across 21 regions",w:620,h:380})}</div>
      ${scatterKey()}
      ${srcStrip("antidep",t.causalNote)}
    </div>
    <div class="pieces" style="grid-template-columns:1fr">
      <div class="piece">
        <div class="tag" style="color:${INST_COLOR[gp.inst]}">${esc(gp.tag)}</div>
        <h4>${esc(gp.h)}</h4><p>${esc(gp.p)}</p>
        <div class="num tnum" style="color:${INST_COLOR[gp.inst]}">${esc(worst.name)}</div>
        <div class="numl">${esc(gp.numl)}</div>
      </div>
    </div>
  </div>`;
}
function viewSjukskrivning(){
  const k="sjukfranvaro", col=INST_COLOR.fk;
  const years=validYears(k);
  const latest=years[years.length-1];
  const nat=total(k,"SE",latest,"T",false);
  const ts=sex=>years.map(y=>{const c=total(k,"SE",y,sex,false); return c&&!c.suppressed?[y,c.value]:null;});
  // Same shape as viewKarta's single (non-compare) map branch, trimmed down
  // to this one indicator — no year slider or trend arrows, just the
  // latest year, since this page is about one indicator, not a picker.
  const rows=REGIONS.map(r=>{const c=total(k,r[0],latest,"T",false); return c&&{code:r[0],name:r[1],value:c.value,lo:c.lo,hi:c.hi};}).filter(Boolean);
  const R=RBY[S.region];
  const mine=total(k,S.region,latest,"T",false);

  return `
  <div class="hero">
    <p>${esc(t.fkLead)}</p>
  </div>
  <div class="card mt-fig">
    <div class="card-h"><h3>${esc(t.timeTitle)}</h3><div class="u">${esc(t.natLine)}</div></div>
    <div class="card-b">${lineChart(
      [{pts:ts("K"),color:col,w:2.4,label:t.women,labelAt:0},
       {pts:ts("M"),color:col,dash:"5 3",w:1.9,label:t.men,labelAt:0}],
      {aria:"Sickness absence trend, women and men",
       xlabels:[[years[0],String(years[0])],[years[years.length-1],String(years[years.length-1])]],
       h:200,unit:unitLabel(k)})}</div>
    ${srcStrip(k)}
  </div>
  <div class="grid-ex mt-fig">
    <div class="card">
      <div class="card-h"><h3>${esc(t.mapTitle)}</h3><div class="u">${esc(t.ind[k])} (${esc(unitLabel(k))}) · ${latest}</div></div>
      <div class="card-b">
        ${mapZoomWrap(chorMap(rows,{color:col,nat:nat?nat.value:null,unit:unitLabel(k),aria:"Map of Sweden's 21 regions for sickness absence, click a region to see its figures"}),"sjukskrivning")}
        ${mapLegend(rows,col,unitLabel(k),nat?nat.value:null)}
      </div>
      <div class="src"><b>${S.lang==="sv"?"Gränser":"Borders"}</b> © OpenStreetMap-bidragsgivare, ODbL.</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h3>${esc(R[1])}</h3><div class="u">${esc(t.mapPicked)}</div></div>
        <div class="card-b">
          <div class="rstats" style="grid-template-columns:1fr">
            <div class="rstat" style="border-top-color:${col}">
              <div class="rk" style="color:${col}"><span class="dot" style="background:${col}"></span>${esc(t.ind[k])}</div>
              <div class="rv tnum">${fmt(mine?mine.value:null,1,unitLabel(k))}</div>
              <div class="rci tnum">${esc(unitLabel(k))} · 95% ${S.lang==="sv"?"KI":"CI"} ${fmt(mine?mine.lo:null,1)}–${fmt(mine?mine.hi:null,1)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
function viewSammanhang(){
  if(!CONTEXT.active)return viewComing();
  const k=S.ctxInd;
  const unit=CONTEXT_META[k].scale==="pct"?"%":"per km²";
  const rows=REGIONS.map(r=>{
    const c=contextCell(k,r[0]);
    return c&&{code:r[0],name:r[1],value:c.value,lo:c.value,hi:c.value,n:c.n_kommuner};
  }).filter(Boolean);
  const col="var(--ink-2)";
  const R=RBY[S.region];
  const mine=contextCell(k,S.region);

  return `
  <div class="hero">
    <p>${esc(t.ctxLead)}</p>
  </div>
  <div class="ctrl">
    <div class="f"><label>${esc(t.lblInd)}</label><select id="c-ctxind">
      ${Object.keys(t.ctxInd).map(x=>`<option value="${x}"${x===k?" selected":""}>${esc(t.ctxInd[x])}</option>`).join("")}</select></div>
  </div>
  <div class="grid-ex">
    <div class="card">
      <div class="card-h"><h3>${esc(t.mapTitle)}</h3><div class="u">${esc(t.ctxInd[k])} (${esc(unit)}) · 2023</div></div>
      <div class="card-b">
        ${mapZoomWrap(chorMap(rows,{color:col,unit,aria:"Map of Sweden's 21 regions for a context indicator, not a mental-health measure, click a region to see its figures"}),"sammanhang")}
        ${mapLegend(rows,col,unit,null)}
      </div>
      <div class="src">${esc(t.ctxCaveat)} ${esc(t.causalNote)}</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h3>${esc(R[1])}</h3><div class="u">${esc(t.mapPicked)}</div></div>
        <div class="card-b">
          <div class="rstats" style="grid-template-columns:1fr">
            <div class="rstat" style="border-top-color:${col}">
              <div class="rk" style="color:${col}"><span class="dot" style="background:${col}"></span>${esc(t.ctxInd[k])}</div>
              <div class="rv tnum">${fmt(mine?mine.value:null,1,unit)}</div>
              <div class="rci tnum">${esc(unit)} · 2023</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
