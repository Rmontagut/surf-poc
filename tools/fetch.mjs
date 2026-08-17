// Recuperation des vraies donnees -> data/week/day-0..6.json
// A LANCER LA OU IL Y A INTERNET (ta machine / un serveur), pas dans le sandbox
// Cowork (reseau verrouille). Puis : node build-week.mjs.
//
// Sources :
//   - Open-Meteo Marine + Forecast : houle, vent, meteo, temp. eau (gratuit, sans cle)
//   - Marees : CALCUL HARMONIQUE LOCAL (tools/tide-harmonic.mjs) — aucun appel
//     reseau, aucune cle, aucun quota. WorldTides abandonne (credits epuises).
//   - CANDHIS (Cerema) getCampTR    : houle MESUREE J0  -> env CANDHIS_TOKEN (bouee 03302)
//
// Sans cle : Open-Meteo + marees calculees suffisent a tout rendre en reel ;
// seule la houle MESUREE (bouee) demande un jeton.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tideExtremesRange, tideExtremesForDate } from './tide-harmonic.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const CFG = {
  spot: 'Lacanau',
  lat: 45.00,
  lon: -1.20,
  tz: 'Europe/Paris',
  days: 7,
  refHour: 12,        // heure de reference des jours a venir (snapshot midi)
  buoyCamp: '03302',  // Cap Ferret (CANDHIS)
  k: 0.227,           // constante de deferlement (a recalibrer, cf CONTEXT)
};

const KEYS = {
  candhis: process.env.CANDHIS_TOKEN || null,
};

// --- Utilitaires ----------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');

async function getJSON(url, headers = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} sur ${url.split('?')[0]}`);
  return r.json();
}

// Code meteo WMO -> icone interne + libelle FR.
export function wx(code) {
  if (code === 0) return ['clear', 'Grand soleil'];
  if (code === 1 || code === 2) return ['partly', 'Peu nuageux'];
  if (code === 3) return ['cloudy', 'Couvert'];
  if (code === 45 || code === 48) return ['cloudy', 'Brouillard'];
  if (code >= 51 && code <= 67) return ['rain', 'Pluie'];
  if (code >= 71 && code <= 77) return ['rain', 'Neige'];
  if (code >= 80 && code <= 82) return ['rain', 'Averses'];
  if (code >= 95) return ['rain', 'Orages'];
  return ['partly', 'Variable'];
}

// Valeur d'une serie horaire Open-Meteo (times locaux naifs) a un instant donne.
function at(hourly, field, timeStr) {
  if (!hourly || !hourly.time) return null;
  const i = hourly.time.indexOf(timeStr);
  return i >= 0 ? (hourly[field] ?? [])[i] ?? null : null;
}
// Houle : la vraie « houle » est le swell ; on retombe sur l'etat de mer total.
const swellAt = (h, base, hh) => at(h, 'swell_wave_height', `${base}T${pad(hh)}:00`) ?? at(h, 'wave_height', `${base}T${pad(hh)}:00`);

// Date locale Europe/Paris.
const PARIS_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: CFG.tz, year: 'numeric', month: '2-digit', day: '2-digit' });

// --- Marees : calcul harmonique local (ni API, ni cle, ni quota) ----------
// Prediction astronomique SHOM-grade calee sur Lacanau, valable des annees.
// Voir tools/tide-harmonic.mjs + tools/tide-constants.json (provenance du fit).
function computeTides() {
  const today = PARIS_DATE.format(new Date());
  return tideExtremesRange(today, CFG.days + 1);
}

// Choix des 3 extremes AFFICHES : parmi les cycles de 3 extremes consecutifs
// commencant ce jour-la, on prend celui qui couvre le mieux la journee eveillee
// (7h-21h), quitte a deborder sur le lendemain matin. La maree de la nuit
// n'interesse personne : un 13 aout donne PM 08:19 / BM 14:10 / PM 20:34,
// pas BM 01:56 / PM 08:19 / BM 14:10.
const DAY_START = 7 * 60, DAY_END = 21 * 60; // fenetre « journee », minutes locales
function nextDateStr(dateStr) {
  return new Date(Date.parse(dateStr) + 86400000).toISOString().slice(0, 10);
}
export function pickDayCycle(tides, dateStr) {
  const nd = nextDateStr(dateStr);
  let all = (tides || []).filter((e) => e.date === dateStr || e.date === nd);
  if (all.filter((e) => e.date === dateStr).length < 2) {
    all = [
      ...tideExtremesForDate(dateStr).map((e) => ({ date: dateStr, ...e })),
      ...tideExtremesForDate(nd).map((e) => ({ date: nd, ...e })),
    ];
  }
  const toMin = (e) => {
    const [h, m] = e.label.split(':').map(Number);
    return (e.date === nd ? 1440 : 0) + h * 60 + m;
  };
  let best = null, bestOv = -1;
  for (let i = 0; i + 2 < all.length; i++) {
    if (all[i].date !== dateStr) continue; // le cycle commence ce jour-la
    const ov = Math.min(toMin(all[i + 2]), DAY_END) - Math.max(toMin(all[i]), DAY_START);
    if (ov > bestOv) { bestOv = ov; best = all.slice(i, i + 3); }
  }
  return (best || all.slice(0, 3)).map(({ date, ...rest }) => rest);
}

// --- Bouee mesuree (CANDHIS) ---------------------------------------------
async function fetchBuoy() {
  if (!KEYS.candhis) return null;
  const today = PARIS_DATE.format(new Date());
  const url = `https://candhis.cerema.fr/API/v1/getCampTR.php?camp=${CFG.buoyCamp}&dateDeb=${today}&dateFin=${today}`;
  const j = await getJSON(url, { Authorization: KEYS.candhis });
  if (!j.success || !Array.isArray(j.results) || j.results.length === 0) return null;
  const col = (name) => j.entete.findIndex((h) => h.startsWith(name));
  const iH = col('H1/3'); const iT = col('TH1/3'); const iD = col('Dir. au pic'); const iW = col('Temp. mer');
  const last = j.results[j.results.length - 1];
  const num = (i) => (i >= 0 && last[i] != null ? +parseFloat(last[i]) : null);
  const wh = num(iH);
  if (wh == null) return null;
  return { waveHeight: +wh.toFixed(1), period: Math.round(num(iT)), direction: Math.round(num(iD)), waterTemp: num(iW) };
}

