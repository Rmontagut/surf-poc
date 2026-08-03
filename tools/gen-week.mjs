// Genere un jeu de 7 jours (J -> J+6) pour la vue paginee « semaine ».
// Donnees factices mais plausibles (aout, Lacanau) : houle qui monte en milieu
// de semaine puis retombe, vent qui bascule offshore -> onshore -> offshore.
// A remplacer par Open-Meteo une fois les APIs cablees.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'week');
fs.mkdirSync(OUT, { recursive: true });

const YEAR = 2026, MONTH = 8, DAY0 = 2;        // dimanche 2 aout 2026
const UPDATE_LABEL = '02 août 2026 à 08:30';   // meme mise a jour pour toute la semaine

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (mins) => `${pad(Math.floor((mins % 1440) / 60))}:${pad(mins % 60)}`;

// Recit de houle / vent / meteo sur 7 jours.
// swell: [hauteur m, periode s, direction d'origine deg]
// wind:  [vitesse km/h, direction d'origine deg]
// wx:    [icon, description, tempAir, tempEau, uv]
// marnage: amplitude de maree du jour (pilote la courbe : <1.8 mortes,
//          <3.0 moyen-bas, <4.2 moyen-haut, >=4.2 vives)
const DAYS = [
  { swell: [1.2, 9, 250],  wind: [10, 90],  wx: ['clear',  'Grand soleil', 24, 20, 7], marnage: 3.4 },
  { swell: [1.5, 10, 265], wind: [12, 60],  wx: ['partly', 'Peu nuageux',  25, 20, 7], marnage: 3.8 },
  { swell: [1.8, 11, 270], wind: [18, 250], wx: ['partly', 'Peu nuageux',  23, 21, 6], marnage: 4.3 },
  { swell: [2.4, 13, 285], wind: [26, 225], wx: ['rain',   'Pluie',        20, 20, 3], marnage: 4.7 },
  { swell: [2.1, 12, 275], wind: [30, 260], wx: ['cloudy', 'Couvert',      21, 20, 4], marnage: 4.4 },
  { swell: [1.5, 10, 270], wind: [14, 20],  wx: ['partly', 'Éclaircies',   23, 20, 6], marnage: 3.9 },
  { swell: [1.0, 8, 300],  wind: [8, 100],  wx: ['clear',  'Grand soleil', 26, 21, 7], marnage: 3.2 },
];

const MEAN_LEVEL = 2.7;          // niveau moyen (m) au-dessus du zero des cartes
const LOW1_BASE = 6 * 60 + 20;   // premiere basse mer du jour 0 a 06:20
const SHIFT = 50;                // la maree decale d'environ 50 min/jour
const HIGH_OFFSET = 6 * 60 + 12; // pleine mer ~6h12 apres la basse
const LOW2_OFFSET = 12 * 60 + 25;// cycle de 12h25

DAYS.forEach((cfg, i) => {
  const dateISO = `${YEAR}-${pad(MONTH)}-${pad(DAY0 + i)}`;
  const [wh, wp, wd] = cfg.swell;
  const [ws, wdir] = cfg.wind;
  const [icon, description, airTemp, waterTemp, uvIndex] = cfg.wx;

  const lo = +(MEAN_LEVEL - cfg.marnage / 2).toFixed(1);
  const hi = +(MEAN_LEVEL + cfg.marnage / 2).toFixed(1);
  const low1 = LOW1_BASE + i * SHIFT;
  const high = low1 + HIGH_OFFSET;
  const low2 = low1 + LOW2_OFFSET;
  const extreme = (mins, height, type) => ({
    time: `${dateISO}T${hhmm(mins)}:00+02:00`, height, type, label: hhmm(mins),
  });

  const day = {
    spot: 'Lacanau',
    now: `${dateISO}T12:00:00+02:00`,
    // Jour 0 = aujourd'hui : la bouee mesure (mesure legerement != prevision).
    // Jours suivants : pas de mesure, seulement la prevision.
    buoy: i === 0 ? { waveHeight: 1.3, period: 9, direction: 248 } : null,
    forecast: { waveHeight: wh, wavePeriod: wp, waveDirection: wd },
    wind: { speed: ws, direction: wdir },
    weather: { airTemp, waterTemp, description, icon, uvIndex },
    tide: {
      extremes: [
        extreme(low1, lo, 'low'),
        extreme(high, hi, 'high'),
        extreme(low2, lo, 'low'),
      ],
    },
    freshness: { ageHours: 0.3, staleAfterHours: 6, label: UPDATE_LABEL },
    calibration: { k: 0.227 },
  };

  const file = path.join(OUT, `day-${i}.json`);
  fs.writeFileSync(file, JSON.stringify(day, null, 2));
  console.log('genere', path.relative(ROOT, file), `marnage ${cfg.marnage}m`);
});
