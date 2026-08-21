"use strict";

/* =====================================================================
   4. CHART PRIMITIVES
   ===================================================================== */
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const fmt=(v,d,u)=>v==null||!isFinite(v)?"—":(S.lang==="sv"?v.toFixed(d).replace(".",","):v.toFixed(d))+(u?` ${u}`:"");

function axisTicks(min,max,n){
  const raw=(max-min)/n, mag=Math.pow(10,Math.floor(Math.log10(raw||1)));
  const step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=raw)||10*mag;
  const out=[];for(let v=Math.ceil(min/step)*step;v<=max+1e-9;v+=step)out.push(+v.toFixed(6));
  return out;
}

function dotPlot(rows, opts){
  const W=430,rowH=13,top=18,H=top+rows.length*rowH+34,L=118,R=W-16;
  const col=opts.color||"var(--violet)";
  // rows.length guard matches lineChart's own (see its comment above) — an
  // empty rows array would otherwise put Math.min/max(...[]) 's
  // +/-Infinity straight into every coordinate below.
  const lo=rows.length?Math.min(...rows.map(r=>r.lo)):0,hi=rows.length?Math.max(...rows.map(r=>r.hi)):1;
  const pad=(hi-lo)*0.08||1,x0=Math.max(0,lo-pad),x1=hi+pad;
  const X=v=>L+(v-x0)/(x1-x0)*(R-L);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria||"")}">`;
  axisTicks(x0,x1,4).forEach(v=>{
    s+=`<line x1="${X(v).toFixed(1)}" y1="${top-4}" x2="${X(v).toFixed(1)}" y2="${top+rows.length*rowH}" stroke="var(--hair-soft)" stroke-width="1"/>`;
    s+=`<text x="${X(v).toFixed(1)}" y="${H-16}" text-anchor="middle" font-family="var(--mono)" font-size="8.5" fill="var(--ink-3)">${fmt(v,v%1?1:0)}</text>`;});
  if(opts.unit)s+=`<text x="${R}" y="${top-6}" text-anchor="end" font-family="var(--sans)" font-size="8.5" fill="var(--ink-3)">${esc(opts.unit)}</text>`;
  if(opts.nat!=null){
    s+=`<line x1="${X(opts.nat).toFixed(1)}" y1="${top-8}" x2="${X(opts.nat).toFixed(1)}" y2="${top+rows.length*rowH}" stroke="${col}" stroke-width="1" stroke-dasharray="3 3" opacity=".65"/>`;
    s+=`<text x="${(X(opts.nat)+4).toFixed(1)}" y="${top-10}" font-family="var(--sans)" font-size="8.5" font-weight="700" fill="${col}">${esc(t.natLine)}</text>`;}
  rows.forEach((r,i)=>{
    const y=top+i*rowH+rowH/2, sel=r.code===S.region;
    s+=`<text x="${L-8}" y="${y+3}" text-anchor="end" font-family="var(--sans)" font-size="8.5" font-weight="${sel?700:400}" fill="${sel?col:"var(--ink-3)"}">${esc(r.name)}</text>`;
    // data-tip, not <title> — see chorMap's comment on the same swap: a
    // native SVG <title> is the unstyled OS tooltip this replaces with the
    // shared #tiletip card (wire(), shell.js).
    // rangeTxt: same lo===hi guard as chorMap's — a real CI always has some
    // width, so lo===hi means no uncertainty figure exists for this row at
    // all rather than a genuinely zero-width interval.
    const rangeTxt=r.lo!==r.hi?` (${fmt(r.lo,1)}–${fmt(r.hi,1)})`:"";
    const tip=`${r.name}: ${fmt(r.value,1)}${rangeTxt}${opts.unit?` ${opts.unit}`:""}`;
    s+=`<g data-tip="${esc(tip)}">`;
    s+=`<line x1="${X(r.lo).toFixed(1)}" y1="${y}" x2="${X(r.hi).toFixed(1)}" y2="${y}" stroke="var(--ink-3)" stroke-width="1.5" opacity=".42" stroke-linecap="round"/>`;
    s+=`<circle cx="${X(r.value).toFixed(1)}" cy="${y}" r="${sel?4.2:3.2}" fill="${col}"${sel?' stroke="var(--surface)" stroke-width="1.4"':''}/></g>`;});
  return s+"</svg>";
}

/* series: [{pts:[[x,y]|null,...], color, dash, w, dot, label, labelAt, anno}] — a
   null point breaks the line (a real series break must not be joined). */
