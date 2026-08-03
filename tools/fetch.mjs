// Recuperation des vraies donnees -> data/week/day-0..6.json
// A LANCER LA OU IL Y A INTERNET (ta machine / un serveur), pas dans le sandbox
// Cowork (reseau verrouille). Puis : node build-week.mjs.
//
// Sources :
//   - Open-Meteo Marine + Forecast : houle, vent, meteo, temp. eau (gratuit, sans cle)
//   - WorldTides (extremes)        : marees            -> env WORLDTIDES_KEY
//   - CANDHIS (Cerema) getCampTR    : houle MESUREE J0  -> env CANDHIS_TOKEN (bouee 03302)
//
// Sans les cles : Open-Meteo suffit a tout rendre ; marees en repli synthetique
// (averti) et bouee ignoree (repli sur le modele). Avec les cles : 100% reel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  worldtides: process.env.WORLDTIDES_KEY || null,
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

// Heure/date locales Europe/Paris d'un timestamp unix (pour WorldTides, en UTC).
const PARIS_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: CFG.tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const PARIS_HM = new Intl.DateTimeFormat('en-GB', { timeZone: CFG.tz, hour: '2-digit', minute: '2-digit', hour12: false });

// --- Marees ---------------------------------------------------------------
async function fetchTides() {
  if (!KEYS.worldtides) return null;
  const start = Math.floor(Date.now() / 1000) - 12 * 3600; // capture la maree du matin
  const url = `https://www.worldtides.info/api/v3?extremes&lat=${CFG.lat}&lon=${CFG.lon}`
    + `&start=${start}&days=${CFG.days + 2}&key=${KEYS.worldtides}`;
  const j = await getJSON(url);
  if (!Array.isArray(j.extremes)) throw new Error('WorldTides : reponse sans extremes');
  return j.extremes.map((e) => {
    const d = new Date(e.dt * 1000);
    return {
      date: PARIS_DATE.format(d),
      time: new Date(e.dt * 1000).toISOString(),
      height: +Number(e.height).toFixed(2),
      type: String(e.type).toLowerCase() === 'high' ? 'high' : 'low',
      label: PARIS_HM.format(d),
    };
  });
}

// Repli : maree synthetique plausible quand pas de cle (cf gen-week).
function synthTideDay(dateStr, i) {
  const mean = 2.7;
  const marnage = 3.6;
  const lo = +(mean - marnage / 2).toFixed(1);
  const hi = +(mean + marnage / 2).toFixed(1);
  const base = 6 * 60 + 20 + i * 50;
  const hhmm = (m) => `${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`;
  const mk = (m, h, t) => ({ time: `${dateStr}T${hhmm(m)}:00+02:00`, height: h, type: t, label: hhmm(m) });
  return [mk(base, lo, 'low'), mk(base + 372, hi, 'high'), mk(base + 745, lo, 'low')];
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

    // Marees du jour : vraies (WorldTides) filtrees par date, sinon repli.
    let extremes = tides ? tides.filter((e) => e.date === dateStr).slice(0, 3) : [];
    if (extremes.length < 2) extremes = synthTideDay(dateStr, i);
    extremes = extremes.map(({ date, ...rest }) => rest); // on retire le champ interne 'date'

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

  let tides = null;
  try { tides = await fetchTides(); } catch (e) { console.warn('! marees :', e.message); }
  if (!tides) console.warn(KEYS.worldtides ? '! marees indisponibles -> repli synthetique' : '! WORLDTIDES_KEY absente -> marees synthetiques');

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
