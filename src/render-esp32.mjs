// Rendu 540 x 960 (portrait) pour l'ecran ESP32 T5-4.7" (dalle 960x540 tournee).
// Meme contenu que la vue principale, mise en page reprise de l'artboard Figma
// « ESP32 ». Tout noir (ou tout blanc en dark) : coordonnees issues de Figma.
// Le theme se pilote par un seul flag -> tokens CSS + variante d'asset.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  breakingRange, travelBearing, windClass, windVariant, tidalRange,
} from './physics.mjs';
import { buildVerdict } from './verdict.mjs';
import { weatherIcon, ruleH, ruleV, tideCurve, dot } from './glyphs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const CANVAS = { w: 540, h: 960 };

export const THEMES = {
  light: { papier: '#FFFFFF', encre: '#000000' },
  dark: { papier: '#000000', encre: '#FFFFFF' },
};

// --- briques reprises du rendu principal ---------------------------------
const METRICS = {
  aujournuit: { asc: 0.958, desc: 0.2, cap: 0.7, family: 'Aujournuit' },
  mono: { asc: 0.992, desc: 0.31, cap: 0.7, family: 'DM Mono' },
  sans: { asc: 0.992, desc: 0.31, cap: 0.7, family: 'DM Sans' },
};
const CAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'calibration.json'), 'utf8'));
const AUJ_W = JSON.parse(fs.readFileSync(path.join(ROOT, 'fonts', 'aujournuit-widths.json'), 'utf8'));
const measureAuj = (s) => { let w = 0; for (const ch of s) w += AUJ_W[ch] ?? 0.5; return w; };

function wrapCount(str, size, maxWidth) {
  const segments = [];
  str.split(' ').forEach((word, wi) => {
    word.split(/(?<=-)/).forEach((piece, pi) => segments.push({ text: piece, glue: pi === 0 && wi > 0 ? ' ' : '' }));
  });
  let lines = 1, cur = 0;
  for (const seg of segments) {
    const w = measureAuj(seg.text) * size, glue = measureAuj(seg.glue) * size;
    if (cur === 0) { cur = w; continue; }
    if (cur + glue + w <= maxWidth) cur += glue + w; else { lines += 1; cur = w; }
  }
  return lines;
}
const topForBaseline = (baseline, size, m) => baseline - CAL[m] * size;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FR_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function frDateLong(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? `${m[3]} ${FR_MOIS[Number(m[2]) - 1]} ${m[1]}` : '';
}

function text({ x, y, w, size, m = 'mono', anchor = 'boxTop', align = 'left', color = 'var(--encre)', upper = false, content, lh = null }) {
  const metric = METRICS[m];
  let top = anchor === 'baseline' ? topForBaseline(y, size, m) : y;
  const style = [
    'position:absolute', `left:${x}px`, `top:${top}px`, w != null ? `width:${w}px` : '',
    `font-family:'${metric.family}'`, `font-size:${size}px`, `line-height:${lh ?? 1}`,
    `text-align:${align}`, `color:${color}`, upper ? 'text-transform:uppercase' : '', 'white-space:pre-wrap',
  ].filter(Boolean).join(';');
  return `<div style="${style}">${content}</div>`;
}
const abs = (x, y, inner) => `<div style="position:absolute;left:${x}px;top:${y}px">${inner}</div>`;
const fontData = (file) => fs.readFileSync(path.join(ROOT, 'fonts', file)).toString('base64');
const assetB64 = (file) => fs.readFileSync(path.join(ROOT, 'assets', file)).toString('base64');

function fontFaces() {
  return `
@font-face{font-family:'Aujournuit';src:url(data:font/otf;base64,${fontData('Aujournuit-Regular.otf')}) format('opentype');font-weight:400;font-style:normal}
@font-face{font-family:'DM Mono';src:url(data:font/woff;base64,${fontData('dm-mono-latin-500-normal.woff')}) format('woff');font-weight:500;font-style:normal}
@font-face{font-family:'DM Sans';src:url(data:font/woff;base64,${fontData('dm-sans-latin-500-normal.woff')}) format('woff');font-weight:500;font-style:normal}`;
}

