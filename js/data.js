"use strict";

/* =====================================================================
   1. THE CUBE — deterministic fake values on the REAL sources' skeleton.

   Every structural constraint below is a fact about the actual sources,
   verified against the parent project's fetchers or the registers'
   documentation. The VALUES are generated; the SHAPE of what exists is not.

     dödsorsaksregistret   suicide X60-X84 (+Y10-Y34): from 1997, region,
                           age, sex. County counts are small -> 5-year
                           windows, counts <10 withheld.
     patientregistret      specialist care only; SVOV definition from 2008.
                           Self-harm carries Y10-Y34 alongside on purpose.
     läkemedelsregistret   started July 2005 -> full years from 2006.
                           Dispensing by ATC, region, age, sex.
     HLV (FoHM)            biennial survey, ages 16-84 ONLY. The measure
                           was revised -> the series breaks and must not
                           be joined across the break.
   ===================================================================== */

const AGES = ["0-14","15-24","25-34","35-44","45-54","55-64","65-74","75-84","85+"];
const AGE_SHARE = [.175,.110,.135,.130,.125,.120,.105,.070,.030];

const REGIONS = [
  ["01","Stockholm",       2470000,-0.20,-0.80, 0.55],
  ["03","Uppsala",          400000,-0.40,-0.45, 0.35],
  ["04","Södermanland",     302000, 0.40, 0.30,-0.25],
  ["05","Östergötland",     470000, 0.00, 0.00, 0.15],
  ["06","Jönköping",        370000,-0.10, 0.10, 0.00],
  ["07","Kronoberg",        204000, 0.10, 0.15,-0.10],
  ["08","Kalmar",           247000, 0.20, 0.70,-0.05],
  ["09","Gotland",           61000, 0.30, 0.80,-0.35],
  ["10","Blekinge",         159000, 0.50, 0.60,-0.40],
  ["12","Skåne",           1420000, 0.30,-0.10, 0.20],
  ["13","Halland",          340000,-0.50, 0.20, 0.10],
  ["14","Västra Götaland", 1760000,-0.10,-0.20, 0.30],
  ["17","Värmland",         283000, 0.40, 0.60,-0.15],
  ["18","Örebro",           306000, 0.30, 0.20, 0.05],
  ["19","Västmanland",      280000, 0.40, 0.20,-0.30],
  ["20","Dalarna",          288000, 0.30, 0.65, 0.10],
  ["21","Gävleborg",        287000, 0.60, 0.70,-0.45],
  ["22","Västernorrland",   244000, 0.40, 0.80, 0.20],
  ["23","Jämtland",         132000, 0.20, 0.70, 0.15],
  ["24","Västerbotten",     275000, 0.00, 0.35, 0.50],
  ["25","Norrbotten",       251000, 0.20, 0.80, 0.25]
];
const RBY = Object.fromEntries(REGIONS.map(r=>[r[0],r]));
const NAT = ["SE","Sverige", REGIONS.reduce((a,r)=>a+r[2],0), 0,0,0];

/* Real county borders, not a schematic. Traced from OpenStreetMap contributor
   data (© OpenStreetMap contributors, ODbL — see kurvan.html's map source
   strip) via the okfse/sweden-geojson dataset, equirectangular-projected
   (longitude scaled by cos of Sweden's mean latitude) and reduced to 2
   decimal places. abbr is the real ISO 3166-2:SE county letter code. */
