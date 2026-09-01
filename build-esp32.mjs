// Rendu ESP32 540x960 en light ET dark, a partir de la vraie donnee du jour.
// Usage : node build-esp32.mjs
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { renderESP32, CANVAS, THEMES } from './src/render-esp32.mjs';

const OUT = 'out/esp32';
fs.mkdirSync(OUT, { recursive: true });

const src = fs.existsSync('data/week/day-0.json') ? 'data/week/day-0.json' : 'data/01-nominal.json';
const data = JSON.parse(fs.readFileSync(src, 'utf8'));

for (const theme of Object.keys(THEMES)) {
  const name = `day-0-${theme}`;
  fs.writeFileSync(`${OUT}/${name}.html`, renderESP32(data, theme));
  execFileSync('wkhtmltoimage', [
    '--enable-local-file-access', '--disable-smart-width', '--quality', '100',
    '--width', String(CANVAS.w), '--height', String(CANVAS.h),
    `${OUT}/${name}.html`, `${OUT}/${name}.png`,
  ], { stdio: 'ignore' });
  execFileSync('python3', ['eink.py', `${OUT}/${name}.png`], { stdio: 'ignore' });
  console.log('rendu', name);
}

// Framebuffers bruts 4 bpp pour le boitier (telecharges par esp32/src/main.cpp).
execFileSync('python3', ['tools/pack-esp32.py', `${OUT}/day-0-light-eink.png`, `${OUT}/lacanau-esp32.bin`]);
execFileSync('python3', ['tools/pack-esp32.py', `${OUT}/day-0-dark-eink.png`, `${OUT}/lacanau-esp32-dark.bin`]);
console.log('-> out/esp32/day-0-{light,dark}-eink.png + lacanau-esp32[-dark].bin');