// Rotation d'un asset (fleche) autour de son centre, via PIL.
const rotCache = new Map();
function rotatedAsset(file, displaySize, bearing, cx, cy) {
  const deg = ((bearing % 360) + 360) % 360;
  const key = `${file}@${deg.toFixed(1)}`;
  if (!rotCache.has(key)) {
    const dir = path.join(ROOT, 'out', 'rot');
    fs.mkdirSync(dir, { recursive: true });
    const dst = path.join(dir, key.replace(/[^\w.@-]/g, '_') + '.png');
    if (!fs.existsSync(dst)) {
      execFileSync('python3', [path.join(ROOT, 'tools', 'rotate.py'), path.join(ROOT, 'assets', file), String(deg), dst]);
    }
    rotCache.set(key, fs.readFileSync(dst).toString('base64'));
  }
  const rad = (deg * Math.PI) / 180;
  const grow = Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad));
  const w = displaySize * grow;
  return `<div style="position:absolute;left:${(cx - w / 2).toFixed(2)}px;top:${(cy - w / 2).toFixed(2)}px">`
    + `<img src="data:image/png;base64,${rotCache.get(key)}" width="${w.toFixed(2)}" height="${w.toFixed(2)}" style="display:block"></div>`;
}

// --- geometrie de maree pour la bande 504 large --------------------------
const TIDE = { x: 18, y: 686.15, w: 504, h: 46 };
const TIDE_GX = [0.156, 0.502, 0.841];  // positions des extremes (fractions), issues de Figma
function tidePoints(extremes) {
  const cycle = extremes.slice(0, 3);
  const mid = TIDE.h / 2;
  const range = tidalRange(cycle) ?? 0;
  const amp = Math.max(4, Math.min(mid - 3, (range / 5) * (mid - 3)));
  const yFor = (t) => (t === 'high' ? mid - amp : mid + amp);
  const pts = [{ x: 0, y: mid }];
  cycle.forEach((e, i) => pts.push({ x: TIDE_GX[i] * TIDE.w, y: yFor(e.type) }));
  pts.push({ x: TIDE.w, y: mid });
  return { cycle, pts, mid, amp, yFor };
}

