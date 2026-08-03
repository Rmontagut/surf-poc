// Rendu HTML de la vue principale, 1072 x 1448 (Kobo Clara HD, portrait).
// Positionnement absolu issu des coordonnees exactes du frame Figma :
// c'est a la fois fidele au pixel et compatible avec tous les moteurs de rendu.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  breakingRange, travelBearing, windClass, cardinal, windVariant,
  tidalRange, tideHeightAt, tideDirection,
} from './physics.mjs';
import { buildVerdict } from './verdict.mjs';
import { weatherIcon } from './glyphs.mjs';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const CANVAS = { w: 1072, h: 1448 };

// --- Metriques typographiques -------------------------------------------
// Aujournuit : upm 1000, ascender 958, descender 200, capHeight 700.
// DM Mono / DM Sans : ascender 992, descender 310, capHeight 700.
// K = distance du haut de la boite CSS a la ligne de base, en em,
// pour line-height:1. Recalibre par tools/calibrate.mjs.
const METRICS = {
  aujournuit: { asc: 0.958, desc: 0.2, cap: 0.7, family: 'Aujournuit' },
  mono: { asc: 0.992, desc: 0.31, cap: 0.7, family: 'DM Mono' },
  sans: { asc: 0.992, desc: 0.31, cap: 0.7, family: 'DM Sans' },
};

const TIDE_META = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tide-meta.json'), 'utf8'));

/**
 * Choix de la courbe dessinee a la main selon le marnage du jour.
 * Quatre variantes seulement : le cycle fait toujours 12 h 25 et la forme
 * est toujours la meme, seule l'amplitude change.
 */
function tideVariant(range) {
  if (range == null) return 'moyen-bas';
  if (range < 1.8) return 'mortes-eaux';
  if (range < 3.0) return 'moyen-bas';
  if (range < 4.2) return 'moyen-haut';
  return 'vives-eaux';
}

const CAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'calibration.json'), 'utf8'));
const AUJ_W = JSON.parse(fs.readFileSync(path.join(ROOT, 'fonts', 'aujournuit-widths.json'), 'utf8'));

/** Largeur exacte d'une chaine en Aujournuit, en em (metriques hmtx du fichier). */
function measureAuj(str) {
  let w = 0;
  for (const ch of str) w += AUJ_W[ch] ?? 0.5;
  return w;
}

/**
 * Retour a la ligne gourmand, aligne sur le comportement du moteur de rendu :
 * les coupures sont possibles aux espaces ET apres un trait d'union
 * ("sud-ouest" peut se couper en "sud-" / "ouest").
 */
function wrapCount(str, size, maxWidth) {
  const segments = [];
  str.split(' ').forEach((word, wi) => {
    const pieces = word.split(/(?<=-)/);
    pieces.forEach((piece, pi) => {
      segments.push({ text: piece, glue: pi === 0 && wi > 0 ? ' ' : '' });
    });
  });

  let lines = 1;
  let cur = 0;
  for (const seg of segments) {
    const w = measureAuj(seg.text) * size;
    const glue = measureAuj(seg.glue) * size;
    if (cur === 0) { cur = w; continue; }
    if (cur + glue + w <= maxWidth) cur += glue + w;
    else { lines += 1; cur = w; }
  }
  return lines;
}

/** Haut de la boite CSS pour poser la ligne de base a `baseline`, line-height:1. */
function topForBaseline(baseline, size, m) {
  return baseline - CAL[m] * size;
}

/** Haut de la boite CSS pour que le haut des capitales tombe sur `capTop`. */
function topForCapTop(capTop, size, m) {
  return topForBaseline(capTop + METRICS[m].cap * size, size, m);
}

/**
 * Assets dessines a la main, exportes depuis Figma en PNG.
 * Le PNG plutot que le SVG : le grain de crayon vectorise pese 400 Ko a 1 Mo
 * par fleche, pour aucun gain visible sur un ecran 16 niveaux de gris.
 * Chaque fleche pointe vers le NORD dans son carre ; le code la pivote
 * autour du centre du carre selon la direction de propagation.
 */