const MAP_VIEWBOX="0 0 6.09 13.69";
const REGION_PATH = {
  "01":{abbr:"AB",d:"M3.02,10.07L3.04,10.02L3.10,10.00L3.10,10.11L3.18,10.13L3.24,9.98L3.40,9.86L3.35,9.77L3.39,9.73L3.50,9.73L3.50,9.66L3.44,9.60L3.44,9.69L3.36,9.66L3.30,9.71L3.24,9.64L3.28,9.59L3.34,9.61L3.54,9.43L3.58,9.33L3.64,9.30L3.70,9.31L3.72,9.26L3.62,9.23L3.65,9.18L3.71,9.20L3.72,9.14L3.64,9.09L3.60,8.97L3.52,8.89L3.47,8.91L3.43,8.99L3.40,9.15L3.29,9.22L3.26,9.28L3.22,9.28L3.11,9.34L3.06,9.33L3.02,9.37L3.03,9.46L2.99,9.58L2.96,9.65L2.91,9.71L2.88,9.81L2.93,10.04L3.02,10.07Z"},
  "03":{abbr:"C",d:"M3.47,8.91L3.41,8.84L3.40,8.78L3.41,8.69L3.34,8.69L3.26,8.57L3.20,8.52L3.18,8.44L3.13,8.45L3.05,8.52L3.02,8.39L2.92,8.41L2.90,8.55L2.85,8.65L2.85,8.73L2.92,8.79L2.93,8.84L2.88,8.98L2.85,8.99L2.83,9.15L2.77,9.20L2.68,9.15L2.65,9.25L2.70,9.37L2.73,9.50L2.82,9.51L2.86,9.54L2.96,9.65L2.99,9.58L3.03,9.46L3.02,9.37L3.06,9.33L3.11,9.34L3.22,9.28L3.26,9.28L3.29,9.22L3.40,9.15L3.43,8.99L3.47,8.91Z"},
  "04":{abbr:"D",d:"M2.73,9.50L2.68,9.53L2.42,9.58L2.41,9.66L2.28,9.68L2.24,9.79L2.18,9.84L2.19,9.91L2.15,9.94L2.11,10.00L2.15,10.05L2.21,10.03L2.32,10.11L2.42,10.21L2.49,10.34L2.58,10.35L2.65,10.40L2.71,10.41L2.79,10.38L2.82,10.30L2.88,10.31L2.96,10.24L3.04,10.12L3.02,10.07L2.93,10.04L2.88,9.81L2.91,9.71L2.96,9.65L2.86,9.54L2.82,9.51L2.73,9.50Z"},
  "05":{abbr:"E",d:"M2.65,10.40L2.58,10.35L2.49,10.34L2.42,10.21L2.32,10.11L2.21,10.03L2.15,10.05L2.11,10.07L2.07,10.16L2.02,10.19L1.95,10.19L1.90,10.23L1.82,10.34L1.73,10.39L1.55,10.81L1.58,10.88L1.63,10.92L1.74,10.94L1.81,10.88L1.86,11.03L1.83,11.12L1.89,11.30L1.91,11.31L2.02,11.32L2.11,11.19L2.17,11.18L2.25,11.22L2.30,11.17L2.32,11.06L2.30,10.96L2.36,10.96L2.42,10.91L2.49,10.91L2.56,10.96L2.60,11.05L2.67,10.83L2.62,10.77L2.65,10.71L2.62,10.60L2.69,10.55L2.65,10.46L2.58,10.41L2.47,10.44L2.39,10.37L2.65,10.40Z"},
  "06":{abbr:"F",d:"M2.07,11.82L2.05,11.73L2.06,11.60L2.11,11.58L2.12,11.53L2.10,11.47L2.13,11.43L2.02,11.32L1.91,11.31L1.89,11.30L1.83,11.12L1.86,11.03L1.81,10.88L1.74,10.94L1.63,10.92L1.58,10.88L1.55,10.81L1.46,11.03L1.45,11.12L1.37,11.17L1.23,11.18L1.24,11.26L1.22,11.32L1.20,11.47L1.14,11.60L1.08,11.68L1.03,11.72L0.94,11.88L0.92,11.93L0.95,12.00L0.99,11.94L1.07,11.92L1.16,11.97L1.17,12.01L1.21,12.05L1.25,12.00L1.29,12.03L1.33,12.00L1.38,11.99L1.42,12.02L1.46,12.12L1.51,12.14L1.53,12.08L1.52,12.01L1.53,11.89L1.68,11.82L1.73,11.81L1.79,11.88L1.90,11.84L1.92,11.80L2.01,11.80L2.07,11.82Z"},
  "07":{abbr:"G",d:"M2.07,11.82L2.01,11.80L1.92,11.80L1.90,11.84L1.79,11.88L1.73,11.81L1.68,11.82L1.53,11.89L1.52,12.01L1.53,12.08L1.51,12.14L1.46,12.12L1.42,12.02L1.38,11.99L1.33,12.00L1.29,12.03L1.25,12.00L1.21,12.05L1.17,12.13L1.05,12.17L1.03,12.20L1.03,12.33L1.09,12.48L1.09,12.54L1.12,12.61L1.15,12.61L1.35,12.56L1.39,12.50L1.48,12.51L1.60,12.56L1.69,12.63L1.78,12.65L1.81,12.59L1.86,12.57L1.92,12.59L1.98,12.57L1.99,12.50L2.00,12.48L2.01,12.36L2.00,12.28L2.08,12.21L2.06,12.13L2.18,12.13L2.21,12.08L2.19,12.02L2.13,11.91L2.09,11.88L2.07,11.82Z"},
  "08":{abbr:"H",d:"M2.78,11.69L2.73,11.73L2.73,11.81L2.71,11.83L2.70,11.92L2.62,12.14L2.57,12.16L2.47,12.49L2.47,12.81L2.51,12.80L2.55,12.69L2.58,12.47L2.65,12.23L2.67,12.21L2.69,12.12L2.69,12.07L2.72,12.02L2.74,11.93L2.78,11.81L2.77,11.77L2.78,11.69Z M2.60,11.05L2.56,10.96L2.49,10.91L2.42,10.91L2.36,10.96L2.30,10.96L2.32,11.06L2.30,11.17L2.25,11.22L2.17,11.18L2.11,11.19L2.02,11.32L2.13,11.43L2.10,11.47L2.12,11.53L2.11,11.58L2.06,11.60L2.05,11.73L2.09,11.88L2.13,11.91L2.19,12.02L2.21,12.08L2.18,12.13L2.06,12.13L2.08,12.21L2.00,12.28L2.01,12.36L2.00,12.48L1.99,12.55L2.09,12.53L2.19,12.66L2.27,12.71L2.31,12.70L2.33,12.62L2.38,12.49L2.40,12.39L2.46,12.36L2.45,12.28L2.47,12.23L2.50,12.09L2.49,12.02L2.53,11.98L2.54,11.93L2.50,11.86L2.51,11.74L2.53,11.68L2.59,11.63L2.60,11.56L2.58,11.48L2.57,11.35L2.61,11.35L2.60,11.27L2.50,11.14L2.56,11.10L2.61,11.15L2.64,11.11L2.60,11.05Z"},
  "09":{abbr:"I",d:"M3.58,11.20L3.56,11.12L3.52,11.13L3.49,11.20L3.43,11.23L3.37,11.36L3.29,11.46L3.27,11.53L3.30,11.66L3.26,11.78L3.29,11.81L3.32,11.90L3.31,12.12L3.38,12.05L3.38,11.95L3.42,11.88L3.49,11.82L3.55,11.79L3.53,11.74L3.57,11.67L3.65,11.63L3.64,11.60L3.58,11.59L3.57,11.53L3.59,11.43L3.57,11.41L3.59,11.33L3.65,11.31L3.66,11.25L3.72,11.21L3.68,11.12L3.63,11.14L3.58,11.20Z M3.79,11.05L3.72,11.07L3.70,11.13L3.74,11.18L3.79,11.05Z"},
  "10":{abbr:"K",d:"M2.31,12.70L2.27,12.71L2.19,12.66L2.09,12.53L1.99,12.55L1.98,12.57L1.93,12.57L1.92,12.59L1.86,12.57L1.81,12.59L1.78,12.65L1.69,12.63L1.60,12.56L1.54,12.69L1.56,12.77L1.60,12.80L1.62,12.88L1.61,12.98L1.63,13.03L1.68,13.03L1.71,13.01L1.67,12.89L1.69,12.87L1.79,12.86L1.84,12.88L2.05,12.86L2.08,12.83L2.16,12.88L2.21,12.95L2.25,12.86L2.30,12.78L2.31,12.70Z"},
  "12":{abbr:"M",d:"M1.60,12.56L1.48,12.51L1.39,12.50L1.35,12.56L1.15,12.61L1.12,12.61L1.07,12.62L0.99,12.69L0.89,12.67L0.87,12.59L0.84,12.56L0.80,12.59L0.75,12.57L0.71,12.62L0.76,12.68L0.80,12.77L0.74,12.81L0.72,12.78L0.65,12.76L0.70,12.92L0.77,13.04L0.80,13.15L0.85,13.20L0.85,13.29L0.89,13.31L0.91,13.36L0.90,13.41L0.85,13.46L0.85,13.52L0.88,13.64L1.01,13.69L1.06,13.69L1.18,13.62L1.29,13.60L1.39,13.65L1.43,13.65L1.52,13.51L1.52,13.47L1.44,13.31L1.45,13.22L1.51,13.08L1.61,12.98L1.62,12.88L1.60,12.80L1.56,12.77L1.54,12.69L1.60,12.56Z"},
  "13":{abbr:"N",d:"M0.94,11.88L0.86,11.84L0.86,11.76L0.77,11.73L0.69,11.69L0.66,11.74L0.62,11.73L0.60,11.65L0.61,11.60L0.57,11.55L0.56,11.42L0.45,11.46L0.38,11.45L0.39,11.55L0.38,11.63L0.44,11.58L0.47,11.64L0.51,11.89L0.54,11.99L0.57,12.02L0.59,12.12L0.64,12.14L0.70,12.22L0.70,12.29L0.76,12.39L0.82,12.39L0.85,12.49L0.84,12.56L0.87,12.59L0.89,12.67L0.99,12.69L1.07,12.62L1.12,12.61L1.09,12.54L1.09,12.48L1.03,12.33L1.03,12.20L1.05,12.17L1.17,12.13L1.21,12.05L1.17,12.01L1.16,11.97L1.07,11.92L0.99,11.94L0.95,12.00L0.92,11.93L0.94,11.88Z"},
  "14":{abbr:"O",d:"M0.29,10.98L0.19,10.99L0.20,11.08L0.23,11.10L0.29,11.04L0.29,10.98Z M0.32,10.79L0.22,10.80L0.14,10.91L0.19,10.95L0.22,10.91L0.28,10.94L0.32,10.91L0.32,10.79Z M1.73,10.39L1.67,10.30L1.59,10.31L1.54,10.19L1.49,10.02L1.45,9.99L1.17,9.98L1.10,10.07L1.06,10.19L1.09,10.28L1.02,10.29L0.85,10.22L0.82,10.05L0.78,9.98L0.77,9.90L0.73,9.86L0.69,9.91L0.54,9.82L0.50,9.78L0.45,9.84L0.39,9.79L0.33,9.79L0.26,10.12L0.20,10.15L0.16,10.14L0.16,10.08L0.11,9.94L0.05,9.95L0.01,10.01L0.00,10.08L0.04,10.13L0.06,10.24L0.03,10.30L0.07,10.39L0.07,10.55L0.05,10.67L0.13,10.68L0.18,10.78L0.21,10.79L0.29,10.71L0.33,10.71L0.36,10.84L0.31,10.97L0.32,11.00L0.27,11.16L0.30,11.25L0.28,11.31L0.34,11.35L0.38,11.45L0.45,11.46L0.56,11.42L0.57,11.55L0.61,11.60L0.60,11.65L0.62,11.73L0.66,11.74L0.69,11.69L0.77,11.73L0.86,11.76L0.86,11.84L0.94,11.88L1.03,11.72L1.08,11.68L1.14,11.60L1.20,11.47L1.22,11.32L1.24,11.26L1.23,11.18L1.37,11.17L1.45,11.12L1.46,11.03L1.55,10.81L1.73,10.39Z"},
  "17":{abbr:"S",d:"M1.56,9.00L1.47,8.93L1.42,8.81L1.28,8.77L1.19,8.63L1.13,8.59L1.00,8.35L0.97,8.32L0.93,8.22L0.77,8.04L0.75,7.98L0.65,7.99L0.55,8.02L0.54,8.06L0.56,8.13L0.59,8.28L0.64,8.38L0.69,8.52L0.69,8.64L0.64,8.74L0.66,8.84L0.65,8.92L0.62,8.99L0.55,9.08L0.48,9.14L0.39,9.13L0.35,9.16L0.37,9.27L0.37,9.33L0.34,9.38L0.27,9.41L0.27,9.48L0.32,9.68L0.33,9.79L0.39,9.79L0.45,9.84L0.50,9.78L0.54,9.82L0.69,9.91L0.73,9.86L0.77,9.90L0.78,9.98L0.82,10.05L0.85,10.22L1.02,10.29L1.09,10.28L1.06,10.19L1.10,10.07L1.17,9.98L1.45,9.99L1.49,10.02L1.50,9.74L1.57,9.54L1.57,9.45L1.56,9.35L1.54,9.11L1.51,9.08L1.56,9.03L1.56,9.00Z"},
  "18":{abbr:"T",d:"M2.03,9.15L1.93,9.02L1.76,8.95L1.71,8.94L1.68,9.02L1.56,9.00L1.56,9.03L1.51,9.08L1.54,9.11L1.56,9.35L1.57,9.45L1.57,9.54L1.50,9.74L1.49,10.02L1.54,10.19L1.59,10.31L1.67,10.30L1.73,10.39L1.82,10.34L1.90,10.23L1.95,10.19L2.02,10.19L2.07,10.16L2.11,10.07L2.11,10.00L2.15,9.94L2.19,9.91L2.19,9.90L2.18,9.84L2.18,9.83L2.11,9.74L2.12,9.63L2.17,9.60L2.11,9.41L2.08,9.40L2.09,9.30L2.03,9.15Z"},
  "19":{abbr:"U",d:"M2.18,9.83L2.24,9.79L2.28,9.68L2.41,9.66L2.42,9.58L2.68,9.53L2.73,9.50L2.70,9.37L2.65,9.25L2.68,9.15L2.77,9.20L2.83,9.15L2.85,8.99L2.88,8.98L2.93,8.84L2.92,8.79L2.85,8.73L2.80,8.75L2.74,8.74L2.66,8.83L2.62,8.82L2.54,8.86L2.50,8.93L2.43,8.96L2.36,8.93L2.34,8.87L2.27,8.85L2.20,8.86L2.17,8.89L2.13,9.07L2.07,9.06L2.03,9.15L2.09,9.30L2.08,9.40L2.11,9.41L2.17,9.60L2.12,9.63L2.11,9.74L2.18,9.83Z"},
  "20":{abbr:"W",d:"M1.57,7.44L1.49,7.44L1.17,7.38L1.04,7.13L1.06,7.03L1.02,6.99L0.97,6.99L0.91,6.96L0.79,6.83L0.56,6.76L0.56,6.80L0.49,7.31L0.61,7.45L0.70,7.49L0.83,7.67L0.80,7.83L0.76,7.88L0.75,7.98L0.77,8.04L0.93,8.22L0.97,8.32L1.00,8.35L1.13,8.59L1.19,8.63L1.28,8.77L1.42,8.81L1.47,8.93L1.56,9.00L1.68,9.02L1.71,8.94L1.76,8.95L1.93,9.02L2.03,9.15L2.07,9.06L2.13,9.07L2.17,8.89L2.20,8.86L2.27,8.85L2.34,8.87L2.36,8.93L2.43,8.96L2.50,8.93L2.54,8.86L2.62,8.82L2.54,8.68L2.47,8.62L2.38,8.46L2.47,8.29L2.47,8.24L2.40,8.15L2.35,8.04L2.24,8.01L2.19,7.97L2.14,7.91L2.11,7.79L2.03,7.69L1.90,7.49L1.86,7.54L1.68,7.54L1.66,7.47L1.57,7.44Z"},
  "21":{abbr:"X",d:"M2.92,8.41L2.86,8.34L2.88,8.26L2.86,8.14L2.82,8.09L2.83,7.90L2.85,7.80L2.81,7.73L2.84,7.69L2.80,7.64L2.83,7.55L2.79,7.47L2.79,7.40L2.92,7.33L2.96,7.40L2.99,7.33L2.93,7.31L2.91,7.21L2.91,7.11L2.97,6.97L2.98,6.89L2.85,6.86L2.75,6.86L2.51,6.79L2.38,6.78L2.11,6.68L2.06,6.69L1.98,6.75L2.03,6.88L2.01,6.92L1.87,7.04L1.87,7.19L1.74,7.20L1.67,7.17L1.63,7.22L1.57,7.44L1.66,7.47L1.68,7.54L1.86,7.54L1.90,7.49L2.03,7.69L2.11,7.79L2.14,7.91L2.19,7.97L2.24,8.01L2.35,8.04L2.40,8.15L2.47,8.24L2.47,8.29L2.38,8.46L2.47,8.62L2.54,8.68L2.62,8.82L2.66,8.83L2.74,8.74L2.80,8.75L2.85,8.73L2.85,8.65L2.90,8.55L2.92,8.41Z"},
  "22":{abbr:"Y",d:"M3.83,5.58L3.78,5.44L3.66,5.27L3.53,5.20L3.46,5.18L3.38,5.05L3.09,5.15L2.70,5.08L2.63,5.02L2.58,5.18L2.56,5.30L2.51,5.33L2.40,5.34L2.36,5.33L2.25,5.37L2.29,5.57L2.37,5.66L2.73,6.04L2.59,6.11L2.49,6.25L2.43,6.31L2.23,6.33L2.10,6.38L1.90,6.43L1.81,6.43L1.73,6.45L1.76,6.55L1.75,6.61L1.85,6.74L1.91,6.76L1.98,6.75L2.06,6.69L2.11,6.68L2.38,6.78L2.51,6.79L2.75,6.86L2.85,6.86L2.98,6.89L3.00,6.79L2.93,6.71L2.91,6.63L2.91,6.54L2.95,6.50L3.02,6.60L3.07,6.54L3.15,6.54L3.17,6.49L3.24,6.44L3.20,6.38L3.22,6.33L3.14,6.12L3.18,6.12L3.18,6.21L3.24,6.18L3.28,6.21L3.34,6.15L3.40,6.19L3.45,6.13L3.46,6.04L3.43,6.01L3.50,5.86L3.57,5.88L3.64,5.82L3.70,5.85L3.75,5.72L3.81,5.69L3.83,5.58Z"},
  "23":{abbr:"Z",d:"M1.57,7.44L1.63,7.22L1.67,7.17L1.74,7.20L1.87,7.19L1.87,7.04L2.01,6.92L2.03,6.88L1.98,6.75L1.91,6.76L1.85,6.74L1.75,6.61L1.76,6.55L1.73,6.45L1.81,6.43L1.90,6.43L2.10,6.38L2.23,6.33L2.43,6.31L2.49,6.25L2.59,6.11L2.73,6.04L2.37,5.66L2.29,5.57L2.25,5.37L2.36,5.33L2.40,5.34L2.51,5.33L2.56,5.30L2.58,5.18L2.63,5.02L2.40,4.78L2.32,4.77L2.28,4.68L2.18,4.61L2.16,4.53L2.11,4.56L2.06,4.50L1.95,4.39L1.94,4.31L1.87,4.28L1.83,4.19L1.76,4.16L1.68,4.04L1.51,3.92L1.50,3.92L1.18,4.45L1.40,4.60L1.42,4.83L1.42,4.87L1.34,5.02L1.32,5.03L0.99,4.95L0.87,4.98L0.73,5.08L0.55,5.38L0.50,5.44L0.51,5.58L0.41,5.75L0.52,6.03L0.46,6.11L0.49,6.30L0.46,6.45L0.55,6.70L0.56,6.76L0.79,6.83L0.91,6.96L0.97,6.99L1.02,6.99L1.06,7.03L1.04,7.13L1.17,7.38L1.49,7.44L1.57,7.44Z"},
  "24":{abbr:"AC",d:"M4.89,3.97L4.74,3.87L4.20,3.72L4.01,3.79L3.97,3.83L3.87,3.87L3.80,3.82L3.79,3.77L3.60,3.66L3.54,3.59L3.48,3.59L3.38,3.54L3.29,3.45L3.11,3.38L2.97,3.28L2.69,3.03L2.51,2.96L2.22,2.76L2.04,2.68L2.04,2.76L1.84,2.88L1.60,2.91L1.65,3.19L1.65,3.26L1.61,3.34L1.59,3.57L1.59,3.72L1.52,3.82L1.51,3.91L1.51,3.92L1.68,4.04L1.76,4.16L1.83,4.19L1.87,4.28L1.94,4.31L1.95,4.39L2.06,4.50L2.11,4.56L2.16,4.53L2.18,4.61L2.28,4.68L2.32,4.77L2.40,4.78L2.63,5.02L2.70,5.08L3.09,5.15L3.38,5.05L3.46,5.18L3.53,5.20L3.66,5.27L3.78,5.44L3.83,5.58L3.89,5.53L3.95,5.52L4.00,5.61L4.04,5.57L4.03,5.51L4.09,5.44L4.18,5.37L4.29,5.38L4.30,5.30L4.34,5.28L4.38,5.21L4.47,5.24L4.57,5.05L4.60,4.89L4.67,4.82L4.73,4.73L4.83,4.66L4.90,4.58L4.84,4.55L4.83,4.49L4.79,4.43L4.73,4.41L4.76,4.34L4.72,4.29L4.70,4.20L4.73,4.08L4.79,4.08L4.83,3.98L4.89,3.97Z"},
  "25":{abbr:"BD",d:"M4.89,3.97L4.90,3.89L4.87,3.81L4.94,3.75L4.84,3.64L5.05,3.62L5.10,3.57L5.03,3.54L5.16,3.48L5.26,3.41L5.20,3.37L5.25,3.28L5.23,3.20L5.30,3.19L5.35,3.24L5.47,3.23L5.57,3.28L5.59,3.31L5.72,3.21L5.99,3.25L6.08,3.23L6.09,3.20L6.04,3.09L6.02,2.99L5.96,2.88L5.89,2.83L5.86,2.73L5.85,2.60L5.86,2.56L5.96,2.47L5.96,2.29L6.01,2.22L5.98,2.15L5.87,1.99L5.82,1.88L5.84,1.77L5.89,1.75L5.90,1.62L5.75,1.55L5.81,1.45L5.77,1.30L5.78,1.15L5.86,1.10L5.73,0.99L5.70,0.91L5.62,0.91L5.62,0.82L5.57,0.74L5.36,0.61L5.22,0.56L5.12,0.56L5.04,0.47L4.83,0.35L4.65,0.17L4.57,0.14L4.58,0.07L4.44,0.00L4.20,0.01L4.31,0.13L4.31,0.23L4.26,0.38L4.22,0.43L4.13,0.50L4.26,0.56L4.15,0.67L4.12,0.69L3.91,0.61L3.70,0.53L3.52,0.54L3.42,0.46L3.30,0.50L3.28,0.64L3.30,0.84L3.29,0.88L3.19,1.05L3.17,1.07L2.90,0.93L2.85,1.00L2.66,1.13L2.64,1.16L2.57,1.39L2.51,1.48L2.45,1.51L2.38,1.53L2.34,1.61L2.49,1.84L2.48,1.98L2.30,2.15L2.13,2.44L2.01,2.55L2.04,2.68L2.22,2.76L2.51,2.96L2.69,3.03L2.97,3.28L3.11,3.38L3.29,3.45L3.38,3.54L3.48,3.59L3.54,3.59L3.60,3.66L3.79,3.77L3.80,3.82L3.87,3.87L3.97,3.83L4.01,3.79L4.20,3.72L4.74,3.87L4.89,3.97Z"},
};

