// Prediction harmonique des marees a Lacanau — AUCUN appel reseau, aucune cle.
//
// 37 composantes (M2, S2, N2, K2, K1, O1, P1, Q1, M4, MS4, MN4, M6, Mf, Mm,
// Ssa, Sa...) avec corrections nodales (f, u) recalculees a chaque instant :
// valable plusieurs annees sans maintenance (la modulation nodale de 18,6 ans
// est prise en compte analytiquement).
//
// Les constantes locales (amplitude H + phase g par composante + niveau moyen)
// sont figees dans tide-constants.json. Elles ont ete ajustees par moindres
// carres sur 2 ans de hauteurs d'eau horaires au droit de Lacanau, puis calees
// sur les horaires SHOM (maree.info « Lacanau (Large) ») et fr.surf-forecast.com
// (voir datum.shiftHighMin / shiftLowMin : l'onde de maree atteint la plage
// ~25-30 min apres le point de calcul du large).
//
// Usage :
//   import { tideExtremesForDate } from './tide-harmonic.mjs';
//   tideExtremesForDate('2026-08-13')
//   -> [ { time, height, type: 'high'|'low', label: 'HH:MM' }, ... ]  (heure Europe/Paris)
//
// CLI : node tools/tide-harmonic.mjs [YYYY-MM-DD] [nbJours]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CST = JSON.parse(fs.readFileSync(path.join(__dirname, 'tide-constants.json'), 'utf8'));

const TZ = 'Europe/Paris';
const D2R = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
const frac = (x) => ((x % 1) + 1) % 1;

// --- Arguments astronomiques (longitudes moyennes, en degres) --------------
// tau : temps lunaire moyen ; s : Lune ; h : Soleil ; p : perigee lunaire ;
// N : noeud ascendant lunaire ; p1 : perigee solaire. (Meeus / Schureman)
function astro(tms) {
  const d = (tms - J2000) / 86400000;
  const T = d / 36525;
  const s = 218.3164477 + 481267.88123421 * T;
  const h = 280.46646 + 36000.76983 * T;
  return {
    tau: 360 * frac(d) + h - s,
    s, h,
    p: 83.3532465 + 4069.0137287 * T,
    N: 125.04452 - 1934.136261 * T,
    p1: 282.93768193 + 1.71946 * T,
  };
}

// --- Corrections nodales f (facteur d'amplitude) et u (dephasage, degres) --
// Approximations standard de Schureman en fonction du noeud lunaire N.
function nodal(N) {
  const n = N * D2R;
  const c = Math.cos(n), c2 = Math.cos(2 * n), c3 = Math.cos(3 * n);
  const s1 = Math.sin(n), s2 = Math.sin(2 * n), s3 = Math.sin(3 * n);
  const fM2 = 1.0004 - 0.0373 * c + 0.0002 * c2, uM2 = -2.14 * s1;
  const fO1 = 1.0089 + 0.1871 * c - 0.0147 * c2 + 0.0014 * c3, uO1 = 10.80 * s1 - 1.34 * s2 + 0.19 * s3;
  const fK1 = 1.0060 + 0.1150 * c - 0.0088 * c2 + 0.0006 * c3, uK1 = -8.86 * s1 + 0.68 * s2 - 0.07 * s3;
  const fK2 = 1.0241 + 0.2863 * c + 0.0083 * c2 - 0.0015 * c3, uK2 = -17.74 * s1 + 0.68 * s2 - 0.04 * s3;
  const fJ1 = 1.013 + 0.168 * c - 0.017 * c2, uJ1 = -12.94 * s1 + 1.34 * s2 - 0.19 * s3;
  const fOO1 = 1.1027 + 0.6504 * c + 0.0317 * c2 - 0.0014 * c3, uOO1 = -36.68 * s1 + 4.02 * s2 - 0.57 * s3;
  const fMm = 1.0000 - 0.1300 * c + 0.0013 * c2;
  const fMf = 1.043 + 0.414 * c, uMf = -23.74 * s1 + 2.68 * s2 - 0.38 * s3;
  return {
    none: [1, 0],
    M2: [fM2, uM2], O1: [fO1, uO1], K1: [fK1, uK1], K2: [fK2, uK2],
    J1: [fJ1, uJ1], OO1: [fOO1, uOO1], Mm: [fMm, 0], Mf: [fMf, uMf],
    Msf: [fM2, -uM2], L2: [fM2, uM2],
    M3: [Math.pow(fM2, 1.5), 1.5 * uM2],
    MK3: [fM2 * fK1, uM2 + uK1], '2MK3': [fM2 * fM2 * fK1, 2 * uM2 - uK1], SK3: [fK1, uK1],
    M4: [fM2 * fM2, 2 * uM2], MS4: [fM2, uM2], '2SM2': [fM2, -uM2],
    M6: [Math.pow(fM2, 3), 3 * uM2], M8: [Math.pow(fM2, 4), 4 * uM2],
    M6x: [fM2 * fM2, 2 * uM2],
  };
}