// --- Assemblage (PUR, testable hors reseau) ------------------------------
export function buildDays({ marine, forecast, tides, buoy, fetchedAtISO }) {
  const dates = forecast.daily.time.slice(0, CFG.days); // 7 dates locales "YYYY-MM-DD"
  const mH = marine.hourly; const fH = forecast.hourly;
  const freshLabel = (() => {
    const [d, t] = fetchedAtISO.split('T');
    const [y, mo, da] = d.split('-');
    const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${da} ${MOIS[+mo - 1]} ${y} à ${t.slice(0, 5)}`;
  })();

  return dates.map((dateStr, i) => {
    const isToday = i === 0;
    const hh = isToday && marine.current ? Number(marine.current.time.slice(11, 13)) : CFG.refHour;

    // Houle / vent / meteo : « courant » pour aujourd'hui, snapshot midi ensuite.
    const swellH = isToday && marine.current
      ? (marine.current.swell_wave_height ?? marine.current.wave_height)
      : swellAt(mH, dateStr, hh);
    const period = isToday && marine.current
      ? (marine.current.swell_wave_period ?? marine.current.wave_period)
      : (at(mH, 'swell_wave_period', `${dateStr}T${pad(hh)}:00`) ?? at(mH, 'wave_period', `${dateStr}T${pad(hh)}:00`));
    const swellDir = isToday && marine.current
      ? (marine.current.swell_wave_direction ?? marine.current.wave_direction)
      : (at(mH, 'swell_wave_direction', `${dateStr}T${pad(hh)}:00`) ?? at(mH, 'wave_direction', `${dateStr}T${pad(hh)}:00`));
    const seaTemp = isToday && marine.current ? marine.current.sea_surface_temperature
      : at(mH, 'sea_surface_temperature', `${dateStr}T${pad(hh)}:00`);

    const windSpeed = isToday && forecast.current ? forecast.current.wind_speed_10m : at(fH, 'wind_speed_10m', `${dateStr}T${pad(hh)}:00`);
    const windDir = isToday && forecast.current ? forecast.current.wind_direction_10m : at(fH, 'wind_direction_10m', `${dateStr}T${pad(hh)}:00`);
    const airTemp = isToday && forecast.current ? forecast.current.temperature_2m : at(fH, 'temperature_2m', `${dateStr}T${pad(hh)}:00`);
    const code = isToday && forecast.current ? forecast.current.weather_code : at(fH, 'weather_code', `${dateStr}T${pad(hh)}:00`);
    const uv = at(fH, 'uv_index', `${dateStr}T${pad(hh)}:00`) ?? 0;
    const [icon, description] = wx(Math.round(code ?? 0));

    // Marees du jour : cycle centre sur la journee (7h-21h), cf pickDayCycle.
    const extremes = pickDayCycle(tides, dateStr);

    return {
      spot: CFG.spot,
      now: `${dateStr}T${pad(hh)}:00:00+02:00`,
      buoy: isToday && buoy ? { waveHeight: buoy.waveHeight, period: buoy.period, direction: buoy.direction } : null,
      forecast: {
        waveHeight: swellH != null ? +Number(swellH).toFixed(1) : null,
        wavePeriod: period != null ? Math.round(period) : null,
        waveDirection: swellDir != null ? Math.round(swellDir) : null,
      },
      wind: { speed: Math.round(windSpeed ?? 0), direction: Math.round(windDir ?? 0) },
      weather: {
        airTemp: Math.round(airTemp ?? 0),
        waterTemp: (isToday && buoy?.waterTemp != null) ? Math.round(buoy.waterTemp)
          : (seaTemp != null ? Math.round(seaTemp) : null),
        description, icon, uvIndex: Math.round(uv),
      },
      tide: { extremes },
      freshness: { ageHours: 0.2, staleAfterHours: 6, label: freshLabel },
      calibration: { k: CFG.k },
    };
  });
}

// --- Reseau ---------------------------------------------------------------
async function fetchAll() {
  const common = `latitude=${CFG.lat}&longitude=${CFG.lon}&timezone=${encodeURIComponent(CFG.tz)}&forecast_days=${CFG.days}`;
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?${common}`
    + `&current=swell_wave_height,swell_wave_period,swell_wave_direction,wave_height,wave_period,wave_direction,sea_surface_temperature`
    + `&hourly=swell_wave_height,swell_wave_period,swell_wave_direction,wave_height,wave_period,wave_direction,sea_surface_temperature`;
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?${common}`
    + `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m`
    + `&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,uv_index&daily=weather_code`;

  const [marine, forecast] = await Promise.all([getJSON(marineUrl), getJSON(forecastUrl)]);

  const tides = computeTides(); // local, deterministe, jamais en echec

  let buoy = null;
  try { buoy = await fetchBuoy(); } catch (e) { console.warn('! bouee :', e.message); }
  if (!buoy) console.warn(KEYS.candhis ? '! bouee indisponible -> repli sur le modele' : '! CANDHIS_TOKEN absent -> houle mesuree ignoree');

  return { marine, forecast, tides, buoy };
}

async function main() {
  const raw = await fetchAll();
  const fetchedAtISO = new Intl.DateTimeFormat('sv-SE', {
    timeZone: CFG.tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).replace(' ', 'T'); // "YYYY-MM-DDTHH:MM"

  const days = buildDays({ ...raw, fetchedAtISO });
  const outDir = path.join(ROOT, 'data', 'week');
  fs.mkdirSync(outDir, { recursive: true });
  days.forEach((d, i) => {
    fs.writeFileSync(path.join(outDir, `day-${i}.json`), JSON.stringify(d, null, 2));
    const src = d.buoy ? 'bouee+prev' : 'prev';
    console.log(`ecrit day-${i} (${d.now.slice(0, 10)}) houle ${d.forecast.waveHeight}m/${d.forecast.wavePeriod}s vent ${d.wind.speed}km/h [${src}]`);
  });
  console.log('OK. Enchaine avec : node build-week.mjs');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('ECHEC :', e.message); process.exit(1); });
}