function hash(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;} return h/4294967296; }
function gauss(s){ const u1=Math.max(hash("a"+s),1e-9), u2=hash("b"+s); return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2); }

/* inst: survey | reg | mort  -> drives colour everywhere.
   start: first publishable year (a real register fact).
   step: 2 for the biennial survey.
   breakAt: first year of the revised measure (series must not join across).
   window: rolling-window width for sparse mortality counts. */
const IND = {
  distress: {
    inst:"survey", start:2006, step:2, window:4, real:true,
    scale:100, dec:1,
    age:[null,28,22,18,16,14,10,11,null],
    mMul:[null,.72,.74,.76,.78,.80,.84,.86,null],
    kMul:[null,1.26,1.24,1.22,1.20,1.18,1.14,1.12,null],
    needW:0.46, supplyW:0.0, drift:0.016, noise:0.05,
    reg:"Hälsa på lika villkor (FoHM)", regEn:"Hälsa på lika villkor (FoHM)"
  },
  antidep: {
    inst:"reg", start:2006, real:true,
    scale:1000, dec:1,
    age:[8,62,78,92,108,118,124,138,152],
    mMul:[.62,.60,.60,.62,.64,.68,.72,.78,.84],
    kMul:[1.36,1.40,1.40,1.38,1.36,1.32,1.28,1.20,1.13],
    needW:0.28, supplyW:0.42, drift:0.012, noise:0.045,
    reg:"Läkemedelsregistret (ATC N06A)", regEn:"Prescribed drug register (ATC N06A)"
  },
  psych: {
    inst:"reg", start:2008, real:true,
    scale:100000, dec:1,
    age:[14,58,46,38,32,26,20,17,13],
    mMul:[1.24,.82,.86,.88,.90,.92,.94,.96,.98],
    kMul:[.78,1.16,1.13,1.11,1.09,1.07,1.05,1.03,1.02],
    needW:0.20, supplyW:0.72, drift:0.021, noise:0.06,
    reg:"Patientregistret", regEn:"National patient register"
  },
  selfharm: {
    inst:"reg", start:2008, window:5, real:true,
    scale:100000, dec:0,
    age:[18,285,165,120,95,62,38,30,26],
    mMul:[.72,.52,.72,.80,.86,.92,.98,1.02,1.06],
    kMul:[1.26,1.46,1.27,1.20,1.14,1.08,1.02,.98,.94],
    needW:0.42, supplyW:0.10, drift:0.008, noise:0.09,
    reg:"Patientregistret (X60–X84 + Y10–Y34)", regEn:"Patient register (X60–X84 + Y10–Y34)"
  },
  suicide: {
    inst:"mort", start:2001, window:5, real:true,
    scale:100000, dec:1,
    age:[0.6,11,16,19,22,23,22,27,38],
    mMul:[1.30,1.42,1.48,1.52,1.55,1.58,1.62,1.72,1.86],
    kMul:[.66,.56,.50,.46,.44,.42,.38,.30,.24],
    needW:0.30, supplyW:-0.16, drift:-0.004, noise:0.05,
    reg:"Dödsorsaksregistret (X60–X84)", regEn:"Cause of death register (X60–X84)"
  },
  sjukfranvaro: {
    // "fk" (Försäkringskassan) is its own instrument, not "reg": this is a
    // functional/societal-impact measure (share of sick-leave CASES, not a
    // healthcare register or a population rate) — conflating it with the
    // register colour would misrepresent what it counts. See IND docstring.
    inst:"fk", start:2005, real:true,
    scale:100, dec:1,
    // Fabricated fallback only (no real per-age curve exists — see
    // REAL_FK below); nulled at both ends like distress's, since sickness
    // *benefit* cases concentrate in working ages.
    age:[null,14,17,20,22,21,18,14,null],
    mMul:[null,.60,.60,.60,.60,.60,.60,.60,null],
    kMul:[null,1.21,1.21,1.21,1.21,1.21,1.21,1.21,null],
    needW:0.25, supplyW:0.0, drift:0.018, noise:0.07,
    reg:"Försäkringskassan (diagnos F43)", regEn:"Försäkringskassan (diagnosis F43)"
  }
};
const INST_COLOR = { survey:"var(--teal)", reg:"var(--violet)", mort:"var(--oxblood)", fk:"var(--amber)" };
const SUPPRESS_BELOW = 10;