// --- rendu ---------------------------------------------------------------
export function renderESP32(d, themeName = 'light') {
  const th = THEMES[themeName] ?? THEMES.light;
  const suffix = themeName === 'dark' ? 'wht' : 'blk';   // variante d'asset
  const stale = d.freshness.ageHours >= d.freshness.staleAfterHours;

  const swellH = d.buoy?.waveHeight ?? d.forecast.waveHeight;
  const period = d.buoy?.period ?? d.forecast.wavePeriod;
  const swellDir = d.buoy?.direction ?? d.forecast.waveDirection;
  const buoyDown = !d.buoy;
  const range = breakingRange(swellH, period, d.calibration?.k ?? 0.39);
  const wc = windClass(d.wind.direction, d.wind.speed);

  const verdict = buildVerdict({
    period, swellDir, windDir: d.wind.direction, windSpeed: d.wind.speed,
    hb: range?.mid ?? null, buoyDown, stale, staleHours: Math.round(d.freshness.ageHours),
  });

  const heightLabel = stale ? '—' : (range ? `${range.low.toFixed(1)}-${range.high.toFixed(1)}` : '—');
  const periodLabel = stale ? 'PÉRIODE: —' : (period != null ? `PÉRIODE: ${Math.round(period)} s` : 'PÉRIODE: —');
  const swellLabel = stale ? '—' : (swellH != null && swellDir != null ? `${swellH.toFixed(1)}m · ${Math.round(swellDir)}°` : 'BOUÉE HS');
  const windLabel = stale ? '—' : `${Math.round(d.wind.speed)} km/h · ${wc}`;

  const parts = [];

  // Zone Metric --------------------------------------------------------
  const HERO = 56;
  parts.push(`<div style="position:absolute;left:18px;top:54.14px;font-family:'Aujournuit';font-size:${HERO}px;line-height:1;white-space:nowrap;color:var(--encre)">`
    + `<span>${esc(heightLabel)}</span>${stale ? '' : `<span style="display:inline-block;width:5px"></span><span style="font-size:44px;line-height:1;vertical-align:baseline">m</span>`}</div>`);
  parts.push(text({ x: 78.5, y: 115.86, w: 130, size: 16, m: 'mono', content: esc(periodLabel) }));

  const swellBearing = swellDir != null ? travelBearing(swellDir) : 0;
  const windBearing = travelBearing(d.wind.direction);
  if (!stale) {
    parts.push(`<img src="data:image/png;base64,${assetB64(`theme/coast-${suffix}.png`)}" width="19.9" height="130" style="position:absolute;left:381.98px;top:30px;display:block">`);
    if (swellDir != null) parts.push(rotatedAsset(`theme/arrow-swell-${suffix}.png`, 104.19, swellBearing, 331.09, 82.09));
    parts.push(rotatedAsset(`theme/arrow-wind-${windVariant(d.wind.speed)}-${suffix}.png`, 104.19, windBearing, 452.8, 82.09));
  }
  parts.push(text({ x: 285, y: 148, w: 92, size: 11, m: 'mono', align: 'center', content: esc(swellLabel) }));
  parts.push(text({ x: 388, y: 148, w: 130, size: 11, m: 'mono', align: 'center', content: esc(windLabel) }));
  parts.push(abs(18, 174, ruleH(504, 3, 2.4)));

  // Zone Accroche ------------------------------------------------------
  const ACC = { top: 197.98, h: 443.55, w: 504 };
  let accSize = 68;
  while (accSize > 38 && wrapCount(verdict, accSize, ACC.w) * accSize > ACC.h) accSize -= 4;
  const accTop = ACC.top + (ACC.h - wrapCount(verdict, accSize, ACC.w) * accSize) / 2;
  parts.push(text({ x: 18, y: accTop, w: ACC.w, size: accSize, m: 'aujournuit', lh: 1, content: esc(verdict) }));

  // Zone Tide ----------------------------------------------------------
  const { cycle, pts, yFor } = tidePoints(d.tide.extremes);
  parts.push(abs(TIDE.x, TIDE.y, tideCurve(TIDE.w, TIDE.h, pts)));
  cycle.forEach((e, i) => {
    const cx = TIDE.x + TIDE_GX[i] * TIDE.w;
    const isHigh = e.type === 'high';
    const dotY = TIDE.y + yFor(e.type);
    parts.push(abs(cx - 3, dotY - 3, dot(6)));
    parts.push(text({
      x: cx - 45, y: isHigh ? TIDE.y - 22 : TIDE.y + TIDE.h + 8, w: 90, size: 13, m: 'sans',
      align: 'center', content: esc(`${isHigh ? 'PM' : 'BM'} ${e.label}`),
    }));
  });

  // Zone Weather -------------------------------------------------------
  const WY = 791.52;
  parts.push(abs(18, WY, ruleH(504, 5, 2.4)));
  parts.push(abs(186, WY + 4, ruleV(96, 6, 2.4)));
  parts.push(abs(354, WY + 4, ruleV(96, 7, 2.4)));
  const cell = (cx, label, value) => {
    parts.push(text({ x: cx - 90, y: WY + 30.23, w: 180, size: 12, m: 'mono', align: 'center', upper: true, content: esc(label) }));
    parts.push(text({ x: cx - 90, y: WY + 40, w: 180, size: 30, m: 'aujournuit', align: 'center', content: esc(value) }));
  };
  cell(102, 'Temp. Air', `${Math.round(d.weather.airTemp)}°C`);
  cell(270, 'Temp. Eau', d.weather.waterTemp != null ? `${Math.round(d.weather.waterTemp)}°C` : '—');
  parts.push(abs(367.41, WY + 26.78, weatherIcon(50, d.weather.icon)));
  parts.push(text({ x: 421.58, y: WY + 33, w: 100, size: 13, m: 'mono', upper: true, content: esc(d.weather.description) }));
  parts.push(text({ x: 421.58, y: WY + 54, w: 100, size: 11, m: 'mono', content: `UV Index: ${d.weather.uvIndex}` }));
  parts.push(abs(18, WY + 104.48, ruleH(504, 8, 2.4)));

  // Zone freshness -----------------------------------------------------
  const FY = 916;
  const viewDateLabel = d.viewDateLabel ?? frDateLong(d.viewDate ?? d.now);
  parts.push(text({ x: 18, y: FY, w: 300, size: 12, m: 'mono', content: esc(`${String(d.spot).toUpperCase()}  ${viewDateLabel}`) }));
  parts.push(text({
    x: 222, y: FY, w: 300, size: 11, m: 'mono', align: 'right',
    content: esc(stale ? `PÉRIMÉ — ${Math.round(d.freshness.ageHours)} H` : `Màj : ${d.freshness.label}`),
  }));

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>
${fontFaces()}
:root{--papier:${th.papier};--encre:${th.encre}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${CANVAS.w}px;height:${CANVAS.h}px;background:var(--papier)}
.frame{position:relative;width:${CANVAS.w}px;height:${CANVAS.h}px;overflow:hidden;background:var(--papier)}
svg{display:block}
</style></head><body><div class="frame">
${parts.join('\n')}
</div></body></html>`;
}