function lineChart(series,opts){
  const W=opts.w||420,H=opts.h||190,L=42,R=W-14,Tp=16,B=H-26;
  const all=series.flatMap(se=>se.pts.filter(Boolean));
  const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
  const bandY=opts.band?opts.band.flatMap(p=>[p[1],p[2]]):[];
  // Every point can legitimately be null — e.g. a region/year where the
  // real source suppresses every value for small counts — leaving xs/ys
  // empty. Math.min()/max() of nothing is +/-Infinity, which propagated
  // into every coordinate as NaN (an invalid SVG attribute, silently
  // dropped by the browser) instead of just rendering an empty chart.
  const x0=opts.x0!=null?opts.x0:(xs.length?Math.min(...xs):0);
  const x1=opts.x1!=null?opts.x1:(xs.length?Math.max(...xs):1);
  let y0=ys.length||bandY.length?Math.min(...ys,...bandY):0;
  let y1=ys.length||bandY.length?Math.max(...ys,...bandY):1;
  if(opts.zero)y0=0;
  const pad=(y1-y0)*0.14||1;y0=Math.max(0,y0-(opts.zero?0:pad));y1+=pad;
  const X=v=>L+(v-x0)/((x1-x0)||1)*(R-L), Y=v=>B-(v-y0)/((y1-y0)||1)*(B-Tp);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria||"")}">`;
  axisTicks(y0,y1,3).forEach(v=>{
    s+=`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${R}" y2="${Y(v).toFixed(1)}" stroke="var(--hair-soft)" stroke-width="1"/>`;
    s+=`<text x="${L-6}" y="${(Y(v)+3).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="8.5" fill="var(--ink-3)">${fmt(v,v%1?1:0)}</text>`;});
  if(opts.unit)s+=`<text x="${L}" y="${Tp-6}" text-anchor="start" font-family="var(--sans)" font-size="8.5" fill="var(--ink-3)">${esc(opts.unit)}</text>`;
  if(opts.band&&opts.band.length){
    const up=opts.band.map(p=>`${X(p[0]).toFixed(1)},${Y(p[2]).toFixed(1)}`).join(" L");
    const dn=opts.band.slice().reverse().map(p=>`${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" L");
    s+=`<path d="M${up} L${dn} Z" fill="var(--band)"/>`;}
  // Labels sit near the BOTTOM of the plot, not the top: series labels
  // (se.label below) anchor at the last point, which in an upward-trending
  // series — the common case here — is near the top-right, exactly where a
  // mark near the end of the range would otherwise print underneath it.
  // y also alternates per mark (mi%2) so two events close together on the
  // x-axis (e.g. 2018 and 2020, both often inside the same chart's range)
  // don't print their labels on top of EACH OTHER either. m.color/m.anchor
  // (data.js's EVENTS, passed through by eventMarks() in views.js) let two
  // such close events diverge further still — a different colour, and a
  // label anchored to the opposite side of its line — rather than relying
  // on the y-stagger alone to tell them apart.
  (opts.marks||[]).forEach((m,mi)=>{
    const col=m.color||"var(--oxblood)", end=m.anchor==="end";
    const lx=X(m.x);
    s+=`<line x1="${lx.toFixed(1)}" y1="${Tp-4}" x2="${lx.toFixed(1)}" y2="${B}" stroke="${col}" stroke-width="1" stroke-dasharray="2 3" opacity=".8"/>`;
    s+=`<text x="${(end?lx-3:lx+3).toFixed(1)}" y="${B-5-(mi%2)*10}" text-anchor="${end?"end":"start"}" font-family="var(--sans)" font-size="7.5" fill="${col}">${esc(m.label)}</text>`;});
  // opts.xFmt formats a point's x-value for its hover tip below — default
  // is the literal x (a calendar year, the common case). Callers whose x is
  // an AGES band index rather than a year (viewLaget's/viewOverTid's age
  // curves) pass xFmt:i=>AGES[i] so the tip reads a real band ("35-44"),
  // not a bare index.
  const xLabel=opts.xFmt||String;
  series.forEach(se=>{
    let d="",pen=false;
    se.pts.forEach(p=>{ if(!p){pen=false;return;} d+=`${pen?"L":"M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`; pen=true; });
    s+=`<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.w||2.3}" stroke-linecap="round" stroke-linejoin="round"${se.dash?` stroke-dasharray="${se.dash}"`:""}/>`;
    const valid=se.pts.filter(Boolean);
    // A single-point series produces only an SVG "moveto" with no "lineto"
    // after it — the path above renders nothing at all. Real data that's
    // only published for one age band (e.g. suicide's single real age
    // group) hits exactly this case, so draw a dot unconditionally rather
    // than relying on the opt-in `se.dot` (which only ever marks the last
    // point of a genuine multi-point line).
    if(valid.length===1)s+=`<circle cx="${X(valid[0][0]).toFixed(1)}" cy="${Y(valid[0][1]).toFixed(1)}" r="3.6" fill="${se.color}"/>`;
    const last=[...se.pts].reverse().find(Boolean);
    if(se.dot&&last)s+=`<circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="3.6" fill="${se.color}"/>`;
    if(se.label){const p=se.pts.filter(Boolean)[se.labelAt??(se.pts.filter(Boolean).length-1)];
      if(p)s+=`<text x="${(X(p[0])-4).toFixed(1)}" y="${(Y(p[1])-10).toFixed(1)}" text-anchor="end" font-family="var(--sans)" font-size="10.5" font-weight="700" fill="${se.color}">${esc(se.label)}</text>`;}
    if(se.anno){const p=se.anno.at;
      s+=`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="4" fill="${se.color}"/>`;
      s+=`<text x="${(X(p[0])+se.anno.dx).toFixed(1)}" y="${(Y(p[1])+se.anno.dy).toFixed(1)}" text-anchor="${se.anno.dx<0?"end":"start"}" font-family="var(--sans)" font-size="10.5" font-weight="700" fill="${se.color}">${esc(se.anno.text)}</text>`;}
    // Hover targets, one per real point — reuses the same data-tip/#tiletip
    // card every other mark type (map tiles, dot-plot rows, histogram bars,
    // scatter points) already shows, wired generically in shell.js's
    // wire(). Invisible at rest (.pt-hit, kurvan.css) and revealed on
    // hover, so the chart looks unchanged when nothing's being pointed at;
    // sits on top of any already-visible marker above (single-point/last-
    // point/anno dot) too — an exact-duplicate tip there is harmless.
    valid.forEach(p=>{
      const tip=`${se.label?se.label+", ":""}${xLabel(p[0])}: ${fmt(p[1],p[1]%1?1:0,opts.unit)}`;
      s+=`<circle class="pt-hit" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="7" fill="${se.color}" data-tip="${esc(tip)}"/>`;
    });
  });
  (opts.notes||[]).forEach(n=>{
    s+=`<text x="${X(n.x).toFixed(1)}" y="${Y(n.y).toFixed(1)}" text-anchor="${n.anchor||"start"}" font-family="var(--sans)" font-size="8.5" font-style="italic" fill="var(--ink-3)">${esc(n.text)}</text>`;});
  (opts.xlabels||[]).forEach(l=>{
    s+=`<text x="${X(l[0]).toFixed(1)}" y="${H-9}" text-anchor="middle" font-family="var(--mono)" font-size="8.5" fill="var(--ink-3)">${esc(l[1])}</text>`;});
  return s+"</svg>";
}

