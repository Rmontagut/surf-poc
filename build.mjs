// Chaine complete : donnees -> HTML -> PNG -> simulation e-ink.
// Usage : node build.mjs [nom-du-scenario]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderMain, CANVAS } from './src/render.mjs';

const only = process.argv[2];
const files = fs.readdirSync('data').filter((f) => f.endsWith('.json'))
  .filter((f) => !only || f.startsWith(only));

fs.mkdirSync('out', { recursive: true });

for (const f of files) {
  const name = path.basename(f, '.json');
  const data = JSON.parse(fs.readFileSync(path.join('data', f), 'utf8'));
  const html = renderMain(data);
  fs.writeFileSync(`out/${name}.html`, html);
  execFileSync('wkhtmltoimage', [
    '--enable-local-file-access', '--disable-smart-width', '--quality', '100',
    '--width', String(CANVAS.w), '--height', String(CANVAS.h),
    `out/${name}.html`, `out/${name}.png`,
  ], { stdio: 'ignore' });
  console.log('rendu', name);
}
