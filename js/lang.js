"use strict";

/* =====================================================================
   2. LANGUAGE
   ===================================================================== */

const T={
sv:{
  word:"Kurvan", sub:"Psykisk hälsa i Sverige",
  tabs:{laget:"Läget",over_tid:"Över tid",karta:"Karta",behov:"Behov & vård",sjukskrivning:"Sjukskrivning",policy_news:"Nyheter & Policy",kon:"Jämförelse efter kön",alder:"Jämförelse efter ålder",sammanhang:"Sammanhang",vantetider:"Väntetider, BUP",hbsc:"Skolbarns hälsovanor",metod:"Metod",regioner:"Länsprofil"},
  comingT:"Under uppbyggnad",
  comingB:"Den här sidan är beskriven i observatoriets plan men inte byggd än i den här prototypen.",
  ctxLead:"Befolknings- och samhällsdata vid sidan av de psykiska hälsomåtten — inte sammanslaget till ett mått. Ett samband här visar inte orsak.",
  ctxInd:{pop_density:"Invånare per kvadratkilometer",education_low_pct:"Andel med låg utbildningsnivå"},
  ctxCaveat:"Regionens värde är ett ovägt medelvärde av dess kommuner, inte befolkningsviktat. Källa: Kolada, 2023.",
  observationNoteL:"Fyra fönster mot samma verklighet",
  observationNoteB:"När enkäterna visar att den självrapporterade oron ökar, följer specialistvårdens besök inte i takt; samtidigt rör sig sjukskrivningarna för syndromet och de svåraste utfallen efter helt egna banor. Att kurvorna divergerar visar att befolkningens upplevda ohälsa, vårdens tillgänglighet, det förebyggande skyddsnätet och arbetslivets belastning mäter fyra skilda dimensioner av samma samhällsfråga.",
  vantetiderLead:"Väntetid till första besök inom barn- och ungdomspsykiatrin (BUP), median antal dagar bland avslutade besök. Ett smalt mått på tillgänglighet — inte på vårdens kvalitet eller hur stort behovet är.",
  vantetiderNoteL:"Läs detta först",
  vantetiderCaveat:"Rullande tolvmånadersfönster, inte en flerårig trend — källan sparar bara den senaste perioden. Uppdaterat för hand, inte automatiskt, så siffrorna kan ligga efter. Medianen gäller bara avslutade första besök — ett lågt värde kan betyda korta väntetider, eller bara att de enklaste fallen hunnit avslutas än så länge.",
  vantetiderInd:"Väntetid till första besök",
  // chorMap()'s no-data tile tooltip for a region suppressed THIS month
  // specifically (see viewVantetider) — distinct from suppLbl, which is
  // about a whole withheld count next to an otherwise-published rate.
  vantetiderNoData:name=>`${name}: ingen siffra denna månad — för få avslutade besök för att publiceras.`,
  // BUP_FACILITIES (data.js) — the real clinic-count stat and clinic
  // directory list added to viewVantetider()'s sidebar, alongside the
  // wait-time stat above. See ../BUPS/README.md for the source.
  vantetiderClinicsInd:"BUP-mottagningar",
  vantetiderClinicsSentence:n=>n===1?"1 BUP-mottagning listad i länet.":`${n} BUP-mottagningar listade i länet.`,
  vantetiderClinicsListH:"Mottagningar i länet",
  vantetiderClinicsEmpty:"Inga BUP-mottagningar listade för den här regionen på 1177.se.",
  vantetiderClinicsSrc:"1177.se, Hitta vård. En ögonblicksbild — inte en direktuppdaterad källa; mottagningar öppnar, stänger och byter adress.",
  vantetiderClinicsNoAddr:"Ingen adress listad",
  // viewSjukskrivning's latest year, when Försäkringskassan hasn't published
  // a full 12 months of it yet (see REAL_FK's `partial`/`months`, data.js) —
  // partialTag is the short inline form (map year label, region card),
  // partialYearNote the full sentence (srcStrip's extra slot).
  partialTag:"(delår)",
  partialYearNote:(y,m)=>`<b>${y} är ett delår.</b> Bara ${m} av 12 månader publicerade hittills av Försäkringskassan — jämför inte rakt av med hela tidigare år.`,
  hbscLead:"Andel 11-, 13- och 15-åringar som uppger att de känt sig nere minst en gång i veckan de senaste sex månaderna. Ett enda mått bland flera i enkäten Skolbarns hälsovanor (HBSC) — inte ett samlat mått på psykisk hälsa hos barn.",
  hbscNoteL:"Läs detta först",
  hbscCaveat:"Ett enda mätvärde, inte en trend — källan har hittills bara en regional mätperiod publicerad (2021–2022). Skolbarns hälsovanor frågar om åtta olika besvär; det här visar bara ett av dem (\"känt sig nere\"). Ingen totalsiffra för båda könen finns i källan.",
  hbscInd:"Känt sig nere minst en gång i veckan",
  hbscNotNumB:"Självrapporterat i en enkät bland 11-, 13- och 15-åringar, inte en klinisk diagnos eller kontakt med vården. Räknar andelen som svarat \"nästan varje dag\" eller \"mer än en gång i veckan\" på en enda fråga.",
  monthsShort:["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"],
  legendRankNote:"Regionerna delas in i fem lika stora grupper efter värde — inte jämnstora intervall.",
  legendTiers:["Lägst","Lägre","Mitten","Högre","Högst"],
  langBtn:"EN", themeD:"Mörkt", themeL:"Ljust",
  copyLink:"Kopiera länk", linkCopied:"Länk kopierad", linkCopyFailed:"Kunde inte kopiera",
  stamp:"Data t.o.m. 2024 · uppdaterad aug 2026",
  // loadRealSourcesLazily() (shell.js): shown next to the #synth banner's
  // own message only while some of the 10 js/data/*.js files are still in
  // flight — pending is how many of the 10 haven't landed yet.
  loadingRemaining:pending=>`Laddar återstående datakällor… (${pending} av 10 kvar)`,
  synthT:"Syntetiska data", synthB:"Alla siffror på den här sidan är genererade. Panelen innehåller ingen verklig statistik.",
  synthPartialT:"Mestadels verkliga data",
  // Computed from IND/isRealActive() via realSummary() (views.js), not
  // hand-counted — see synthPartialB's English twin for why.
  synthPartialB:(n,total,realNames,synthNames,synthN)=>`${n} av ${total} indikatorer bygger nu på verklig, öppen statistik: ${realNames}. Bara ${synthNames} är fortfarande genererad${synthN>1?"e":""} — se märkningen vid varje diagram.`,
  // synthN===0 (every indicator real) used to fall through to synthPartialB
  // anyway, with an empty synthNames — "Bara  är fortfarande genererad" —
  // since that sentence was written assuming there's always at least one
  // synthetic indicator left to name. This is the complete-sentence version
  // for when there genuinely isn't one.
  synthAllT:"Verkliga data",
  synthAllB:(total,realNames)=>`Alla ${total} indikatorer bygger nu på verklig, öppen statistik: ${realNames}.`,
  realLbl:"verkliga data", synthLbl:"syntetiska data",
  realCaveat:{
    selfharm:"Verkliga siffror gäller endast 12–17 år, femårsfönster.",
    suicide:"Verkliga siffror gäller nu alla åldrar, femårsfönster. Antal under 10 per fönster hålls tillbaka oftare i de yngsta och äldsta åldersgrupperna, där dödsfall är sällsynta — själva andelen (per 100 000) visas ändå.",
    psych:"Uppdelat på sex diagnostyper, årsvis, alla åldrar och kön — men bara specialistvård. \"Ätstörningar m.fl.\" och \"ADHD och barndomsdebut\" är bredare ICD-10-kapitel än namnen antyder — se typväljaren och not nedan.",
    distress:"Ingen åldersuppdelning finns i källan; \"Alla åldrar\" är enda valet. Bytte namn från \"Nedsatt psykiskt välbefinnande\" — den kategorin slutade publiceras efter 2015–2018.",
    sjukfranvaro:"Verkliga siffror sedan 2005, månadsvis genomsnitt per år. Ingen åldersuppdelning.",
    antidep:"Uppdelat på fem läkemedelsklasser, alla åldrar och kön, årsvis sedan 2006 — men mäter uthämtade recept, inte diagnos; se typväljaren och not nedan."
  },
  // Turns a bare "value + unit" .rstat number into a full sentence — only
  // used on the low-density, often-orphaned side-panel numbers (Karta,
  // Sjukskrivning, Kön, Ålder, Sammanhang, Väntetider), never on chart
  // tooltips/dot-plot rows/map hovers, which repeat up to 21x on screen
  // and already sit next to a chart title naming the indicator — a
  // sentence there would repeat words, not add clarity. Takes the value
  // ALREADY formatted as a plain number (fmt(v,1), no unit attached),
  // since each sentence places its own unit text wherever its own
  // grammar needs it — sjukfranvaro's "% of ongoing sick-leave cases" is
  // NOT "% of population", and bup_vantetid/pop_density aren't things
  // people "are" the way an event rate is, so one shared template can't
  // cover all of these (see CLAUDE.md's interpretation rules on not
  // overstating what a number does/doesn't mean).
  statSentence:{
    selfharm:(n)=>`${n} per 100 000 vårdades för självskada.`,
    suicide:(n)=>`${n} per 100 000 avled i suicid.`,
    psych:(n)=>`${n} per 100 000 hade kontakt med psykiatrisk specialistvård.`,
    distress:(n)=>`${n} % uppgav svår ängslan, oro eller ångest.`,
    antidep:(n)=>`${n} per 1 000 hämtade ut antidepressiva.`,
    sjukfranvaro:(n)=>`${n} % av pågående sjukfall hade diagnosen stressreaktion.`,
    bup_vantetid:(n)=>`Medianväntetiden till första besök var ${n} dagar.`,
    hbsc_felt_low:(n)=>`${n} % uppgav att de känt sig nere minst en gång i veckan.`,
    // Context indicators deliberately phrased plainly, not in the same
    // clinical-sounding shape as the mental-health sentences above — see
    // CONTEXT's own docstring in js/data.js on why these aren't shaped
    // like IND/REAL_*; giving them the same sentence template would imply
    // a comparability with the health measures this project avoids.
    pop_density:(n)=>`Regionen har ${n} invånare per kvadratkilometer.`,
    education_low_pct:(n)=>`${n} % av invånarna 25–64 år har låg utbildningsnivå.`
  },
  realNoteL:"Vad som faktiskt är verkligt här",
  // realNames leads the sentence here (unlike synthPartialB/footBPartial,
  // where it follows a colon) — capitalise just its first letter back up.
  realNoteOn:(n,total,realNames,synthNames,synthN)=>`${realNames.charAt(0).toUpperCase()+realNames.slice(1)} är nu verklig, öppen statistik, hämtad av prototype/pipeline/. Bara ${synthNames} saknar hämtskript i det här projektet och förblir genererad${synthN>1?"e":""} — se märkningen vid varje diagram.`,
  realNoteAll:(realNames)=>`${realNames.charAt(0).toUpperCase()+realNames.slice(1)} är nu verklig, öppen statistik, hämtad av prototype/pipeline/.`,
  realNoteOff:"Ingen indikator är verklig data ännu på den här sidan. prototype/pipeline/ kan hämta verkliga siffror för svår ängslan/oro, psykiatrisk specialistvård, självskada och suicid; kör fetcherna och sedan build_kurvan_data.py för att aktivera dem.",
  legend:[["survey","Enkäten","frågar människor direkt"],["reg","Registren","räknar dem som nått vården"],["mort","Dödsorsaksregistret","missar ingen"]],
  introLabel:"Om Kurvan",
  introLead:"Kurvan följer psykisk hälsa på befolkningsnivå i Sverige — självskada, suicid, psykiatrisk vård, läkemedel, sjukskrivning med mera — byggt på öppna myndighetsdata (Socialstyrelsen, Försäkringskassan, Folkhälsomyndigheten, SCB). Syftet är att visa hur måtten rör sig över tid och mellan regioner, inte att diagnostisera, förutsäga eller rangordna någon person, region eller kommun.",
  introHow:["Använd flikarna till vänster för att utforska olika vyer: utveckling över tid, karta per region, väntetider med mera.","De flesta flikar går att filtrera på region, ålder, kön och år, och växla mellan råa och åldersstandardiserade tal.","En markering på varje diagram visar om det är verklig publicerad data eller en tydligt märkt syntetisk platshållare — se fliken Metod för exakt vad som är verkligt."],
  introCrisisLead:"Behöver du prata med någon nu?",
  kick:"Veckans bild",
  h1:"Den ålder som skadar sig själv är inte den ålder som dör",
  hp:"Slutenvård för självskada toppar före 25 och är vanligast bland unga kvinnor. Suicid stiger genom hela livet och är vanligast bland de äldsta männen. Nästan all uppmärksamhet ligger på den första kurvan.",
  twinT:"Två kurvor, samma befolkning",
  shTitle:"Slutenvårdad för självskada", suTitle:"Avlidna i suicid",
  perK:"per 100 000", women:"kvinnor", men:"män",
  peakSh:"kvinnor 15–24", peakSu:"män 85+",
  gapTitle:"Rapporterat behov mot vårdrespons",
  gapUnit:"21 regioner · vuxna · 2024 · två oberoende instrument",
  gapX:"uppger svår ängslan, oro eller ångest, % (enkät)",
  gapY:"uthämtade antidepressiva, per 1 000 (register)",
  gapLine:"genomsnittligt samband mellan behov och respons",
  causalNote:"Ett samband är inte en orsak. Regioner skiljer sig åt av många skäl som den här grafen inte visar.",
  disagreeTitle:"Rapporterad ångest mot vårdkontakt",
  disagreeUnit:y=>`21 regioner · alla åldrar · ${y}`,
  // gapX (above) already is the distress/survey axis — reused as-is for this
  // scatter's x-axis, since it's the exact same measure. Only the y-axis
  // (care contact, not antidepressants) needs its own label.
  disagreeY:"i psykiatrisk specialistvård, per 100 000 (register)",
  disagreeCaveat:"Två oberoende mått på samma breda problem: självrapporterad ångest (enkät) och registrerad kontakt med specialistpsykiatrin (register). Ett samband säger inte varför de skiljer sig åt i en viss region — det kan bero på att vården inte nås, inte söks, eller att datan är ofullständig.",
  gapPiece:{tag:"Behov och respons",inst:"reg",h:"Störst avstånd mellan behov och respons",p:"Regionen med störst skillnad mellan rapporterat behov och registrerad vårdrespons, 2024.",numl:"störst avstånd 2024"},
  // Fills the sidebar's second card (viewBehov) with whichever region is
  // currently selected — clicking a point in the scatter (shell.js) sets
  // S.region and re-renders, so this updates per click. Two full sentence
  // functions (not fragments assembled in views.js), same shape as
  // disagreeUnit above — word order differs by direction and language,
  // and every UI string belongs in this file (see CLAUDE.md).
  gapSelTag:"Vald region",
  gapSelAbove:(xv,yv,resAbs)=>`${xv} uppger svår ångest här; ${yv} hämtas ut — ${resAbs} fler än det genomsnittliga sambandet mellan behov och respons skulle antyda.`,
  gapSelBelow:(xv,yv,resAbs)=>`${xv} uppger svår ångest här; ${yv} hämtas ut — ${resAbs} färre än det genomsnittliga sambandet mellan behov och respons skulle antyda.`,
  gapSelNuml:"jämfört med genomsnittligt samband · 2024",
  pieces:[
    {tag:"Livsloppet",inst:"mort",h:"De äldsta männen",p:"Suicidtalet bland män 85+ är landets högsta. Enkäten slutar vid 84, så gruppen syns inte i något mått på självrapporterad ohälsa.",numl:"per 100 000 · män 85+"},
    {tag:"Förskrivning",inst:"reg",h:"Unga kvinnor, 20 år av ökning",p:"Uthämtade antidepressiva bland kvinnor 15–24 sedan registret startade 2006.",numl:"2006 → 2024 · kvinnor 15–24"}
  ],
  ind:{distress:"Svår ängslan, oro eller ångest",antidep:"Uthämtade antidepressiva",psych:"Psykiatrisk specialistvård",selfharm:"Slutenvårdad för självskada",suicide:"Avlidna i suicid",sjukfranvaro:"Sjukskrivning, stressreaktion (F43)"},
  fkLead:"Andel pågående sjukfall med diagnosen stressreaktion (F43) — ett mått på samhällelig/funktionell påverkan, inte ett direkt mått på psykisk ohälsa och inte en kostnadsberäkning.",
  konLead:"Svår ängslan/oro, psykiatrisk specialistvård och sjukskrivning publiceras alla uppdelat på kön i sina källor — här jämförs kvinnor och män över tid för respektive mått, rikssiffror.",
  konCaveat:"Slutenvårdad för självskada och avliden i suicid saknas här: de källorna är femårsfönster kring en mittpunkt, inte årsvisa siffror som de tre andra — och skulle behöva en egen kortlayout, inte bara läggas till i den här.",
  youthTitle:"Unga: vårdkontakt, 15–24 år",
  youthUnit:"15–24 år · riket · uppdelat på kön",
  youthDistressCtx:"Ingen åldersuppdelning finns i källan — inte en 15–24-siffra.",
  alderLead:"Psykiatrisk specialistvård är det enda måttet som publiceras uppdelat på ålder genom hela livet i sin källa — här jämförs barn, vuxna och äldre över tid, rikssiffror.",
  alderCaveat:"Åldersgrupperna följer registrets egna åldersband, inte en exakt gräns vid 18 år: \"vuxna\" här är 15–64 år och innehåller alltså även 15–17-åringar tillsammans med de vuxna. De andra måtten saknas här: deras källor har ingen åldersuppdelning alls, eller täcker bara tonår (12–19 år) och inget för vuxna eller äldre.",
  ageChild:"Barn (0–14)",ageAdult:"Vuxna (15–64)",ageElderly:"Äldre (65+)",
  lblInd:"Indikator",lblAge:"Åldersgrupp",lblSex:"Kön",lblYear:"År",lblReg:"Region",
  allAges:"Alla åldrar",sexT:"Totalt",sexM:"Män",sexK:"Kvinnor",
  // Diagnosis-type (psych) / medication-class (antidep) selector —
  // viewOverTid()/viewKarta() (js/views.js), only shown for those two
  // indicators. typeAll is the default ("all six/five summed" — see
  // PSYCH_TYPES/MED_TYPES and rebuildREAL_PSYCH()'s docstring, js/data.js).
  // psychMedTypes is one shared dictionary (keys never collide — psych's
  // six and antidep's five are each their own distinct set of names) so
  // views.js doesn't need to know which of two objects to read from.
  lblType:"Typ",
  typeAll:"Alla typer",
  psychMedTypes:{
    substance_use:"Missbruk och beroende",
    psychosis:"Psykos",
    depression_mood:"Depression och förstämning",
    anxiety_stress:"Ångest och stress",
    eating_disorders:"Ätstörningar m.fl.",
    adhd_childhood:"ADHD och barndomsdebut",
    antidepressants:"Antidepressiva",
    adhd_med:"ADHD-läkemedel",
    antipsychotics:"Antipsykotika",
    anxiety_med:"Ångestdämpande",
    sleep_med:"Sömnmedel",
  },
  crude:"Ojusterat",std:"Åldersstandardiserat",
  // Shown only when real data is active AND stdCapable(k) is false
  // (js/data.js) — psych/antidep are real-active and DO standardise once
  // SCB population data is loaded; every other real indicator's own
  // source doesn't cover enough age bands for it regardless.
  stdDisabledTip:"Verkliga siffror saknar tillräcklig åldersuppdelning för att åldersstandardiseras.",
  // Shown on viewOverTid specifically (not Karta, which has no age
  // selector) when the indicator COULD standardise but a single age band
  // is picked instead of "Alla åldrar" — standardising one band against
  // itself is meaningless, so the toggle would otherwise silently do
  // nothing while still looking clickable.
  stdAgeOnlyTip:"Åldersstandardisering gäller bara ”Alla åldrar” — välj det för att se effekten.",
  dotTitle:"Alla 21 regioner",dotSub:"Sorterat · 95 % konfidensintervall. Överlappande intervall är ingen rangordning.",
  ageTitle:"Genom livet",ageSub:"mot rikets band",
  noAgeData:"Ingen åldersuppdelning finns för den här indikatorn — se noten nedan.",
  timeTitle:"Över tid",
  natLine:"Riket",
  winLbl:y=>`${y-2}–${y+2}`,   // y is the window's MIDPOINT (matches midpoint_year everywhere real data is keyed), not its end. No "fönster"/"window" prefix — the dash range already reads as a period, and the Over time tab's own year dropdown shows the same range unprefixed.
  suppLbl:"Undertryckt, färre än 10 fall per fönster:",
  surveyEnd:"enkäten slutar vid 84",
  breakLbl:"nytt mått",
  eventPandemic:"pandemi",
  eventHlvBreak:"HLV-mätningen ändrad",
  spreadNote:(s,mode)=>`Spridningen mellan högsta och lägsta region är <b>${s} %</b> av rikets nivå. ${mode?"Byt till ojusterat och se hur mycket ålderstrukturen lägger till.":"Byt till åldersstandardiserat och se hur mycket som är ålderstruktur."}`,
  notNum:"Vad talet inte är.",
  notNumB:{
    antidep:"Räknar personer som hämtat ut ett recept, oavsett förskrivare. Ingen diagnos, och det stiger både när behandlingen förbättras och när hälsan försämras. \"ADHD-läkemedel\" är läkemedelsklassen \"centralt verkande sympatomimetika\" (ATC N06BA) — i praktiken det som skrivs ut vid ADHD i Sverige, men inte det WHO:s klassificering kallar den.",
    psych:"Räknar endast specialistvård. Det mesta av vanlig depression sköts i primärvården och syns inte här alls. \"Ätstörningar m.fl.\" är ICD-10-kapitlet F50–F59 (beteendestörningar med fysiologiska orsaker) — ätstörningar är den största delen, men kapitlet omfattar även bl.a. sömnstörningar. \"ADHD och barndomsdebut\" är kapitlet F90–F98 — ADHD är den största delen, men kapitlet omfattar även bl.a. uppförandestörningar och tics.",
    selfharm:"Räknar vårdtillfällen, inte personer. Y10–Y34 redovisas tillsammans med X60–X84 eftersom kodning av avsikt driver mellan regioner.",
    suicide:"Femårsfönster. Antal under 10 per fönster redovisas inte; talet publiceras ändå.",
    distress:"Självrapporterat, 16–84 år. Redovisas i fyraårsfönster (två sammanslagna enkätomgångar) för regional tillförlitlighet; ingen åldersuppdelning finns i regiontabellen.",
    sjukfranvaro:"Andel av pågående sjukfall, inte andel av befolkningen. Räknar sjukfall, inte personer med psykisk ohälsa i stort — och mäter inte behandling eller diagnos i vården."
  },
  dl:"Ladda ner serien",
  profileLead:"Samlad profil för regionens samtliga indikatorer, demografi, förändring över tid och jämförelse med liknande regioner.",
  peers:"Jämförs med liknande regioner (ålderstruktur och inkomst):",
  rDistress:"Svår ängslan/oro",rTreated:"Behandlade",rPsych:"Specialistpsykiatri",rSelfharm:"Slutenvård självskada",rSuicide:"Suicid",rSjukfranvaro:"Sjukskrivning (F43)",
  rPop:"Invånare",rDensity:"Invånare per km²",rLowEdu:"Låg utbildningsnivå",
  rContextTitle:"Samhälle och demografi",rContextSub:"Befolkningsmått vid sidan av hälsodata (Kolada)",
  vsPeers:"Liknande regioner",notDiff:"Skillnaden går inte att skilja från noll.",
  higher:"Högre än liknande regioner.",lower:"Lägre än liknande regioner.",
  gapPos:"Regionens läge: behov mot vårdrespons",gapPosU:"avvikelse från genomsnittligt samband",
  scatterBelowKey:"Störst avstånd under sambandet",scatterAboveKey:"Störst avstånd över sambandet",
  behovLead:"Rapporterat behov jämfört med registrerad vårdrespons, region för region.",
  behovOpen:"Öppna Behov & vård →",
  changed:"Vad har rört sig",changedU:(a,b)=>`${a} → ${b} · förändring med intervall`,
  withinCI:"inom intervallet",
  chgNote:(n,total)=>`<b>${n} av ${total||4} förändringar ligger inom konfidensintervallet</b> och kan bero på slumpmässig variation (visas nedtonade).`,
  methodH:"Så är siffrorna framtagna",
  mManifestH:"Källornas aktualitet och hämtningsdatum (Data Vintage)",
  mManifestLead:"Varje hämtskript i pipelinen registrerar automatiskt sitt hämtningsdatum, ursprung och täckning i manifestet. Här framgår exakt hur färsk varje siffra är och hur den har hämtats.",
  mColInd:"Dataserie / Mått",mColSource:"Ursprungskälla & register",mColFetched:"Hämtad (UTC)",mColCoverage:"Tidsperiod i data",mColScript:"Hämtskript",mColStatus:"Status",
  mColGeo:"Geografi",mColYears:"Tidsperiod",mColSplits:"Uppdelning",yes:"Ja",no:"Nej",splitAge:"Ålder",splitSex:"Kön",
  mStatusReal:"Verklig data",mStatusSynth:"Syntetisk fallback",mStatusNoFetch:"Saknar öppet API",
  mRecordsCount:n=>`${n.toLocaleString("sv-SE")} rader`,
  mIndicator:"Indikator",mSource:"Källa",mFrom:"Serie från",mGrain:"Nivå",mLimit:"Det viktigaste förbehållet",
  mRows:{
    distress:["Region, ~4-årsfönster","Endast 16–84 år. Ingen åldersuppdelning i regiontabellen; fönstren är ojämnt fördelade, inte en fast takt."],
    antidep:["Region","Registret startade juli 2005; helår från 2006. Uthämtning, inte diagnos."],
    psych:["Region","Endast specialistvård (SVOV-definitionen från 2008). Primärvård ingår inte."],
    selfharm:["Region","Från 2008. Vårdtillfällen, inte personer. Y10–Y34 följer med."],
    suicide:["Region, 5-årsfönster","Från 1997 nationellt; fönster från 2001. Antal <10 undertrycks."],
    sjukfranvaro:["Region","Från 2005, månadsvis genomsnitt per år. Andel av pågående sjukfall med diagnos F43, inte en befolkningsandel."]
  },
  mProse:{
    a:"Tre instrument, inte ett",
    b:"Enkäten frågar människor direkt, registren räknar dem som nått vården, dödsorsaksregistret missar ingen. Instrumenten är blinda på olika ställen, och det är därför avståndet mellan dem betyder något. Ett konkret exempel: enkäten slutar vid 84 års ålder, och landets högsta suicidtal ligger bland män 85 och äldre. Gruppen med störst risk är osynlig i varje mått på självrapporterad ohälsa. Sjukskrivning läggs till som ett fjärde, annorlunda instrument: ett mått på samhällelig påverkan, inte på psykisk ohälsa i sig.",
    c:"Åldersstandardisering",
    d:"Regionernas åldersstruktur skiljer sig kraftigt. Ett ojusterat tal för något åldersberoende är till stor del en karta över åldersstruktur. Båda versionerna publiceras, med reglaget synligt.",
    e:"Osäkerhet och små tal",
    f:"Varje regionalt tal bär sitt 95-procentiga intervall. Suicid redovisas i femårsfönster på regionnivå, och fönster med färre än tio fall redovisas utan antal. Raden finns kvar: en saknad rad ser ut som saknade data, inte som en skyddad uppgift.",
    g:"Det här kan siffrorna inte säga",
    h:"Patientregistret innehåller endast specialistvård, så det mesta av vanlig depression saknas, och saknas olika mycket i olika regioner. Detta är områdesstatistik, inte utsagor om enskilda personer. Incidens går inte att räkna fram ur aggregerade data."
  },
  mapTitle:"Regionkarta",
  mapNote:(real)=>real
    ?"Färgstyrkan visar nivå för vald indikator. Kartan visar verklig geografi — värdena är härledda direkt från regionala registerdata."
    :"Färgstyrkan visar nivå för vald indikator, 2024. Kartan är själva geografin — värdena är fortfarande syntetiska.",
  mapPicked:"vald region",mapOpen:"Öppna länsprofilen",
  trendWith:"följer riket",trendAgainst:"mot rikets riktning",
  trendNote:(a,b)=>`Peka på en region för pil ↑/↓/→: förändring ${a}→${b} mot intervallet, och om den följer eller går mot rikets rörelse.`,
  cmpToggle:"⇄ Jämför två kartor",
  zoomIn:"Zooma in kartan",zoomOut:"Zooma ut kartan",
  chartFullscreen:"Visa diagrammet i helskärm",
  chartFsClose:"Stäng helskärm",
  chartFsHint:"Klicka på en punkt, region eller stapel för dess siffror",
  chartFsPng:"Ladda ner PNG", chartFsPngLbl:"PNG",
  chartFsCsv:"Ladda ner CSV", chartFsCsvLbl:"CSV",
  histTitle:"Fördelning mellan regioner",
  histSub:"Antal regioner per nivåband. Visar spridningen, inte vilken region som är vilken.",
  histCount:"antal regioner",
  helpA:"Självmordslinjen 90101",helpB:"öppet dygnet runt, alla dagar",helpC:"1177 för vårdrådgivning",
  footA:"Utkast. Byggd på den öppna dataarkitektur som utvecklats för Svenska barnhälsoobservatoriet. Ett fristående projekt, inte knutet till barnhalsovard.se.",
  footB:"Varje siffra på den här sidan är genererad för att visa en design. Ingen är en mätning och ingen ska citeras. Källhänvisningarna beskriver var de riktiga serierna finns.",
  footBPartial:(n,total,realNames,synthNames,synthN)=>`${n} av ${total} indikatorer — ${realNames} — bygger nu på verklig, öppen statistik och kan citeras med respektive källhänvisning. Bara ${synthNames} är fortfarande genererad${synthN>1?"e":""} för att visa en design; den siffran är inte en mätning.`,
  footBAll:(total,realNames)=>`Alla ${total} indikatorer — ${realNames} — bygger nu på verklig, öppen statistik och kan citeras med respektive källhänvisning.`
},
en:{
  word:"Kurvan", sub:"Mental health in Sweden",
  tabs:{laget:"The picture",over_tid:"Over time",karta:"Map",behov:"Need & care",sjukskrivning:"Sickness absence",policy_news:"Policy & News",kon:"Comparison by sex",alder:"Comparison by age",sammanhang:"Context",vantetider:"Waiting times, BUP",hbsc:"School health habits",metod:"Method",regioner:"County profile"},
  comingT:"Under construction",
  comingB:"This page is described in the observatory's plan but not built yet in this prototype.",
  ctxLead:"Population and societal data alongside the mental-health measures — not merged into one score. A relationship shown here does not establish a cause.",
  ctxInd:{pop_density:"Residents per square kilometre",education_low_pct:"Share with low education level"},
  ctxCaveat:"A region's value is an unweighted mean of its municipalities, not population-weighted. Source: Kolada, 2023.",
  observationNoteL:"Four windows on the same reality",
  observationNoteB:"When surveys show rising self-reported distress, specialist care volumes do not track in lockstep; meanwhile, stress-related sickness absence and the most severe outcomes follow entirely distinct trajectories. These divergences reflect how lived experience, healthcare capacity, preventive safety nets, and workplace strain capture four separate dimensions of the same societal challenge.",
  vantetiderLead:"Waiting time to a first visit in child and adolescent psychiatry (BUP), median days among completed visits. A narrow measure of accessibility — not of care quality, or of how large the need is.",
  vantetiderNoteL:"Read this first",
  vantetiderCaveat:"A rolling twelve-month window, not a multi-year trend — the source only keeps the most recent period. Updated by hand, not automatically, so figures can lag. The median covers only completed first visits — a low value can mean short waits, or just that the easiest cases have finished so far.",
  vantetiderInd:"Waiting time to first visit",
  vantetiderNoData:name=>`${name}: no figure this month — too few completed visits to publish.`,
  vantetiderClinicsInd:"BUP clinics",
  vantetiderClinicsSentence:n=>n===1?"1 BUP clinic listed in this county.":`${n} BUP clinics listed in this county.`,
  vantetiderClinicsListH:"Clinics in this county",
  vantetiderClinicsEmpty:"No BUP clinics listed for this region on 1177.se.",
  vantetiderClinicsSrc:"1177.se, Hitta vård (find care). A snapshot — not a live-updating source; clinics open, close, and change address.",
  vantetiderClinicsNoAddr:"No address listed",
  partialTag:"(partial year)",
  partialYearNote:(y,m)=>`<b>${y} is a partial year.</b> Only ${m} of 12 months published so far by Försäkringskassan — don't compare it straight against a full prior year.`,
  hbscLead:"Share of 11-, 13- and 15-year-olds who report feeling low at least once a week over the past six months. One measure among several in the Health Behaviour in School-aged Children (HBSC) survey — not a combined measure of children's mental health.",
  hbscNoteL:"Read this first",
  hbscCaveat:"A single reading, not a trend — the source has only one regional survey window published so far (2021–2022). Skolbarns hälsovanor asks about eight different complaints; this shows only one of them (\"felt low\"). No combined-sex figure exists in the source.",
  hbscInd:"Felt low at least weekly",
  hbscNotNumB:"Self-reported in a survey of 11-, 13- and 15-year-olds, not a clinical diagnosis or contact with care. Counts the share who answered \"almost every day\" or \"more than once a week\" to a single question.",
  monthsShort:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  legendRankNote:"Regions are split into five equal-sized groups by value — not equal-width ranges.",
  legendTiers:["Lowest","Lower","Middle","Higher","Highest"],
  langBtn:"SV", themeD:"Dark", themeL:"Light",
  copyLink:"Copy link", linkCopied:"Link copied", linkCopyFailed:"Couldn't copy",
  stamp:"Data to 2024 · updated Aug 2026",
  loadingRemaining:pending=>`Loading remaining data sources… (${pending} of 10 left)`,
  synthT:"Synthetic data", synthB:"Every figure on this page is generated. It contains no real statistics.",
  synthPartialT:"Mostly real data",
  // n/total/realNames/synthNames/synthN come from realSummary() (views.js),
  // computed from IND + isRealActive() on every render — so this sentence
  // can't quietly go stale the way a hand-typed "four of five" already did
  // once (it omitted sjukfranvaro after that indicator went real).
  synthPartialB:(n,total,realNames,synthNames,synthN)=>`${n} of ${total} indicators now draw on real, open statistics: ${realNames}. Only ${synthNames} ${synthN>1?"are":"is"} still generated — see the label on every chart.`,
  // synthN===0 (every indicator real) used to fall through to synthPartialB
  // anyway, with an empty synthNames — "Only  is still generated" — since
  // that sentence was written assuming there's always at least one
  // synthetic indicator left to name. This is the complete-sentence
  // version for when there genuinely isn't one.
  synthAllT:"Real data",
  synthAllB:(total,realNames)=>`All ${total} indicators now draw on real, open statistics: ${realNames}.`,
  realLbl:"real data", synthLbl:"synthetic data",
  realCaveat:{
    selfharm:"Real figures cover ages 12–17 only, five-year windows.",
    suicide:"Real figures now cover every age, five-year windows. Counts under 10 per window are withheld more often at the youngest and oldest age bands, where deaths are rare — the rate (per 100,000) is still shown either way.",
    psych:"Split into six diagnosis types, annual, every age and sex — specialist care only. \"Eating disorders etc.\" and \"ADHD and childhood-onset\" are broader ICD-10 chapters than their names suggest — see the type picker and the note below.",
    distress:"The source has no age breakdown at all; \"All ages\" is the only option. Renamed from \"Poor mental wellbeing\" — that category stopped being published after 2015-2018.",
    sjukfranvaro:"Real figures since 2005, monthly average per year. No age breakdown.",
    antidep:"Split into five medication classes, every age and sex, annual since 2006 — but measures dispensed prescriptions, not diagnosis; see the type picker and the note below."
  },
  statSentence:{
    selfharm:(n)=>`${n} per 100,000 were hospitalised for self-harm.`,
    suicide:(n)=>`${n} per 100,000 died by suicide.`,
    psych:(n)=>`${n} per 100,000 had contact with specialist psychiatric care.`,
    distress:(n)=>`${n}% reported severe anxiety, worry or dread.`,
    antidep:(n)=>`${n} per 1,000 were dispensed antidepressants.`,
    sjukfranvaro:(n)=>`${n}% of ongoing sickness-benefit cases had a stress-reaction diagnosis.`,
    bup_vantetid:(n)=>`The median wait for a first visit was ${n} days.`,
    hbsc_felt_low:(n)=>`${n}% reported feeling low at least once a week.`,
    pop_density:(n)=>`This region has ${n} residents per km².`,
    education_low_pct:(n)=>`${n}% of residents 25–64 have a low education level.`
  },
  realNoteL:"What's actually real here",
  // realNames leads the sentence here (unlike synthPartialB/footBPartial,
  // where it follows a colon) — capitalise just its first letter back up.
  realNoteOn:(n,total,realNames,synthNames,synthN)=>`${realNames.charAt(0).toUpperCase()+realNames.slice(1)} now ${n>1?"run":"runs"} on real, open data, fetched by prototype/pipeline/. Only ${synthNames} ${synthN>1?"have":"has"} no fetcher anywhere in this project and stay${synthN>1?"":"s"} generated — see the label on every chart.`,
  realNoteAll:(realNames)=>`${realNames.charAt(0).toUpperCase()+realNames.slice(1)} now run on real, open data, fetched by prototype/pipeline/.`,
  realNoteOff:"No indicator on this page is real data yet. prototype/pipeline/ can fetch real figures for severe anxiety/worry, specialist psychiatric care, self-harm and suicide; run the fetchers, then build_kurvan_data.py, to switch them on.",
  legend:[["survey","The survey","asks people directly"],["reg","The registers","count those who reached care"],["mort","The death register","misses nobody"]],
  introLabel:"About Kurvan",
  introLead:"Kurvan tracks population-level mental-health indicators for Sweden — self-harm, suicide, psychiatric care, medication, sickness absence, and more — built from official government statistics (Socialstyrelsen, Försäkringskassan, Folkhälsomyndigheten, SCB). It's meant to show how these measures move over time and across regions, not to diagnose, predict, or rank any person, region, or municipality.",
  introHow:["Use the tabs on the left to explore different views: trends over time, a map by region, waiting times, and more.","Most tabs let you filter by region, age, sex, and year, and switch between crude and age-standardised rates.","A tag on each chart shows whether it's real published data or a clearly labelled synthetic placeholder — see the Method tab for exactly what's real."],
  introCrisisLead:"Need to talk to someone now?",
  kick:"This week's exhibit",
  h1:"The age most likely to self-harm is not the age most likely to die",
  hp:"Self-harm admissions peak before twenty-five and are highest among young women. Suicide mortality climbs across the whole life course and is highest among the oldest men. Nearly all public attention sits on the first curve.",
  twinT:"Two curves, one population",
  shTitle:"Hospitalised for self-harm", suTitle:"Died by suicide",
  perK:"per 100 000", women:"women", men:"men",
  peakSh:"women 15–24", peakSu:"men 85+",
  gapTitle:"Reported need against healthcare response",
  gapUnit:"21 regions · adults · 2024 · two independent instruments",
  gapX:"reporting severe anxiety, worry or dread, % (survey)",
  gapY:"antidepressants dispensed, per 1,000 (register)",
  gapLine:"average association between need and response",
  causalNote:"A relationship is not a cause. Regions differ for many reasons this chart does not show.",
  disagreeTitle:"Reported distress against care contact",
  disagreeUnit:y=>`21 regions · all ages · ${y}`,
  // gapX (above) already is the distress/survey axis — reused as-is for this
  // scatter's x-axis, since it's the exact same measure. Only the y-axis
  // (care contact, not antidepressants) needs its own label.
  disagreeY:"in specialist psychiatric care, per 100,000 (register)",
  disagreeCaveat:"Two independent measures of the same broad problem: self-reported anxiety (survey) and recorded contact with specialist psychiatric care (register). A relationship doesn't say why they diverge for a given region — that could mean care isn't being reached, isn't being sought, or that the data itself is incomplete.",
  gapPiece:{tag:"Need and response",inst:"reg",h:"Widest distance between need and response",p:"The region with the largest distance between reported need and recorded care response, 2024.",numl:"widest distance, 2024"},
  gapSelTag:"Selected region",
  gapSelAbove:(xv,yv,resAbs)=>`${xv} report severe anxiety here; ${yv} are dispensed — ${resAbs} more than the average association between need and response would suggest.`,
  gapSelBelow:(xv,yv,resAbs)=>`${xv} report severe anxiety here; ${yv} are dispensed — ${resAbs} fewer than the average association between need and response would suggest.`,
  gapSelNuml:"vs. average association · 2024",
  pieces:[
    {tag:"Life course",inst:"mort",h:"The oldest men",p:"Suicide among men 85+ is the country's highest rate. The survey stops at 84, so the group appears in no measure of self-reported health.",numl:"per 100,000 · men 85+"},
    {tag:"Prescribing",inst:"reg",h:"Young women, 20 years of increase",p:"Antidepressants dispensed to women 15–24 since the register began in 2006.",numl:"2006 → 2024 · women 15–24"}
  ],
  ind:{distress:"Severe anxiety, worry or dread",antidep:"Antidepressants dispensed",psych:"Specialist psychiatric care",selfharm:"Hospitalised for self-harm",suicide:"Died by suicide",sjukfranvaro:"Sickness absence, stress reaction (F43)"},
  fkLead:"Share of ongoing sickness-benefit cases with a stress-reaction (F43) diagnosis — a societal/functional impact measure, not a direct measure of mental health and not a cost estimate.",
  konLead:"Severe anxiety/worry, specialist psychiatric care and sickness absence are all published broken down by sex in their sources — this compares women and men over time for each measure, national figures.",
  konCaveat:"Hospitalised for self-harm and died by suicide aren't here: those sources are five-year rolling windows around a midpoint year, not annual figures like the other three — and would need their own card layout, not just adding into this one.",
  youthTitle:"Youth: care contact, ages 15-24",
  youthUnit:"ages 15-24 · national · by sex",
  youthDistressCtx:"The source has no age breakdown — not a 15-24 figure.",
  alderLead:"Specialist psychiatric care is the only measure published broken down by age across the whole lifespan in its source — this compares children, adults and elderly over time, national figures.",
  alderCaveat:"The age groups follow the register's own age bands, not an exact cut at 18: \"adults\" here means 15–64, which includes 15–17-year-olds alongside adults. The other measures aren't here: their sources either have no age breakdown at all, or cover only the teenage years (ages 12–19) and nothing for adults or elderly.",
  ageChild:"Children (0–14)",ageAdult:"Adults (15–64)",ageElderly:"Elderly (65+)",
  lblInd:"Indicator",lblAge:"Age band",lblSex:"Sex",lblYear:"Year",lblReg:"Region",
  allAges:"All ages",sexT:"Total",sexM:"Men",sexK:"Women",
  lblType:"Type",
  typeAll:"All types",
  psychMedTypes:{
    substance_use:"Substance use",
    psychosis:"Psychosis",
    depression_mood:"Depression and mood",
    anxiety_stress:"Anxiety and stress",
    eating_disorders:"Eating disorders etc.",
    adhd_childhood:"ADHD and childhood-onset",
    antidepressants:"Antidepressants",
    adhd_med:"ADHD medication",
    antipsychotics:"Antipsychotics",
    anxiety_med:"Anxiety medication",
    sleep_med:"Sleep medication",
  },
  crude:"Crude",std:"Age-standardised",
  stdDisabledTip:"Real figures don't cover enough age bands to be age-standardised.",
  stdAgeOnlyTip:"Age-standardisation only applies to “All ages” — pick that to see the effect.",
  dotTitle:"All 21 regions",dotSub:"Sorted · 95% confidence intervals. Overlapping intervals are not a ranking.",
  ageTitle:"Across the life course",ageSub:"against the national band",
  noAgeData:"No age breakdown exists for this indicator — see the note below.",
  timeTitle:"Over time",
  natLine:"Sweden",
  winLbl:y=>`${y-2}–${y+2}`,   // y is the window's MIDPOINT (matches midpoint_year everywhere real data is keyed), not its end. No "fönster"/"window" prefix — the dash range already reads as a period, and the Over time tab's own year dropdown shows the same range unprefixed.
  suppLbl:"Withheld, fewer than 10 cases per window:",
  surveyEnd:"the survey stops at 84",
  breakLbl:"measure revised",
  eventPandemic:"pandemic",
  eventHlvBreak:"HLV measure revised",
  spreadNote:(s,mode)=>`The spread between the highest and lowest region is <b>${s}%</b> of the national level. ${mode?"Switch to crude and see how much age structure adds.":"Switch to age-standardised and see how much of it is age structure."}`,
  notNum:"What this number is not.",
  notNumB:{
    antidep:"Counts people who collected a prescription, from any prescriber. Not a diagnosis, and it rises when treatment improves as well as when health worsens. \"ADHD medication\" is the drug class \"centrally acting sympathomimetics\" (ATC N06BA) — in practice what's prescribed for ADHD in Sweden, but not what WHO's own classification calls it.",
    psych:"Counts specialist care only. Most ordinary depression is managed in primary care and does not appear here at all. \"Eating disorders etc.\" is ICD-10 chapter F50-F59 (behavioural syndromes with physiological disturbance) — eating disorders are the largest part, but the chapter also covers sleep disorders and others. \"ADHD and childhood-onset\" is chapter F90-F98 — ADHD is the largest part, but the chapter also covers conduct disorders, tics and others.",
    selfharm:"Counts admissions, not people. Y10–Y34 is carried alongside X60–X84 because coding of intent drifts between regions.",
    suicide:"Five-year windows. Counts below 10 per window are withheld; the rate is still published.",
    distress:"Self-reported, ages 16–84. Published in four-year windows (two survey waves pooled for regional reliability); the region table has no age breakdown at all.",
    sjukfranvaro:"Share of ongoing sickness-benefit cases, not a share of the population. Counts sick-leave cases, not people with poor mental health in general — and doesn't measure treatment or diagnosis in healthcare."
  },
  dl:"Download this series",
  profileLead:"Consolidated profile of all indicators, demographics, change over time and comparison with peer regions for the selected county.",
  peers:"Compared with peer regions (age structure and income):",
  rDistress:"Severe anxiety",rTreated:"Treated",rPsych:"Specialist care",rSelfharm:"Self-harm care",rSuicide:"Suicide",rSjukfranvaro:"Sickness absence (F43)",
  rPop:"Residents",rDensity:"Residents per km²",rLowEdu:"Low education level",
  rContextTitle:"Societal context and demographics",rContextSub:"Population measures alongside health data (Kolada)",
  vsPeers:"Peers",notDiff:"Difference not distinguishable from zero.",
  higher:"Higher than peers.",lower:"Lower than peers.",
  gapPos:"Where the region sits: need vs. response",gapPosU:"residual from the average association",
  scatterBelowKey:"Furthest below the average association",scatterAboveKey:"Furthest above the average association",
  behovLead:"Reported need compared with recorded healthcare response, region by region.",
  behovOpen:"Open Need & care →",
  changed:"What moved",changedU:(a,b)=>`${a} → ${b} · change with intervals`,
  withinCI:"within interval",
  chgNote:(n,total)=>`<b>${n} of ${total||4} changes are within the confidence interval</b> and may be due to statistical noise (shown greyed).`,
  methodH:"How these figures were made",
  mManifestH:"Data Vintage & Fetch Manifest",
  mManifestLead:"Each pipeline fetcher automatically records its fetch timestamp, origin, and coverage directly to the manifest. This shows exactly how current every number is without asking.",
  mColInd:"Dataset / Measure",mColSource:"Source registry & Agency",mColFetched:"Fetched (UTC)",mColCoverage:"Time coverage",mColScript:"Fetcher script",mColStatus:"Status",
  mColGeo:"Geography",mColYears:"Time period",mColSplits:"Breakdowns",yes:"Yes",no:"No",splitAge:"Age",splitSex:"Sex",
  mStatusReal:"Real data",mStatusSynth:"Synthetic fallback",mStatusNoFetch:"No open API",
  mRecordsCount:n=>`${n.toLocaleString("en-US")} rows`,
  mIndicator:"Indicator",mSource:"Source",mFrom:"Series from",mGrain:"Grain",mLimit:"The caveat that matters most",
  mRows:{
    distress:["Region, ~4-year windows","Ages 16–84 only. No age breakdown in the region table; windows are unevenly spaced, not a fixed cadence."],
    antidep:["Region","Register began July 2005; full years from 2006. Dispensing, not diagnosis."],
    psych:["Region","Specialist care only (SVOV definition from 2008). Primary care not included."],
    selfharm:["Region","From 2008. Admissions, not people. Y10–Y34 carried alongside."],
    suicide:["Region, 5-year windows","From 1997 nationally; windows from 2001. Counts <10 withheld."],
    sjukfranvaro:["Region","From 2005, monthly average per year. Share of ongoing sickness-benefit cases with diagnosis F43, not a share of the population."]
  },
  mProse:{
    a:"Three instruments, not one",
    b:"The survey asks people directly, the registers count those who reached care, the death register misses nobody. The instruments are blind in different places, which is why the distance between them means something. One concrete example: the survey stops at age 84, and the country's highest suicide rate sits among men 85 and older. The group at greatest risk is invisible to every measure of self-reported health. Sickness absence is added as a fourth, different instrument: a measure of societal impact, not of mental health itself.",
    c:"Age standardisation",
    d:"Regional age structures differ a great deal. A crude figure for anything age-related is largely a map of age structure. Both versions are published, with the toggle visible.",
    e:"Uncertainty and small counts",
    f:"Every regional figure carries its 95% interval. Suicide is reported in five-year windows at region level, and windows with fewer than ten cases are published without a count. The row stays: a missing row reads as missing data, not as a protected one.",
    g:"What these figures cannot tell you",
    h:"The patient register holds specialist care only, so most ordinary depression is missing, and missing unevenly between regions. These are area statistics, not statements about individuals. Incidence cannot be derived from aggregate data."
  },
  mapTitle:"Region map",
  mapNote:(real)=>real
    ?"Colour strength shows the level of the selected indicator. The map shows real geography — values are derived directly from regional register data."
    :"Colour strength shows the level of the selected indicator, 2024. The map itself is real geography — the values are still synthetic.",
  mapPicked:"selected region",mapOpen:"Open the county profile",
  trendWith:"tracking the national trend",trendAgainst:"against the national trend",
  trendNote:(a,b)=>`Hover a region for a ↑/↓/→ arrow: change ${a}→${b} against the interval, and whether it tracks or runs against the national move.`,
  cmpToggle:"⇄ Compare two maps",
  zoomIn:"Zoom in on the map",zoomOut:"Zoom out on the map",
  chartFullscreen:"View chart full screen",
  chartFsClose:"Close full screen",
  chartFsHint:"Click a point, region, or bar for its figures",
  chartFsPng:"Download PNG", chartFsPngLbl:"PNG",
  chartFsCsv:"Download CSV", chartFsCsvLbl:"CSV",
  histTitle:"Distribution across regions",
  histSub:"Number of regions per value band. Shows the spread, not which region is which.",
  histCount:"number of regions",
  helpA:"Självmordslinjen 90101",helpB:"open around the clock, every day",helpC:"1177 for care advice",
  footA:"Draft. Built on the open-data observatory architecture developed for the Swedish Child Health Observatory. A separate project, not affiliated with barnhalsovard.se.",
  footB:"Every figure on this page is generated to show a design. None is a measurement, and none should be quoted. The source references describe where the real series live.",
  footBPartial:(n,total,realNames,synthNames,synthN)=>`${n} of ${total} indicators — ${realNames} — now draw on real, open statistics and can be cited with their respective sources. Only ${synthNames} ${synthN>1?"are":"is"} still generated to show a design; that figure is not a measurement.`,
  footBAll:(total,realNames)=>`All ${total} indicators — ${realNames} — now draw on real, open statistics and can be cited with their respective sources.`
}};
