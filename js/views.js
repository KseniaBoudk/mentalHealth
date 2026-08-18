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
const srcLine=(k)=>`${esc(IND[k][S.lang==="sv"?"reg":"regEn"])} · ${IND[k].inst==="survey"?"FoHM":"Socialstyrelsen"}`;
const srcStrip=(k,extra)=>`<div class="src"><b>${esc(t.notNum)}</b> ${esc(t.notNumB[k])}<br>${srcLine(k)} · <b>${esc(isRealActive(k)?t.realLbl:t.synthLbl)}</b>${isRealActive(k)&&t.realCaveat[k]?` · ${esc(t.realCaveat[k])}`:""}${extra?" · "+extra:""}</div>`;

function agePts(k,regionCode,year,sex,std){
  const pts=[];
  for(let i=0;i<AGES.length;i++){
    const c=cell(k,regionCode,year,i,sex,std);
    pts.push(c?[i,c.value]:null);
  }
  while(pts.length&&!pts[pts.length-1])pts.pop();
  let i0=0;while(i0<pts.length&&!pts[i0])i0++;
  return pts.slice(i0).map((p,j)=>p?[p[0],p[1]]:null);
}
/* Forces the fabricated generator even for indicators REAL can now answer.
   Used only by viewLaget's life-course exhibit — see fakeCell()'s docstring
   in data.js for why that one chart can never honestly go real. */
function fakeAgePts(k,regionCode,year,sex,std){
  const pts=[];
  for(let i=0;i<AGES.length;i++){
    const c=fakeCell(k,regionCode,year,i,sex,std);
    pts.push(c?[i,c.value]:null);
  }
  while(pts.length&&!pts[pts.length-1])pts.pop();
  let i0=0;while(i0<pts.length&&!pts[i0])i0++;
  return pts.slice(i0).map((p,j)=>p?[p[0],p[1]]:null);
}

