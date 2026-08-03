// Vue paginee « semaine » : rend les 7 pages-jour (meme gabarit que la vue
// principale) puis assemble un prototype HTML plein ecran qui simule la
// navigation d'une liseuse : clic a droite = jour suivant, a gauche = precedent.
// Usage : node build-week.mjs   (genere d'abord les donnees si absentes)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import { renderMain, CANVAS } from './src/render.mjs';

const OUT = 'out/week';
fs.mkdirSync(OUT, { recursive: true });

const dir = 'data/week';
if (!fs.existsSync(dir) || fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length === 0) {
  execFileSync('node', ['tools/gen-week.mjs'], { stdio: 'inherit' });
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

const einkPngs = [];
for (const f of files) {
  const name = path.basename(f, '.json');
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const html = renderMain(data);
  const htmlPath = `${OUT}/${name}.html`;
  const pngPath = `${OUT}/${name}.png`;
  fs.writeFileSync(htmlPath, html);
  execFileSync('wkhtmltoimage', [
    '--enable-local-file-access', '--disable-smart-width', '--quality', '100',
    '--width', String(CANVAS.w), '--height', String(CANVAS.h), htmlPath, pngPath,
  ], { stdio: 'ignore' });
  execFileSync('python3', ['eink.py', pngPath], { stdio: 'ignore' });
  einkPngs.push(`${OUT}/${name}-eink.png`);
  console.log('rendu', name);
}

// --- Prototype liseuse ----------------------------------------------------
const b64 = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
const pages = einkPngs.map(b64);

const proto = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lacanau — vue semaine</title>
<style>
  :root{ --bezel:#3a3f45; --bg:#1d1f21; }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:var(--bg);
    font-family:'DM Mono',ui-monospace,Menlo,monospace;color:#9aa0a6;overflow:hidden}
  #stage{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px}
  #device{position:relative;height:88vh;aspect-ratio:${CANVAS.w}/${CANVAS.h};
    background:var(--bezel);border-radius:16px;padding:14px 14px 44px;
    box-shadow:0 24px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06)}
  #screen{position:relative;height:100%;width:100%;background:#ececeb;overflow:hidden;
    border-radius:3px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
  #page{display:block;width:100%;height:100%;object-fit:contain;background:#ececeb}
  /* Flash de rafraichissement e-ink */
  #flash{position:absolute;inset:0;background:#f4f4f2;opacity:0;pointer-events:none;transition:opacity .09s}
  #device.turning #flash{opacity:1;transition:none}
  .zone{position:absolute;top:0;bottom:0;width:44%;cursor:pointer;display:flex;align-items:center;
    opacity:0;transition:opacity .15s}
  #prev{left:0;justify-content:flex-start;padding-left:18px}
  #next{right:0;justify-content:flex-end;padding-right:18px}
  #screen:hover .zone{opacity:1}
  .chev{font-size:40px;color:rgba(20,20,20,.28);user-select:none}
  .zone.disabled{cursor:default}
  .zone.disabled .chev{opacity:0}
  #kobo-btn{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);
    width:34px;height:18px;border-radius:9px;background:#2b2f33;box-shadow:inset 0 1px 2px rgba(0,0,0,.5)}
  #dots{display:flex;gap:9px;align-items:center}
  .dot{width:7px;height:7px;border-radius:50%;background:#4a4f55;transition:all .15s}
  .dot.on{background:#cfd3d7;transform:scale(1.25)}
  #hint{font-size:12px;letter-spacing:.04em;color:#5c6167}
</style></head>
<body>
  <div id="stage">
    <div id="device">
      <div id="screen">
        <img id="page" alt="page jour">
        <div id="flash"></div>
        <div class="zone" id="prev"><span class="chev">‹</span></div>
        <div class="zone" id="next"><span class="chev">›</span></div>
      </div>
      <div id="kobo-btn"></div>
    </div>
    <div id="dots"></div>
    <div id="hint">Touche la moitié droite pour le jour suivant, la gauche pour revenir · ← →</div>
  </div>
<script>
  const PAGES = ${JSON.stringify(pages)};
  let i = 0;
  const page = document.getElementById('page');
  const device = document.getElementById('device');
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  const dotsBox = document.getElementById('dots');
  PAGES.forEach((_, k) => {
    const d = document.createElement('div'); d.className = 'dot'; d.dataset.k = k;
    dotsBox.appendChild(d);
  });
  const dots = [...dotsBox.children];

  function render(){
    // Flash court facon rafraichissement e-ink, puis bascule de l'image.
    device.classList.add('turning');
    setTimeout(() => {
      page.src = PAGES[i];
      device.classList.remove('turning');
    }, 70);
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    prev.classList.toggle('disabled', i === 0);
    next.classList.toggle('disabled', i === PAGES.length - 1);
  }
  function go(delta){
    const n = Math.min(PAGES.length - 1, Math.max(0, i + delta));
    if (n === i) return;
    i = n; render();
  }
  next.addEventListener('click', () => go(1));
  prev.addEventListener('click', () => go(-1));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  });
  page.src = PAGES[0];
  render();
</script>
</body></html>`;

fs.writeFileSync('out/semaine.html', proto);
console.log('prototype -> out/semaine.html');

// --- PDF 7 pages pour la liseuse -----------------------------------------
// Une page = un jour. Ouvert dans un lecteur (KOReader / Nickel), tourner la
// page = changer de jour, nativement : la navigation « tap a droite = jour
// suivant » sans aucun code embarque. Pages a 300 ppi = plein ecran Kobo.
const PT = (px) => (px * 72) / 300;
const pdf = await PDFDocument.create();
for (const p of einkPngs) {
  const img = await pdf.embedPng(fs.readFileSync(p));
  const page = pdf.addPage([PT(CANVAS.w), PT(CANVAS.h)]);
  page.drawImage(img, { x: 0, y: 0, width: PT(CANVAS.w), height: PT(CANVAS.h) });
}
fs.writeFileSync('out/lacanau-semaine.pdf', await pdf.save());
console.log(`PDF -> out/lacanau-semaine.pdf (${einkPngs.length} pages)`);
