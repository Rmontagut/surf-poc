// Generation des elements crayonnes via rough.js, cote Node.
// Les tracés sont produits une fois puis figes dans le SVG : aucun JS
// n'est execute au moment du rendu, ce qui evite toute dependance au
// moteur de rendu. La graine (seed) rend le resultat deterministe —
// important en e-ink, ou un trace qui change a chaque rafraichissement
// aggrave la remanence.

import rough from 'roughjs';

const gen = rough.generator();

const BASE = { roughness: 1.15, bowing: 1.1, disableMultiStroke: false };

/** Convertit un drawable rough en balises <path> SVG. */
function toPaths(drawable, { stroke = 'var(--encre)', strokeWidth = 2.4 } = {}) {
  return gen
    .toPaths(drawable)
    .map((p) => {
      const fill = p.fill && p.fill !== 'none' ? p.fill : 'none';
      const sw = p.strokeWidth && p.fill !== 'none' ? p.strokeWidth : strokeWidth;
      const st = p.stroke === 'none' ? 'none' : stroke;
      return `<path d="${p.d}" fill="${fill}" stroke="${st}" stroke-width="${sw}" stroke-linecap="round"/>`;
    })
    .join('');
}

/** Filet horizontal crayonne. */
export function ruleH(width, seed = 1, strokeWidth = 2.6) {
  const d = gen.line(0, 3, width, 3, { ...BASE, seed, roughness: 0.85, strokeWidth });
  return `<svg width="${width}" height="7" viewBox="0 0 ${width} 7" fill="none">${toPaths(d, { strokeWidth })}</svg>`;
}

/** Filet vertical crayonne. */
export function ruleV(height, seed = 2, strokeWidth = 2.6) {
  const d = gen.line(3, 0, 3, height, { ...BASE, seed, roughness: 0.85, strokeWidth });
  return `<svg width="7" height="${height}" viewBox="0 0 7 ${height}" fill="none">${toPaths(d, { strokeWidth })}</svg>`;
}

/**
 * Fleche de houle : hampe ondulee + pointe.
 * Dessinee pointant vers le NORD, puis pivotee selon la direction de propagation.
 */
export function swellArrow(size, bearing, seed = 7) {
  const s = size;
  const cx = s / 2;
  const w = s * 0.24; // amplitude de l'ondulation
  const top = s * 0.07;
  const bottom = s * 0.97;
  const shaft = [
    `M ${cx} ${bottom}`,
    `C ${cx - w} ${bottom - s * 0.16}, ${cx + w} ${bottom - s * 0.3}, ${cx} ${bottom - s * 0.44}`,
    `C ${cx - w} ${bottom - s * 0.58}, ${cx + w} ${bottom - s * 0.68}, ${cx} ${top + s * 0.06}`,
  ].join(' ');

  const head = s * 0.26;
  const parts = [
    gen.path(shaft, { ...BASE, seed, strokeWidth: 5.4 }),
    gen.line(cx, top, cx - head, top + head * 1.05, { ...BASE, seed: seed + 1, strokeWidth: 5.4 }),
    gen.line(cx, top, cx + head, top + head * 1.05, { ...BASE, seed: seed + 2, strokeWidth: 5.4 }),
  ];

  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none">
    <g transform="rotate(${bearing} ${cx} ${cx})">
      ${parts.map((p) => toPaths(p, { strokeWidth: 5.4 })).join('')}
    </g>
  </svg>`;
}

/**
 * Fleche de vent : grande pointe ouverte + hampe + deux traits de rappel.
 * Dessinee pointant vers le NORD, puis pivotee.
 */
export function windArrow(size, bearing, seed = 21) {
  const s = size;
  const cx = s / 2;
  const top = s * 0.05;
  const head = s * 0.38;
  const sw = 5.6;

  const parts = [
    gen.line(cx, top, cx - head, top + head, { ...BASE, seed, strokeWidth: sw }),
    gen.line(cx, top, cx + head, top + head, { ...BASE, seed: seed + 1, strokeWidth: sw }),
    gen.line(cx, top + s * 0.06, cx, s * 0.95, { ...BASE, seed: seed + 2, strokeWidth: sw }),
    gen.line(cx - s * 0.19, s * 0.5, cx - s * 0.19, s * 0.84, { ...BASE, seed: seed + 3, strokeWidth: sw * 0.8 }),
    gen.line(cx + s * 0.19, s * 0.5, cx + s * 0.19, s * 0.84, { ...BASE, seed: seed + 4, strokeWidth: sw * 0.8 }),
  ];

  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none">
    <g transform="rotate(${bearing} ${cx} ${cx})">
      ${parts.map((p) => toPaths(p, { strokeWidth: sw })).join('')}
    </g>
  </svg>`;
}