/* Groups rows into n roughly-equal-count bands by rank (quintiles by
   default) rather than equal-width value slices — "how does this region's
   standing compare to its peers' " reads more plainly as a rank than as a
   raw value on a gradient. Shared by chorMap (fill) and viewKarta's legend
   (swatches), so the two never disagree about where a band boundary falls. */
const BAND_OP=[0.16,0.34,0.52,0.72,0.92];
function quintileBands(rows,n){
  n=n||BAND_OP.length;
  const sorted=rows.slice().sort((a,b)=>a.value-b.value);
  const size=sorted.length;
  const bands=Array.from({length:n},()=>[]);
  sorted.forEach((r,i)=>bands[Math.min(n-1,Math.floor(i/size*n))].push(r));
  const idxByCode={};
  bands.forEach((b,i)=>b.forEach(r=>idxByCode[r.code]=i));
  const ranges=bands.map(b=>b.length?{lo:b[0].value,hi:b[b.length-1].value}:null);
  return{idxByCode,ranges};
}

/* rows: [{code,name,value,lo,hi}] for all 21 regions, real county borders
   from REGION_PATH (data.js). Fill opacity encodes the region's quintile
   band, not its raw value — see quintileBands() — and the selected region
   gets a heavier outline. Regions are real <path> elements, clickable and
   focusable like the other controls. */
