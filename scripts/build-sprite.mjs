/**
 * Builds a WebP sprite sheet of all pal icons (for the single-file artifact).
 * Output: .cache/pal-sprite.json  { dataUri, size, cols, ids: [palId in grid order] }
 * Uses headless Chromium (canvas) so no native image deps are needed.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICON_DIR = path.join(ROOT, 'public', 'img', 'pals');
const OUT = path.join(ROOT, '.cache', 'pal-sprite.json');
const CELL = 40;

const pals = JSON.parse(readFileSync(path.join(ROOT, 'public', 'data', 'pals.json'), 'utf8'));
const files = new Set(readdirSync(ICON_DIR));
const entries = pals
  .filter((p) => p.icon && files.has(p.icon))
  .map((p) => ({
    id: p.id,
    uri: `data:image/${p.icon.endsWith('.webp') ? 'webp' : 'png'};base64,${readFileSync(path.join(ICON_DIR, p.icon)).toString('base64')}`,
  }));

const cols = Math.ceil(Math.sqrt(entries.length));
const rows = Math.ceil(entries.length / cols);
console.log(`${entries.length} icons → ${cols}x${rows} grid @ ${CELL}px`);

const browser = await chromium.launch();
const page = await browser.newPage();
const dataUri = await page.evaluate(async ({ uris, cols, rows, cell }) => {
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');
  await Promise.all(uris.map((uri, i) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, (i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = uri;
  })));
  return canvas.toDataURL('image/webp', 0.75);
}, { uris: entries.map((e) => e.uri), cols, rows, cell: CELL });
await browser.close();

writeFileSync(OUT, JSON.stringify({ dataUri, size: CELL, cols, ids: entries.map((e) => e.id) }));
console.log('sprite:', Math.round(dataUri.length / 1024), 'KB →', OUT);