/* Fixed reference events, drawn as vertical markers on calendar-year time
   series (lineChart()'s opts.marks, charts.js — already built, just never
   wired to anything until now). Dates only, no interpretation of what moved
   because of them — that's for whoever reads the chart, not this array.
   Both events below are universal (shown on every indicator's chart whose
   year range covers them) — `ind` exists as a hook to restrict a future
   event to one indicator's own history, unused by either entry today.
   `color`/`anchor` are optional per-event style overrides (see the marks
   renderer in charts.js): default is oxblood, label to the right of the
   line; the HLV entry below overrides both so two events landing close
   together (2018/2020 both fall inside most indicators' ranges) stay
   visually distinct rather than reading as the same kind of marker twice.
   See eventMarks() in views.js, which turns this into a given chart's own
   opts.marks — filtered to events that actually fall inside that chart's
   visible year range. */
const EVENTS = [
  { year: 2020, labelKey: "eventPandemic" },
  // The HLV survey category backing `distress` changed — see
  // fetch_folkhalsodata_hlv.py's docstring: "Nedsatt psykiskt välbefinnande"
  // stopped being published after its 2015-2018 window; "Svår ängslan, oro
  // eller ångest" is what's fetched from 2018 on. Shown as a general
  // reference point on every chart (not just distress's), same as the
  // pandemic marker — not the same mechanism as IND[k].breakAt above (a
  // hypothetical synthetic step this data model supports but no indicator
  // currently uses). Styled distinctly (grey, label to the left) so it
  // doesn't read as a second pandemic marker when the two land close
  // together.
  { year: 2018, labelKey: "eventHlvBreak", color: "var(--ink-2)", anchor: "end" },
];

/* =====================================================================
   1b. REAL DATA — self-harm and suicide, from js/data/real_mh.js.

   That file is generated by prototype/pipeline/{fetch_socialstyrelsen_mh,
   build_kurvan_data}.py from Socialstyrelsen's Statistikdatabasen (the
   Patientregistret and Dödsorsaksregistret registers), the same source
   ../../pipeline/fetch_socialstyrelsen_mh.py uses for the main app. It is
   checked in, so the prototype works out of the box; regenerate it by
   running those two scripts again.

   Only `selfharm` and `suicide` have a real fetcher anywhere in this repo.
   `distress` and `psych` stay on the fabricated generator above — see the
   docstring at the top of this file — because nothing here pulls HLV/FoHM
   survey data; `antidep` has its own real source now too (1f below).

   What the real source actually publishes, and what it does not:
     - county grain only (plus one national row) — never municipality
     - self-harm: ages 12-14 and 15-17 ONLY. Nothing for 18+ — Sweden's
       self-harm hospitalisation register this project reaches is child/
       adolescent-only, unlike synthetic's full curve below.
     - suicide: ALL nine of Kurvan's AGES bands (widened from 15-19-only —
       dodsorsaker's own age dimension always covered every age, that was
       this project's own scope choice, not a source limit; see
       fetch_socialstyrelsen_mh.py's "KURVAN CHANGE 2" for the pooling that
       makes this possible), so suicide is standardisable the same way
       psych/antidep are — see STD_CAPABLE_REAL below.
     - all three sexes (M/K/T) — fetch_socialstyrelsen_mh.py requests
       kon/1,2,3, confirmed live to work on both underlying datasets.
     - five-year rolling windows plotted at the midpoint year, not annual
     - self-harm rates are never suppressed; suicide counts below 10 per
       window are withheld (the rate is still published) — per SEX now,
       so a county's single-sex count is suppressed far more often than
       its combined-sex count was, which is the same disclosure floor
       working as intended on a genuinely smaller sub-population.

   REAL.active is false until someone has actually run the fetcher (an empty
   js/data/real_mh.js ships empty by default-safe). While it's false, cell()/total()
   fall back to the fabricated generator for selfharm/suicide too, exactly
   as they always did — nothing regresses for a reader who never runs
   Python. The per-chart source line (views.js) reads REAL.active to say
   which mode is showing.
   ===================================================================== */
// Was a one-shot IIFE (`const REAL = (() => {...})();`); now a callable
// rebuild — js/shell.js's lazy loader calls rebuildREAL() again once
// js/data/real_mh.js actually lands (it doesn't exist as a static
// <script> in kurvan.html any more, see pipeline/build_kurvan_data.py's
// module docstring for why), reassigning the module-scope `let REAL`
// below. Every reader (cell(), total(), isRealActive(), ...) reads REAL
// by name at call time, not at definition time, so this needs no other
// changes anywhere else in this file.
function rebuildREAL() {
  const rows = (typeof REAL_MH !== "undefined" && Array.isArray(REAL_MH.rows)) ? REAL_MH.rows : [];
  const active = rows.length > 0;

  // Kurvan's ageIdx (into AGES) -> the real age_group label that stands in
  // for it. Every other ageIdx (25-34 through 85+) has no real counterpart
  // and stays null on purpose: see the docstring above.
  // suicide's age_group values ARE Kurvan's own AGES labels directly now
  // (fetch_socialstyrelsen_mh.py's pool_suicide_age_bands() pools every raw
  // dodsorsaker age id straight into Kurvan's nine bands, unlike self-harm
  // which stays on its narrower 12-14/15-17 sub-labels) — this map is just
  // AGES itself, kept explicit rather than special-cased away below so
  // rebuildREAL()'s ageOf/idx-building loop needs no per-indicator branch.
  const AGE_MAP = { selfharm: { 0: "12_14", 1: "15_17" },
                     suicide: Object.fromEntries(AGES.map((a, i) => [i, a])) };
  // X60-X84 alone for suicide (matches IND.suicide's cited source); X60-X84
  // + Y10-Y34 combined for self-harm (matches IND.selfharm's cited source
  // and notNumB.selfharm's caveat about carrying undetermined intent along).
  const CAUSES = { selfharm: ["self_harm_hosp_per_100k", "undetermined_intent_hosp_per_100k"],
                    suicide: ["suicide_per_100k"] };

  const idx = { selfharm: {}, suicide: {} };  // idx[k][county][ageIdx][sex][midpoint_year]
  for (const k of Object.keys(idx)) {
    const ageOf = {};
    for (const ai in AGE_MAP[k]) ageOf[AGE_MAP[k][ai]] = ai;
    for (const row of rows) {
      if (!CAUSES[k].includes(row.indicator)) continue;
      const ageIdx = ageOf[row.age_group];
      if (ageIdx === undefined) continue;
      const byCounty = idx[k][row.county_code] || (idx[k][row.county_code] = {});
      const byAge = byCounty[ageIdx] || (byCounty[ageIdx] = {});
      const bySex = byAge[row.sex] || (byAge[row.sex] = {});
      const cur = bySex[row.midpoint_year];
      if (!cur) {
        bySex[row.midpoint_year] = { value: row.value, count: row.count, suppressed: row.suppressed, window: row.window };
      } else {
        // Two causes (X60-X84 and Y10-Y34) landing on the same county/age/sex/window: sum the rates.
        cur.value += row.value;
        cur.count = (cur.count != null && row.count != null) ? cur.count + row.count : null;
        cur.suppressed = cur.suppressed || row.suppressed;
      }
    }
  }

  const maxYear = (k) => {
    const nat = idx[k]["00"];
    if (!nat) return null;
    let best = null;
    for (const ai in nat) for (const sex in nat[ai]) for (const y in nat[ai][sex]) { const yn = +y; if (best === null || yn > best) best = yn; }
    return best;
  };
  const latestYear = active
    ? Math.min(...["selfharm", "suicide"].map(maxYear).filter(y => y != null))
    : null;

  return { active, idx, latestYear, generatedAt: active ? REAL_MH.generated_at : null };
}
let REAL = rebuildREAL();

/* =====================================================================
   1c. REAL DATA — specialist psychiatric care, from js/data/real_psych.js's
   REAL_PSYCH_MH (fetch_socialstyrelsen_psych.py + build_kurvan_data.py).

   Unlike self-harm/suicide, this one is a comfortable fit for Kurvan's
   shape: county grain (plus one national row), ALL nine of Kurvan's age
   bands (the register's own 5-year bands, pooled pairwise — see that
   script's docstring), all three sexes, ANNUAL — no rolling window. The
   register's own true "all ages" figure (age band "0-85+") is used
   directly for totals rather than reconstructed from the nine bands.

   Split into six diagnosis-type series (PSYCH_TYPES below) instead of one
   combined "all psychiatric care" number — the source already breaks it
   down this way (see fetch_socialstyrelsen_psych.py's docstring for the
   six ids/labels and two labelling caveats). REAL_PSYCH.idx/idxAll are
   keyed by type FIRST, county second — every existing caller that never
   asks for a type (viewRegioner, viewKon, viewMetod, viewLaget, viewAlder,
   ...) transparently gets `"all"`, a synthesised pseudo-type summing the
   six real ones — see rebuildREAL_PSYCH()'s own addToAll() for why simple
   summation is exact here (not an approximation the way pooling different
   AGE bands needs population-recovery for): the population denominator is
   the SAME across diagnosis types for one county/age/sex/year cell, so
   summing real per-type rates already gives the correct combined rate.
   Only viewOverTid()/viewKarta() (js/views.js) — the two views with an
   actual type selector — ever pass a specific type through.

   REAL_PSYCH_MH's rows are compact tuples, not objects — see
   build_kurvan_data.py's "COMPACT TUPLE ROWS" docstring section and
   rebuildREAL_PSYCH()'s own comment below for the decode.
   ===================================================================== */