function chorMap(rows,opts){
  const col=opts.color||"var(--violet)";
  const nat=opts.nat;
  const{idxByCode}=quintileBands(rows);
  // Selected tile drawn last so its stroke paints on top of any neighbor's
  // shared-edge stroke, instead of a random one covering half its outline.
  const paths=[...rows].sort((a,b)=>(a.code===S.region)-(b.code===S.region)).map(r=>{
    const g=REGION_PATH[r.code];
    const op=BAND_OP[idxByCode[r.code]];
    const sel=r.code===S.region;
    const vsNat=nat!=null?` · ${t.natLine} ${fmt(nat,1)}`:"";
    const trendTxt=r.trend?` · ${r.trend.arrow}${r.trend.rel?` (${r.trend.rel==="with"?t.trendWith:t.trendAgainst})`:""}`:"";
    // Omit the range when lo===hi — a real confidence interval always
    // has some width; lo===hi means the caller has no uncertainty figure
    // for this value at all (context indicators: one yearly number, not a
    // survey estimate) rather than a genuinely zero-width interval, so
    // showing "(225,5–225,5)" would just repeat the same number.
    const rangeTxt=r.lo!==r.hi?` (${fmt(r.lo,1)}–${fmt(r.hi,1)})`:"";
    // Unit once, right after the region's own value+range — same rule as
    // dotPlot's tip: one unit describes the whole reading, not every number
    // in it, so it isn't repeated again on the "· Sweden ..." reference.
    const unitTxt=opts.unit?` ${opts.unit}`:"";
    const title=`${r.name} (${g.abbr}): ${fmt(r.value,1)}${rangeTxt}${unitTxt}${vsNat}${trendTxt}`;
    // Significant moves (not "→") also get a data-trend/data-rel pair; wire()
    // paints these as an actual glyph on the shape after the SVG is in the
    // DOM, using getBBox() rather than stored centroids — the region paths
    // carry no centroid data, and computing one from path geometry is not
    // worth doing when the browser already knows each shape's bounding box.
    const trendAttr=r.trend&&r.trend.arrow!=="→"
      ?` data-trend="${r.trend.arrow}" data-rel="${r.trend.rel||"neutral"}"`:"";
    // The glow on the selected tile is an SVG filter, not a CSS one: the
    // viewBox is tiny (MAP_VIEWBOX is a handful of units across), so a CSS
    // blur radius in px would be resolved against that local coordinate
    // system and come out wildly wrong at this scale. stdDeviation on
    // feGaussianBlur is already in the same local units as the path data.
    // data-tip, not a <title> child: a native SVG <title> triggers the
    // browser's own unstyled OS tooltip, which is what this is replacing.
    // aria-label alone (already present) is enough for the accessible name,
    // so dropping <title> loses nothing for screen readers.
    return `<path class="tile${sel?" on":""}" data-region="${r.code}" data-tip="${esc(title)}"${trendAttr} tabindex="0" role="button"
      aria-label="${esc(title)}" d="${g.d}" fill="${col}" fill-opacity="${op}"${sel?` filter="url(#tileglow)" style="stroke:${col}"`:""}></path>`;
  }).join("");
  return `<svg class="mapsvg" viewBox="${MAP_VIEWBOX}" role="group" aria-label="${esc(opts.aria||"")}">
    <defs><filter id="tileglow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="0.09" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter></defs>${paths}</svg>`;
}

/* rows: [{value,...}] for the regions being shown (suppressed rows already
   filtered out by the caller). Bins values into opts.bins equal-width bands
   and draws a bar per band — "how many regions sit at this level", not a
   ranking of which region. */