// --- 37 composantes : [nom, nTau, nS, nH, nP, nP1, chi(deg), groupe nodal] --
// V = nTau*tau + nS*s + nH*h + nP*p + nP1*p1 + chi   (nombres de Doodson)
const CONSTITUENTS = [
  ['Sa',   0,  0, 1,  0,  0,   0, 'none'], ['Ssa', 0, 0, 2, 0, 0, 0, 'none'],
  ['Mm',   0,  1, 0, -1,  0,   0, 'Mm'],   ['Msf', 0, 2, -2, 0, 0, 0, 'Msf'],
  ['Mf',   0,  2, 0,  0,  0,   0, 'Mf'],
  ['2Q1',  1, -3, 0,  2,  0,  90, 'O1'],   ['Q1', 1, -2, 0, 1, 0, 90, 'O1'],
  ['Rho1', 1, -2, 2, -1,  0,  90, 'O1'],   ['O1', 1, -1, 0, 0, 0, 90, 'O1'],
  ['P1',   1,  1, -2, 0,  0,  90, 'none'], ['S1', 1, 1, -1, 0, 0, 0, 'none'],
  ['K1',   1,  1, 0,  0,  0, -90, 'K1'],   ['J1', 1, 2, 0, -1, 0, -90, 'J1'],
  ['OO1',  1,  3, 0,  0,  0, -90, 'OO1'],
  ['2N2',  2, -2, 0,  2,  0,   0, 'M2'],   ['Mu2', 2, -2, 2, 0, 0, 0, 'M2'],
  ['N2',   2, -1, 0,  1,  0,   0, 'M2'],   ['Nu2', 2, -1, 2, -1, 0, 0, 'M2'],
  ['M2',   2,  0, 0,  0,  0,   0, 'M2'],   ['Lam2', 2, 1, -2, 1, 0, 180, 'M2'],
  ['L2',   2,  1, 0, -1,  0, 180, 'L2'],   ['T2', 2, 2, -3, 0, 1, 0, 'none'],
  ['S2',   2,  2, -2, 0,  0,   0, 'none'], ['R2', 2, 2, -1, 0, -1, 180, 'none'],
  ['K2',   2,  2, 0,  0,  0,   0, 'K2'],   ['2SM2', 2, 4, -4, 0, 0, 0, '2SM2'],
  ['M3',   3,  0, 0,  0,  0, 180, 'M3'],   ['MK3', 3, 1, 0, 0, 0, -90, 'MK3'],
  ['2MK3', 3, -1, 0,  0,  0,  90, '2MK3'], ['SK3', 3, 3, -2, 0, 0, -90, 'SK3'],
  ['MN4',  4, -1, 0,  1,  0,   0, 'M4'],   ['M4', 4, 0, 0, 0, 0, 0, 'M4'],
  ['MS4',  4,  2, -2, 0,  0,   0, 'MS4'],  ['S4', 4, 4, -4, 0, 0, 0, 'none'],
  ['M6',   6,  0, 0,  0,  0,   0, 'M6'],   ['2MS6', 6, 2, -2, 0, 0, 0, 'M6x'],
  ['M8',   8,  0, 0,  0,  0,   0, 'M8'],
];

// Verification de coherence constantes <-> table des composantes.
const HG = CST.constituents.map(([name, H, g], i) => {
  if (name !== CONSTITUENTS[i][0]) {
    throw new Error(`tide-constants.json desynchronise : ${name} != ${CONSTITUENTS[i][0]}`);
  }
  return [H, g * D2R];
});

