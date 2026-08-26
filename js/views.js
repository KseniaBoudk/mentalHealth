"use strict";

/* =====================================================================
   5. VIEWS
   ===================================================================== */

/* isRealActive(k) is defined in data.js: true once this indicator is
   actually being served from REAL (js/data/real_mh.js has rows AND has
   finished its lazy load — see js/shell.js's loadRealSourcesLazily()),
   not just eligible for it. Every label below reads it rather than
   IND[k].real alone, so a reader never sees "real data" before anyone has
   run the fetcher (or, now, before that indicator's own file has landed). */
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

// "95% KI"/"95% CI" was typed out with its own inline language ternary at
// every one of the ~9 spots a card shows a confidence interval — one
// shared pair here instead, so a wording change only ever needs to happen
// once. Used by views.js's own rstat/rci cards and by shell.js's
// renderReadoutCard() (loaded after this file, so the functions are
// already in scope by the time it runs).
const ciWord=()=>S.lang==="sv"?"KI":"CI";
const ciRange=(lo,hi)=>`95% ${ciWord()} ${fmt(lo,1)}–${fmt(hi,1)}`;

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
function agePtsWith(getCell,k,regionCode,year,sex,std,type){
  const pts=[];
  for(let i=0;i<AGES.length;i++){
    const c=getCell(k,regionCode,year,i,sex,std,type);
    pts.push(c?[i,c.value]:null);
  }
  while(pts.length&&!pts[pts.length-1])pts.pop();
  let i0=0;while(i0<pts.length&&!pts[i0])i0++;
  return pts.slice(i0);
}
const agePts=(k,regionCode,year,sex,std,type)=>agePtsWith(cell,k,regionCode,year,sex,std,type);
/* Forces the fabricated generator even for indicators REAL can now answer.
   Used only by viewLaget's life-course exhibit — see fakeCell()'s docstring
   in data.js for why that one chart can never honestly go real. */
const fakeAgePts=(k,regionCode,year,sex,std)=>agePtsWith(fakeCell,k,regionCode,year,sex,std);

const legendStrip=()=>`<div class="legend">${t.legend.map(([k,b,r])=>
  `<span class="li"><span class="dot" style="background:${INST_COLOR[k==="survey"?"survey":k==="reg"?"reg":"mort"]}"></span><span><b>${esc(b)}</b> ${esc(r)}</span></span>`).join("")}</div>`;

// lineLegend: one row per labelled series in a lineChart() call, each a
// short stroke sample (colour + dash + width, matching the line itself
// exactly) next to its name — replaces the on-chart caption lineChart()
// used to draw at each line's last point, which got crowded or ran off
// the plot on anything longer than a one-word label (see kurvan.css's
// .line-legend). Series without a label (e.g. a lone annotated line) are
// skipped rather than showing up as a blank row.
const lineLegend=series=>{
  const labelled=series.filter(se=>se.label);
  if(!labelled.length)return "";
  return `<div class="line-legend">${labelled.map(se=>
    `<span class="li"><svg class="ln" width="28" height="12" aria-hidden="true"><line x1="1" y1="6" x2="27" y2="6" stroke="${se.color}" stroke-width="${se.w||2.3}"${se.dash?` stroke-dasharray="${se.dash}"`:""} stroke-linecap="round"/></svg>${esc(se.label)}</span>`).join("")}</div>`;
};

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

// National K(women)/M(men) trend for one indicator across all its valid
// years — originally viewSjukskrivning's own closure, hoisted here once
// viewKon() needed the identical shape three more times. null, not a
// missing point dropped, for a suppressed year (real windows sometimes
// suppress small counts) — lineChart() already treats null as a genuine
// series break, never silently joins across one.
// ageIdx (optional): omitted (the original/every existing call's shape)
// means the all-ages total() series this was always built for; passed,
// it uses cell() at that one AGES band instead — e.g. the youth panel
// (viewKon) wanting psych at "15-24" specifically rather than all ages.
const sexTimeSeries=(k,std,ageIdx)=>{
  const years=validYears(k);
  const ts=sex=>years.map(y=>{
    const c=ageIdx==null?total(k,"SE",y,sex,std):cell(k,"SE",y,ageIdx,sex,std);
    return c&&!c.suppressed?[y,c.value]:null;});
  return{years,ts};
};

// National age-group trend for one indicator across all its valid years —
// the age analogue of sexTimeSeries above, feeding viewAlder. Sex "T"
// throughout: this compares age groups, not sexes. ageGroupTotal (data.js)
// already returns null for a group with nothing published in that year,
// same series-break convention as sexTimeSeries.
const ageGroupTimeSeries=(k,std)=>{
  const years=validYears(k);
  const ts=g=>years.map(y=>{const c=ageGroupTotal(k,"SE",y,g.idxs,"T",std); return c?[y,c.value]:null;});
  return{years,ts};
};

