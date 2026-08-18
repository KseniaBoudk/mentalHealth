"use strict";

/* =====================================================================
   3. STATE
   ===================================================================== */
function initLang(){
  try{const n=(navigator.languages&&navigator.languages[0])||navigator.language||"";return String(n).toLowerCase().startsWith("sv")?"sv":"en";}
  catch(e){return "en";}
}
const S={lang:initLang(),theme:"light",tab:"laget",ind:"antidep",age:6,sex:"T",year:2024,std:true,region:"24",mapYear:null,cmpOn:false,cmpInd:null};
// mapYear: null means "latest available for the current indicator" — the
// Karta tab's own year, kept separate from `year` (Utforska's) so scrubbing
// the map slider doesn't silently move the Explore tab's year underneath it.
let t=T[S.lang];
