import { chromium } from 'playwright';

const OUT = process.env.SHOT_DIR ?? '.';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 400)));

await p.goto('http://localhost:5199/map');
await p.waitForSelector('.leaflet-marker-icon', { timeout: 15000 });

// 1. enable effigies (198 pins)
await p.getByText('翠葉鼠雕像').click();
await p.waitForTimeout(800);
console.log('effigy markers:', await p.locator('.leaflet-marker-icon').count());

// 2. add a spawn pal (Anubis) — range circles
await p.getByPlaceholder(/加入帕魯/).fill('阿努比斯');
await p.waitForTimeout(400);
await p.locator('.pal-select .opt').first().click();
await p.waitForTimeout(1200);
console.log('circles (paths):', await p.locator('.leaflet-overlay-pane path, canvas.leaflet-zoom-animated').count());
await p.screenshot({ path: `${OUT}/shot-map-interact.png` });

// 3. points mode + night filter
await p.getByText('出現點', { exact: true }).click();
await p.waitForTimeout(600);
await p.getByText('🌙 夜間').click();
await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/shot-map-points.png` });

// 4. individual pin toggle: expand alpha list and switch one off
await p.locator('.cat-row', { hasText: 'Alpha 頭目' }).locator('.cat-expand').click();
await p.waitForTimeout(400);
const before = await p.locator('.leaflet-marker-icon').count();
await p.locator('.pin-row input[type=checkbox]').nth(1).click(); // first pin after 全開/全關 row is idx? row0 has buttons only
await p.waitForTimeout(500);
const after = await p.locator('.leaflet-marker-icon').count();
console.log('pin toggle markers before/after:', before, after);

// 5. world tree region
await p.getByText('世界樹').click();
await p.waitForTimeout(1200);
console.log('tree markers:', await p.locator('.leaflet-marker-icon').count());
await p.screenshot({ path: `${OUT}/shot-map-tree.png` });

// 6. breeding page quick check
await p.goto('http://localhost:5199/breeding');
await p.waitForTimeout(800);
const inputs = p.getByPlaceholder(/搜尋帕魯/);
await inputs.first().fill('Pengullet');
await p.waitForTimeout(400);
await p.locator('.pal-select .opt').first().click();
await p.waitForTimeout(300);
await inputs.first().fill('Lamball');
await p.waitForTimeout(400);
const opts = await p.locator('.pal-select .opt').allTextContents();
console.log('breeding opts for Lamball:', opts.slice(0, 3));
await p.locator('.pal-select .opt').first().click();
await p.waitForTimeout(500);
console.log('breed result:', (await p.locator('.breed-result').textContent().catch(() => 'NONE'))?.slice(0, 120));
await p.screenshot({ path: `${OUT}/shot-breeding.png` });

// 7. pal detail page
await p.goto('http://localhost:5199/pal/Anubis');
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/shot-detail.png`, fullPage: true });
console.log('detail h1:', await p.locator('h1').textContent());

await b.close();
console.log('done');