const PSYCH_TYPES = ["substance_use", "psychosis", "depression_mood", "anxiety_stress", "eating_disorders", "adhd_childhood"];
// See rebuildREAL()'s comment above — same lazy-rebuild pattern, callable
// again once js/data/real_psych.js lands.
function rebuildREAL_PSYCH() {
  const rows = (typeof REAL_PSYCH_MH !== "undefined" && Array.isArray(REAL_PSYCH_MH.rows)) ? REAL_PSYCH_MH.rows : [];
  const active = rows.length > 0;
  // types/ages: the two small dictionaries build_kurvan_data.py's
  // encode_type_age_rows() emits alongside `rows` (see that function's own
  // comment) — each row below is `[county_code, type_idx, year, age_idx,
  // sex, value, count]`, a positional tuple rather than a named-key object,
  // decoded back into the same shape this loop always worked with by
  // indexing into these two arrays. Cuts real_psych.js roughly 4x (was
  // repeating seven full key names, and a spelled-out "psych_x_per_100k"
  // string, on every one of ~68,000 rows) with no change to anything past
  // the decode step below — idx/idxAll and every reader of them are
  // unchanged.
  const types = active ? REAL_PSYCH_MH.types : [];
  const ages = active ? REAL_PSYCH_MH.ages : [];
  const ageIdxOf = {}; AGES.forEach((a, i) => { ageIdxOf[a] = i; });

  const idx = {};     // idx[type|"all"][county][ageIdx][sex][year] = {value,count}
  const idxAll = {};  // idxAll[type|"all"][county][sex][year] = {value,count} -- the register's own "0-85+"
  // Adds one row into both its own real type's bucket AND the "all"
  // bucket in the same pass, via a variable-depth `path` (4 keys for idx:
  // county/ageIdx/sex/year; 3 for idxAll: county/sex/year) — one function
  // for both shapes rather than writing the nested-loop version twice.
  // Summed raw, not rounded per-add (fmt() rounds for display) — six tiny
  // per-add roundings would drift further from the true sum than one
  // display-time rounding does.
  const addToAll = (bucket, type, path, value, count) => {
    for (const key of ["all", type]) {
      let node = bucket[key] || (bucket[key] = {});
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]] || (node[path[i]] = {});
      const leafKey = path[path.length - 1];
      const cur = node[leafKey];
      if (!cur) node[leafKey] = { value, count };
      else {
        cur.value += value;
        cur.count = (cur.count != null && count != null) ? cur.count + count : null;
      }
    }
  };

  for (const row of rows) {
    const [county, typeIdx, year, ageIdx, sex, value, count] = row;
    const type = types[typeIdx];
    if (!type) continue;
    const ageGroup = ages[ageIdx];
    if (ageGroup === "0-85+") {
      addToAll(idxAll, type, [county, sex, year], value, count);
      continue;
    }
    const ai = ageIdxOf[ageGroup];
    if (ai === undefined) continue;
    addToAll(idx, type, [county, ai, sex, year], value, count);
  }

  const years = new Set(rows.filter(r => ages[r[3]] === "0-85+").map(r => r[2]));
  return { active, idx, idxAll, years: [...years].sort((a, b) => a - b),
           generatedAt: active ? REAL_PSYCH_MH.generated_at : null };
}
let REAL_PSYCH = rebuildREAL_PSYCH();

/* =====================================================================
   1d. REAL DATA — self-reported severe anxiety/worry/dread, from
   js/data/real_hlv.js's REAL_HLV_MH (fetch_folkhalsodata_hlv.py).

   Backs Kurvan's `distress` indicator. Renamed from "poor mental
   wellbeing" ("Nedsatt psykiskt välbefinnande") to "severe anxiety, worry
   or dread" ("Svår ängslan, oro eller ångest") specifically because the
   real source for the former stopped publishing regional figures after
   2015-2018; the latter is continuously updated. See
   fetch_folkhalsodata_hlv.py's docstring for the full coverage check.

   County grain (plus a national row), all three sexes, ~4-year rolling
   survey windows keyed by midpoint year like self-harm/suicide — BUT this
   table has NO age dimension at all (a sibling table does, by age instead
   of by region; this project doesn't fetch that one, so Kurvan simply has
   no real age curve for this indicator). realCellHLV() always returns
   null rather than reconstruct an age split that was never published.
   ===================================================================== */
// See rebuildREAL()'s comment above — same lazy-rebuild pattern.
function rebuildREAL_HLV() {
  const rows = (typeof REAL_HLV_MH !== "undefined" && Array.isArray(REAL_HLV_MH.rows)) ? REAL_HLV_MH.rows : [];
  const active = rows.length > 0;
  const idx = {};   // idx[county][sex][year] = {value,ci_lo,ci_hi,n}
  for (const row of rows) {
    const byCounty = idx[row.county_code] || (idx[row.county_code] = {});
    const bySex = byCounty[row.sex] || (byCounty[row.sex] = {});
    bySex[row.midpoint_year] = { value: row.value, ci_lo: row.ci_lo, ci_hi: row.ci_hi, n: row.n };
  }
  const years = new Set(rows.map(r => r.midpoint_year));
  return { active, idx, years: [...years].sort((a, b) => a - b),
           generatedAt: active ? REAL_HLV_MH.generated_at : null };
}
let REAL_HLV = rebuildREAL_HLV();

/* Which ageIdx values are actually selectable for indicator k, right now.
   NOT the same array as IND[k].age: that one stays the full fabricated
   9-band curve always, because fakeCell()/fakeAgePts() (viewLaget) still
   read it and must keep working unpruned regardless of REAL's state. This
   is only for the age <select> and the c-ind change handler, so a reader
   can't pick "45-54" for suicide once real data is live and land on a
   guaranteed "no data" row. Indicators absent from REAL_AGE_LIMIT (psych)
   have no real restriction — the register covers every band; `distress`
   maps to an empty array because its real source has NO age dimension at
   all (see REAL_HLV above), so "All ages" is the only real option. */
/* =====================================================================
   1e. REAL DATA — share of ongoing sickness-benefit cases with a stress-
   reaction (F43) diagnosis, from js/data/real_fk.js's REAL_FK_MH
   (fetch_forsakringskassan.py). County grain (plus a national row), all
   three sexes, annual (averaged from monthly), 2005 through the current
   year — unlike every other real indicator here, this one keeps extending
   into the current, still-unfinished year rather than stopping at the
   last fully closed one.

   That means the latest year is usually a PARTIAL year: whatever months
   Försäkringskassan has published so far, averaged the same way a full
   12 would be, with nothing about the number itself distinguishing it
   from a finished year. `months` on each REAL_FK_MH row (fetcher's own
   to_records() docstring) carries how many calendar months actually went
   into that average; `partial` below is just `months < 12`, computed once
   here so every caller checks the same thing the same way instead of
   re-deriving it. No age dimension, same situation as REAL_HLV.
   ===================================================================== */
// See rebuildREAL()'s comment above — same lazy-rebuild pattern.
function rebuildREAL_FK() {
  const rows = (typeof REAL_FK_MH !== "undefined" && Array.isArray(REAL_FK_MH.rows)) ? REAL_FK_MH.rows : [];
  const active = rows.length > 0;
  const idx = {};   // idx[county][sex][year] = {value,count,months}
  for (const row of rows) {
    const byCounty = idx[row.county_code] || (idx[row.county_code] = {});
    const bySex = byCounty[row.sex] || (byCounty[row.sex] = {});
    bySex[row.year] = { value: row.value, count: row.count, months: row.months };
  }
  const years = new Set(rows.map(r => r.year));
  return { active, idx, years: [...years].sort((a, b) => a - b),
           generatedAt: active ? REAL_FK_MH.generated_at : null };
}
let REAL_FK = rebuildREAL_FK();
function realTotalFK(regionCode, year, sex) {
  if (!REAL_FK.active) return undefined;
  const county = regionCode === "SE" ? "00" : regionCode;
  const row = REAL_FK.idx[county] && REAL_FK.idx[county][sex] && REAL_FK.idx[county][sex][year];
  if (!row) return null;
  return { ...realRowToCell(row), months: row.months, partial: row.months != null && row.months < 12 };
}
// No age dimension in the source table — always null once real, same as distress/HLV.
function realCellFK() { return REAL_FK.active ? null : undefined; }

/* =====================================================================
   1f. REAL DATA — psychiatric medication dispensed, from
   js/data/real_lakemedel.js's REAL_LAKEMEDEL_MH (fetch_socialstyrelsen_lakemedel.py
   + build_kurvan_data.py).

   Same comfortable shape as psych (1c above), and the same rebuild/lookup
   pair reused almost verbatim: county grain (plus a national row), ALL
   nine of Kurvan's age bands, all three sexes, ANNUAL. Unlike psych, the
   source table has no pre-aggregated "0-85+" row of its own — the fetcher
   reconstructs one itself (same population-recovery pooling it uses for
   the nine age bands, just applied across all eighteen 5-year bands) and
   writes it under age_group "0-85+" in the same row shape, so it can be
   read here exactly like psych's real "all ages" row.

   Split into five ATC-class series (MED_TYPES below) the same way psych
   split into six diagnosis types — same idx[type|"all"][...] shape, same
   addToAll() summing trick for the synthesised "all" pseudo-type (still
   IND.antidep's own indicator key — "antidep" never became a type name,
   it's the Kurvan indicator that this whole REAL_ANTIDEP block backs).

   pipeline/README.md used to say this indicator needed a multi-gigabyte
   bulk download (true of the microdata register, not this aggregate
   table) — see that fetcher's docstring for what changed.

   viewBehov()'s need-vs-response scatter (js/views.js) still calls
   fakeTotal() directly for antidep regardless of this — it deliberately
   never reads real data for either of its two axes, since that chart's
   whole "distance from the average association" story depends on both
   values coming from the same internally-correlated fabricated
   generator. Nothing here changes that; leave it be.

   REAL_LAKEMEDEL_MH's rows are compact tuples, not objects — same as
   REAL_PSYCH_MH above, see rebuildREAL_ANTIDEP()'s own comment below.
   ===================================================================== */
const MED_TYPES = ["antidepressants", "adhd_med", "antipsychotics", "anxiety_med", "sleep_med"];
// See rebuildREAL()'s comment above — same lazy-rebuild pattern.
function rebuildREAL_ANTIDEP() {
  const rows = (typeof REAL_LAKEMEDEL_MH !== "undefined" && Array.isArray(REAL_LAKEMEDEL_MH.rows)) ? REAL_LAKEMEDEL_MH.rows : [];
  const active = rows.length > 0;
  // types/ages: see rebuildREAL_PSYCH()'s own comment on these — same
  // encode_type_age_rows() tuple format, same decode-by-index here.
  const types = active ? REAL_LAKEMEDEL_MH.types : [];
  const ages = active ? REAL_LAKEMEDEL_MH.ages : [];
  const ageIdxOf = {}; AGES.forEach((a, i) => { ageIdxOf[a] = i; });

  const idx = {};     // idx[type|"all"][county][ageIdx][sex][year] = {value,count}
  const idxAll = {};  // idxAll[type|"all"][county][sex][year] = {value,count} -- reconstructed "0-85+"
  // See rebuildREAL_PSYCH()'s addToAll() for the full explanation — same
  // helper, same reasoning (summing real per-type rates is exact here,
  // the population denominator is shared across medication types for one
  // county/age/sex/year cell).
  const addToAll = (bucket, type, path, value, count) => {
    for (const key of ["all", type]) {
      let node = bucket[key] || (bucket[key] = {});
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]] || (node[path[i]] = {});
      const leafKey = path[path.length - 1];
      const cur = node[leafKey];
      if (!cur) node[leafKey] = { value, count };
      else {
        cur.value += value;
        cur.count = (cur.count != null && count != null) ? cur.count + count : null;
      }
    }
  };

  for (const row of rows) {
    const [county, typeIdx, year, ageIdx, sex, value, count] = row;
    const type = types[typeIdx];
    if (!type) continue;
    const ageGroup = ages[ageIdx];
    if (ageGroup === "0-85+") {
      addToAll(idxAll, type, [county, sex, year], value, count);
      continue;
    }
    const ai = ageIdxOf[ageGroup];
    if (ai === undefined) continue;
    addToAll(idx, type, [county, ai, sex, year], value, count);
  }

  const years = new Set(rows.filter(r => ages[r[3]] === "0-85+").map(r => r[2]));
  return { active, idx, idxAll, years: [...years].sort((a, b) => a - b),
           generatedAt: active ? REAL_LAKEMEDEL_MH.generated_at : null };
}
let REAL_ANTIDEP = rebuildREAL_ANTIDEP();
// type: one of MED_TYPES, or "all" (default). Same convention as
// realCellPsych/realTotalPsych above — see their own comment.
function realCellAntidep(regionCode, year, ageIdx, sex, type) {
  if (!REAL_ANTIDEP.active) return undefined;
  type = type || "all";
  const county = regionCode === "SE" ? "00" : regionCode;
  const byType = REAL_ANTIDEP.idx[type];
  const row = byType && byType[county] && byType[county][ageIdx] &&
              byType[county][ageIdx][sex] && byType[county][ageIdx][sex][year];
  return row ? realRowToCell(row) : null;
}
function realTotalAntidep(regionCode, year, sex, type) {
  if (!REAL_ANTIDEP.active) return undefined;
  type = type || "all";
  const county = regionCode === "SE" ? "00" : regionCode;
  const byType = REAL_ANTIDEP.idxAll[type];
  const row = byType && byType[county] && byType[county][sex] && byType[county][sex][year];
  return row ? realRowToCell(row) : null;
}

