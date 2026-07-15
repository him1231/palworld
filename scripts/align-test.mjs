import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { readdirSync } from 'fs';

const ROOT = '/Users/him/Repository/palworld';
const img = readFileSync(ROOT + '/public/map/palpagos.jpg').toString('base64');
// gather all palpagos spawn points
const dir = ROOT + '/public/data/spawns/palpagos';
const pts = [];
for (const f of readdirSync(dir)) {
  for (const p of JSON.parse(readFileSync(dir + '/' + f, 'utf8'))) pts.push([p[0], p[1]]);
}
const regions = JSON.parse(readFileSync(ROOT + '/public/data/map/regions.json', 'utf8'));
const reg = regions.find(r => r.id === 'palpagos');
const ext = reg.imageBounds ?? reg.extent; // image-anchored bounds
console.log('points:', pts.length, 'extent:', ext);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 1200 } });
await p.setContent('<canvas id="c" width="2048" height="2048"></canvas>');
await p.evaluate(async ({ img, pts, ext }) => {
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  const im = new Image();
  await new Promise(r => { im.onload = r; im.src = 'data:image/jpeg;base64,' + img; });
  ctx.drawImage(im, 0, 0, 2048, 2048);
  const [minX, minY, maxX, maxY] = ext;
  ctx.fillStyle = 'rgba(255,40,40,0.55)';
  for (const [x, y] of pts) {
    const px = (x - minX) / (maxX - minX) * 2048;
    const py = (1 - (y - minY) / (maxY - minY)) * 2048;
    ctx.fillRect(px - 1.2, py - 1.2, 2.4, 2.4);
  }
}, { img, pts, ext });
const el = await p.locator('#c').elementHandle();
await el.screenshot({ path: '/private/tmp/claude-502/-Users-him-Repository-palworld/de75ba0c-fa45-4c66-9c86-90071dc08c5f/scratchpad/align-overlay.png' });
await b.close();
console.log('done');
