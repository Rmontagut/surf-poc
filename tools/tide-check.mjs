// Verification du predicteur de maree contre des references externes
// (maree.info « Lacanau (Large) » = SHOM, et fr.surf-forecast.com Lacanau).
// References d'aout 2026 figees ci-dessous ; pour re-verifier plus tard,
// remplacer REF par des horaires frais releves sur ces sites.
// Usage : node tools/tide-check.mjs
import { tideExtremesForDate, seaLevelMSL } from './tide-harmonic.mjs';
import fs from 'node:fs';

// Neutralise les decalages pour mesurer les ecarts bruts
const cst = JSON.parse(fs.readFileSync(new URL('./tide-constants.json', import.meta.url), 'utf8'));

const REF = {
  // maree.info « Lacanau (Large) » (SHOM), heure locale, hauteurs zero hydro
  shom: {
    '2026-08-17': [['02:01', 0.85, 'low'], ['08:13', 4.29, 'high'], ['14:12', 0.99, 'low'], ['20:32', 4.32, 'high']],
    '2026-08-18': [['02:39', 1.15, 'low'], ['08:50', 4.05, 'high'], ['14:53', 1.28, 'low'], ['21:11', 4.00, 'high']],
    '2026-08-19': [['03:19', 1.46, 'low'], ['09:31', 3.80, 'high'], ['15:38', 1.59, 'low'], ['21:55', 3.69, 'high']],
    '2026-08-20': [['04:05', 1.76, 'low'], ['10:24', 3.57, 'high'], ['16:34', 1.87, 'low'], ['22:56', 3.41, 'high']],
    '2026-08-21': [['05:05', 2.01, 'low'], ['11:43', 3.40, 'high'], ['17:48', 2.06, 'low']],
    '2026-08-22': [['00:29', 3.25, 'high'], ['06:28', 2.13, 'low'], ['13:16', 3.40, 'high'], ['19:19', 2.07, 'low']],
    '2026-08-23': [['02:04', 3.30, 'high'], ['07:57', 2.07, 'low'], ['14:29', 3.54, 'high'], ['20:36', 1.90, 'low']],
  },
  // fr.surf-forecast.com Lacanau
  sf: {
    '2026-08-13': [['05:43', 4.62, 'high'], ['11:30', 0.64, 'low'], ['17:58', 4.95, 'high']],
    '2026-08-17': [['01:59', 0.21, 'low'], ['08:21', 3.68, 'high'], ['14:14', 0.35, 'low'], ['20:38', 3.71, 'high']],
  },
};

const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

for (const [src, days] of Object.entries(REF)) {
  console.log(`\n=== ${src} ===`);
  const dts = { high: [], low: [] };
  const hts = [];
  for (const [date, evs] of Object.entries(days)) {
    const pred = tideExtremesForDate(date);
    for (const [t, h, ty] of evs) {
      // extreme predit le plus proche du meme type
      let best = null, bd = 1e9;
      for (const p of pred) {
        if (p.type !== ty) continue;
        const d = Math.abs(mins(p.label) - mins(t));
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) { console.log(`${date} ${ty} ${t} : PAS DE PREDICTION`); continue; }
      const dt = mins(t) - mins(best.label);
      dts[ty].push(dt);
      hts.push([h, best.height]);
      console.log(`${date} ${ty === 'high' ? 'PM' : 'BM'} ref ${t} ${h}m | pred ${best.label} ${best.height}m | dt=${dt >= 0 ? '+' : ''}${dt} min, dh=${(h - best.height).toFixed(2)}m`);
    }
  }
  for (const ty of ['high', 'low']) {
    const a = dts[ty];
    if (!a.length) continue;
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    console.log(`${ty}: dt moyen ${mean.toFixed(1)} min (min ${Math.min(...a)}, max ${Math.max(...a)})`);
  }
}
console.log(`\ndatum actuel: offset=${cst.datum.offset} scale=${cst.datum.scale} shiftHigh=${cst.datum.shiftHighMin} shiftLow=${cst.datum.shiftLowMin}`);