/* =====================================================================
   1g. CONTEXT — demographic/socioeconomic layers for the Sammanhang tab,
   from js/data/real_context.js's REAL_CONTEXT_MH (fetch_kolada_context.py,
   Kolada). Deliberately NOT shaped like IND/REAL_*: these are not mental-
   health indicators (no age/sex breakdown, no synthetic fallback — a
   context layer with no data just doesn't show a region, same honesty
   rule as everywhere else, not a fabricated stand-in). Region values are
   an unweighted mean of that region's municipalities — see CONTEXT_META's
   caveat text, shown wherever a value from here is displayed.
   ===================================================================== */
const CONTEXT_META = {
  pop_density: { scale: "km2" },        // people per km²
  education_low_pct: { scale: "pct" },  // %, residents 25-64 with low education
};
// See rebuildREAL()'s comment above — same lazy-rebuild pattern.
function rebuildCONTEXT() {
  const rows = (typeof REAL_CONTEXT_MH !== "undefined" && Array.isArray(REAL_CONTEXT_MH.rows)) ? REAL_CONTEXT_MH.rows : [];
  const active = rows.length > 0;
  const idx = {};   // idx[indicator][county] = {value, n_kommuner, year}
  for (const row of rows) {
    const byInd = idx[row.indicator] || (idx[row.indicator] = {});
    byInd[row.county_code] = { value: row.value, n_kommuner: row.n_kommuner, year: row.year };
  }
  return { active, idx, generatedAt: active ? REAL_CONTEXT_MH.generated_at : null };
}
let CONTEXT = rebuildCONTEXT();
function contextCell(indicator, regionCode) {
  if (!CONTEXT.active) return undefined;
  const row = CONTEXT.idx[indicator] && CONTEXT.idx[indicator][regionCode];
  return row || null;
}

/* =====================================================================
   1h. BUP WAITING TIMES — median days waited for a completed first visit
   at barn- och ungdomspsykiatrin (child/adolescent psychiatry), from
   js/data/real_bup.js's REAL_BUP_WAIT (pipeline/convert_vantetider_bup.py
   + build_kurvan_data.py). Deliberately NOT shaped like IND/REAL_* —
   same reasoning as CONTEXT above, plus more of its own:

     - MONTHLY, not annual — every real IND indicator is a yearly figure;
       this is the only one with a month dimension.
     - No age/sex breakdown (this pull requested "Alla kön"/"Alla åldrar"
       combined) — read as a single value per county/year/month, no `sex`
       lookup key needed the way REAL_ANTIDEP etc. have one.
     - NOT fetched by a script — convert_vantetider_bup.py's own docstring
       explains why (no API, a human has to use the source's own CSV
       export) and that this needs a person to redo that export
       periodically to stay current; `generatedAt` here is the date of
       that manual export, not a live fetch timestamp.
     - The source itself only holds a ROLLING ~12-MONTH WINDOW — `months`
       below is never going to grow into a multi-year history the way
       every other real series here eventually could.
     - Suppressed cells (too few contacts to publish, mostly the smaller/
       northern regions) are simply absent, same "missing, not zero" rule
       as everywhere else.
   ===================================================================== */
// See rebuildREAL()'s comment above — same lazy-rebuild pattern.
function rebuildBUP_WAIT() {
  const rows = (typeof REAL_BUP_WAIT !== "undefined" && Array.isArray(REAL_BUP_WAIT.rows)) ? REAL_BUP_WAIT.rows : [];
  const active = rows.length > 0;
  const idx = {};   // idx[county][year][month] = value (days)
  for (const row of rows) {
    const byCounty = idx[row.county_code] || (idx[row.county_code] = {});
    const byYear = byCounty[row.year] || (byCounty[row.year] = {});
    byYear[row.month] = row.value;
  }
  // Chronological (year, month) pairs actually present in the national
  // ("00") series — the x-axis for the trend chart, and months[months.
  // length-1] is "latest" for the map, same idea as REAL_PSYCH's maxYear.
  const months = Object.entries(idx["00"] || {})
    .flatMap(([y, byM]) => Object.keys(byM).map(m => [+y, +m]))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { active, idx, months, generatedAt: active ? REAL_BUP_WAIT.generated_at : null };
}
let BUP_WAIT = rebuildBUP_WAIT();
function bupWaitCell(regionCode, year, month) {
  if (!BUP_WAIT.active) return undefined;
  const county = regionCode === "SE" ? "00" : regionCode;
  const v = BUP_WAIT.idx[county] && BUP_WAIT.idx[county][year] && BUP_WAIT.idx[county][year][month];
  return v == null ? null : v;
}

/* =====================================================================
   1i. HBSC — Skolbarns hälsovanor, share of 11/13/15-year-olds reporting
   feeling low at least weekly, from js/data/real_hbsc.js's REAL_HBSC_MH
   (fetch_hbsc.py). Deliberately NOT shaped like IND/REAL_* — same
   reasoning as CONTEXT/BUP_WAIT above:

     - A SINGLE SNAPSHOT (one survey window, "2021-2022" as of writing at
       region grain) — not a trend, nothing to plot a time series against.
     - Own age keys, "11"/"13"/"15" (single years) — NOT Kurvan's nine
       AGES bands. Forcing 11 and 13 through AGES would collide them both
       into "0-14", losing exactly the precision this exists to add (see
       fetch_hbsc.py's own docstring).
     - Both sexes (K/M), no "total" — the source itself has none.
   ===================================================================== */
const HBSC_AGES = ["11", "13", "15"];
// See rebuildREAL()'s comment above — same lazy-rebuild pattern.
function rebuildHBSC() {
  const rows = (typeof REAL_HBSC_MH !== "undefined" && Array.isArray(REAL_HBSC_MH.rows)) ? REAL_HBSC_MH.rows : [];
  const active = rows.length > 0;
  const idx = {};   // idx[county][age][sex] = value
  let window = null;
  for (const row of rows) {
    const byCounty = idx[row.county_code] || (idx[row.county_code] = {});
    const byAge = byCounty[row.age_group] || (byCounty[row.age_group] = {});
    byAge[row.sex] = row.value;
    window = row.year;   // same window on every row; last write is fine
  }
  return { active, idx, window, generatedAt: active ? REAL_HBSC_MH.generated_at : null };
}
let HBSC = rebuildHBSC();
function hbscCell(regionCode, age, sex) {
  if (!HBSC.active) return undefined;
  const county = regionCode === "SE" ? "00" : regionCode;
  const v = HBSC.idx[county] && HBSC.idx[county][age] && HBSC.idx[county][age][sex];
  return v == null ? null : v;
}

/* =====================================================================
   1j. SCB POPULATION — the denominator behind real age-standardisation,
   from js/data/real_pop.js's REAL_POP_MH (fetch_scb_population.py). Not a
   mental-health measure at all; used only by standardRate() below.

     - County grain (plus a national "00" row), Kurvan's own nine AGES
       bands (pooled from SCB's single-year ages — see that script's
       docstring), both sexes, annual, 2006-2024 (fetch_hbsc.py's sibling
       script stops there on purpose — see ITS docstring for why
       BefolkningCKM, which would extend to 2025, isn't also fetched).
     - STD_CAPABLE_REAL below is the complete list of indicators this can
       actually standardise: psych, antidep and suicide are the three real
       indicators with full nine-band age coverage (REAL_AGE_LIMIT above
       has no entry for any of the three) — selfharm's 2-band real coverage
       and distress/sjukfranvaro's zero real age coverage can't be
       standardised regardless of having a population denominator; that
       gap is in the numerator, not here.
   ===================================================================== */
const STD_CAPABLE_REAL = ["psych", "antidep", "suicide"];
// See rebuildREAL()'s comment above — same lazy-rebuild pattern, except
// this one has a dependant (NATIONAL_AGE_WEIGHTS, below) that also needs
// recomputing once real_pop.js lands — js/shell.js's loader calls both in
// sequence, rebuildREAL_POP() then rebuildNATIONAL_AGE_WEIGHTS().
function rebuildREAL_POP() {
  const rows = (typeof REAL_POP_MH !== "undefined" && Array.isArray(REAL_POP_MH.rows)) ? REAL_POP_MH.rows : [];
  const active = rows.length > 0;
  const idx = {};        // idx[county][ageIdx][sex][year] = population
  const ageIdxOf = {}; AGES.forEach((a, i) => { ageIdxOf[a] = i; });
  let latestYear = null;
  for (const row of rows) {
    const ai = ageIdxOf[row.age_group];
    if (ai === undefined) continue;
    const byCounty = idx[row.county_code] || (idx[row.county_code] = {});
    const byAge = byCounty[ai] || (byCounty[ai] = {});
    const bySex = byAge[row.sex] || (byAge[row.sex] = {});
    bySex[row.year] = row.value;
    if (latestYear === null || row.year > latestYear) latestYear = row.year;
  }
  return { active, idx, latestYear, generatedAt: active ? REAL_POP_MH.generated_at : null };
}
let REAL_POP = rebuildREAL_POP();
/* National reference weights (share of Sweden's total population in each
   AGES band), held fixed at REAL_POP's latest year regardless of which
   year is being standardised — the same reasoning Socialstyrelsen/
   Folkhälsomyndigheten's own "åldersstandardiserade" figures use a fixed
   reference population: standardising 2010 and 2024 against each year's
   OWN population structure would confound the trend with the reference
   ageing alongside it. Recomputed only when REAL_POP itself changes (see
   rebuildREAL_POP()'s own comment) — not on every render. */