const legendStrip=()=>`<div class="legend">${t.legend.map(([k,b,r])=>
  `<span class="li"><span class="dot" style="background:${INST_COLOR[k==="survey"?"survey":k==="reg"?"reg":"mort"]}"></span><span><b>${esc(b)}</b> ${esc(r)}</span></span>`).join("")}</div>`;

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

  // fakeTotal, deliberately: this scatter's whole premise (distance from the
  // regression line is "the treatment gap") only holds if both axes come
  // from the same internally-correlated fabricated generator. See
  // fakeTotal()'s docstring in data.js.
  const gap=REGIONS.map(r=>{
    const d=fakeTotal("distress",r[0],2024,"T",false),a=fakeTotal("antidep",r[0],2024,"T",false);
    return {x:d.value,y:a.value,code:r[0],name:r[1]};});
  const worst=(()=>{const n=gap.length,mx=gap.reduce((s,p)=>s+p.x,0)/n,my=gap.reduce((s,p)=>s+p.y,0)/n;
    let sxy=0,sxx=0;gap.forEach(p=>{sxy+=(p.x-mx)*(p.y-my);sxx+=(p.x-mx)**2;});
    const b=sxy/sxx,a=my-b*mx;
    return gap.slice().sort((p,q)=>(p.y-(a+b*p.x))-(q.y-(a+b*q.x)))[0];})();
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
          {aria:"Self-harm admissions by age and sex",xlabels:xl,zero:true,h:205})}
      </div>
      <div>
        <h4>${esc(t.suTitle)}</h4><div class="u">${srcLine("suicide")}</div>
        ${lineChart(
          [{pts:suM,color:"var(--oxblood)",w:2.6,anno:{at:suPeak,dx:-9,dy:-9,text:t.peakSu}},
           {pts:suK,color:"var(--oxblood)",dash:"5 3",w:1.9,label:t.women,labelAt:4}],
          {aria:"Suicide by age and sex",xlabels:xl,zero:true,h:205})}
      </div>
    </div>
    <div class="src"><b>${S.lang==="sv"?"Syntetiska data.":"Synthetic data."}</b> ${S.lang==="sv"
      ?"Heldragen linje kvinnor, streckad män. Samma skala vore missvisande: kurvornas form, inte nivå, är poängen."
      :"Solid line women, dashed men. The point is the shape of the curves, not their shared level."}</div>
  </div>

  <div class="figrow">
    <div class="card">
      <div class="card-h"><h3>${esc(t.gapTitle)}</h3><div class="u">${esc(t.gapUnit)}</div></div>
      <div class="card-b">${scatter(gap,{aria:"Reported distress against treatment across 21 regions",w:620,h:380})}</div>
      ${srcStrip("antidep",t.causalNote)}
    </div>
    <div class="pieces" style="grid-template-columns:1fr">
      ${t.pieces.map((p,i)=>`
        <div class="piece">
          <div class="tag" style="color:${INST_COLOR[p.inst]}">${esc(p.tag)}</div>
          <h4>${esc(p.h)}</h4><p>${esc(p.p)}</p>
          <div class="num tnum" style="color:${INST_COLOR[p.inst]}">${
            i===0?esc(worst.name):i===1?fmt(oldMen.value,1):"+"+growth+" %"}</div>
          <div class="numl">${
            i===0?(S.lang==="sv"?"störst gap 2024":"widest gap, 2024")
            :i===1?(S.lang==="sv"?"per 100 000 · män 85+":"per 100 000 · men 85+")
            :(S.lang==="sv"?"2006 → 2024 · kvinnor 15–24":"2006 → 2024 · women 15–24")}</div>
        </div>`).join("")}
    </div>
  </div>`;
}

function viewUtforska(){
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

  const R=RBY[S.region];
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

  const spread=shown.length>1&&nat?Math.round((shown[0].value-shown[shown.length-1].value)/nat.value*100):0;
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
        ${shown.length?dotPlot(shown,{nat:nat?nat.value:null,color:col,aria:"All regions with confidence intervals"}):""}
        ${suppressed.length?`<div class="suppress"><b>${esc(t.suppLbl)}</b> ${suppressed.map(esc).join(", ")}</div>`:""}
      </div>
      <div class="src">${t.spreadNote(fmt(spread,0),S.std?1:0)}</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h3>${esc(t.ageTitle)}</h3><div class="u">${esc(R[1])} ${esc(t.ageSub)}</div></div>
        <div class="card-b">${lineChart(seriesAge,
          {band,aria:"Age curves for the selected region against the national band",
           xlabels:[[1,"15"],[4,"45"],[6,"65"],[8,"85+"]],x0:0,x1:8,zero:true,h:185,notes:ageNotes})}</div>
      </div>
      <div class="card">
        <div class="card-h"><h3>${esc(t.timeTitle)}</h3><div class="u tnum">${years[0]}–${years[years.length-1]}</div></div>
        <div class="card-b">${lineChart([{pts:ts,color:col,w:2.4,dot:true}],
          {aria:"Time series for the selected region with national events marked",
           marks,xlabels:[[years[0],String(years[0])],[Math.round((years[0]+years[years.length-1])/2),String(Math.round((years[0]+years[years.length-1])/2))],[years[years.length-1],String(years[years.length-1])]],h:185})}</div>
      </div>
    </div>
  </div>
  <div class="card" style="margin-top:20px">${srcStrip(k,
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
      <div class="rv tnum">${fmt(mine.distress.value,1)} %</div>
      <div class="rci tnum">95% ${S.lang==="sv"?"KI":"CI"} ${fmt(mine.distress.lo,1)}–${fmt(mine.distress.hi,1)} · 16–84</div>
      <div class="rvs">${cmp("distress")}</div>
    </div>
    <div class="rstat i-reg">
      <div class="rk" style="color:var(--violet)"><span class="dot" style="background:var(--violet)"></span>${esc(t.rTreated)}</div>
      <div class="rv tnum">${fmt(mine.antidep.value,1)}</div>
      <div class="rci tnum">${S.lang==="sv"?"per 1 000":"per 1,000"} · 95% ${S.lang==="sv"?"KI":"CI"} ${fmt(mine.antidep.lo,1)}–${fmt(mine.antidep.hi,1)}</div>
      <div class="rvs">${cmp("antidep")}</div>
    </div>
    <div class="rstat i-mort">
      <div class="rk" style="color:var(--oxblood)"><span class="dot" style="background:var(--oxblood)"></span>${esc(t.rSuicide)}</div>
      <div class="rv tnum">${fmt(mine.suicide.value,1)}</div>
      <div class="rci tnum">${S.lang==="sv"?"per 100 000":"per 100,000"} · ${esc(t.winLbl(latest))}</div>
      <div class="rvs">${cmp("suicide")}</div>
    </div>
  </div>

  <div class="figrow" style="margin-top:20px">
    <div class="card">
      <div class="card-h"><h3>${esc(t.gapPos)}</h3><div class="u">${esc(t.gapPosU)}</div></div>
      <div class="card-b">${scatter(gap,{aria:"Region position on the treatment gap",w:620,h:350})}</div>
      <div class="src"><b>${S.lang==="sv"?"Syntetiska data":"Synthetic data"}</b> · ${S.lang==="sv"
        ?"Ringad region är den valda. Avståndet till linjen är behandlingsgapet."
        :"The circled region is the selected one. Distance from the line is the treatment gap."} ${esc(t.causalNote)}</div>
    </div>
    <div class="card">
      <div class="card-h"><h3>${esc(t.changed)}</h3><div class="u">${esc(t.changedU(prior,latest))}</div></div>
      <div class="card-b">
        <svg viewBox="0 0 380 170" role="img" aria-label="${`Change since ${prior} for four indicators; changes inside the interval are greyed`}">
          <line x1="172" y1="14" x2="172" y2="142" stroke="var(--hair)" stroke-width="1"/>
          ${changes.map((c,i)=>{
            const y=32+i*30;
            if(c.d==null){
              return `<text x="162" y="${y+3}" text-anchor="end" font-family="var(--sans)" font-size="9.5" fill="var(--ink-2)">${esc(t.ind[c.x])}</text>
                <text x="182" y="${y+3}" font-family="var(--mono)" font-size="9" fill="var(--ink-3)">${esc(fmt(null))}</text>`;
            }
            const w=Math.min(70,Math.abs(c.d)*(c.x==="suicide"?12:6)+6);
            const x2=172+(c.d>0?w:-w);
            const col=c.within?"var(--ink-3)":INST_COLOR[c.inst];
            const op=c.within?".45":"1";
            return `<text x="162" y="${y+3}" text-anchor="end" font-family="var(--sans)" font-size="9.5" fill="var(--ink-2)">${esc(t.ind[c.x])}</text>
              <line x1="172" y1="${y}" x2="${x2.toFixed(1)}" y2="${y}" stroke="${col}" stroke-width="2.6" opacity="${op}" stroke-linecap="round"/>
              <text x="${(x2+(c.d>0?6:-6)).toFixed(1)}" y="${y+3}" text-anchor="${c.d>0?"start":"end"}" font-family="var(--mono)" font-size="9" fill="${col}" opacity="${op}">${c.d>0?"+":"−"}${fmt(Math.abs(c.d),1)}</text>
              ${c.within?`<text x="302" y="${y+3}" font-family="var(--sans)" font-size="8" fill="var(--ink-3)">${esc(t.withinCI)}</text>`:""}`;
          }).join("")}
        </svg>
      </div>
      <div class="src">${t.chgNote(changes.filter(c=>c.within).length)}</div>
    </div>
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
      <div class="rv tnum">${fmt(mine[key].value,1)}${key==="distress"?" %":""}</div>
      <div class="rci tnum">95% ${S.lang==="sv"?"KI":"CI"} ${fmt(mine[key].lo,1)}–${fmt(mine[key].hi,1)}</div>
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
      <div class="card-h"><h3>${esc(t.mapTitle)}</h3>${cmpK?"":`<div class="u">${esc(t.ind[k])} · ${I.window?esc(t.winLbl(yr)):yr}</div>`}</div>
      <div class="card-b">
        ${cmpK?`
        <div class="mapcmp">
          <div>
            <div class="mapcmphead">${esc(t.ind[k])}</div>
            ${chorMap(rows,{color:col,nat:nat?nat.value:null,aria:"Map of Sweden's 21 regions for "+t.ind[k]})}
            <div class="mapscale sm"><span>${esc(t.natLine)} <b class="tnum">${fmt(nat?nat.value:null,1)}</b></span></div>
          </div>
          <div>
            <div class="mapcmphead"><select id="c-cmpind">
              ${Object.keys(IND).filter(x=>x!==k).map(x=>`<option value="${x}"${x===cmpK?" selected":""}>${esc(t.ind[x])}</option>`).join("")}
            </select></div>
            ${chorMap(cmpRows,{color:cmpCol,nat:cmpNat?cmpNat.value:null,aria:"Map of Sweden's 21 regions for "+t.ind[cmpK]})}
            <div class="mapscale sm"><span>${esc(t.natLine)} <b class="tnum">${fmt(cmpNat?cmpNat.value:null,1)}</b></span></div>
          </div>
        </div>`:`
        ${chorMap(rows,{color:col,nat:nat?nat.value:null,aria:"Map of Sweden's 21 regions, click a region to see its figures"})}
        <div class="mapscale">
          ${quintileBands(rows).ranges.map((rg,i)=>rg?`<span class="bandsw">
            <span class="bandchip" style="background:${col};opacity:${BAND_OP[i]}"></span>
            <span class="tnum">${fmt(rg.lo,1)}–${fmt(rg.hi,1)}</span></span>`:"").join("")}
          <span style="margin-left:auto">${esc(t.natLine)} <b class="tnum">${fmt(nat?nat.value:null,1)}</b></span>
        </div>`}
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
        <div class="card-h"><h3>${esc(t.histTitle)}</h3><div class="u">${esc(t.ind[k])}</div></div>
        <div class="card-b">${histogram(rows,{color:col,aria:"How many regions fall into each value band"})}</div>
        <div class="src">${esc(t.histSub)}</div>
      </div>
    </div>
  </div>`;
}

function viewMetod(){
  const P=t.mProse;
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
    <div class="note"><div class="l">${esc(t.realNoteL)}</div><p>${esc(REAL.active?t.realNoteOn:t.realNoteOff)}</p></div>
  </div>
  <div class="mwrap"><table class="m">
    <thead><tr><th>${esc(t.mIndicator)}</th><th>${esc(t.mSource)}</th><th>${esc(t.mFrom)}</th><th>${esc(t.mGrain)}</th><th>${esc(t.mLimit)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}
