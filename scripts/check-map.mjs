import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 300)); });
p.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 500)));
p.on('requestfailed', (r) => console.log('REQFAIL', r.url(), r.failure()?.errorText));
await p.goto('http://localhost:5199/map');
await p.waitForTimeout(4000);
const counts = await p.evaluate(() => ({
  markers: document.querySelectorAll('.leaflet-marker-icon').length,
  overlays: document.querySelectorAll('.leaflet-image-layer').length,
  panes: document.querySelectorAll('.leaflet-pane').length,
}));
console.log('DOM', JSON.stringify(counts));
await b.close();