function rebuildNATIONAL_AGE_WEIGHTS() {
  if (!REAL_POP.active) return null;
  const y = REAL_POP.latestYear;
  const pops = AGES.map((_, i) => {
    const byAge = REAL_POP.idx["00"] && REAL_POP.idx["00"][i];
    const m = byAge && byAge["M"] && byAge["M"][y] || 0;
    const k = byAge && byAge["K"] && byAge["K"][y] || 0;
    return m + k;
  });
  const total = pops.reduce((s, v) => s + v, 0);
  return total > 0 ? pops.map(v => v / total) : null;
}
let NATIONAL_AGE_WEIGHTS = rebuildNATIONAL_AGE_WEIGHTS();
/** Direct age-standardisation: each AGES band's own real rate (via cell(),
    so it stays real-preferred the same way every other reader here does)
    weighted by that band's share of Sweden's national population,
    summed. Bands with no real cell for this region/year/sex are dropped
    and the remaining weights renormalised, rather than treating a missing
    band as a zero rate. Returns null (never a fabricated number) if
    nothing at all is available, undefined if standardisation genuinely
    doesn't apply here (not real-active, not population-active, or k
    isn't in STD_CAPABLE_REAL) — same undefined/null contract every real*
    function above uses. */
function standardRate(k, regionCode, year, sex, type) {
  if (!STD_CAPABLE_REAL.includes(k) || !REAL_POP.active || !NATIONAL_AGE_WEIGHTS) return undefined;
  if (!isRealActive(k)) return undefined;
  const parts = [];
  for (let i = 0; i < AGES.length; i++) {
    const c = k === "psych" ? realCellPsych(regionCode, year, i, sex, type)
             : k === "antidep" ? realCellAntidep(regionCode, year, i, sex, type)
             : realCell(k, regionCode, year, i, sex);   // suicide: already generic, no type param
    if (c && c.value != null) parts.push({ c, w: NATIONAL_AGE_WEIGHTS[i] });
  }
  if (!parts.length) return null;
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  if (wSum <= 0) return null;
  const value = parts.reduce((s, p) => s + p.c.value * p.w, 0) / wSum;
  const count = parts.every(p => p.c.count != null) ? parts.reduce((s, p) => s + p.c.count, 0) : null;
  const suppressed = parts.some(p => p.c.suppressed);
  const se = (count != null && count > 0) ? value / Math.sqrt(count) : null;
  return {
    value, count, denom: null,
    lo: se != null ? Math.max(0, value - 1.96 * se) : value,
    hi: se != null ? value + 1.96 * se : value,
    suppressed, real: true, standardised: true,
  };
}

/* Data-vintage manifest — compiled from pipeline/manifest.json by
   build_kurvan_data.py into REAL_MANIFEST (currently dormant — no fetcher
   populates it yet).
   getManifestRows() returns one entry per data source (real + the one
   synthetic-only source, antidep) for the Metod view. */
const DATA_MANIFEST = (() => {
  const sources = (typeof REAL_MANIFEST !== "undefined" && Array.isArray(REAL_MANIFEST.sources))
    ? REAL_MANIFEST.sources : [];
  const builtAt = typeof REAL_MANIFEST !== "undefined" ? REAL_MANIFEST.built_at : null;
  return { sources, builtAt };
})();

function getManifestRows() {
  const rows = [];
  (DATA_MANIFEST.sources || []).forEach(s => {
    rows.push({
      key: s.key,
      source: s.source,
      fetcher: s.fetcher,
      indicators: s.indicators,
      time_period: s.time_period,
      records_count: s.records_count,
      grain: s.grain,
      fetched_at: s.fetched_at,
      active: s.active,
      isSynthOnly: false
    });
  });
  // Hand-appended, not read from REAL_MANIFEST (see this function's own
  // sources loop above): antidep's own row, reflecting whichever mode is
  // actually active right now rather than a hardcoded "always synthetic" —
  // it stopped being fetcher-less once fetch_socialstyrelsen_lakemedel.py
  // shipped (see REAL_ANTIDEP's docstring above).
  rows.push({
    key: "antidep",
    source: "Socialstyrelsen Statistikdatabasen (Läkemedelsregistret, ATC N06A)",
    fetcher: "fetch_socialstyrelsen_lakemedel.py",
    indicators: ["antidep"],
    time_period: REAL_ANTIDEP.active
      ? `${REAL_ANTIDEP.years[0]}–${REAL_ANTIDEP.years[REAL_ANTIDEP.years.length - 1]}`
      : "2006–2024",
    records_count: null,
    grain: "Region × Ålder × Kön",
    fetched_at: REAL_ANTIDEP.active ? REAL_ANTIDEP.generatedAt : null,
    active: REAL_ANTIDEP.active,
    isSynthOnly: !REAL_ANTIDEP.active
  });
  return rows;
}

// suicide dropped from here (widened to full 9-band real coverage — see
// AGE_MAP.suicide and STD_CAPABLE_REAL above); absent from this map means
// "no restriction", same as psych/antidep.
const REAL_AGE_LIMIT = { selfharm: [0, 1], distress: [], sjukfranvaro: [] };
function ageAvailable(k, ageIdx) {
  if (isRealActive(k)) return REAL_AGE_LIMIT[k] ? REAL_AGE_LIMIT[k].includes(ageIdx) : true;
  return IND[k].age[ageIdx] != null;
}
// Whether the standardise toggle can do anything real for k right now —
// views.js's viewOverTid/viewKarta read this to decide whether to enable
// the button (rather than just disabling it outright for any real
// indicator, the blanket rule before standardRate() existed). Synthetic
// data is unaffected: fakeCell()'s own standardisation runs regardless.
function stdCapable(k) {
  return !isRealActive(k) || (STD_CAPABLE_REAL.includes(k) && REAL_POP.active);
}

// Three-band regrouping of AGES for the age-comparison tab (viewAlder). 65
// lands exactly on an AGES boundary (65-74 starts cleanly), but 18 does not
// -- AGES[1] ("15-24") mixes 15-17-year-olds in with 18-24-year-olds, so
// "adult" here really means 15-64, not a clean 18-64 (see viewAlder's
// caveat note, which says so). psych, antidep and suicide are the only
// indicators with real data across every AGES band (REAL_AGE_LIMIT above
// has no entry for any of the three), so those are the only ones that can
// honestly use all three groups today.
const AGE_GROUPS = [
  { key: "child",   idxs: [0] },         // 0-14
  { key: "adult",   idxs: [1,2,3,4,5] }, // 15-64
  { key: "elderly", idxs: [6,7,8] },     // 65-74, 75-84, 85+
];
// Indicators whose real source only ever publishes sex "T" (total). Absent
// from this map means the real source publishes M/K/T all three — true of
// every real indicator now (selfharm/suicide included, since
// fetch_socialstyrelsen_mh.py started requesting kon/1,2,3), kept as an
// empty map rather than deleted so a future real source that genuinely
// only has a sex total has somewhere to say so.
const REAL_SEX_ONLY_TOTAL = {};
function sexAvailable(k, sex) {
  if (isRealActive(k) && REAL_SEX_ONLY_TOTAL[k]) return sex === "T";
  return true;
}
function isRealActive(k) {
  if (!IND[k].real) return false;
  if (k === "psych") return REAL_PSYCH.active;
  if (k === "distress") return REAL_HLV.active;
  if (k === "sjukfranvaro") return REAL_FK.active;
  if (k === "antidep") return REAL_ANTIDEP.active;
  return REAL.active;
}

/** Real lookup for one cell. Returns `undefined` when there is no real data
    loaded at all (caller should fall back to the fabricated generator),
    `null` when real data IS loaded but genuinely has nothing for this exact
    combination (caller must show "no data", never fabricate one), or a real
    cell otherwise. */
function realCell(k, regionCode, year, ageIdx, sex) {
  if (!REAL.active) return undefined;
  const county = regionCode === "SE" ? "00" : regionCode;
  const byAge = REAL.idx[k][county] && REAL.idx[k][county][ageIdx];
  const bySex = byAge && byAge[sex];
  const row = bySex && bySex[year];
  if (!row) return null;
  // realRowToCell's suppressed:false default doesn't apply here — selfharm/
  // suicide rows (unlike psych/HLV/FK's) carry a real suppressed/window pair
  // of their own, so those override the shared computation's default.
  return { ...realRowToCell(row), suppressed: row.suppressed, window: row.window };
}

function realRowToCell(row) {
  const se = (row.count != null && row.count > 0) ? row.value / Math.sqrt(row.count) : null;
  return {
    value: row.value, count: row.count, denom: null,
    lo: se != null ? Math.max(0, row.value - 1.96 * se) : row.value,
    hi: se != null ? row.value + 1.96 * se : row.value,
    suppressed: false, real: true,
  };
}
// type: one of PSYCH_TYPES, or "all" (default — the six real types summed,
// see rebuildREAL_PSYCH()). Only viewOverTid()/viewKarta() (js/views.js)
// ever pass a specific type; every other caller gets "all" for free.
function realCellPsych(regionCode, year, ageIdx, sex, type) {
  if (!REAL_PSYCH.active) return undefined;
  type = type || "all";
  const county = regionCode === "SE" ? "00" : regionCode;
  const byType = REAL_PSYCH.idx[type];
  const row = byType && byType[county] && byType[county][ageIdx] &&
              byType[county][ageIdx][sex] && byType[county][ageIdx][sex][year];
  return row ? realRowToCell(row) : null;
}
function realTotalPsych(regionCode, year, sex, type) {
  if (!REAL_PSYCH.active) return undefined;
  type = type || "all";
  const county = regionCode === "SE" ? "00" : regionCode;
  const byType = REAL_PSYCH.idxAll[type];
  const row = byType && byType[county] && byType[county][sex] && byType[county][sex][year];
  return row ? realRowToCell(row) : null;
}

/* HLV publishes its own confidence interval directly (survey CI, not a
   Poisson approximation from a count) — used as-is rather than recomputed. */
function realTotalHLV(regionCode, year, sex) {
  if (!REAL_HLV.active) return undefined;
  const county = regionCode === "SE" ? "00" : regionCode;
  const row = REAL_HLV.idx[county] && REAL_HLV.idx[county][sex] && REAL_HLV.idx[county][sex][year];
  if (!row) return null;
  return {
    value: row.value, count: row.n, denom: null,
    lo: row.ci_lo != null ? row.ci_lo : row.value,
    hi: row.ci_hi != null ? row.ci_hi : row.value,
    suppressed: false, real: true,
  };
}
// No age dimension exists in the real HLV region table — always null once real,
// never a fabricated per-age curve. See REAL_HLV's docstring above.
function realCellHLV() { return REAL_HLV.active ? null : undefined; }

