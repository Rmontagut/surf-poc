// Mesure empirique de la position de la ligne de base telle que la calcule
// le moteur de rendu, pour line-height:1. Evite de deviner les metriques.
import fs from 'node:fs';
const S = 1000;
const fonts = [
  ['aujournuit', 'Aujournuit', 'fonts/Aujournuit-Regular.otf', 'opentype'],
  ['mono', 'DM Mono', 'fonts/dm-mono-latin-500-normal.woff', 'woff'],
  ['sans', 'DM Sans', 'fonts/dm-sans-latin-500-normal.woff', 'woff'],
];
const faces = fonts.map(([, fam, file, fmt]) =>
  `@font-face{font-family:'${fam}';src:url(data:font/${fmt};base64,${fs.readFileSync(file).toString('base64')}) format('${fmt}');font-weight:500}`).join('\n');
const blocks = fonts.map(([key, fam], i) =>
  `<div style="position:absolute;left:0;top:${i * 1400}px;font-family:'${fam}';font-size:${S}px;line-height:1;color:#000">H</div>`).join('\n');
fs.writeFileSync('out/calib.html', `<!doctype html><meta charset="utf-8"><style>${faces}
*{margin:0;padding:0}body{width:1200px;height:4200px;background:#fff;position:relative}</style><body>${blocks}</body>`);
console.log('ok');