// Vertical event markers (EVENTS, data.js) for one indicator's calendar-year
// time series — only events that actually apply to this indicator (no `ind`
// on the event, or `ind===k`) AND fall inside `years`' own range, so a chart
// never draws a marker past its own visible x-axis (e.g. sjukfranvaro's real
// data stops in 2019, before the pandemic marker, and correctly shows none).
// Feeds lineChart()'s existing opts.marks (charts.js) directly.
function eventMarks(k,years){
  if(!years.length)return[];
  const lo=years[0],hi=years[years.length-1];
  return EVENTS.filter(e=>(!e.ind||e.ind===k)&&e.year>=lo&&e.year<=hi)
    .map(e=>({x:e.year,label:t[e.labelKey],color:e.color,anchor:e.anchor}));
}

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
  const shSeries=[{pts:shK,color:"var(--violet)",w:2.5,label:t.women,anno:{at:shPeak,dx:9,dy:-8,text:t.peakSh}},
                   {pts:shM,color:"var(--violet)",dash:"5 3",w:1.9,label:t.men}];
  const suSeries=[{pts:suM,color:"var(--oxblood)",w:2.6,label:t.men,anno:{at:suPeak,dx:-9,dy:-9,text:t.peakSu}},
                   {pts:suK,color:"var(--oxblood)",dash:"5 3",w:1.9,label:t.women}];
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
        ${lineChart(shSeries,
          {aria:"Self-harm admissions by age and sex",xlabels:xl,zero:true,h:205,unit:unitLabel("selfharm"),xFmt:i=>AGES[i]})}
        ${lineLegend(shSeries)}
      </div>
      <div>
        <h4>${esc(t.suTitle)}</h4><div class="u">${srcLine("suicide")}</div>
        ${lineChart(suSeries,
          {aria:"Suicide by age and sex",xlabels:xl,zero:true,h:205,unit:unitLabel("suicide"),xFmt:i=>AGES[i]})}
        ${lineLegend(suSeries)}
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
  // Diagnosis type (psych) / medication class (antidep) — the only two
  // indicators this applies to; cell()/total() ignore a `type` argument
  // for every other k, and default it to "all" themselves when it's
  // undefined, so this is a no-op everywhere else. See PSYCH_TYPES/
  // MED_TYPES and rebuildREAL_PSYCH()'s docstring in js/data.js.
  const hasType = k==="psych" || k==="antidep";
  const type = k==="psych" ? S.psychType : k==="antidep" ? S.medType : undefined;

  const rowsAll=REGIONS.map(r=>{
    const c=S.age===-1?total(k,r[0],yr,S.sex,S.std,type):cell(k,r[0],yr,S.age,S.sex,S.std,type);
    return c&&{code:r[0],name:r[1],value:c.value,lo:c.lo,hi:c.hi,supp:c.suppressed};
  }).filter(Boolean);
  const shown=rowsAll.filter(r=>!r.supp).sort((a,b)=>b.value-a.value);
  const suppressed=rowsAll.filter(r=>r.supp).map(r=>r.name);
  // Whichever region a click on a dot-plot row (or the region picker
  // below) landed on — undefined only for the "SE" pseudo-region, which
  // isn't one of rowsAll's 21 real entries. Rendered into the dot plot's
  // own card-b, in what used to be empty space below the SVG whenever
  // the plot itself is shorter than its two .stack siblings (CSS grid's
  // own stretch, same as every other side-by-side card pairing here).
  const selRow=rowsAll.find(r=>r.code===S.region);
  const nat=S.age===-1?total(k,"SE",yr,S.sex,S.std,type):cell(k,"SE",yr,S.age,S.sex,S.std,type);

  // "SE" (Sweden) is a selectable pseudo-region here, not a RBY entry —
  // cell()/total() already treat it as the national aggregate everywhere
  // (map reference line, dot plot, etc.), so only the display name needs a
  // stand-in; t.natLine keeps it correctly localised rather than NAT[1],
  // which is hardcoded Swedish regardless of language.
  const R=S.region==="SE"?["SE",t.natLine]:RBY[S.region];
  const isNat=S.region==="SE";
  const band=[];const natT=[];
  for(let i=0;i<AGES.length;i++){
    const c=cell(k,"SE",yr,i,"T",S.std,type);
    if(c){band.push([i,c.lo*0.96,c.hi*1.04]);natT.push([i,c.value]);}}
  const seriesAge = S.sex==="T"
    ? [{pts:agePts(k,S.region,yr,"K",S.std,type),color:col,w:2.4,label:t.women},
       {pts:agePts(k,S.region,yr,"M",S.std,type),color:col,dash:"5 3",w:1.9,label:t.men}]
    : [{pts:agePts(k,S.region,yr,S.sex,S.std,type),color:col,w:2.4}];
  // Only annotates the FABRICATED age curve: the real HLV table has no age
  // dimension at all (see REAL_HLV in data.js), so there is no curve to
  // annotate once distress is real-active — band/seriesAge are empty there.
  const ageNotes = k==="distress" && !isRealActive(k)
    ? [{x:7.9,y:(band.length?band[band.length-1][2]:12),text:t.surveyEnd,anchor:"end"}] : [];

  const ts=[];
  validYears(k).forEach(y=>{
    const c=S.age===-1?total(k,S.region,y,S.sex,S.std,type):cell(k,S.region,y,S.age,S.sex,S.std,type);
    if(!c||c.suppressed){ts.push(null);return;}
    if(I.breakAt&&y>=I.breakAt&&ts.length&&ts[ts.length-1]&&ts[ts.length-1][0]<I.breakAt)ts.push(null);
    ts.push([y,c.value]);});
  const marks=eventMarks(k,years);
  if(I.breakAt)marks.push({x:I.breakAt-1,label:t.breakLbl});

  // null, not 0, when it isn't computable (fewer than 2 regions shown, or
  // the national total is itself suppressed/absent for this year) — a real
  // 0% spread is a genuine (if boring) reading, and shouldn't look the same
  // as "nothing to compare here".
  const spread=shown.length>1&&nat?Math.round((shown[0].value-shown[shown.length-1].value)/nat.value*100):null;
  const winNote=I.window?` · ${t.winLbl(yr)}`:"";
  // Real psych/antidep's standardRate() (data.js) only exists for the "all
  // ages" aggregate — a single age band standardised against itself is
  // meaningless, so cell() never applies it, and the crude/standardised
  // toggle is otherwise a silent no-op whenever a specific band is picked
  // (S.age defaults to a band, not "All ages" — this bit for real data
  // otherwise, since fakeCell()'s own standardisation DOES apply per band).
  const stdNoopHere = isRealActive(k) && stdCapable(k) && S.age !== -1;
  const stdDisabled = !stdCapable(k) || stdNoopHere;
  const stdTip = !stdCapable(k) ? t.stdDisabledTip : stdNoopHere ? t.stdAgeOnlyTip : "";

  return `
  <div class="ctrl">
    <div class="f"><label>${esc(t.lblInd)}</label><select id="c-ind">
      ${Object.keys(IND).map(x=>`<option value="${x}"${x===k?" selected":""}>${esc(t.ind[x])}</option>`).join("")}</select></div>
    ${hasType?`<div class="f"><label>${esc(t.lblType)}</label><select id="c-type">
      <option value="all"${type==="all"?" selected":""}>${esc(t.typeAll)}</option>
      ${(k==="psych"?PSYCH_TYPES:MED_TYPES).map(ty=>`<option value="${ty}"${ty===type?" selected":""}>${esc(t.psychMedTypes[ty])}</option>`).join("")}</select></div>`:""}
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
    <div class="seg"${stdTip?` title="${esc(stdTip)}"`:""}>
      <button data-std="0" class="${S.std?"":"on"}"${stdDisabled?" disabled":""}>${esc(t.crude)}</button>
      <button data-std="1" class="${S.std?"on":""}"${stdDisabled?" disabled":""}>${esc(t.std)}</button>
    </div>
  </div>

  <div class="grid-ex">
    <div class="card">
      <div class="card-h"><h3>${esc(t.dotTitle)}</h3><div class="u">${esc(t.dotSub)}${esc(winNote)}</div></div>
      <div class="card-b">
        ${shown.length?dotPlot(shown,{nat:nat?nat.value:null,color:col,aria:"All regions with confidence intervals",unit:unitLabel(k)}):""}
        ${suppressed.length?`<div class="suppress"><b>${esc(t.suppLbl)}</b> ${suppressed.map(esc).join(", ")}</div>`:""}
        ${selRow?`<div class="rstats" style="grid-template-columns:1fr;margin-top:14px">
          <div class="rstat" style="border-top-color:${col}">
            <div class="rk" style="color:${col}"><span class="dot" style="background:${col}"></span>${esc(selRow.name)}</div>
            <div class="rv tnum">${fmt(selRow.value,1,unitLabel(k))}</div>
            <div class="rci tnum">${esc(unitLabel(k))} · ${ciRange(selRow.lo,selRow.hi)}</div>
            <div class="rvs">${esc(t.statSentence[k](fmt(selRow.value,1)))}</div>
          </div>
        </div>`:""}
      </div>
      <div class="src">${spread!=null?t.spreadNote(fmt(spread,0),S.std?1:0):""}</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h3>${esc(t.ageTitle)}</h3><div class="u">${esc(R[1])}${isNat?"":" "+esc(t.ageSub)}</div></div>
        <div class="card-b">${lineChart(seriesAge,
          {band:isNat?[]:band,aria:isNat?"Age curve for Sweden as a whole":"Age curves for the selected region against the national band",
           xlabels:[[1,"15"],[4,"45"],[6,"65"],[8,"85+"]],x0:0,x1:8,zero:true,h:185,notes:ageNotes,unit:unitLabel(k),xFmt:i=>AGES[i],
           emptyMsg:(isRealActive(k)&&REAL_AGE_LIMIT[k]&&!REAL_AGE_LIMIT[k].length)?t.noAgeData:null})}
          ${lineLegend(seriesAge)}
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
  const peers=REGIONS.filter(r=>r[0]!==S.region)
    .map(r=>({r,d:Math.abs(r[4]-R[4])*1.4+Math.abs(r[3]-R[3])}))
    .sort((a,b)=>a.d-b.d).slice(0,4).map(p=>p.r);

  const NO_DATA={value:null,lo:null,hi:null,suppressed:false};

  const indConfigs=[
    {k:"distress",tag:t.rDistress,inst:"survey"},
    {k:"antidep",tag:t.rTreated,inst:"reg"},
    {k:"psych",tag:t.rPsych,inst:"reg"},
    {k:"selfharm",tag:t.rSelfharm,inst:"reg"},
    {k:"suicide",tag:t.rSuicide,inst:"mort"},
    {k:"sjukfranvaro",tag:t.rSjukfranvaro,inst:"fk"}
  ];

  const mine={},peer={},latestYrs={};
  indConfigs.forEach(item=>{
    const k=item.k;
    const yrs=validYears(k);
    const lat=yrs[yrs.length-1];
    latestYrs[k]=lat;
    mine[k]=total(k,S.region,lat,"T",false)||NO_DATA;
    const vs=peers.map(p=>total(k,p[0],lat,"T",false)).filter(Boolean).filter(c=>!c.suppressed).map(c=>c.value);
    peer[k]=vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null;
  });

  const cmp=k=>{
    const m=mine[k],p=peer[k];
    if(m.value==null||p==null)return `<span class="flat">${esc(fmt(null))}</span>`;
    if(p>=m.lo&&p<=m.hi)return `<span class="flat">${esc(t.vsPeers)} <em>${fmt(p,1)}</em>. ${esc(t.notDiff)}</span>`;
    return `${esc(t.vsPeers)} <em>${fmt(p,1)}</em>. ${m.value>p?esc(t.higher):esc(t.lower)}`;
  };

  const ciText=(k,lat)=>{
    const m=mine[k];
    const u=esc(unitLabel(k));
    if(k==="distress")return `${u} · ${ciRange(m.lo,m.hi)} · 16–84 · ${lat}`;
    if(k==="suicide"||k==="selfharm")return `${u} · ${esc(t.winLbl(lat))}`;
    return `${u} · ${ciRange(m.lo,m.hi)} · ${lat}`;
  };

  const ctxDensity=contextCell("pop_density",S.region);
  const ctxLowEdu=contextCell("education_low_pct",S.region);

  const gapLatest=REAL.active?REAL.latestYear:2024;
  const gap=REGIONS.map(r=>{
    const d=fakeTotal("distress",r[0],gapLatest,"T",false),a=fakeTotal("antidep",r[0],gapLatest,"T",false);
    return {x:d.value,y:a.value,code:r[0],name:r[1]};
  });

  const chgDefs=[
    ["distress","survey"],
    ["antidep","reg"],
    ["psych","reg"],
    ["selfharm","reg"],
    ["suicide","mort"],
    ["sjukfranvaro","fk"]
  ];
  const changes=chgDefs.map(([x,inst])=>{
    const yrs=validYears(x);
    const lat=yrs[yrs.length-1];
    const pri=yrs.length>1?yrs[yrs.length-2]:null;
    if(!pri)return {x,inst,d:null,within:false,pri,lat};
    const a=total(x,S.region,lat,"T",false);
    const b=total(x,S.region,pri,"T",false);
    if(!a||!b||a.suppressed||b.suppressed||a.value==null||b.value==null){
      return {x,inst,d:null,within:false,pri,lat};
    }
    const d=a.value-b.value;
    const ciW=(a.hi-a.lo)/2;
    return {x,inst,d,within:Math.abs(d)<ciW,pri,lat};
  });

  const latestCommon = REAL.active ? REAL.latestYear : 2024;
  const priorCommon = latestCommon - 2;

  return `
  <div class="hero">
    <p>${esc(t.profileLead)}</p>
  </div>

  <div class="rhead">
    <div>
      <div class="rname">${esc(R[1])}</div>
      <div class="rpeers">${esc(t.peers)} ${peers.map(p=>`<b>${esc(p[1])}</b>`).join(", ")}</div>
    </div>
    <div class="f" style="margin-left:auto"><label>${esc(t.lblReg)}</label>
      <select id="c-reg2">${REGIONS.map(r=>`<option value="${r[0]}"${r[0]===S.region?" selected":""}>${esc(r[1])}</option>`).join("")}</select></div>
  </div>

  <div class="rcontext-strip">
    <div class="rcontext-item">
      <span class="rcontext-k">${esc(t.rPop)}</span>
      <span class="rcontext-v tnum">${R[2].toLocaleString(S.lang==="sv"?"sv-SE":"en-US")}</span>
    </div>
    ${ctxDensity?`
    <div class="rcontext-item">
      <span class="rcontext-k">${esc(t.rDensity)}</span>
      <span class="rcontext-v tnum">${fmt(ctxDensity.value,1)} <span class="rcontext-u">/ km²</span></span>
      <span class="rcontext-src">${ctxDensity.year||2023}</span>
    </div>`:""}
    ${ctxLowEdu?`
    <div class="rcontext-item">
      <span class="rcontext-k">${esc(t.rLowEdu)}</span>
      <span class="rcontext-v tnum">${fmt(ctxLowEdu.value,1)} <span class="rcontext-u">%</span></span>
      <span class="rcontext-src">${ctxLowEdu.year||2023}</span>
    </div>`:""}
  </div>

  <div class="rstats rstats-6">
    ${indConfigs.map(item=>{
      const k=item.k, inst=item.inst, col=INST_COLOR[inst];
      const m=mine[k];
      return `
      <div class="rstat i-${inst}">
        <div class="rk" style="color:${col}"><span class="dot" style="background:${col}"></span>${esc(item.tag)}</div>
        <div class="rv tnum">${fmt(m.value,1,unitLabel(k))}</div>
        <div class="rci tnum">${ciText(k,latestYrs[k])}</div>
        <div class="rvs">${cmp(k)}</div>
      </div>`;
    }).join("")}
  </div>

  <div class="card mt-fig">
    <div class="card-h"><h3>${esc(t.changed)}</h3><div class="u">${esc(t.changedU(priorCommon,latestCommon))}</div></div>
    <div class="card-b">
      <svg viewBox="0 0 620 205" role="img" aria-label="Change between measurement periods for all six indicators">
        <line x1="300" y1="12" x2="300" y2="188" stroke="var(--hair)" stroke-width="1"/>
        ${changes.map((c,i)=>{
          const y=26+i*28;
          if(c.d==null){
            return `<text x="220" y="${y+3}" text-anchor="end" font-family="var(--sans)" font-size="10.5" fill="var(--ink-2)">${esc(t.ind[c.x])}</text>
              <text x="380" y="${y+3}" font-family="var(--mono)" font-size="9.5" fill="var(--ink-3)">${esc(fmt(null))}</text>`;
          }
          const mult=c.x==="suicide"?12:(c.x==="distress"||c.x==="sjukfranvaro")?8:4;
          const w=Math.min(65,Math.abs(c.d)*mult+4);
          const x2=300+(c.d>0?w:-w);
          const col=c.within?"var(--ink-3)":INST_COLOR[c.inst];
          const op=c.within?".45":"1";
          return `<line x1="300" y1="${y}" x2="${x2.toFixed(1)}" y2="${y}" stroke="${col}" stroke-width="2.6" opacity="${op}" stroke-linecap="round"/>
            <text x="380" y="${y+3}" font-family="var(--mono)" font-size="10" fill="${col}" opacity="${op}">${c.d>0?"+":"−"}${fmt(Math.abs(c.d),1)}</text>
            <text x="424" y="${y+3}" font-family="var(--sans)" font-size="8" fill="var(--ink-3)">${esc(unitLabel(c.x))}</text>
            ${c.within?`<text x="510" y="${y+3}" font-family="var(--sans)" font-size="9" fill="var(--ink-3)">${esc(t.withinCI)}</text>`:""}
            <text x="220" y="${y+3}" text-anchor="end" font-family="var(--sans)" font-size="10.5" fill="var(--ink-2)">${esc(t.ind[c.x])}</text>`;
        }).join("")}
      </svg>
    </div>
    <div class="src">${t.chgNote(changes.filter(c=>c.within).length,changes.filter(c=>c.d!=null).length)}</div>
  </div>

  <div class="card mt-fig">
    <div class="card-h"><h3>${esc(t.gapPos)}</h3><div class="u">${esc(t.gapPosU)}</div></div>
    <div class="card-b">${scatter(gap,{aria:"Region position: reported need against healthcare response",w:620,h:350,
      xName:t.ind.distress,yName:t.ind.antidep,xUnit:unitLabel("distress"),yUnit:unitLabel("antidep")})}</div>
    ${scatterKey()}
    <div class="src"><b>${S.lang==="sv"?"Syntetiska data":"Synthetic data"}</b> · ${S.lang==="sv"
      ?"Ringad region är den valda. Avståndet till linjen visar hur regionen förhåller sig till det genomsnittliga sambandet mellan behov och respons."
      :"The circled region is the selected one. Distance from the line shows how the region compares with the average association between need and response."} ${esc(t.causalNote)}</div>
    <button id="b-openbehov" class="mapopen">${esc(t.behovOpen)}</button>
  </div>`;
}

function viewKarta(){
  const k=S.ind, I=IND[k], col=INST_COLOR[I.inst];
  const years=validYears(k);
  const yrIdx=S.mapYear!=null&&years.includes(S.mapYear)?years.indexOf(S.mapYear):years.length-1;
  const yr=years[yrIdx];
  // See viewOverTid()'s own comment on hasType/type — same convention.
  // Compare mode's second map (cmpK, below) always stays on "all" even if
  // cmpK itself is psych/antidep — one type selector, for the primary map
  // only, keeps this control row from needing a second one that only
  // sometimes appears depending on what's picked in compare mode.
  const hasType = k==="psych" || k==="antidep";
  const type = k==="psych" ? S.psychType : k==="antidep" ? S.medType : undefined;

  // Builds one indicator's region rows for a given year, trend arrows
  // included: each row compares against the previous *available* point for
  // that indicator (years can be irregular windows, so "prior" is never
  // just year-1) and reads direction against the same shift nationally —
  // a region can rise while the country falls, and that's the interesting
  // case, not the raw up/down. Shared by the primary map and, in compare
  // mode, the second one, so neither loses its arrows.
  const mapRows=(indK,yrVal,yrsList,ty)=>{
    const idx=yrsList.indexOf(yrVal), priorYr=idx>0?yrsList[idx-1]:null;
    const nat=total(indK,"SE",yrVal,"T",S.std,ty);
    const natPrior=priorYr?total(indK,"SE",priorYr,"T",S.std,ty):null;
    const natDelta=nat&&natPrior?nat.value-natPrior.value:null;
    const trendOf=(code,c)=>{
      if(!priorYr)return null;
      const p=total(indK,code,priorYr,"T",S.std,ty);
      if(!p||p.suppressed)return null;
      const d=c.value-p.value, within=Math.abs(d)<(c.hi-c.lo)/2;
      if(within)return{arrow:"→",rel:null};
      const arrow=d>0?"↑":"↓";
      if(natDelta==null||Math.abs(natDelta)<1e-9)return{arrow,rel:null};
      return{arrow,rel:(d>0)===(natDelta>0)?"with":"against"};
    };
    const rows=REGIONS.map(r=>{
      const c=total(indK,r[0],yrVal,"T",S.std,ty);
      return c&&{code:r[0],name:r[1],value:c.value,lo:c.lo,hi:c.hi,supp:c.suppressed,trend:c.suppressed?null:trendOf(r[0],c)};
    }).filter(Boolean);
    return{rows,nat,priorYr};
  };

  const{rows,nat,priorYr}=mapRows(k,yr,years,type);

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
      <div class="rci tnum">${esc(unitLabel(key))} · ${ciRange(mine[key].lo,mine[key].hi)}</div>
      <div class="rvs">${esc(t.statSentence[key](fmt(mine[key].value,1)))}</div>
    </div>`;

  return `
  <div class="ctrl">
    <div class="f"><label>${esc(t.lblInd)}</label><select id="c-mapind">
      ${Object.keys(IND).map(x=>`<option value="${x}"${x===k?" selected":""}>${esc(t.ind[x])}</option>`).join("")}</select></div>
    ${hasType?`<div class="f"><label>${esc(t.lblType)}</label><select id="c-maptype">
      <option value="all"${type==="all"?" selected":""}>${esc(t.typeAll)}</option>
      ${(k==="psych"?PSYCH_TYPES:MED_TYPES).map(ty=>`<option value="${ty}"${ty===type?" selected":""}>${esc(t.psychMedTypes[ty])}</option>`).join("")}</select></div>`:""}
    <div class="seg"${!stdCapable(k)?` title="${esc(t.stdDisabledTip)}"`:""}>
      <button data-std="0" class="${S.std?"":"on"}"${!stdCapable(k)?" disabled":""}>${esc(t.crude)}</button>
      <button data-std="1" class="${S.std?"on":""}"${!stdCapable(k)?" disabled":""}>${esc(t.std)}</button>
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

function formatIsoDate(isoStr){
  if(!isoStr) return "–";
  try{
    const d=new Date(isoStr);
    if(isNaN(d.getTime())) return isoStr;
    const y=d.getUTCFullYear();
    const mo=String(d.getUTCMonth()+1).padStart(2,"0");
    const day=String(d.getUTCDate()).padStart(2,"0");
    const hh=String(d.getUTCHours()).padStart(2,"0");
    const mm=String(d.getUTCMinutes()).padStart(2,"0");
    return `${y}-${mo}-${day} ${hh}:${mm} UTC`;
  }catch(e){ return isoStr; }
}

function viewMetod(){
  const P=t.mProse;
  const rs=realSummary();

  // Coverage table
  const coverageRows=Object.keys(IND).map(x=>{
    const I=IND[x];
    const real=isRealActive(x);
    const ageTxt=I.ageSplit?t.yes:t.no;
    const sexTxt=I.sexSplit?t.yes:t.no;
    return `<tr>
      <td class="in" style="border-left:3px solid ${INST_COLOR[I.inst]}">${esc(t.ind[x])}
        <span class="modechip ${real?"real":"synth"}">${esc(real?t.realLbl:t.synthLbl)}</span></td>
      <td>${esc(I.coverage||"Region")}</td>
      <td class="mono">${esc(I.years||I.start)}</td>
      <td class="mono">${esc(t.splitSex)}: ${sexTxt} &nbsp;|&nbsp; ${esc(t.splitAge)}: ${ageTxt}</td>
    </tr>`;
  }).join("");

  // Original indicator-caveats table (unchanged)
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

  // Data-vintage manifest table
  const manifestList=getManifestRows();
  const manifestRows=manifestList.map(item=>{
    const indLabels=item.indicators.map(k=>t.ind[k]||k).join(", ");
    const isReal=item.active;
    const statusChip=item.isSynthOnly
      ?`<span class="modechip synth">${esc(t.mStatusNoFetch)}</span>`
      :isReal
        ?`<span class="modechip real">${esc(t.mStatusReal)}</span>`
        :`<span class="modechip synth">${esc(t.mStatusSynth)}</span>`;
    const countText=item.records_count!=null?t.mRecordsCount(item.records_count):"";
    const dateText=formatIsoDate(item.fetched_at);
    return `<tr>
      <td class="in">${esc(indLabels)}</td>
      <td>${esc(item.source)}</td>
      <td class="mono">${esc(dateText)}</td>
      <td class="mono">${esc(item.time_period)}</td>
      <td class="mono"><code>${esc(item.fetcher)}</code></td>
      <td>${statusChip}${countText?`<span class="mono" style="font-size:10px;color:var(--ink-3);display:block;margin-top:2px">${esc(countText)}</span>`:""}</td>
    </tr>`;
  }).join("");

  return `
  <div class="prose">
    <h2>${esc(t.methodH)}</h2>
    <h3>${esc(P.a)}</h3><p>${esc(P.b)}</p>
    <h3>${esc(P.c)}</h3><p>${esc(P.d)}</p>
    <h3>${esc(P.e)}</h3><p>${esc(P.f)}</p>
    <div class="note"><div class="l">${esc(P.g)}</div><p>${esc(P.h)}</p></div>
    <div class="note"><div class="l">${esc(t.realNoteL)}</div><p>${esc(rs.synthN===0?t.realNoteAll(rs.realNames):rs.n>0?t.realNoteOn(rs.n,rs.total,rs.realNames,rs.synthNames,rs.synthN):t.realNoteOff)}</p></div>
  </div>

  <div class="prose" style="margin-top:30px">
    <h3>${esc(t.mManifestH)}</h3>
    <p>${esc(t.mManifestLead)}</p>
  </div>
  <div class="mwrap"><table class="m">
    <thead><tr>
      <th>${esc(t.mColInd)}</th>
      <th>${esc(t.mColSource)}</th>
      <th>${esc(t.mColFetched)}</th>
      <th>${esc(t.mColCoverage)}</th>
      <th>${esc(t.mColScript)}</th>
      <th>${esc(t.mColStatus)}</th>
    </tr></thead>
    <tbody>${manifestRows}</tbody>
  </table></div>

  <div class="prose" style="margin-top:30px">
    <h3>${esc(S.lang==="sv"?"Dataseriernas täckning":"Indicator coverage")}</h3>
  </div>
  <div class="mwrap"><table class="m">
    <thead><tr>
      <th>${esc(t.mColInd)}</th>
      <th>${esc(t.mColGeo)}</th>
      <th>${esc(t.mColYears)}</th>
      <th>${esc(t.mColSplits)}</th>
    </tr></thead>
    <tbody>${coverageRows}</tbody>
  </table></div>

  <div class="prose" style="margin-top:30px">
    <h3>${esc(t.mIndicator)} &amp; ${esc(t.mLimit)}</h3>
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
  // Rendered here, not inline in the template below, and BEFORE worst/
  // selPoint: scatter() mutates each point in `gap` with `.res` (its own
  // regression residual) as a side effect — calling it first lets both of
  // those reuse that instead of re-deriving the same regression by hand.
  const gapSvg=scatter(gap,{aria:"Reported need against healthcare response across 21 regions",w:620,h:380,
    xName:t.ind.distress,yName:t.ind.antidep,xUnit:unitLabel("distress"),yUnit:unitLabel("antidep")});
  const worst=gap.slice().sort((p,q)=>p.res-q.res)[0];
  // The region behind the sidebar's second card — whichever one is
  // currently selected (clicking a point in the scatter below sets
  // S.region and re-renders, shell.js), falling back to `worst` on the
  // rare S.region value `gap` doesn't cover (e.g. "SE", reachable from
  // other tabs' region pickers).
  const selPoint=gap.find(p=>p.code===S.region)||worst;
  const selAbove=selPoint.res>=0;
  const selResAbs=fmt(Math.abs(selPoint.res),1,unitLabel("antidep"));
  const selSentence=(selAbove?t.gapSelAbove:t.gapSelBelow)(
    fmt(selPoint.x,1,unitLabel("distress")),fmt(selPoint.y,1,unitLabel("antidep")),selResAbs);
  const selCol=selAbove?"var(--teal)":"var(--oxblood)";
  const gp=t.gapPiece;

  // Disagreement scatter: reported distress against care contact, per
  // county — a second, independent pairing from the need/response one
  // above. Real whenever both sources are loaded, but never a real value on
  // one axis against a fabricated one on the other (see fakeTotal()'s
  // docstring): when only one of the two is real so far, BOTH axes fall
  // back to the fabricated generator together, consistently, and the chip
  // below says so — this must never silently blend the two.
  const distressYears=validYears("distress");
  const bothReal=isRealActive("distress")&&isRealActive("psych");
  const dgYear=bothReal?distressYears[distressYears.length-1]:2024;
  const getVal=bothReal?total:fakeTotal;
  const disagree=REGIONS.map(r=>{
    const dx=getVal("distress",r[0],dgYear,"T",false), dy=getVal("psych",r[0],dgYear,"T",false);
    return (dx&&dy)?{x:dx.value,y:dy.value,code:r[0],name:r[1]}:null;
  }).filter(Boolean);
  // srcLine(k) already appends "· INST_NAME", not just the register name —
  // reused as-is (same shape srcStrip uses) rather than hand-building a
  // parenthetical, which would double up distress's own "(FoHM)" (see
  // IND.distress.reg) into "(FoHM) (FoHM)".
  const srcBoth=`${srcLine("distress")} · ${srcLine("psych")}`;

  return `
  <div class="hero">
    <p>${esc(t.behovLead)}</p>
  </div>
  <div class="figrow" style="margin-top:20px">
    <div class="card">
      <div class="card-h"><h3>${esc(t.gapTitle)}</h3><div class="u">${esc(t.gapUnit)}</div></div>
      <div class="card-b">${gapSvg}</div>
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
      <!-- Fills what used to be dead space below the card above (this
           column stretches to match the taller scatter next to it, CSS
           grid's default align-items:stretch) — click any point in that
           scatter to change which region this reports on. Sized up a
           notch from .piece's own defaults (extra padding, a bigger
           .num) since this is the one that actually needs to fill that
           leftover height, not just sit in it. -->
      <div class="piece" style="padding:22px 24px 26px">
        <div class="tag" style="color:var(--violet)">${esc(t.gapSelTag)}</div>
        <h4>${esc(selPoint.name)}</h4><p>${esc(selSentence)}</p>
        <div class="num tnum" style="color:${selCol};font-size:34px">${selAbove?"+":"−"}${selResAbs}</div>
        <div class="numl">${esc(t.gapSelNuml)}</div>
      </div>
    </div>
  </div>
  <div class="card mt-fig">
    <div class="card-h">
      <h3>${esc(t.disagreeTitle)}</h3>
      <div class="u">${esc(t.disagreeUnit(dgYear))}</div>
      <span class="modechip ${bothReal?"real":"synth"}">${esc(bothReal?t.realLbl:t.synthLbl)}</span>
    </div>
    <!-- w:900,h:420, wider than the 620x380 the other scatter()s use: this
         card is full-width (no .pieces sidebar next to it, unlike the
         need/response scatter above), so on a wide screen the SVG's CSS
         width:100% stretches a 620-wide design a lot further than its
         column-width siblings do, magnifying every fixed font-size/point
         radius along with it. A wider intrinsic viewBox keeps those fixed
         sizes closer to their rendered size instead. -->
    <div class="card-b">${scatter(disagree,{aria:"Reported distress against care contact across 21 regions",w:900,h:420,yLabel:t.disagreeY,
      xName:t.ind.distress,yName:t.ind.psych,xUnit:unitLabel("distress"),yUnit:unitLabel("psych")})}</div>
    ${scatterKey()}
    <div class="src">${esc(t.disagreeCaveat)} ${esc(t.causalNote)}<br>${srcBoth}</div>
  </div>`;
}
function viewSjukskrivning(){
  const k="sjukfranvaro", col=INST_COLOR.fk;
  const{years,ts}=sexTimeSeries(k,false);
  const latest=years[years.length-1];
  const nat=total(k,"SE",latest,"T",false);
  // F43 keeps extending into the current, still-open year instead of
  // stopping at the last closed one (see REAL_FK's docstring, data.js) —
  // so `latest` is often a partial year. nat.partial is that year's flag;
  // checked on the national total since map/line-chart headers below are
  // both keyed to the national "latest", not any one region's own coverage.
  const latestPartial=nat&&nat.partial;
  const yearTag=latestPartial?` ${esc(t.partialTag)}`:"";
  // Same shape as viewKarta's single (non-compare) map branch, trimmed down
  // to this one indicator — no year slider or trend arrows, just the
  // latest year, since this page is about one indicator, not a picker.
  const rows=REGIONS.map(r=>{const c=total(k,r[0],latest,"T",false); return c&&{code:r[0],name:r[1],value:c.value,lo:c.lo,hi:c.hi};}).filter(Boolean);
  const R=RBY[S.region];
  const mine=total(k,S.region,latest,"T",false);
  const sexSeries=[{pts:ts("K"),color:col,w:2.4,label:t.women},
                    {pts:ts("M"),color:col,dash:"5 3",w:1.9,label:t.men}];

  return `
  <div class="hero">
    <p>${esc(t.fkLead)}</p>
  </div>
  <div class="card mt-fig">
    <div class="card-h"><h3>${esc(t.timeTitle)}</h3><div class="u">${esc(t.natLine)}</div></div>
    <div class="card-b">${lineChart(sexSeries,
      {aria:"Sickness absence trend, women and men",
       xlabels:[[years[0],String(years[0])],[years[years.length-1],String(years[years.length-1])+(latestPartial?`\n${t.partialTag}`:"")]],
       marks:eventMarks(k,years),h:200,unit:unitLabel(k)})}
      ${lineLegend(sexSeries)}</div>
    ${srcStrip(k,latestPartial?t.partialYearNote(latest,nat.months):undefined)}
  </div>
  <div class="grid-ex mt-fig">
    <div class="card">
      <div class="card-h"><h3>${esc(t.mapTitle)}</h3><div class="u">${esc(t.ind[k])} (${esc(unitLabel(k))}) · ${latest}${yearTag}</div></div>
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
              <div class="rci tnum">${esc(unitLabel(k))} · ${ciRange(mine?mine.lo:null,mine?mine.hi:null)}${mine&&mine.partial?` · ${esc(t.partialTag)}`:""}</div>
              ${mine?`<div class="rvs">${esc(t.statSentence.sjukfranvaro(fmt(mine.value,1)))}</div>`:""}
            </div>
          </div>
          <button class="mapopen btn-openregion">${esc(t.mapOpen)} →</button>
        </div>
      </div>
    </div>
  </div>`;
}
// distress/psych/sjukfranvaro are the three real indicators shaped like an
// ANNUAL time series — selfharm/suicide have real sex data too now (see
// REAL's docstring, data.js), but as five-year rolling windows keyed by
// midpoint year, a different shape this generic annual-card layout doesn't
// fit; deliberately absent here, not forgotten. t.konCaveat says why.
function viewKon(){
  const inds=["distress","psych","sjukfranvaro"];
  const cards=inds.map(k=>{
    const col=INST_COLOR[IND[k].inst];
    const{years,ts}=sexTimeSeries(k,false);
    const latest=years[years.length-1];
    const natK=total(k,"SE",latest,"K",false), natM=total(k,"SE",latest,"M",false);
    const sexSeries=[{pts:ts("K"),color:col,w:2.4,label:t.women},
                      {pts:ts("M"),color:col,dash:"5 3",w:1.9,label:t.men}];
    return `
    <div class="card mt-fig">
      <div class="card-h"><h3>${esc(t.ind[k])}</h3><div class="u">${esc(t.natLine)} · ${esc(unitLabel(k))}</div></div>
      <div class="card-b">
        ${lineChart(sexSeries,
          {aria:t.ind[k]+", women and men over time",
           xlabels:[[years[0],String(years[0])],[years[years.length-1],String(years[years.length-1])]],
           marks:eventMarks(k,years),h:180,unit:unitLabel(k)})}
        ${lineLegend(sexSeries)}
        <div class="rstats" style="grid-template-columns:1fr 1fr;margin-top:14px">
          <div class="rstat" style="border-top-color:${col}">
            <div class="rk" style="color:${col}"><span class="dot" style="background:${col}"></span>${esc(t.women)}</div>
            <div class="rv tnum">${fmt(natK?natK.value:null,1,unitLabel(k))}</div>
            <div class="rci tnum">${ciRange(natK?natK.lo:null,natK?natK.hi:null)}</div>
            ${natK?`<div class="rvs">${esc(t.statSentence[k](fmt(natK.value,1)))}</div>`:""}
          </div>
          <div class="rstat" style="border-top-color:${col}">
            <div class="rk" style="color:${col}"><span class="dot" style="background:${col}"></span>${esc(t.men)}</div>
            <div class="rv tnum">${fmt(natM?natM.value:null,1,unitLabel(k))}</div>
            <div class="rci tnum">${ciRange(natM?natM.lo:null,natM?natM.hi:null)}</div>
            ${natM?`<div class="rvs">${esc(t.statSentence[k](fmt(natM.value,1)))}</div>`:""}
          </div>
        </div>
      </div>
      ${srcStrip(k)}
    </div>`;
  }).join("");

  // Youth panel: care contact (psych) at age 15-24, by sex, as small
  // multiples — one column per sex (.inner2, the same two-column pattern
  // viewLaget uses for its twin self-harm/suicide card), not the
  // overlaid-women/men-in-one-chart convention the three cards above use.
  // distress has no real age breakdown at all (REAL_HLV, data.js) so it
  // can never get the same 15-24 treatment — shown per sex as its
  // existing all-ages figure only, explicitly captioned, never plotted as
  // if it matched the psych line above it.
  const AGE_1524=1; // AGES[1] === "15-24"
  const pcol=INST_COLOR.reg, dcol=INST_COLOR.survey;
  const{years:pyears,ts:pts}=sexTimeSeries("psych",false,AGE_1524);
  const platest=pyears[pyears.length-1];
  const{years:dyears}=sexTimeSeries("distress",false);
  const dlatest=dyears[dyears.length-1];
  const youthCol=(sex,label)=>{
    const pNow=cell("psych","SE",platest,AGE_1524,sex,false);
    const dNow=total("distress","SE",dlatest,sex,false);
    return `
      <div>
        <h4>${esc(label)}</h4><div class="u">${esc(t.ind.psych)} · 15–24</div>
        ${lineChart([{pts:pts(sex),color:pcol,w:2.2,dot:true}],
          {aria:t.ind.psych+" ages 15-24, "+label,
           xlabels:[[pyears[0],String(pyears[0])],[pyears[pyears.length-1],String(pyears[pyears.length-1])]],
           marks:eventMarks("psych",pyears),h:150,unit:unitLabel("psych")})}
        <div class="rv tnum" style="font-size:19px;margin-top:6px;color:${pcol}">${fmt(pNow?pNow.value:null,1,unitLabel("psych"))}</div>
        <div class="rci tnum">${ciRange(pNow?pNow.lo:null,pNow?pNow.hi:null)}</div>
        <div class="suppress">
          <b style="color:${dcol}">${esc(t.ind.distress)} (${esc(t.allAges)})</b>
          ${fmt(dNow?dNow.value:null,1,unitLabel("distress"))} · <b>${esc(isRealActive("distress")?t.realLbl:t.synthLbl)}</b> — ${esc(t.youthDistressCtx)}
        </div>
      </div>`;
  };

  return `
  <div class="hero">
    <p>${esc(t.konLead)}</p>
  </div>
  ${cards}
  <div class="note mt-fig"><p>${esc(t.konCaveat)}</p></div>
  <div class="card mt-fig">
    <div class="card-h"><h3>${esc(t.youthTitle)}</h3><div class="u">${esc(t.youthUnit)}</div></div>
    <div class="inner2">
      ${youthCol("K",t.sexK)}
      ${youthCol("M",t.sexM)}
    </div>
    ${srcStrip("psych")}
  </div>`;
}