const rotCache = new Map();

/**
 * Renvoie un asset pivote, centre sur (cx, cy).
 * La rotation est faite en amont par PIL plutot qu'en CSS : Qt WebKit rogne
 * les images transformees, et un reechantillonnage propre vaut mieux en e-ink.
 */
function rotatedAsset(file, displaySize, bearing, cx, cy, opacity = 1) {
  const deg = ((bearing % 360) + 360) % 360;
  const key = `${file}@${deg.toFixed(1)}`;
  if (!rotCache.has(key)) {
    const dir = path.join(ROOT, 'out', 'rot');
    fs.mkdirSync(dir, { recursive: true });
    const dst = path.join(dir, key.replace(/[^\w.@-]/g, '_') + '.png');
    if (!fs.existsSync(dst)) {
      execFileSync('python3', [path.join(ROOT, 'tools', 'rotate.py'),
        path.join(ROOT, 'assets', file), String(deg), dst]);
    }
    rotCache.set(key, {
      b64: fs.readFileSync(dst).toString('base64'),
      src: file,
    });
  }
  const { b64 } = rotCache.get(key);
  // L'image pivotee est plus grande que l'originale : on la redimensionne au
  // ratio de la diagonale pour que le dessin garde sa taille apparente.
  const rad = (deg * Math.PI) / 180;
  const grow = Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad));
  const w = displaySize * grow;
  const op = opacity < 1 ? `;opacity:${opacity}` : '';
  return `<div style="position:absolute;left:${(cx - w / 2).toFixed(2)}px;top:${(cy - w / 2).toFixed(2)}px${op}">`
    + `<img src="data:image/png;base64,${b64}" width="${w.toFixed(2)}" height="${w.toFixed(2)}" style="display:block"></div>`;
}

const fontData = (file) => fs.readFileSync(path.join(ROOT, 'fonts', file)).toString('base64');

// --- Dividers dessines a la main (Figma), exportes en PNG 2x -------------
// Remplacent les filets generes par rough.js : trace crayonne coherent avec
// les fleches et les courbes de maree, et fige (aucun JS au rendu).
const assetB64 = (file) => fs.readFileSync(path.join(ROOT, 'assets', file)).toString('base64');
const DIV_H = assetB64('divider-h.png');  // 2016 x 16 intrinseque (ratio 126:1)
const DIV_V = assetB64('divider-v.png');  // 14 x 416 intrinseque

/** Divider horizontal, coin haut-gauche en (x, y), affiche a `width` px. */
function dividerH(x, y, width) {
  const h = width * (16 / 2016);
  return `<img src="data:image/png;base64,${DIV_H}" width="${width}" height="${h.toFixed(2)}" `
    + `style="position:absolute;left:${x}px;top:${y.toFixed(2)}px;display:block">`;
}
/** Divider vertical, coin haut-gauche en (x, y), affiche a `height` px. */
function dividerV(x, y, height) {
  const w = height * (14 / 416);
  return `<img src="data:image/png;base64,${DIV_V}" width="${w.toFixed(2)}" height="${height}" `
    + `style="position:absolute;left:${x.toFixed(2)}px;top:${y.toFixed(2)}px;display:block">`;
}