function histogram(rows,opts){
  // L=24, not 14: no y-axis tick numbers here, but a rotated countLabel
  // still needs its own lane clear of the bars — scatter()/lineChart()
  // reserve far more (54/42) because they also fit tick numbers in there.
  const W=opts.w||300,H=opts.h||150,L=24,R=W-14,Tp=16,B=H-24;
  const col=opts.color||"var(--violet)";
  const vals=rows.map(r=>r.value);
  // realSpan is what gets displayed (boundary labels, tooltips) — genuinely
  // 0 when every region reports the same value, which is real information
  // ("no spread"), not an error. binSpan is only for the /0 guard in the
  // bin-index math below; forcing it to 1 there doesn't affect the display
  // math, since lo+i*0/nbins is lo for every i regardless of what the
  // divisor was.
  const lo=Math.min(...vals),hi=Math.max(...vals),realSpan=hi-lo,binSpan=realSpan||1;
  const nbins=opts.bins||6;
  const counts=new Array(nbins).fill(0);
  vals.forEach(v=>{
    let i=Math.floor((v-lo)/binSpan*nbins);
    if(i>=nbins)i=nbins-1; if(i<0)i=0;
    counts[i]++;
  });
  const maxC=Math.max(...counts)||1;
  const bw=(R-L)/nbins;
  const X=i=>L+i*bw, Y=c=>B-c/maxC*(B-Tp);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria||"")}">`;
  counts.forEach((c,i)=>{
    const x=X(i),y=Y(c),h=B-y;
    // data-tip, not <title> — same swap as chorMap/dotPlot, for the same
    // shared #tiletip card instead of the unstyled OS tooltip.
    const tip=`${fmt(lo+i*realSpan/nbins,1)}–${fmt(lo+(i+1)*realSpan/nbins,1)}${opts.unit?` ${opts.unit}`:""}: ${c}`;
    s+=`<rect data-tip="${esc(tip)}" x="${(x+1.5).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw-3).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${col}" opacity="${c?".82":".14"}"/>`;
    if(c)s+=`<text x="${(x+bw/2).toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="middle" font-family="var(--mono)" font-size="8.5" fill="var(--ink-2)">${c}</text>`;
  });
  // Unit suffixed directly onto the two boundary numbers (6,2 / 9,6 %)
  // rather than floating in a corner — ties it to the exact values it
  // describes instead of relying on the reader to connect the two.
  [0,nbins].forEach(i=>{
    s+=`<text x="${X(i).toFixed(1)}" y="${(B+13).toFixed(1)}" text-anchor="${i===0?"start":"end"}" font-family="var(--mono)" font-size="8" fill="var(--ink-3)">${fmt(lo+i*realSpan/nbins,realSpan<10?1:0)}${opts.unit&&i===nbins?" "+esc(opts.unit):""}</text>`;});
  // Bar-top numbers are counts of regions, not values — labelled here since
  // that's not otherwise obvious from the chart alone.
  if(opts.countLabel){
    const cy=((Tp+B)/2).toFixed(1);
    s+=`<text x="10" y="${cy}" transform="rotate(-90 10 ${cy})" text-anchor="middle" font-family="var(--sans)" font-size="8" fill="var(--ink-3)">${esc(opts.countLabel)}</text>`;
  }
  s+=`<line x1="${L}" y1="${B}" x2="${R}" y2="${B}" stroke="var(--hair-soft)" stroke-width="1"/>`;
  return s+"</svg>";
}