// --- Hauteur d'eau du modele (reference niveau moyen du large) -------------
export function seaLevelMSL(tms) {
  const A = astro(tms);
  const nod = nodal(A.N);
  let hh = CST.z0;
  for (let i = 0; i < CONSTITUENTS.length; i++) {
    const c = CONSTITUENTS[i];
    const V = (c[1] * A.tau + c[2] * A.s + c[3] * A.h + c[4] * A.p + c[5] * A.p1 + c[6]) * D2R;
    const [f, u] = nod[c[7]];
    hh += f * HG[i][0] * Math.cos(V + u * D2R - HG[i][1]);
  }
  return hh;
}

// Hauteur affichee (zero hydrographique cote plage, cf datum dans le JSON).
const toDatum = (h) => CST.datum.offset + CST.datum.scale * h;

// --- Format heure locale Europe/Paris --------------------------------------
const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false, timeZoneName: 'longOffset',
});
function parisParts(tms) {
  const p = Object.fromEntries(FMT.formatToParts(tms).map((x) => [x.type, x.value]));
  const off = p.timeZoneName.replace('GMT', '').replace('UTC', '') || '+00:00';
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    label: `${p.hour}:${p.minute}`,
    iso: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${off}`,
  };
}
// Minuit local (Europe/Paris) d'une date YYYY-MM-DD, en ms UTC.
function parisMidnightUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d, 0, 0, 0) - 2 * 3600000; // Paris = UTC+1/+2
  for (let k = 0; k < 3; k++) {
    const p = parisParts(guess);
    if (p.date === dateStr && p.label === '00:00') return guess;
    const target = Date.UTC(y, m - 1, d);
    const [py, pm, pd] = p.date.split('-').map(Number);
    const [hh, mm] = p.label.split(':').map(Number);
    guess -= (Date.UTC(py, pm - 1, pd, hh, mm) - target);
  }
  return guess;
}

// --- Extremes (PM/BM) d'un jour local --------------------------------------
// Balaye le modele a pas d'1 min autour du jour demande, applique le decalage
// de propagation vers la plage, et garde les extremes qui tombent ce jour-la.
export function tideExtremesForDate(dateStr) {
  const t0 = parisMidnightUTC(dateStr);
  const shiftHi = (CST.datum.shiftHighMin || 0) * 60000;
  const shiftLo = (CST.datum.shiftLowMin || 0) * 60000;
  const from = t0 - 3 * 3600000, to = t0 + 27 * 3600000;
  const out = [];
  const STEP = 60000;
  let prev = seaLevelMSL(from - STEP);
  let cur = seaLevelMSL(from);
  for (let t = from + STEP; t <= to; t += STEP) {
    const next = seaLevelMSL(t);
    const isMax = cur > prev && cur >= next;
    const isMin = cur < prev && cur <= next;
    if (isMax || isMin) {
      // Affinage parabolique autour du sommet (puis arrondi a la minute).
      const off = (prev - next) / (2 * (prev - 2 * cur + next)) || 0;
      const tExt = (t - STEP) + off * STEP + (isMax ? shiftHi : shiftLo);
      const hExt = cur - (prev - next) * off / 4;
      const p = parisParts(Math.round(tExt / 60000) * 60000);
      if (p.date === dateStr) {
        out.push({
          time: p.iso,
          height: +toDatum(hExt).toFixed(2),
          type: isMax ? 'high' : 'low',
          label: p.label,
        });
      }
    }
    prev = cur; cur = next;
  }
  return out;
}

// Plusieurs jours d'affilee, a plat, avec la date en plus (pour fetch.mjs).
export function tideExtremesRange(startDateStr, days) {
  const out = [];
  const [y, m, d] = startDateStr.split('-').map(Number);
  for (let i = 0; i < days; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const ds = dt.toISOString().slice(0, 10);
    for (const e of tideExtremesForDate(ds)) out.push({ date: ds, ...e });
  }
  return out;
}

// --- CLI -------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const start = process.argv[2] || today;
  const days = Number(process.argv[3] || 1);
  for (const e of tideExtremesRange(start, days)) {
    console.log(`${e.date}  ${e.type === 'high' ? 'PM' : 'BM'}  ${e.label}  ${e.height.toFixed(2)} m`);
  }
}