/**
 * Courbe de maree. Les points sont fournis en coordonnees du SVG.
 * L'amplitude est pilotee en amont par le marnage du jour.
 */
export function tideCurve(width, height, points, seed = 41) {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const mx = (a.x + b.x) / 2;
    d += ` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
  }
  const drawable = gen.path(d, { ...BASE, seed, roughness: 0.9, strokeWidth: 2.8 });
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${toPaths(drawable, { strokeWidth: 2.8 })}</svg>`;
}

/** Icone meteo : variantes soleil / soleil-nuage / nuage / pluie. */
export function weatherIcon(size, kind = 'partly', seed = 61) {
  const s = size;
  const sw = 2.8;
  const parts = [];

  const sunAt = (cx, cy, r, rays) => {
    parts.push(gen.circle(cx, cy, r * 2, { ...BASE, seed, strokeWidth: sw }));
    if (!rays) return;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r1 = r * 1.32;
      const r2 = r * 1.72;
      parts.push(
        gen.line(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2, {
          ...BASE, seed: seed + i + 1, strokeWidth: sw * 0.85,
        }),
      );
    }
  };

  const cloudAt = (x, y, w) => {
    const h = w * 0.55;
    const d = [
      `M ${x + w * 0.14} ${y + h}`,
      `C ${x - w * 0.05} ${y + h}, ${x - w * 0.05} ${y + h * 0.5}, ${x + w * 0.18} ${y + h * 0.48}`,
      `C ${x + w * 0.2} ${y + h * 0.02}, ${x + w * 0.72} ${y - h * 0.06}, ${x + w * 0.74} ${y + h * 0.42}`,
      `C ${x + w * 1.02} ${y + h * 0.4}, ${x + w * 1.02} ${y + h}, ${x + w * 0.82} ${y + h}`,
      `Z`,
    ].join(' ');
    parts.push(gen.path(d, { ...BASE, seed: seed + 20, strokeWidth: sw }));
  };

  if (kind === 'clear') {
    sunAt(s * 0.5, s * 0.5, s * 0.22, true);
  } else if (kind === 'cloudy') {
    cloudAt(s * 0.06, s * 0.26, s * 0.86);
  } else if (kind === 'rain') {
    cloudAt(s * 0.06, s * 0.14, s * 0.86);
    for (let i = 0; i < 3; i++) {
      const x = s * (0.26 + i * 0.22);
      parts.push(gen.line(x, s * 0.76, x - s * 0.05, s * 0.94, { ...BASE, seed: seed + 30 + i, strokeWidth: sw * 0.9 }));
    }
  } else {
    sunAt(s * 0.68, s * 0.3, s * 0.16, true);
    cloudAt(s * 0.02, s * 0.4, s * 0.72);
  }

  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none">${parts
    .map((p) => toPaths(p, { strokeWidth: sw }))
    .join('')}</svg>`;
}

/** Petit disque plein pour marquer les extremes de maree. */
export function dot(size = 10) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="var(--encre)"/></svg>`;
}