// Age-group comparison — psych only. Unlike viewKon (three indicators, two
// lines each), only psych has real age data spanning the whole lifespan
// (see AGE_GROUPS's comment in data.js), so this is one card, three lines.
// One colour (psych's own instrument colour), three dash patterns — extends
// the app's existing "sex is solid vs dashed, never a second colour system"
// rule to this second categorical dimension rather than introducing a
// competing 3-colour palette.
function viewAlder(){
  const k="psych", col=INST_COLOR[IND[k].inst];
  const{years,ts}=ageGroupTimeSeries(k,false);
  const latest=years[years.length-1];
  const dashes=[null,"5 3","2 3"];
  const groupLabel={child:t.ageChild,adult:t.ageAdult,elderly:t.ageElderly};
  const totals=AGE_GROUPS.map(g=>({g,c:ageGroupTotal(k,"SE",latest,g.idxs,"T",false)}));
  const ageSeries=AGE_GROUPS.map((g,i)=>({pts:ts(g),color:col,dash:dashes[i],w:i===0?2.4:1.9,label:groupLabel[g.key]}));

  return `
  <div class="hero"><p>${esc(t.alderLead)}</p></div>
  <div class="card mt-fig">
    <div class="card-h"><h3>${esc(t.ind[k])}</h3><div class="u">${esc(t.natLine)} · ${esc(unitLabel(k))}</div></div>
    <div class="card-b">
      ${lineChart(ageSeries,
        {aria:t.ind[k]+", children, adults and elderly over time",
         xlabels:[[years[0],String(years[0])],[years[years.length-1],String(years[years.length-1])]],
         marks:eventMarks(k,years),h:180,unit:unitLabel(k)})}
      ${lineLegend(ageSeries)}
      <div class="rstats" style="grid-template-columns:1fr 1fr 1fr;margin-top:14px">
        ${totals.map(({g,c})=>`
        <div class="rstat" style="border-top-color:${col}">
          <div class="rk" style="color:${col}"><span class="dot" style="background:${col}"></span>${esc(groupLabel[g.key])}</div>
          <div class="rv tnum">${fmt(c?c.value:null,1,unitLabel(k))}</div>
          <div class="rci tnum">${ciRange(c?c.lo:null,c?c.hi:null)}</div>
          ${c?`<div class="rvs">${esc(t.statSentence[k](fmt(c.value,1)))}</div>`:""}
        </div>`).join("")}
      </div>
    </div>
    ${srcStrip(k)}
  </div>
  <div class="note mt-fig"><p>${esc(t.alderCaveat)}</p></div>`;
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
              ${mine?`<div class="rvs">${esc(t.statSentence[k](fmt(mine.value,1)))}</div>`:""}
            </div>
          </div>
          <button class="mapopen btn-openregion">${esc(t.mapOpen)} →</button>
        </div>
      </div>
    </div>
  </div>`;
}

// BUP (barn- och ungdomspsykiatri) waiting times — its own dedicated view,
// same "not IND-shaped" precedent as viewSammanhang above, plus a shape
// none of the other real indicators have: MONTHLY, not annual, and only a
// rolling ~12-month window rather than growing history. See BUP_WAIT's own
// docstring (data.js) for the full "why this is different" — the prominent
// note right under the hero (not just a small .src caveat) exists because
// this indicator has more ways to be over-read than the others: a rolling
// snapshot mistaken for a trend, or a low median mistaken for short waits
// when it might just mean only the easy cases have finished yet.
function viewVantetider(){
  if(!BUP_WAIT.active)return viewComing();
  const unit=S.lang==="sv"?"dagar":"days";
  const col=INST_COLOR.reg;
  const months=BUP_WAIT.months; // [[year,month],...] chronological, oldest first
  const latest=months[months.length-1];
  const monthLabel=([y,m])=>`${t.monthsShort[m-1]} ${y}`;

  // Not .filter(Boolean)ing out the regions with no figure this month:
  // unlike self-harm/suicide's count-suppression (a rate is still
  // published there), a suppressed BUP region-month has no value at all
  // to fall back to. chorMap()/quintileBands() know how to take a
  // value:null row and draw it as a real, clickable "no data" tile
  // instead of leaving a hole in the map where that county should be —
  // see chorMap's own docstring in charts.js.
  const rows=REGIONS.map(r=>{
    const v=bupWaitCell(r[0],latest[0],latest[1]);
    return v!=null?{code:r[0],name:r[1],value:v,lo:v,hi:v}
                  :{code:r[0],name:r[1],value:null,tip:t.vantetiderNoData(r[1])};
  });
  const nat=bupWaitCell("SE",latest[0],latest[1]);
  const R=RBY[S.region];
  const mine=bupWaitCell(S.region,latest[0],latest[1]);

  // Two series: the national line always shown for reference, the picked
  // region dashed alongside it — same shape as self-harm/suicide's
  // women/men pairing, just region-vs-national instead of a sex split.
  // If "SE" itself is picked the two lines simply coincide; not worth
  // special-casing away for a rolling 12-point chart.
  const natSeries={pts:months.map(([y,m],i)=>{const v=bupWaitCell("SE",y,m);return v!=null?[i,v]:null;}),
    color:col,w:2.4,label:t.natLine};
  const mineSeries={pts:months.map(([y,m],i)=>{const v=bupWaitCell(S.region,y,m);return v!=null?[i,v]:null;}),
    color:col,dash:"5 3",w:1.9,label:R[1]};
  const trendSeries=[natSeries,mineSeries];

  return `
  <div class="hero">
    <p>${esc(t.vantetiderLead)}</p>
  </div>
  <div class="note mt-fig"><div class="l">${esc(t.vantetiderNoteL)}</div><p>${esc(t.vantetiderCaveat)}</p></div>
  <div class="card mt-fig">
    <div class="card-h"><h3>${esc(t.timeTitle)}</h3><div class="u">${esc(monthLabel(months[0]))}–${esc(monthLabel(latest))}</div></div>
    <div class="card-b">${lineChart(trendSeries,
      {aria:"BUP waiting time trend, national and selected region",
       xlabels:[[0,monthLabel(months[0])],[months.length-1,monthLabel(latest)]],
       h:200,unit,xFmt:i=>monthLabel(months[i])})}
      ${lineLegend(trendSeries)}</div>
    <div class="src">${esc(t.causalNote)}<br>Socialstyrelsen (väntetider barn- och ungdomspsykiatrin).</div>
  </div>
  <div class="grid-ex mt-fig">
    <div class="card">
      <div class="card-h"><h3>${esc(t.mapTitle)}</h3><div class="u">${esc(t.vantetiderInd)} (${esc(unit)}) · ${esc(monthLabel(latest))}</div></div>
      <div class="card-b">
        ${mapZoomWrap(chorMap(rows,{color:col,nat,unit,aria:"Map of Sweden's 21 regions for BUP first-visit waiting time, click a region to see its figures"}),"vantetider")}
        ${mapLegend(rows,col,unit,nat)}
      </div>
      <div class="src"><b>${S.lang==="sv"?"Gränser":"Borders"}</b> © OpenStreetMap-bidragsgivare, ODbL.</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h3>${esc(R[1])}</h3><div class="u">${esc(t.mapPicked)}</div></div>
        <div class="card-b">
          <div class="rstats" style="grid-template-columns:1fr">
            <div class="rstat" style="border-top-color:${col}">
              <div class="rk" style="color:${col}"><span class="dot" style="background:${col}"></span>${esc(t.vantetiderInd)}</div>
              <div class="rv tnum">${fmt(mine,1,unit)}</div>
              <div class="rci tnum">${esc(unit)} · ${esc(monthLabel(latest))}</div>
              ${mine!=null?`<div class="rvs">${esc(t.statSentence.bup_vantetid(fmt(mine,1)))}</div>`:""}
            </div>
          </div>
          <button class="mapopen btn-openregion">${esc(t.mapOpen)} →</button>
        </div>
      </div>
    </div>
  </div>`;
}

// HBSC (Skolbarns hälsovanor) — its own dedicated view, same "not
// IND-shaped" precedent as viewSammanhang/viewVantetider above: a SINGLE
// snapshot (one survey window, HBSC.window), own age keys (11/13/15, not
// AGES), no "total" sex. See HBSC's own docstring (data.js) for why.
function viewHbsc(){
  if(!HBSC.active)return viewComing();
  const unit="%";
  const col=INST_COLOR.survey;
  const age=S.hbscAge, sex=S.hbscSex;

  const rows=REGIONS.map(r=>{
    const v=hbscCell(r[0],age,sex);
    return v!=null&&{code:r[0],name:r[1],value:v,lo:v,hi:v};
  }).filter(Boolean);
  const nat=hbscCell("SE",age,sex);
  const R=RBY[S.region];
  const mine=hbscCell(S.region,age,sex);

  return `
  <div class="hero">
    <p>${esc(t.hbscLead)}</p>
  </div>
  <div class="note mt-fig"><div class="l">${esc(t.hbscNoteL)}</div><p>${esc(t.hbscCaveat)}</p></div>
  <div class="ctrl mt-fig">
    <div class="f"><label>${esc(t.lblAge)}</label><select id="c-hbscage">
      ${HBSC_AGES.map(a=>`<option value="${a}"${a===age?" selected":""}>${a} ${S.lang==="sv"?"år":"years"}</option>`).join("")}</select></div>
    <div class="f"><label>${esc(t.lblSex)}</label><select id="c-hbscsex">
      <option value="K"${sex==="K"?" selected":""}>${esc(t.sexK)}</option>
      <option value="M"${sex==="M"?" selected":""}>${esc(t.sexM)}</option></select></div>
  </div>
  <div class="grid-ex mt-fig">
    <div class="card">
      <div class="card-h"><h3>${esc(t.mapTitle)}</h3><div class="u">${esc(t.hbscInd)} (${esc(unit)}) · ${esc(HBSC.window)}</div></div>
      <div class="card-b">
        ${mapZoomWrap(chorMap(rows,{color:col,nat,unit,aria:"Map of Sweden's 21 regions for HBSC self-reported feeling low, click a region to see its figures"}),"hbsc")}
        ${mapLegend(rows,col,unit,nat)}
      </div>
      <div class="src"><b>${S.lang==="sv"?"Gränser":"Borders"}</b> © OpenStreetMap-bidragsgivare, ODbL.</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h3>${esc(R[1])}</h3><div class="u">${esc(t.mapPicked)}</div></div>
        <div class="card-b">
          <div class="rstats" style="grid-template-columns:1fr">
            <div class="rstat" style="border-top-color:${col}">
              <div class="rk" style="color:${col}"><span class="dot" style="background:${col}"></span>${esc(t.hbscInd)}</div>
              <div class="rv tnum">${fmt(mine,1,unit)}</div>
              <div class="rci tnum">${esc(unit)} · ${esc(HBSC.window)}</div>
              ${mine!=null?`<div class="rvs">${esc(t.statSentence.hbsc_felt_low(fmt(mine,1)))}</div>`:""}
            </div>
          </div>
          <button class="mapopen btn-openregion">${esc(t.mapOpen)} →</button>
        </div>
      </div>
    </div>
  </div>
  <div class="src mt-fig">${esc(t.notNum)} ${esc(t.hbscNotNumB)}<br>Folkhälsomyndigheten (Skolbarns hälsovanor / HBSC).</div>`;
}

function viewPolicyNews() {
  let items = typeof REAL_POLICY_NEWS !== "undefined" ? REAL_POLICY_NEWS : [];
  
  // Filtering
  if (S.policyFilter && S.policyFilter !== "all") {
    items = items.filter(item => item.topic === S.policyFilter || item.item_type === S.policyFilter || item.source_name === S.policyFilter);
  }
  
  // Sorting
  items = items.slice().sort((a, b) => {
    const dateA = new Date(a.published_at || 0).getTime();
    const dateB = new Date(b.published_at || 0).getTime();
    return S.policySort === "asc" ? dateA - dateB : dateB - dateA;
  });

  const limit = 10;
  const initialItems = items.slice(0, limit);
  
  const topics = [
    {val: "all", sv: "Alla ämnen / källor", en: "All Topics / Sources"},
    {val: "mental_health", sv: "Psykisk hälsa", en: "Mental Health"},
    {val: "children_young_people", sv: "Barn och unga", en: "Children & Young People"},
    {val: "Socialstyrelsen", sv: "Socialstyrelsen", en: "Socialstyrelsen"},
    {val: "Folkhälsomyndigheten", sv: "Folkhälsomyndigheten", en: "Folkhälsomyndigheten"},
    {val: "Regeringen", sv: "Regeringen", en: "Regeringen"}
  ];

  return `
  <div class="card">
    <div class="card-h"><h3>${esc(S.lang==="sv"?"Nyheter & Policy":"Policy & News")}</h3></div>
    <div class="ctrl" style="padding: 12px 18px; border-bottom: 1px solid var(--line);">
      <div class="f">
        <label>${esc(S.lang==="sv"?"Filtrera":"Filter")}</label>
        <select id="c-policy-filter">
          ${topics.map(tp => `<option value="${tp.val}"${S.policyFilter===tp.val?" selected":""}>${esc(S.lang==="sv"?tp.sv:tp.en)}</option>`).join("")}
        </select>
      </div>
      <div class="f">
        <label>${esc(S.lang==="sv"?"Sortering":"Sort")}</label>
        <select id="c-policy-sort">
          <option value="desc"${S.policySort==="desc"?" selected":""}>${esc(S.lang==="sv"?"Nyast först":"Newest first")}</option>
          <option value="asc"${S.policySort==="asc"?" selected":""}>${esc(S.lang==="sv"?"Äldst först":"Oldest first")}</option>
        </select>
      </div>
    </div>
    <div class="card-b">
      <div class="feed" id="policy-feed" data-total-items="${items.length}">
        ${initialItems.length === 0 ? `<p style="color:var(--ink-3); padding: 12px 0;">${esc(S.lang==="sv"?"Inga träffar.":"No items found.")}</p>` : initialItems.map(item => `
          <div class="feed-item">
            <div class="feed-meta">
              <span class="feed-source">${esc(item.source_name)}${item.author ? ` · ${esc(item.author)}` : ""}</span>
              <span class="feed-type">${esc(item.item_type)}</span>
              <span class="feed-topic">${esc(item.topic)}</span>
              <span class="feed-date">${esc(item.published_at ? (item.published_at.includes("T") ? item.published_at.substring(0, 10) : item.published_at.trim().split(/\s+/).slice(0, 4).join(" ")) : "")}</span>
            </div>
            <h4><a href="${esc(item.url)}" target="_blank">${esc(item.title)}</a></h4>
            <p>${esc(item.summary)}</p>
            <div class="feed-note">
              <b>${esc(S.lang==="sv"?"Observatoriets notering":"Observatory note")}:</b> ${esc(S.lang==="sv"?item.observatory_note:item.observatory_note_en)}
            </div>
          </div>
        `).join("")}
      </div>
      ${items.length > limit ? `<button id="load-more-policy" onclick="loadMorePolicy()"> ${esc(S.lang==="sv"?"Visa mer":"View more")}</button>` : ""}
    </div>
  </div>`;
}

function loadMorePolicy() {
  const container = document.getElementById("policy-feed");
  const btn = document.getElementById("load-more-policy");
  let items = typeof REAL_POLICY_NEWS !== "undefined" ? REAL_POLICY_NEWS : [];
  
  if (S.policyFilter && S.policyFilter !== "all") {
    items = items.filter(item => item.topic === S.policyFilter || item.item_type === S.policyFilter || item.source_name === S.policyFilter);
  }
  
  items = items.slice().sort((a, b) => {
    const dateA = new Date(a.published_at || 0).getTime();
    const dateB = new Date(b.published_at || 0).getTime();
    return S.policySort === "asc" ? dateA - dateB : dateB - dateA;
  });

  const currentCount = container.children.length;
  const nextItems = items.slice(currentCount, currentCount + 10);
  
  nextItems.forEach(item => {
    const div = document.createElement("div");
    div.className = "feed-item";
    div.innerHTML = `
      <div class="feed-meta">
        <span class="feed-source">${esc(item.source_name)}${item.author ? ` · ${esc(item.author)}` : ""}</span>
        <span class="feed-type">${esc(item.item_type)}</span>
        <span class="feed-topic">${esc(item.topic)}</span>
        <span class="feed-date">${esc(item.published_at ? (item.published_at.includes("T") ? item.published_at.substring(0, 10) : item.published_at.trim().split(/\s+/).slice(0, 4).join(" ")) : "")}</span>
      </div>
      <h4><a href="${esc(item.url)}" target="_blank">${esc(item.title)}</a></h4>
      <p>${esc(item.summary)}</p>
      <div class="feed-note">
        <b>${esc(S.lang==="sv"?"Observatoriets notering":"Observatory note")}:</b> ${esc(S.lang==="sv"?item.observatory_note:item.observatory_note_en)}
      </div>
    `;
    container.appendChild(div);
  });
  
  if (container.children.length >= items.length && btn) btn.remove();
}