function validYears(k){
  if (k === "psych" && REAL_PSYCH.active) return REAL_PSYCH.years;
  if (k === "distress" && REAL_HLV.active) return REAL_HLV.years;
  if (k === "sjukfranvaro" && REAL_FK.active) return REAL_FK.years;
  if (k === "antidep" && REAL_ANTIDEP.active) return REAL_ANTIDEP.years;
  // REAL.idx only ever has "selfharm"/"suicide" keys (rebuildREAL(), above)
  // — this branch is for THOSE two, not a generic "any real indicator"
  // fallback, so it must check REAL.idx[k] actually exists before indexing
  // into it. Harmless before lazy-loading existed (every REAL_X.active flag
  // used to flip true in the same instant, so a k landing here always had
  // REAL.idx[k]) — with each source now loading independently (js/shell.js's
  // loadRealSourcesLazily()), a k like "antidep" can hit this exact line
  // with REAL.active already true but REAL_ANTIDEP.active not yet, and
  // REAL.idx["antidep"] was always undefined; caught live via Playwright
  // during Phase 1's own verification, not by the headless harness (which
  // only ever rebuilds every source atomically, never partway through).
  if (IND[k].real && REAL.active && REAL.idx[k]) {
    const nat = REAL.idx[k]["00"];
    const years = new Set();
    if (nat) for (const ai in nat) for (const sex in nat[ai]) for (const y in nat[ai][sex]) years.add(+y);
    if (years.size) return [...years].sort((a, b) => a - b);
  }
  const I=IND[k], out=[];
  for(let y=I.start; y<=2024; y++){
    if (I.step && (y % I.step)) continue;
    out.push(y);
  }
  return out;
}

function ageShare(region,i){
  const w=[-1,-.85,-.6,-.25,.1,.45,.8,1.05,1.2][i];
  return Math.max(.01, AGE_SHARE[i]*(1+0.16*region[4]*w));
}
function denom(region,ageIdx,sex){
  const b=region[2]*ageShare(region,ageIdx);
  return sex==="T"?b:b*0.5;
}

/** One cell, always fabricated. Null where the (simulated) source does not
    publish; suppressed counts stay as rows with the count withheld, exactly
    as the real pipeline does. Used directly (bypassing the real-data-aware
    cell() below) only by viewLaget's life-course exhibit, which contrasts
    self-harm's youth peak against suicide's old-age peak — a shape no real
    fetcher here can show, since the real self-harm/suicide sources this
    project can reach never cover anyone past 19. See REAL's docstring
    above. */
function fakeCell(k, regionCode, year, ageIdx, sex, standardised){
  const I=IND[k];
  if (I.age[ageIdx]==null) return null;                       // HLV: no 0-14, no 85+
  if (year<I.start || (I.step && year%I.step)) return null;   // series start / biennial
  const R = regionCode==="SE"?NAT:RBY[regionCode];
  if (!R) return null;

  let v=I.age[ageIdx];
  if (sex==="M") v*=I.mMul[ageIdx];
  if (sex==="K") v*=I.kMul[ageIdx];
  v *= (1 + I.drift*(year-2006));
  if (I.breakAt && year>=I.breakAt) v*=1.17;                  // revised measure: a visible step

  if (regionCode!=="SE"){
    v *= (1 + I.needW*R[3] + I.supplyW*R[5]);
    v *= (1 + I.noise*gauss(k+R[0]+ageIdx+sex));
    v *= (1 + 0.02*gauss(k+R[0]+year));
    if (standardised) v /= (1 + 0.30*R[4]);
  } else {
    v *= (1 + 0.008*gauss(k+"SE"+year+ageIdx));
  }

  const d=denom(R,ageIdx,sex);
  const nAnnual=v*d/I.scale;
  const win=I.window||1;
  const nWin=nAnnual*win;
  const se=nAnnual>0 ? v/Math.sqrt(nWin) : v;

  return {
    value:v, count:Math.round(nWin), denom:Math.round(d),
    lo:Math.max(0,v-1.96*se), hi:v+1.96*se,
    suppressed: !!I.window && nWin<SUPPRESS_BELOW
  };
}

/** One cell, real data first. For selfharm/suicide/psych this checks the
    fetched Socialstyrelsen panel(s) (REAL/REAL_PSYCH, above) before ever
    fabricating anything; it only falls back to fakeCell() when the
    relevant fetcher has not been run on this machine, so the prototype
    still renders something before anyone has Python or network access.
    For every other indicator this is exactly fakeCell(). views.js reads
    `.real` on the returned cell (and isRealActive(k)) to label which mode
    produced a number — never blend the two under one label. */
// type (new, optional): a PSYCH_TYPES/MED_TYPES entry, only meaningful for
// k==="psych"/"antidep" — defaults to "all" inside realCellPsych()/
// realCellAntidep() themselves, so every caller here that never passes it
// (i.e. every one of them except viewOverTid()/viewKarta()) is unaffected.
function cell(k, regionCode, year, ageIdx, sex, standardised, type){
  if (k === "psych") {
    const r = realCellPsych(regionCode, year, ageIdx, sex, type);
    if (r !== undefined) return r;
  } else if (k === "distress") {
    const r = realCellHLV();   // always null once active: no real age dimension
    if (r !== undefined) return r;
  } else if (k === "sjukfranvaro") {
    const r = realCellFK();    // always null once active: no real age dimension
    if (r !== undefined) return r;
  } else if (k === "antidep") {
    const r = realCellAntidep(regionCode, year, ageIdx, sex, type);
    if (r !== undefined) return r;
  } else if (IND[k].real) {
    const r = realCell(k, regionCode, year, ageIdx, sex);
    if (r !== undefined) return r;   // real data loaded: real result wins, even if null
  }
  return fakeCell(k, regionCode, year, ageIdx, sex, standardised);
}

// type: see cell()'s own comment just above — same convention.
function total(k, regionCode, year, sex, standardised, type){
  const R=regionCode==="SE"?NAT:RBY[regionCode];
  // Standardised real psych/antidep: standardRate() itself checks
  // STD_CAPABLE_REAL/REAL_POP.active/isRealActive and returns undefined
  // when any of those don't hold, so this only intercepts the cases it
  // can actually serve — everything else falls through to the crude
  // real branches below exactly as before.
  if (standardised && (k === "psych" || k === "antidep" || k === "suicide")) {
    const r = standardRate(k, regionCode, year, sex, type);
    if (r !== undefined) return r;
  }
  if (k === "psych") {
    const r = realTotalPsych(regionCode, year, sex, type);
    if (r !== undefined) return r;   // real data loaded: use the register's own "0-85+" figure
  } else if (k === "distress") {
    const r = realTotalHLV(regionCode, year, sex);
    if (r !== undefined) return r;
  } else if (k === "sjukfranvaro") {
    const r = realTotalFK(regionCode, year, sex);
    if (r !== undefined) return r;
  } else if (k === "antidep") {
    const r = realTotalAntidep(regionCode, year, sex, type);
    if (r !== undefined) return r;
  } else if (IND[k].real && REAL.active) {
    const cells=[];
    for(let i=0;i<AGES.length;i++){
      const c=realCell(k,regionCode,year,i,sex);
      if (c) cells.push(c);
    }
    if (cells.length){
      const value=cells.reduce((s,c)=>s+c.value,0)/cells.length;
      const count=cells.every(c=>c.count!=null) ? cells.reduce((s,c)=>s+c.count,0) : null;
      const suppressed=cells.some(c=>c.suppressed);
      const se=(count!=null && count>0) ? value/Math.sqrt(count) : null;
      return {value, count, denom:null,
              lo: se!=null?Math.max(0,value-1.96*se):value,
              hi: se!=null?value+1.96*se:value,
              suppressed, real:true};
    }
    return null;   // real data loaded, but genuinely nothing for this region/year/sex
  }
  return fakeTotal(k, regionCode, year, sex, standardised);
}

/** Combines cell()'s per-age-band figures across a subset of AGES indices
    (an AGE_GROUPS entry's idxs) into one reading — used by viewAlder's
    age-group comparison. Deliberately mirrors the unweighted-mean-of-
    present-bands shape total() already uses for its own multi-age real
    fallback (the IND[k].real && REAL.active branch above), just
    parameterized on which indices to include instead of always all nine.
    Goes through cell(), not realCell() directly, so it stays real-
    preferred/synthetic-fallback-aware for any indicator, not just psych. */
function ageGroupTotal(k, regionCode, year, ageIdxs, sex, standardised){
  const cells=[];
  for(const i of ageIdxs){
    const c=cell(k,regionCode,year,i,sex,standardised);
    if(c && !c.suppressed) cells.push(c);
  }
  if(!cells.length) return null;
  const value=cells.reduce((s,c)=>s+c.value,0)/cells.length;
  const count=cells.every(c=>c.count!=null)?cells.reduce((s,c)=>s+c.count,0):null;
  const se=(count!=null&&count>0)?value/Math.sqrt(count):null;
  return {value,count,
    lo:se!=null?Math.max(0,value-1.96*se):value,
    hi:se!=null?value+1.96*se:value,
    suppressed:false};
}

/** Total, always fabricated — the population-weighted mean of fakeCell()
    across every age band. Used by total() as the fallback when an
    indicator's real source isn't loaded, AND directly by viewLaget's
    treatment-gap scatter (distress vs antidep), which must never mix a
    real value on one axis with a fabricated one on the other: the "gap"
    and its regression line are only meaningful because the fabricated
    generator deliberately correlates the two series (see fakeCell's
    needW/supplyW). See fakeCell()'s docstring for the parallel reasoning
    on viewLaget's self-harm/suicide life-course chart. */
function fakeTotal(k, regionCode, year, sex, standardised){
  const R=regionCode==="SE"?NAT:RBY[regionCode];
  let num=0, den=0;
  for(let i=0;i<AGES.length;i++){
    const c=fakeCell(k,regionCode,year,i,sex,standardised);
    if(!c) continue;
    const d=denom(R,i,sex);
    num+=c.value*d; den+=d;
  }
  if(!den) return null;
  const v=num/den, win=IND[k].window||1;
  const n=v*den/IND[k].scale*win;
  const se=n>0?v/Math.sqrt(n):v;
  return {value:v,count:Math.round(n),denom:Math.round(den),
          lo:Math.max(0,v-1.96*se),hi:v+1.96*se,suppressed:false};
}