function scatter(pts,opts){
  const W=opts.w||560,H=opts.h||360,L=54,R=W-18,Tp=18,B=H-46;
  // Regression-fit math (below) is meaningless on zero points and xs.reduce
  // with no initial value throws outright on an empty array — same
  // defensive spirit as lineChart's own empty-series guard above.
  if(!pts.length)return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria||"")}"></svg>`;
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const px=(Math.max(...xs)-Math.min(...xs))*.12,py=(Math.max(...ys)-Math.min(...ys))*.14;
  const x0=Math.min(...xs)-px,x1=Math.max(...xs)+px,y0=Math.min(...ys)-py,y1=Math.max(...ys)+py;
  const X=v=>L+(v-x0)/(x1-x0)*(R-L),Y=v=>B-(v-y0)/(y1-y0)*(B-Tp);
  const n=pts.length,mx=xs.reduce((a,b)=>a+b)/n,my=ys.reduce((a,b)=>a+b)/n;
  let sxy=0,sxx=0;pts.forEach(p=>{sxy+=(p.x-mx)*(p.y-my);sxx+=(p.x-mx)**2;});
  const b=sxy/sxx,a=my-b*mx,fit=x=>a+b*x;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria||"")}">`;
  axisTicks(y0,y1,4).forEach(v=>{
    s+=`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${R}" y2="${Y(v).toFixed(1)}" stroke="var(--hair-soft)" stroke-width="1"/>`;
    s+=`<text x="${L-6}" y="${(Y(v)+3).toFixed(1)}" text-anchor="end" font-family="var(--mono)" font-size="8.5" fill="var(--ink-3)">${fmt(v,v%1?1:0)}</text>`;});
  axisTicks(x0,x1,4).forEach(v=>{
    s+=`<text x="${X(v).toFixed(1)}" y="${B+16}" text-anchor="middle" font-family="var(--mono)" font-size="8.5" fill="var(--ink-3)">${fmt(v,v%1?1:0)}</text>`;});
  s+=`<line x1="${X(x0).toFixed(1)}" y1="${Y(fit(x0)).toFixed(1)}" x2="${X(x1).toFixed(1)}" y2="${Y(fit(x1)).toFixed(1)}" stroke="var(--violet)" stroke-width="1.5" stroke-dasharray="6 4" opacity=".7"/>`;
  s+=`<text x="${R}" y="${(Y(fit(x1))-8).toFixed(1)}" text-anchor="end" font-family="var(--sans)" font-size="9.5" font-weight="650" fill="var(--violet)">${esc(t.gapLine)}</text>`;
  let below=null,above=null;
  pts.forEach(p=>{p.res=p.y-fit(p.x);if(!below||p.res<below.res)below=p;if(!above||p.res>above.res)above=p;});
  // Selected region gets its own ring colour/label ONLY when it isn't
  // already below/above — those two mean "statistical extreme"; this ring
  // means "the region you're currently viewing", a different concept that
  // used to share teal with `above` and get no label of its own.
  const sel = pts.find(p=>p.code===S.region && p!==below && p!==above);
  pts.forEach(p=>{
    const hl=p===below||p===above||p===sel;
    // data-tip, not <title> — same swap as chorMap/dotPlot/histogram. tabindex
    // (new: was missing here, same as dotPlot/histogram's marks) makes it a
    // real tab stop — wire()'s generic [data-tip] loop (shell.js) already
    // handles focus/blur for any tabindex'd data-tip mark, this was just
    // never opted into the tab order before. .spt's focus ring is in
    // kurvan.css, next to .tile's.
    // Tip shows both axes' actual values, not just the point's name — same
    // "label: value unit" shape lineChart()'s own pt-hit tooltips use.
    // opts.xName/yName/xUnit/yUnit are optional so a caller that hasn't been
    // updated still gets the old name-only tip instead of "undefined".
    const tip=opts.xName?`${p.name}, ${opts.xName}: ${fmt(p.x,1,opts.xUnit)} · ${opts.yName}: ${fmt(p.y,1,opts.yUnit)}`:p.name;
    s+=`<circle class="spt" tabindex="0" data-tip="${esc(tip)}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${hl?5.4:4.2}" fill="var(--violet)" opacity="${p.res<0?.62:1}"/>`;
    if(hl)s+=`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="7.6" fill="none" stroke="${p===below?"var(--oxblood)":p===above?"var(--teal)":"var(--ink)"}" stroke-width="1.8"/>`;});
  [[below,"var(--oxblood)",1],[above,"var(--teal)",-1]].forEach(([p,col,dir])=>{
    s+=`<line x1="${X(p.x).toFixed(1)}" y1="${Y(p.y).toFixed(1)}" x2="${X(p.x).toFixed(1)}" y2="${Y(fit(p.x)).toFixed(1)}" stroke="${col}" stroke-width="2"/>`;
    s+=`<text x="${(X(p.x)+(dir>0?-12:12)).toFixed(1)}" y="${(Y(p.y)+(dir>0?24:-20)).toFixed(1)}" text-anchor="${dir>0?"end":"start"}" font-family="var(--sans)" font-size="11" font-weight="700" fill="${col}">${esc(p.name)}</text>`;});
  if(sel){
    const dy=sel.res<0?24:-20;
    s+=`<text x="${X(sel.x).toFixed(1)}" y="${(Y(sel.y)+dy).toFixed(1)}" text-anchor="middle" font-family="var(--sans)" font-size="11" font-weight="700" fill="var(--ink)">${esc(sel.name)}</text>`;
  }
  // xLabel/yLabel: default to t.gapX/t.gapY (the original need-vs-response
  // pairing this function was written for) so viewBehov/viewRegioner's
  // existing calls don't need to change; a caller plotting a different pair
  // of axes (e.g. the disagreement scatter, viewBehov) passes its own.
  s+=`<text x="${((L+R)/2).toFixed(0)}" y="${H-8}" text-anchor="middle" font-family="var(--sans)" font-size="10.5" font-weight="650" fill="var(--teal)">${esc(opts.xLabel||t.gapX)}</text>`;
  s+=`<text x="14" y="${((Tp+B)/2).toFixed(0)}" transform="rotate(-90 14 ${((Tp+B)/2).toFixed(0)})" text-anchor="middle" font-family="var(--sans)" font-size="10.5" font-weight="650" fill="var(--violet)">${esc(opts.yLabel||t.gapY)}</text>`;
  return s+"</svg>";
}