function fontFaces() {
  return `
@font-face{font-family:'Aujournuit';src:url(data:font/otf;base64,${fontData('Aujournuit-Regular.otf')}) format('opentype');font-weight:400;font-style:normal}
@font-face{font-family:'DM Mono';src:url(data:font/woff;base64,${fontData('dm-mono-latin-500-normal.woff')}) format('woff');font-weight:500;font-style:normal}
@font-face{font-family:'DM Sans';src:url(data:font/woff;base64,${fontData('dm-sans-latin-500-normal.woff')}) format('woff');font-weight:500;font-style:normal}`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Date longue en francais a partir du prefixe YYYY-MM-DD d'une chaine ISO.
// On lit la date directement dans la chaine pour ne dependre d'aucun fuseau.
const FR_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function frDateLong(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return '';
  return `${m[3]} ${FR_MOIS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Bloc de texte absolu. `anchor` : 'capTop' | 'baseline' | 'boxTop'. */
function text({
  x, y, w, size, m = 'mono', anchor = 'boxTop', align = 'left',
  color = 'var(--encre)', upper = false, content, lh = null, ls = null,
}) {
  const metric = METRICS[m];
  const lineHeight = lh ?? 1;
  let top;
  if (anchor === 'capTop') top = topForCapTop(y, size, m);
  else if (anchor === 'baseline') top = topForBaseline(y, size, m);
  // 'boxTop' : Figma et CSS calculent le demi-interligne de la meme facon,
  // le haut de la boite de ligne se reporte donc tel quel.
  else top = y;

  const style = [
    'position:absolute',
    `left:${x}px`,
    `top:${top}px`,
    w != null ? `width:${w}px` : '',
    `font-family:'${metric.family}'`,
    `font-size:${size}px`,
    `line-height:${lineHeight}`,
    `text-align:${align}`,
    `color:${color}`,
    upper ? 'text-transform:uppercase' : '',
    ls ? `letter-spacing:${ls}px` : '',
    'white-space:pre-wrap',
  ].filter(Boolean).join(';');

  return `<div style="${style}">${content}</div>`;
}

function abs(x, y, inner) {
  return `<div style="position:absolute;left:${x}px;top:${y}px">${inner}</div>`;
}

// --- Geometrie de la courbe de maree ------------------------------------

const TIDE = { x: 48, y: 988.068, w: 976, h: 88.66 };
const MAX_RANGE = 5.0;   // marnage de vive-eau de reference a Lacanau
const MAX_AMP = 38;      // demi-amplitude max en px

function tideGeometry(extremes) {
  if (!extremes || extremes.length < 2) return null;
  const times = extremes.map((e) => new Date(e.time).getTime());
  const pad = 2 * 3600 * 1000;
  const t0 = times[0] - pad;
  const t1 = times[times.length - 1] + pad;
  const range = tidalRange(extremes) ?? 0;
  const amp = Math.max(6, Math.min(MAX_AMP, (range / MAX_RANGE) * MAX_AMP));
  const mid = TIDE.h / 2;
  const heights = extremes.map((e) => e.height);
  const hi = Math.max(...heights);
  const lo = Math.min(...heights);

  const toX = (t) => ((t - t0) / (t1 - t0)) * TIDE.w;
  const toY = (h) => {
    if (hi === lo) return mid;
    const norm = (h - lo) / (hi - lo);      // 0 = basse, 1 = haute
    return mid + amp - norm * 2 * amp;      // y inverse
  };

  const pts = [{ x: 0, y: toY((hi + lo) / 2) }];
  extremes.forEach((e, i) => pts.push({ x: toX(times[i]), y: toY(e.height) }));
  pts.push({ x: TIDE.w, y: toY((hi + lo) / 2) });

  return { pts, toX, toY, amp, range };
}

// --- Vue principale ------------------------------------------------------

export function renderMain(d) {
  const now = new Date(d.now).getTime();
  const stale = d.freshness.ageHours >= d.freshness.staleAfterHours;

  // Donnees perimees : les placeholders « — » sont en gris moyen (presence
  // discrete, clairement vides), pas a l'encre. La maree (cache annuel) et la
  // meteo restent a l'encre.
  const dataColor = stale ? 'var(--gris-moyen)' : 'var(--encre)';

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

  // Donnees perimees : on ne montre AUCUN chiffre du moment. Hauteur, periode,
  // houle et vent passent en tiret, les fleches sont masquees (une fleche sans
  // donnee mentirait). La phrase d'accroche porte seule l'etat hors ligne.
  const heightLabel = stale ? '—'
    : (range ? `${range.low.toFixed(1)}-${range.high.toFixed(1)}` : '—');
  const periodLabel = stale ? 'PÉRIODE: —'
    : (period != null ? `PÉRIODE: ${Math.round(period)} s` : 'PÉRIODE: —');
  const swellLabel = stale ? '—'
    : (swellH != null && swellDir != null ? `${swellH.toFixed(1)}m · ${Math.round(swellDir)}°` : 'BOUÉE HS');
  const windLabel = stale ? '—' : `${Math.round(d.wind.speed)} km/h · ${wc}`;

  const geo = tideGeometry(d.tide.extremes);
  const tideDir = tideDirection(d.tide.extremes, now);

  const parts = [];

  // Zone Metric ----------------------------------------------------------
  const HERO_BASELINE = 186.898;
  parts.push(
    `<div style="position:absolute;left:32px;top:${topForBaseline(HERO_BASELINE, 154.114, 'aujournuit')}px;
      font-family:'Aujournuit';font-size:154.114px;line-height:1;white-space:nowrap;color:${dataColor}">
      <span>${esc(heightLabel)}</span>${stale ? '' : '<span style="display:inline-block;width:8px"></span><span style="font-size:123.291px;line-height:1;vertical-align:baseline">m</span>'}
    </div>`,
  );
  parts.push(text({
    x: 130.5, y: 206.898, w: 250, size: 32, m: 'mono', align: 'center',
    lh: 1.302, color: dataColor, content: esc(periodLabel),
  }));

  const swellBearing = swellDir != null ? travelBearing(swellDir) : 0;
  const windBearing = travelBearing(d.wind.direction);
  if (swellDir != null && !stale) {
    parts.push(rotatedAsset('arrow-swell.png', 214.38, swellBearing, 516 + 107.19, 30 + 107.19));
  }
  parts.push(text({
    x: 560.69, y: 272.797, w: 125, size: 18.91, m: 'mono', align: 'center',
    lh: 1.302, color: dataColor, content: esc(swellLabel),
  }));
  if (!stale) {
    parts.push(rotatedAsset(`arrow-wind-${windVariant(d.wind.speed)}.png`, 214.38, windBearing,
      788.919 + 107.19, 30 + 107.19));
  }
  parts.push(text({
    x: 793.61, y: 272.797, w: 205, size: 18.91, m: 'mono', align: 'center',
    lh: 1.302, color: dataColor, content: esc(windLabel),
  }));
  parts.push(dividerH(32, 331.8, 1008));

  // Zone Accroche --------------------------------------------------------
  // La phrase est de longueur variable : on adapte le corps pour qu'elle
  // tienne toujours dans la zone, et on recentre le bloc verticalement.
  const ACC = { top: 347.598, h: 580, w: 1008 };
  let accSize = 125;
  while (accSize > 74 && wrapCount(verdict, accSize, ACC.w) * accSize > ACC.h) accSize -= 5;
  const accLines = wrapCount(verdict, accSize, ACC.w);
  const accTop = ACC.top + (ACC.h - accLines * accSize) / 2;
  parts.push(text({
    x: 32, y: accTop, w: ACC.w, size: accSize, m: 'aujournuit', lh: 1,
    content: esc(verdict),
  }));

  // Zone Tide ------------------------------------------------------------
  // Les extremes tombent toujours a 10 / 50 / 90 % de la largeur du bloc :
  // le cycle de maree dure 12 h 25, sa forme ne change jamais. Les heures
  // sont donc a des positions fixes, elles ne bougent pas d'un jour a l'autre.
  const cycle = d.tide.extremes.slice(0, 3);
  const startsHigh = cycle[0]?.type === 'high';
  const variant = tideVariant(tidalRange(cycle));
  const tm = TIDE_META[variant];
  const file = `tide-${variant}${startsHigh ? '-flip' : ''}.png`;
  const blockTop = startsHigh ? tm.blockTopFlip : tm.blockTop;
  const tideB64 = fs.readFileSync(path.join(ROOT, 'assets', file)).toString('base64');
  parts.push(`<img src="data:image/png;base64,${tideB64}" width="${tm.w}" height="${tm.h}" `
    + `style="position:absolute;left:${TIDE.x}px;top:${(TIDE.y - blockTop).toFixed(2)}px;display:block">`);

  const GUIDES = [97.5996, 488, 878.4];
  const LABEL_ABOVE = TIDE.y - 8 - 27;
  const LABEL_BELOW = TIDE.y + TIDE.h + 8;
  cycle.forEach((e, i) => {
    const cx = TIDE.x + GUIDES[i];
    const isHigh = e.type === 'high';
    parts.push(text({
      x: cx - 70, y: isHigh ? LABEL_ABOVE : LABEL_BELOW, w: 140, size: 21, m: 'sans',
      align: 'center', lh: 1.302, content: esc(`${isHigh ? 'PM' : 'BM'} ${e.label}`),
    }));
  });

  // Zone Weather ---------------------------------------------------------
  parts.push(dividerH(32, 1163.2, 1008));
  parts.push(dividerV(365, 1166.199, 208));
  parts.push(dividerV(701, 1166.199, 208));

  const cell = (cx, label, value) => {
    parts.push(text({
      x: cx - 150, y: 1226.199, w: 300, size: 22, m: 'mono', align: 'center',
      lh: 1.302, upper: true, content: esc(label),
    }));
    parts.push(text({
      x: cx - 150, y: 1259.199, w: 300, size: 78, m: 'aujournuit', anchor: 'capTop',
      align: 'center', content: esc(value),
    }));
  };
  cell(200, 'Temp. Air', `${Math.round(d.weather.airTemp)}°C`);
  cell(536, 'Temp. Eau', d.weather.waterTemp != null ? `${Math.round(d.weather.waterTemp)}°C` : '—');

  parts.push(abs(731.856, 1220.055, weatherIcon(100.287, d.weather.icon)));
  parts.push(text({
    x: 840.143, y: 1236.199, w: 200, size: 26, m: 'mono', lh: 1.302,
    upper: true, content: esc(d.weather.description),
  }));
  parts.push(text({
    x: 840.143, y: 1278.199, w: 200, size: 20, m: 'mono', lh: 1.302,
    content: `UV Index: ${d.weather.uvIndex}`,
  }));
  parts.push(dividerH(32, 1371.2, 1008));

  // Zone freshness -------------------------------------------------------
  // Gauche : ville + date du jour affiche (encre). Sur la vue paginee, cette
  // date est le repere de navigation — quel jour on regarde. Droite : date de
  // mise a jour, grisee par precaution (elle ne doit jamais se lire comme la
  // date du jour), ou marqueur « perime ».
  const viewDateLabel = d.viewDateLabel ?? frDateLong(d.viewDate ?? d.now);
  parts.push(text({
    x: 32, y: 1387, w: 600, size: 24, m: 'mono', lh: 1.302,
    content: esc(`${String(d.spot).toUpperCase()}  ${viewDateLabel}`),
  }));
  parts.push(text({
    x: 440, y: 1388, w: 600, size: 22, m: 'mono', lh: 1.302, align: 'right',
    color: stale ? 'var(--encre)' : 'var(--gris-moyen)',
    // Le glyphe ⚠ n'existe pas dans DM Mono : marqueur purement typographique.
    content: esc(stale ? `PÉRIMÉ — DONNÉES DE ${Math.round(d.freshness.ageHours)} H` : `Màj : ${d.freshness.label}`),
  }));

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>
${fontFaces()}
:root{--papier:#FFFFFF;--encre:#000000;--gris-fort:#404040;--gris-moyen:#808080;--gris-clair:#C0C0C0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${CANVAS.w}px;height:${CANVAS.h}px;background:var(--papier)}
.frame{position:relative;width:${CANVAS.w}px;height:${CANVAS.h}px;overflow:hidden;background:var(--papier)}
svg{display:block}
</style></head><body><div class="frame">
${parts.join('\n')}
</div></body></html>`;
}
