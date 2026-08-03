// Test hors-reseau du transform de fetch.mjs : on injecte des reponses
// simulees (Open-Meteo / WorldTides / CANDHIS) et on verifie que buildDays
// produit 7 jours valides, rendus sans erreur par renderMain.
import assert from 'node:assert';
import { buildDays } from './fetch.mjs';
import { renderMain } from '../src/render.mjs';

const dates = ['2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08'];

function hourly(fields) {
  const time = []; const cols = {};
  Object.keys(fields).forEach((f) => { cols[f] = []; });
  for (const d of dates) for (let h = 0; h < 24; h++) {
    time.push(`${d}T${String(h).padStart(2, '0')}:00`);
    for (const f in fields) cols[f].push(fields[f](d, h));
  }
  return { time, ...cols };
}

const marine = {
  hourly: hourly({
    swell_wave_height: (d, h) => 1.4 + (h % 5) * 0.1,
    swell_wave_period: (d, h) => 10 + (h % 3),
    swell_wave_direction: () => 270,
    wave_height: () => 1.6, wave_period: () => 9, wave_direction: () => 275,
    sea_surface_temperature: () => 20,
  }),
  current: { time: '2026-08-02T09:00', swell_wave_height: 1.1, swell_wave_period: 9, swell_wave_direction: 250, wave_height: 1.3, wave_period: 8, wave_direction: 255, sea_surface_temperature: 20 },
};
const forecast = {
  daily: { time: dates, weather_code: dates.map(() => 1) },
  hourly: hourly({
    temperature_2m: () => 22,
    weather_code: (d) => (d === '2026-08-05' ? 61 : 1),   // pluie le 05
    wind_speed_10m: () => 15, wind_direction_10m: () => 90,
    uv_index: (d, h) => (h === 12 ? 6 : 2),
  }),
  current: { time: '2026-08-02T09:00', temperature_2m: 21, weather_code: 0, wind_speed_10m: 10, wind_direction_10m: 90 },
};
const tides = [];
for (const d of dates) {
  tides.push({ date: d, time: `${d}T05:00:00Z`, height: 0.9, type: 'low', label: '06:30' });
  tides.push({ date: d, time: `${d}T11:00:00Z`, height: 4.1, type: 'high', label: '12:40' });
  tides.push({ date: d, time: `${d}T17:00:00Z`, height: 1.0, type: 'low', label: '18:55' });
}
const buoy = { waveHeight: 1.3, period: 9, direction: 248, waterTemp: 20 };

const days = buildDays({ marine, forecast, tides, buoy, fetchedAtISO: '2026-08-02T08:30' });

assert.equal(days.length, 7, '7 jours');
assert.ok(days[0].buoy && days[0].buoy.waveHeight === 1.3, 'J0 porte la bouee mesuree');
assert.equal(days[1].buoy, null, 'J1 sans bouee');
assert.equal(days[0].forecast.waveHeight, 1.1, 'J0 utilise le courant (swell 1.1)');
assert.equal(days[3].weather.icon, 'rain', 'J3 (05 aout) = pluie via code 61');
assert.ok(days[0].tide.extremes.length >= 2, 'marees presentes');
assert.ok(!('date' in days[0].tide.extremes[0]), 'champ interne date retire');
assert.ok(days[0].freshness.label.includes('août'), 'label maj en FR');
for (const d of days) {
  const html = renderMain(d);
  assert.ok(html.includes('LACANAU'), 'rendu contient la ville');
}
console.log('OK — 7 jours, J0 bouee+courant, J3 pluie, marees, rendus sans erreur.');
console.log('  J0 forecast', JSON.stringify(days[0].forecast), '| eau', days[0].weather.waterTemp, '| tide', days[0].tide.extremes.length);
console.log('  J3 forecast', JSON.stringify(days[3].forecast), '| meteo', days[3].weather.icon, days[3].weather.description);
