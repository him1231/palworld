/**
 * Builds a single-file, self-contained "lite" edition of the guide site,
 * suitable for publishing as a Claude Artifact (strict CSP: no external
 * requests — Leaflet, data, and the map underlay are all inlined).
 *
 * Kept: full pal stat table, interactive map (POI categories with per-pin
 * toggles, alpha pins, precomputed spawn-range circles, day/night), breeding
 * calculator (both directions), element chart, data version/attribution.
 * Dropped vs full site: pal icons, raw spawn points mode, items list.
 *
 * Usage: node scripts/build-artifact.mjs <output.html>
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'public', 'data');
const OUT = process.argv[2] ?? path.join(ROOT, '.cache', 'palworld-artifact.html');

const readJSON = (p) => JSON.parse(readFileSync(path.join(DATA, p), 'utf8'));

const pals = readJSON('pals.json');
const breeding = readJSON('breeding.json');
const pois = readJSON('map/pois.json');
const alphas = readJSON('map/alphas.json');
const regions = readJSON('map/regions.json');
const meta = readJSON('meta.json');

// pal icon sprite sheet (generate with scripts/build-sprite.mjs)
let sprite = null;
const spritePath = path.join(ROOT, '.cache', 'pal-sprite.json');
if (existsSync(spritePath)) {
  sprite = JSON.parse(readFileSync(spritePath, 'utf8'));
  console.log('sprite sheet:', sprite.ids.length, 'icons,', Math.round(sprite.dataUri.length / 1024), 'KB');
} else {
  console.warn('! no sprite sheet (.cache/pal-sprite.json) — run scripts/build-sprite.mjs first; icons skipped');
}

// ---- precompute spawn-range clusters (ports MapPage clustering) ----
function clusterPoints(pts, cell = 80) {
  if (!pts.length) return [];
  const cells = new Map();
  for (const p of pts) {
    const k = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(p);
  }
  const seen = new Set();
  const out = [];
  for (const start of cells.keys()) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const members = [];
    while (stack.length) {
      const k = stack.pop();
      members.push(...cells.get(k));
      const [gx, gy] = k.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const nk = `${gx + dx},${gy + dy}`;
        if (!seen.has(nk) && cells.has(nk)) { seen.add(nk); stack.push(nk); }
      }
    }
    let sx = 0, sy = 0, lo = Infinity, hi = -Infinity;
    for (const m of members) { sx += m[0]; sy += m[1]; lo = Math.min(lo, m[3]); hi = Math.max(hi, m[4]); }
    const cx = sx / members.length, cy = sy / members.length;
    let r = 0;
    for (const m of members) r = Math.max(r, Math.hypot(m[0] - cx, m[1] - cy));
    out.push([Math.round(cx), Math.round(cy), Math.round(Math.max(r + 18, 30)), members.length, lo, hi]);
  }
  return out;
}

const clusters = { palpagos: {}, tree: {} };
for (const region of ['palpagos', 'tree']) {
  const dir = path.join(DATA, 'spawns', region);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    const palId = f.replace(/\.json$/, '');
    const pts = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
    const day = clusterPoints(pts.filter((p) => p[2] === 0));
    const night = clusterPoints(pts.filter((p) => p[2] === 1));
    if (day.length || night.length) clusters[region][palId] = { d: day, n: night };
  }
}
console.log('clusters:', Object.keys(clusters.palpagos).length, '+', Object.keys(clusters.tree).length, 'pals');

// ---- compressed underlay ----
let mapDataUri = null;
const srcMap = ['.cache/palpagos-8192.webp', 'public/map/palpagos.jpg', 'public/map/palpagos.webp']
  .map((p) => path.join(ROOT, p)).find(existsSync);
if (srcMap) {
  const tmp = path.join(ROOT, '.cache', 'palpagos-1280.jpg');
  const attempts = [
    ['sips', ['-Z', '1280', '-s', 'format', 'jpeg', '-s', 'formatOptions', '55', srcMap, '--out', tmp]],
    ['magick', [srcMap, '-resize', '1280x1280', '-quality', '55', tmp]],
    ['convert', [srcMap, '-resize', '1280x1280', '-quality', '55', tmp]],
  ];
  for (const [cmd, args] of attempts) {
    try { execFileSync(cmd, args, { stdio: 'pipe' }); break; } catch { /* next */ }
  }
  if (existsSync(tmp)) {
    mapDataUri = 'data:image/jpeg;base64,' + readFileSync(tmp).toString('base64');
    console.log('underlay:', Math.round(mapDataUri.length / 1024), 'KB inlined');
  }
}

// ---- leaflet ----
const leafletJs = readFileSync(path.join(ROOT, 'node_modules/leaflet/dist/leaflet.js'), 'utf8');
const leafletCss = readFileSync(path.join(ROOT, 'node_modules/leaflet/dist/leaflet.css'), 'utf8');

// ---- slim pal payload ----
const palsLite = pals.map((p) => ({
  id: p.id, n: p.name, z: p.nameZh, dex: p.paldexNumber, el: p.elements,
  hp: p.hp, atk: p.attack, def: p.defense, spd: p.runSpeed, sta: p.stamina,
  food: p.food, rar: p.rarity, rank: p.breedingRank, noc: p.nocturnal ? 1 : 0,
  work: p.workSuitability, ig: p.ignoreCombi ? 1 : 0, ord: p.breedOrder,
  alpha: p.alphaLevels, sc: p.spawnCount, mt: p.mount,
}));

// artifact keeps only lighter categories (≤400 markers) to stay single-file friendly
const AGROUP_COLOR = { 地點: '#22d3ee', 可收集: '#4ade80', 收集: '#4ade80', 敵人: '#e66767', 資源: '#facc15', 礦脈: '#c98500', 釣魚: '#3987e5', NPCs: '#e879f9', 帕魯蛋: '#f9a8d4', Oilrig: '#67e8f9', 其他: '#94a3b8' };
const poisCatCount = new Map();
for (const p of pois.pois) poisCatCount.set(p.cat, (poisCatCount.get(p.cat) ?? 0) + 1);
const catsLite = pois.cats
  .filter((c) => (poisCatCount.get(c.id) ?? 0) <= 400)
  .map((c) => ({ id: c.id, nameZh: c.nameZh, group: c.group, color: c.color ?? AGROUP_COLOR[c.group] ?? '#94a3b8', glyph: c.glyph ?? (c.nameZh || '?')[0] }));
const keepCats = new Set(catsLite.map((c) => c.id));
const poisLite = { cats: catsLite, pois: pois.pois.filter((p) => keepCats.has(p.cat)) };
console.log('artifact pois:', poisLite.pois.length, 'markers in', catsLite.length, 'categories');

const payload = {
  meta: { build: meta.steamBuildId, generated: meta.gameDataGeneratedAt, fetched: meta.fetchedAt, attribution: meta.attribution },
  pals: palsLite,
  breeding,
  pois: poisLite,
  alphas,
  regions,
  clusters,
  sprite: sprite ? { size: sprite.size, cols: sprite.cols, ids: sprite.ids } : null,
};
const payloadJson = JSON.stringify(payload).replace(/<\//g, '<\\/');

const ELEMENT_ZH = { Normal: '無', Fire: '火', Water: '水', Electricity: '雷', Leaf: '草', Dark: '暗', Dragon: '龍', Earth: '地', Ice: '冰' };
const ELEMENT_COLOR = { Normal: '#9aa0ae', Fire: '#e5673b', Water: '#4f9fe0', Electricity: '#e6c14f', Leaf: '#6fbf5a', Dark: '#a06bd6', Dragon: '#7a6bf0', Earth: '#c09055', Ice: '#6fd0e0' };
const WORK_ZH = { EmitFlame: '生火', Watering: '澆水', Seeding: '播種', GenerateElectricity: '發電', Handcraft: '手工', Collection: '採集', Deforest: '伐木', Mining: '挖掘', ProductMedicine: '製藥', Cool: '冷卻', Transport: '搬運', MonsterFarm: '牧場' };
const STRONG = { Fire: ['Leaf', 'Ice'], Water: ['Fire'], Electricity: ['Water'], Leaf: ['Earth'], Earth: ['Electricity'], Ice: ['Dragon'], Dragon: ['Dark'], Dark: ['Normal'] };

const html = `<title>帕魯攻略 Lite — Palworld 圖鑑 · 地圖 · 配種</title>
<style>
${leafletCss}
/* 深色 gaming 主題(刻意單一主題:主體係深色遊戲地圖)— 與主站同一套已驗證 token */
:root { color-scheme: dark; }
.pw {
  --bg:#0f1117; --s1:#171a22; --s2:#1d212c; --s3:#262b37;
  --ink1:#f2f3f5; --ink2:#b9bdc7; --ink3:#8a8f9c;
  --line:rgba(255,255,255,.08); --accent:#3987e5; --accent-soft:rgba(57,135,229,.16);
  --day:#c98500; --night:#6d7ce0; --danger:#e66767;
  background:var(--bg); color:var(--ink1);
  font:14px/1.6 system-ui,-apple-system,'Segoe UI','PingFang TC','Microsoft JhengHei',sans-serif;
  position:fixed; inset:0; display:flex; flex-direction:column; overflow:hidden;
}
.pw *{box-sizing:border-box}
.pw button{font:inherit;color:inherit;cursor:pointer}
.pw input,.pw select{font:inherit;background:var(--s2);color:var(--ink1);border:1px solid var(--line);border-radius:6px;padding:5px 10px}
.pw input:focus{outline:2px solid var(--accent-soft);border-color:var(--accent)}
.pw .nav{display:flex;gap:4px;align-items:center;padding:0 14px;height:50px;flex:none;background:var(--s1);border-bottom:1px solid var(--line);overflow-x:auto}
.pw .brand{font-weight:700;font-size:15px;margin-right:10px;white-space:nowrap}
.pw .brand small{color:var(--ink3);font-weight:400;margin-left:6px}
.pw .tab{padding:6px 13px;border-radius:6px;border:none;background:none;color:var(--ink2);white-space:nowrap}
.pw .tab.on{background:var(--accent-soft);color:var(--accent);font-weight:600}
.pw .view{flex:1;min-height:0;display:none}
.pw .view.on{display:flex;flex-direction:column}
.pw .pad{padding:14px;overflow:auto}
.pw .toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}
.pw .chip{display:inline-flex;align-items:center;gap:5px;padding:2px 10px;border-radius:99px;border:1px solid var(--line);background:var(--s2);color:var(--ink2);font-size:12.5px}
.pw .chip.on{background:var(--accent-soft);border-color:var(--accent);color:var(--ink1)}
.pw .dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
.pw .tablewrap{overflow:auto;border:1px solid var(--line);border-radius:10px;flex:1;min-height:0}
.pw table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;white-space:nowrap;font-size:13px}
.pw th,.pw td{padding:6px 9px;text-align:left}
.pw thead th{position:sticky;top:0;background:var(--s2);color:var(--ink2);font-weight:600;border-bottom:1px solid var(--line);cursor:pointer;user-select:none;z-index:2}
.pw thead th.sorted{color:var(--accent)}
.pw tbody tr{border-bottom:1px solid var(--line)}
.pw tbody tr:hover{background:var(--s2)}
.pw td.num,.pw th.num{text-align:right}
.pw .pi{display:inline-block;border-radius:50%;background-color:var(--s3);background-repeat:no-repeat;flex:none;vertical-align:middle}
.pw .namecell{display:flex;align-items:center;gap:8px}
.pw .wl{display:flex;flex-direction:column;gap:2px;padding:2px 0}
.pw .wl>div{display:flex;gap:5px;align-items:center;line-height:1.3}
.pw .wl b{color:var(--ink1)}
.pw td.wc{text-align:center;padding:6px 5px}
.pw .wz{color:var(--ink3);opacity:.35}
.pw .bar{display:inline-flex;align-items:center;gap:6px}
.pw .track{display:block;width:52px;height:6px;border-radius:3px;background:var(--s3);overflow:hidden;flex:none}
.pw .fill{display:block;height:100%;background:var(--accent);border-radius:3px}
.pw .map-layout{display:flex;flex:1;min-height:0;position:relative}
.pw .side{width:315px;flex:none;overflow-y:auto;background:var(--s1);border-right:1px solid var(--line);padding:10px;display:flex;flex-direction:column;gap:8px}
.pw .side h3{margin:6px 0 0;font-size:12px;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em}
.pw .rtabs{display:flex;gap:6px}
.pw .rtabs button{flex:1;padding:6px 4px;border-radius:6px;border:1px solid var(--line);background:var(--s2);color:var(--ink2)}
.pw .rtabs button.on{background:var(--accent-soft);border-color:var(--accent);color:var(--ink1);font-weight:600}
.pw .cat{border:1px solid var(--line);border-radius:6px;background:var(--s2)}
.pw .cat-head{display:flex;align-items:center;gap:7px;padding:5px 8px}
.pw .cat-head label{display:flex;align-items:center;gap:7px;flex:1;cursor:pointer;min-width:0}
.pw .glyph{width:19px;height:19px;border-radius:50%;color:#0b0d12;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex:none}
.pw .cnt{color:var(--ink3);font-size:11.5px;margin-left:auto}
.pw .exp{background:none;border:none;color:var(--ink3);padding:0 5px}
.pw .pins{max-height:200px;overflow-y:auto;border-top:1px solid var(--line)}
.pw .pin{display:flex;align-items:center;gap:6px;padding:2px 8px 2px 13px;font-size:12px;color:var(--ink2)}
.pw .pin:hover{background:var(--s3)}
.pw .pin label{flex:1;display:flex;gap:6px;align-items:center;cursor:pointer;min-width:0}
.pw .pin .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pw .pin .go{background:none;border:none;color:var(--ink3);padding:0 4px;font-size:12px}
.pw .pin .go:hover{color:var(--accent)}
.pw .picker{position:relative}
.pw .picker input{width:100%}
.pw .menu{position:absolute;top:100%;left:0;right:0;z-index:1200;max-height:230px;overflow-y:auto;background:var(--s2);border:1px solid var(--line);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.pw .opt{display:flex;align-items:center;gap:7px;padding:5px 10px;width:100%;background:none;border:none;text-align:left;color:var(--ink1)}
.pw .opt:hover,.pw .opt:focus{background:var(--s3)}
.pw .opt small{color:var(--ink3)}
.pw .selrow{display:flex;align-items:center;gap:7px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--s2);font-size:13px}
.pw .selrow .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pw .selrow .rm{background:none;border:none;color:var(--ink3)}
.pw .selrow .rm:hover{color:var(--danger)}
.pw .seg{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.pw .seg button{border:none;background:var(--s2);color:var(--ink2);padding:3px 10px;font-size:12px}
.pw .seg button+button{border-left:1px solid var(--line)}
.pw .seg button.on{background:var(--accent-soft);color:var(--ink1);font-weight:600}
.pw .maparea{flex:1;min-width:0;position:relative}
.pw #map{width:100%;height:100%}
.pw .leaflet-container{background:#0b0d12;font:inherit}
.pw .leaflet-popup-content-wrapper,.pw .leaflet-popup-tip{background:var(--s2);color:var(--ink1)}
.pw .legend{position:absolute;right:10px;bottom:10px;z-index:1000;background:rgba(23,26,34,.92);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--ink2)}
.pw .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;max-width:1100px}
.pw .card{background:var(--s1);border:1px solid var(--line);border-radius:10px;padding:13px 15px}
.pw .card h2{font-size:14px;margin:0 0 10px}
.pw .kv{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px dashed var(--line);font-size:13px}
.pw .kv .k{color:var(--ink2)}
.pw .result{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:15px;font-weight:700}
.pw .pairlist{display:flex;flex-direction:column;gap:5px;max-height:330px;overflow-y:auto;margin-top:8px}
.pw .pair{font-size:13px;color:var(--ink2)}
.pw .pair b{color:var(--ink1);font-weight:600}
.pw .eline{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--s2);border-radius:6px;margin-bottom:6px;flex-wrap:wrap;font-size:13.5px}
.pw .ebadge{display:inline-flex;align-items:center;gap:5px}
.pw .arrow{color:var(--ink3);font-size:12px}
.pw .note{color:var(--ink3);font-size:12px}
.pw a{color:var(--accent);text-decoration:none}
.pw a:hover{text-decoration:underline}
.pw .side-toggle{display:none}
@media(max-width:760px){
  .pw .side{position:absolute;z-index:1100;top:0;bottom:0;left:0;width:min(315px,86vw);transform:translateX(-100%);transition:transform .2s}
  .pw .side.open{transform:translateX(0);box-shadow:0 0 40px rgba(0,0,0,.6)}
  .pw .side-toggle{display:block;position:absolute;z-index:1090;top:10px;left:10px;background:var(--s1);border:1px solid var(--line);border-radius:6px;padding:5px 11px}
}
@media(prefers-reduced-motion:reduce){.pw .side{transition:none}}
</style>
<div class="pw">
  <div class="nav">
    <span class="brand">🐑 帕魯攻略 <small>Lite</small></span>
    <button class="tab on" data-v="dex">圖鑑</button>
    <button class="tab" data-v="map">地圖</button>
    <button class="tab" data-v="breed">配種</button>
    <button class="tab" data-v="elem">屬性</button>
    <button class="tab" data-v="about">數據</button>
  </div>
  <div class="view on" id="v-dex">
    <div class="pad" style="display:flex;flex-direction:column;min-height:0">
      <div class="toolbar" id="dex-tools"></div>
      <div class="tablewrap"><table id="dex-table"></table></div>
    </div>
  </div>
  <div class="view" id="v-map">
    <div class="map-layout">
      <button class="side-toggle" id="side-toggle">☰ 圖層</button>
      <div class="side" id="side"></div>
      <div class="maparea">
        <div id="map"></div>
        <div class="legend" id="legend"></div>
      </div>
    </div>
  </div>
  <div class="view" id="v-breed"><div class="pad"><div class="cards" id="breed-cards"></div></div></div>
  <div class="view" id="v-elem"><div class="pad" id="elem-pad" style="max-width:640px"></div></div>
  <div class="view" id="v-about"><div class="pad" id="about-pad" style="max-width:720px"></div></div>
</div>
<script type="application/json" id="pw-data">${payloadJson}</script>
<script>${leafletJs.replace(/<\//g, '<\\/')}</script>
<script>
(() => {
const D = JSON.parse(document.getElementById('pw-data').textContent);
const EL_ZH = ${JSON.stringify(ELEMENT_ZH)};
const EL_C = ${JSON.stringify(ELEMENT_COLOR)};
const WORK_ZH = ${JSON.stringify(WORK_ZH)};
const STRONG = ${JSON.stringify(STRONG)};
const MOUNT_ZH = { ground: '地面', fly: '飛行', swim: '水上' };
const MOUNT_EMO = { ground: '🏇', fly: '🪽', swim: '🌊' };
const MAP_URI = ${mapDataUri ? JSON.stringify('__MAP_URI__') : 'null'};
const SPRITE_URI = ${sprite ? JSON.stringify('__SPRITE_URI__') : 'null'};
const byId = new Map(D.pals.map(p => [p.id, p]));
const disp = p => p.z || p.n;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// pal icon sprite
const SP = D.sprite;
const spIdx = {};
if (SP && SPRITE_URI) {
  SP.ids.forEach((id, i) => { spIdx[id] = i; });
  const st = document.createElement('style');
  st.textContent = '.pw .pi{background-image:url(' + SPRITE_URI + ')}';
  document.head.appendChild(st);
}
function icon(id, px) {
  if (!(id in spIdx)) return '';
  const i = spIdx[id], c = i % SP.cols, r = Math.floor(i / SP.cols), s = px / SP.size;
  const w = Math.round(SP.cols * SP.size * s);
  return '<span class="pi" style="width:' + px + 'px;height:' + px + 'px;background-size:' + w + 'px auto;background-position:' + (-Math.round(c * SP.size * s)) + 'px ' + (-Math.round(r * SP.size * s)) + 'px"></span>';
}

// ---------- tabs ----------
let mapBuilt = false;
document.querySelectorAll('.pw .tab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.pw .tab').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.pw .view').forEach(v => v.classList.toggle('on', v.id === 'v-' + b.dataset.v));
  if (b.dataset.v === 'map') { if (!mapBuilt) { buildMap(); mapBuilt = true; } setTimeout(() => MAP && MAP.invalidateSize(), 60); }
}));

// ---------- 圖鑑 ----------
const dexState = { q: '', el: null, sort: 'dex', dir: 1 };
const WORK_KEYS = Object.keys(WORK_ZH);
const COLS = [['dex','#',1],['name','帕魯',0],['el','屬性',0],['hp','HP',1],['atk','攻擊',1],['def','防禦',1],['spd','速度',1],['sta','耐力',1],['food','食量',1],['rar','稀有',1],['rank','配種Rank',1]]
  .concat(WORK_KEYS.map(w => ['w:' + w, WORK_ZH[w], 1]))
  .concat([['mt','騎乘',0],['mts','騎乘速度',1],['other','其他',0]]);
const maxes = { hp: 0, atk: 0, def: 0 };
D.pals.forEach(p => { maxes.hp = Math.max(maxes.hp, p.hp); maxes.atk = Math.max(maxes.atk, p.atk); maxes.def = Math.max(maxes.def, p.def); });
function bar(v, m) { return '<span class="bar"><span class="track"><span class="fill" style="width:' + Math.round(v / m * 100) + '%"></span></span>' + v + '</span>'; }
function elBadge(e) { return '<span class="ebadge"><span class="dot" style="background:' + EL_C[e] + '"></span>' + EL_ZH[e] + '</span>'; }
function renderDexTools() {
  const t = document.getElementById('dex-tools');
  t.innerHTML = '<input type="search" placeholder="搜尋:中文/英文名…" style="width:210px" id="dex-q">' +
    Object.keys(EL_ZH).map(e => '<button class="chip' + (dexState.el === e ? ' on' : '') + '" data-el="' + e + '"><span class="dot" style="background:' + EL_C[e] + '"></span>' + EL_ZH[e] + '</button>').join('') +
    '<span class="note" id="dex-count"></span>';
  const q = document.getElementById('dex-q');
  q.value = dexState.q;
  q.addEventListener('input', () => { dexState.q = q.value; renderDexTable(); });
  t.querySelectorAll('[data-el]').forEach(b => b.addEventListener('click', () => {
    dexState.el = dexState.el === b.dataset.el ? null : b.dataset.el;
    renderDexTools(); renderDexTable();
  }));
}
function renderDexTable() {
  const s = dexState.q.trim().toLowerCase();
  let rows = D.pals.filter(p =>
    (!s || (p.z || '').toLowerCase().includes(s) || p.n.toLowerCase().includes(s) || p.id.toLowerCase().includes(s) || String(p.dex) === s)
    && (!dexState.el || p.el.includes(dexState.el)));
  const k = dexState.sort, dir = dexState.dir;
  rows.sort((a, b) => {
    let c = 0;
    if (k === 'name') c = disp(a).localeCompare(disp(b), 'zh-Hant');
    else if (k.startsWith('w:')) c = ((a.work || {})[k.slice(2)] || 0) - ((b.work || {})[k.slice(2)] || 0);
    else if (k === 'mt') c = (a.mt ? 1 : 9) - (b.mt ? 1 : 9);
    else if (k === 'mts') c = (a.mt && a.mt.speed || -1) - (b.mt && b.mt.speed || -1);
    else if (k === 'el' || k === 'other') c = 0;
    else c = a[k] - b[k];
    return c * dir || a.dex - b.dex;
  });
  document.getElementById('dex-count').textContent = rows.length + ' 隻';
  const th = COLS.map(([kk, lbl, num]) =>
    '<th class="' + (num ? 'num' : '') + (dexState.sort === kk ? ' sorted' : '') + '" data-k="' + kk + '">' + lbl + (dexState.sort === kk ? (dir === 1 ? ' ↑' : ' ↓') : '') + '</th>').join('');
  const body = rows.map(p => '<tr>' +
    '<td class="num">' + p.dex + '</td>' +
    '<td><span class="namecell">' + icon(p.id, 28) + '<span><b>' + esc(disp(p)) + '</b> <span class="note">' + esc(p.z ? p.n : '') + '</span></span></span></td>' +
    '<td>' + p.el.map(elBadge).join(' ') + '</td>' +
    '<td class="num">' + bar(p.hp, maxes.hp) + '</td>' +
    '<td class="num">' + bar(p.atk, maxes.atk) + '</td>' +
    '<td class="num">' + bar(p.def, maxes.def) + '</td>' +
    '<td class="num">' + p.spd + '</td><td class="num">' + p.sta + '</td><td class="num">' + p.food + '</td><td class="num">' + p.rar + '</td><td class="num">' + p.rank + '</td>' +
    WORK_KEYS.map(w => { const l = (p.work || {})[w] || 0; return '<td class="num wc">' + (l ? '<b title="' + WORK_ZH[w] + ' Lv' + l + '">' + l + '</b>' : '<span class="wz">·</span>'); }).join('') +
    '<td>' + (p.mt ? '<span title="騎乘速度 ' + (p.mt.speed ?? '?') + ' · 加速 ' + (p.mt.sprint ?? '?') + ' · 鞍具科技Lv' + (p.mt.tech ?? '?') + '">' + MOUNT_EMO[p.mt.type] + ' ' + MOUNT_ZH[p.mt.type] + '</span>' : '') + '</td>' +
    '<td class="num">' + (p.mt && p.mt.speed != null ? p.mt.speed : '') + '</td>' +
    '<td>' + (p.noc ? '<span title="夜行性:夜晚活動,日間瞓覺">🌙 </span>' : '') + (p.alpha && p.alpha.length ? '<span title="野外 Alpha 頭目 Lv' + p.alpha.join('/') + '">👑Lv' + Math.min.apply(null, p.alpha) + '</span>' : '') + (p.ig ? ' <span title="限同種配種">🧬</span>' : '') + '</td>' +
    '</tr>').join('');
  document.getElementById('dex-table').innerHTML = '<thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody>';
  document.querySelectorAll('#dex-table th').forEach(h => h.addEventListener('click', () => {
    const kk = h.dataset.k;
    if (kk === 'el' || kk === 'work' || kk === 'other') return;
    if (dexState.sort === kk) dexState.dir *= -1;
    else { dexState.sort = kk; dexState.dir = (kk === 'dex' || kk === 'name') ? 1 : -1; }
    renderDexTable();
  }));
}
renderDexTools(); renderDexTable();

// ---------- picker factory ----------
function makePicker(container, placeholder, list, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'picker';
  wrap.innerHTML = '<input type="search" placeholder="' + placeholder + '"><div class="menu" hidden></div>';
  const inp = wrap.firstChild, menu = wrap.lastChild;
  function refresh() {
    const s = inp.value.trim().toLowerCase();
    if (!s) { menu.hidden = true; return; }
    const hits = list().filter(p => (p.z || '').toLowerCase().includes(s) || p.n.toLowerCase().includes(s) || p.id.toLowerCase().includes(s)).slice(0, 25);
    menu.innerHTML = hits.map(p => '<button class="opt" data-id="' + p.id + '">' + icon(p.id, 22) + '#' + p.dex + ' ' + esc(disp(p)) + ' <small>' + esc(p.z ? p.n : '') + '</small></button>').join('');
    menu.hidden = !hits.length;
    menu.querySelectorAll('.opt').forEach(o => o.addEventListener('mousedown', ev => {
      ev.preventDefault();
      onPick(byId.get(o.dataset.id));
      inp.value = ''; menu.hidden = true;
    }));
  }
  inp.addEventListener('input', refresh);
  inp.addEventListener('blur', () => setTimeout(() => { menu.hidden = true; }, 150));
  container.appendChild(wrap);
  return wrap;
}

// ---------- 地圖 ----------
let MAP = null;
const PAL_COLORS = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'];
const mapState = { region: 'palpagos', catOn: { alpha: 1, fast_travel: 1, tower: 1 }, pinOff: new Set(), expanded: null, sel: [], dn: 'all' };
const ALPHA_CAT = { id: 'alpha', nameZh: 'Alpha 頭目', color: '#e66767', glyph: '王' };
let layerPois = null, layerSpawns = null, layerBase = null;

function regionPois() {
  const alphaPois = D.alphas.filter(a => a.region === mapState.region).map((a, i) => ({
    id: 'alpha-' + mapState.region + '-' + i, cat: 'alpha',
    x: a.x, y: a.y, name: 'Lv' + a.level + ' ' + (a.nameZh || a.name),
  }));
  const statics = mapState.region === 'palpagos' ? D.pois.pois : [];
  return { cats: [ALPHA_CAT].concat(mapState.region === 'palpagos' ? D.pois.cats : []), byCat: groupBy(alphaPois.concat(statics), p => p.cat) };
}
function groupBy(arr, f) { const m = new Map(); arr.forEach(x => { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; }

function pinIcon(color, glyph) {
  return L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 20], popupAnchor: [0, -18],
    html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:' + color + ';border:2px solid #0b0d12;display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:9px;font-weight:700;color:#0b0d12">' + glyph + '</span></div>' });
}

function buildMap() {
  const reg = D.regions.find(r => r.id === mapState.region);
  const b = L.latLngBounds([[reg.extent[1], reg.extent[0]], [reg.extent[3], reg.extent[2]]]);
  const ib = reg.imageBounds || reg.extent;
  const imgB = L.latLngBounds([[ib[1], ib[0]], [ib[3], ib[2]]]);
  if (!MAP) {
    MAP = L.map(document.querySelector('.pw #map'), { crs: L.CRS.Simple, minZoom: -3, maxZoom: 3, zoomSnap: 0.5, attributionControl: false, preferCanvas: true });
    MAP.on('mousemove', e => { document.getElementById('legend').innerHTML = legendHtml('(' + Math.round(e.latlng.lng) + ', ' + Math.round(e.latlng.lat) + ')'); });
  }
  if (layerBase) MAP.removeLayer(layerBase);
  if (mapState.region === 'palpagos' && MAP_URI) layerBase = L.imageOverlay(MAP_URI, imgB).addTo(MAP);
  else {
    const g = L.layerGroup();
    L.rectangle(b, { color: '#2c3140', weight: 1, fillColor: '#131722', fillOpacity: 1, interactive: false }).addTo(g);
    for (let x = Math.ceil(reg.extent[0] / 100) * 100; x <= reg.extent[2]; x += 100) L.polyline([[reg.extent[1], x], [reg.extent[3], x]], { color: '#222838', weight: 1, interactive: false }).addTo(g);
    for (let y = Math.ceil(reg.extent[1] / 100) * 100; y <= reg.extent[3]; y += 100) L.polyline([[y, reg.extent[0]], [y, reg.extent[2]]], { color: '#222838', weight: 1, interactive: false }).addTo(g);
    layerBase = g.addTo(MAP);
  }
  MAP.setMaxBounds(b.pad(0.25));
  MAP.fitBounds(b);
  renderSide(); renderPois(); renderSpawns();
}
function legendHtml(coords) {
  return (coords ? '座標 ' + coords + '<br>' : '') + (mapState.sel.length ? '實線＝日夜都出現 · 虛線＝夜間限定' : '');
}
function renderPois() {
  if (layerPois) MAP.removeLayer(layerPois);
  layerPois = L.layerGroup();
  const { cats, byCat } = regionPois();
  cats.forEach(cat => {
    if (!mapState.catOn[cat.id]) return;
    (byCat.get(cat.id) || []).forEach(p => {
      if (mapState.pinOff.has(p.id)) return;
      L.marker([p.y, p.x], { icon: pinIcon(cat.color, cat.glyph) })
        .bindPopup('<b>' + esc(p.name) + '</b><br><span style="color:#8a8f9c;font-size:12px">' + esc(cat.nameZh) + ' · (' + Math.round(p.x) + ', ' + Math.round(p.y) + ')</span>')
        .addTo(layerPois);
    });
  });
  layerPois.addTo(MAP);
}
function renderSpawns() {
  if (layerSpawns) MAP.removeLayer(layerSpawns);
  layerSpawns = L.layerGroup();
  mapState.sel.forEach(sel => {
    const c = (D.clusters[mapState.region] || {})[sel.palId];
    if (!c) return;
    const pal = byId.get(sel.palId);
    const draw = (arr, dashed) => arr.forEach(cl => {
      L.circle([cl[1], cl[0]], { radius: cl[2], color: sel.color, weight: 2, dashArray: dashed ? '6 5' : null, fillColor: sel.color, fillOpacity: 0.13 })
        .bindPopup(icon(pal.id, 30) + ' <b>' + esc(disp(pal)) + '</b><br><span style="color:#8a8f9c;font-size:12px">' + (dashed ? '夜間限定' : '日夜都出現') + ' · ' + cl[3] + ' 個出現點 · Lv ' + cl[4] + '–' + cl[5] + '</span>')
        .addTo(layerSpawns);
    });
    if (mapState.dn !== 'night') draw(c.d, false);
    if (mapState.dn !== 'day') draw(c.n, true);
  });
  layerSpawns.addTo(MAP);
  document.getElementById('legend').innerHTML = legendHtml();
}
function renderSide() {
  const side = document.getElementById('side');
  side.innerHTML = '';
  const rt = document.createElement('div'); rt.className = 'rtabs';
  D.regions.forEach(r => {
    const bt = document.createElement('button');
    bt.textContent = r.nameZh; bt.className = r.id === mapState.region ? 'on' : '';
    bt.addEventListener('click', () => { mapState.region = r.id; mapState.expanded = null; buildMap(); });
    rt.appendChild(bt);
  });
  side.appendChild(rt);
  if (mapState.region === 'tree') side.insertAdjacentHTML('beforeend', '<div class="note">世界樹(1.0 新地區)暫未有底圖,用格網顯示。</div>');
  side.insertAdjacentHTML('beforeend', '<h3>地圖標記</h3>');
  const { cats, byCat } = regionPois();
  cats.forEach(cat => {
    const pois = byCat.get(cat.id) || [];
    const box = document.createElement('div'); box.className = 'cat';
    const offN = pois.filter(p => mapState.pinOff.has(p.id)).length;
    box.innerHTML = '<div class="cat-head"><label><input type="checkbox"' + (mapState.catOn[cat.id] ? ' checked' : '') + '><span class="glyph" style="background:' + cat.color + '">' + cat.glyph + '</span><span>' + cat.nameZh + '</span><span class="cnt">' + (pois.length - offN) + '/' + pois.length + '</span></label><button class="exp">' + (mapState.expanded === cat.id ? '▲' : '▼') + '</button></div>';
    box.querySelector('input').addEventListener('change', () => { mapState.catOn[cat.id] = !mapState.catOn[cat.id]; renderSide(); renderPois(); });
    box.querySelector('.exp').addEventListener('click', () => { mapState.expanded = mapState.expanded === cat.id ? null : cat.id; renderSide(); });
    if (mapState.expanded === cat.id) {
      const pl = document.createElement('div'); pl.className = 'pins';
      pl.innerHTML = '<div class="pin"><button class="go" data-all="1">全開</button><button class="go" data-all="0">全關</button></div>' +
        pois.map(p => '<div class="pin"><label><input type="checkbox" data-pin="' + p.id + '"' + (mapState.pinOff.has(p.id) ? '' : ' checked') + '><span class="nm">' + esc(p.name) + '</span></label><button class="go" data-go="' + p.id + '">◎</button></div>').join('');
      pl.querySelectorAll('[data-all]').forEach(bt => bt.addEventListener('click', () => {
        pois.forEach(p => bt.dataset.all === '1' ? mapState.pinOff.delete(p.id) : mapState.pinOff.add(p.id));
        renderSide(); renderPois();
      }));
      pl.querySelectorAll('[data-pin]').forEach(cb => cb.addEventListener('change', () => {
        mapState.pinOff.has(cb.dataset.pin) ? mapState.pinOff.delete(cb.dataset.pin) : mapState.pinOff.add(cb.dataset.pin);
        renderSide(); renderPois();
      }));
      pl.querySelectorAll('[data-go]').forEach(bt => bt.addEventListener('click', () => {
        const p = pois.find(x => x.id === bt.dataset.go);
        MAP.flyTo([p.y, p.x], Math.max(MAP.getZoom(), 1), { duration: 0.6 });
      }));
      box.appendChild(pl);
    }
    side.appendChild(box);
  });
  side.insertAdjacentHTML('beforeend', '<h3>帕魯出現範圍</h3>');
  makePicker(side, '加入帕魯(最多 8 隻)…', () => D.pals.filter(p => (D.clusters[mapState.region] || {})[p.id] && !mapState.sel.some(s => s.palId === p.id)), pal => {
    if (mapState.sel.length >= 8) return;
    const used = new Set(mapState.sel.map(s => s.color));
    mapState.sel.push({ palId: pal.id, color: PAL_COLORS.find(c => !used.has(c)) || PAL_COLORS[0] });
    renderSide(); renderSpawns();
  });
  mapState.sel.forEach(sel => {
    const pal = byId.get(sel.palId);
    const row = document.createElement('div'); row.className = 'selrow';
    row.innerHTML = '<span class="dot" style="background:' + sel.color + '"></span>' + icon(pal.id, 24) + '<span class="grow">' + esc(disp(pal)) + '</span><button class="rm">✕</button>';
    row.querySelector('.rm').addEventListener('click', () => { mapState.sel = mapState.sel.filter(s => s !== sel); renderSide(); renderSpawns(); });
    side.appendChild(row);
  });
  if (mapState.sel.length) {
    const seg = document.createElement('div'); seg.className = 'seg';
    [['all', '全部'], ['day', '☀ 日間'], ['night', '🌙 夜間']].forEach(([v, lbl]) => {
      const bt = document.createElement('button'); bt.textContent = lbl; bt.className = mapState.dn === v ? 'on' : '';
      bt.addEventListener('click', () => { mapState.dn = v; renderSide(); renderSpawns(); });
      seg.appendChild(bt);
    });
    side.appendChild(seg);
  }
}
document.getElementById('side-toggle').addEventListener('click', () => document.getElementById('side').classList.toggle('open'));

// ---------- 配種 ----------
const uniqueByPair = new Map(), uniqueChildren = new Set();
D.breeding.uniquePairs.forEach(u => {
  uniqueByPair.set([u.parentAId, u.parentBId].sort().join('|'), u.childId);
  uniqueChildren.add(u.childId);
});
const cands = D.pals.filter(p => !uniqueChildren.has(p.id) && !p.ig).sort((a, b) => a.rank - b.rank || (a.ord ?? 99) - (b.ord ?? 99) || a.dex - b.dex);
function breedChild(aId, bId) {
  const u = uniqueByPair.get([aId, bId].sort().join('|'));
  if (u) return byId.get(u);
  if (aId === bId) return byId.get(aId);
  const t = Math.floor((byId.get(aId).rank + byId.get(bId).rank + 1) / 2);
  let lo = 0, hi = cands.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cands[m].rank < t) lo = m + 1; else hi = m; }
  let bi = lo - 1;
  while (bi > 0 && cands[bi - 1].rank === cands[bi].rank) bi--;
  const below = cands[bi], at = cands[lo];
  if (bi < 0 || !below) return at || null;
  if (!at) return below;
  return Math.abs(below.rank - t) <= Math.abs(at.rank - t) ? below : at;
}
const breedState = { a: null, b: null, target: null };
function renderBreed() {
  const wrap = document.getElementById('breed-cards');
  wrap.innerHTML = '<div class="card" id="bc1"><h2>父母 → 仔</h2></div><div class="card" id="bc2"><h2>目標仔 → 父母組合</h2><p class="note">用遊戲 CombiRank 計算;同 Rank 並列時為近似結果。</p></div>';
  const c1 = document.getElementById('bc1'), c2 = document.getElementById('bc2');
  [['a', '父/母 A'], ['b', '父/母 B']].forEach(([key, lbl]) => {
    const cur = breedState[key];
    if (cur) {
      const row = document.createElement('div'); row.className = 'selrow';
      row.innerHTML = '<span class="grow">' + lbl + ':<b>' + esc(disp(cur)) + '</b></span><button class="rm">✕</button>';
      row.querySelector('.rm').addEventListener('click', () => { breedState[key] = null; renderBreed(); });
      c1.appendChild(row);
    } else makePicker(c1, lbl + ' — 搜尋帕魯…', () => D.pals, p => { breedState[key] = p; renderBreed(); });
  });
  if (breedState.a && breedState.b) {
    const ch = breedChild(breedState.a.id, breedState.b.id);
    if (ch) c1.insertAdjacentHTML('beforeend', '<div class="result">→ ' + icon(ch.id, 34) + ' ' + esc(disp(ch)) + ' <span class="note">#' + ch.dex + (ch.z ? ' ' + esc(ch.n) : '') + '</span></div>');
  }
  if (breedState.target) {
    const row = document.createElement('div'); row.className = 'selrow';
    row.innerHTML = '<span class="grow">目標:<b>' + esc(disp(breedState.target)) + '</b></span><button class="rm">✕</button>';
    row.querySelector('.rm').addEventListener('click', () => { breedState.target = null; renderBreed(); });
    c2.appendChild(row);
    const pairs = [];
    for (let i = 0; i < D.pals.length; i++) for (let j = i; j < D.pals.length; j++) {
      const ch = breedChild(D.pals[i].id, D.pals[j].id);
      if (ch && ch.id === breedState.target.id) pairs.push([D.pals[i], D.pals[j]]);
    }
    c2.insertAdjacentHTML('beforeend', '<p class="note">共 ' + pairs.length + ' 組</p>');
    const listEl = document.createElement('div'); listEl.className = 'pairlist';
    listEl.innerHTML = pairs.slice(0, 400).map(([a, b]) => '<div class="pair"><b>' + esc(disp(a)) + '</b> × <b>' + esc(disp(b)) + '</b></div>').join('') + (pairs.length > 400 ? '<div class="note">…仲有 ' + (pairs.length - 400) + ' 組</div>' : '');
    c2.appendChild(listEl);
  } else makePicker(c2, '搜尋目標帕魯…', () => D.pals, p => { breedState.target = p; renderBreed(); });
}
renderBreed();

// ---------- 屬性 ----------
document.getElementById('elem-pad').innerHTML = '<p class="note" style="margin-top:0">攻擊方 → 剋制(2 倍傷害)。</p>' +
  Object.entries(STRONG).map(([a, ts]) => '<div class="eline">' + elBadge(a) + '<span class="arrow">──剋──▶</span>' + ts.map(elBadge).join(' ') + '</div>').join('') +
  '<div class="eline">' + elBadge('Normal') + '<span class="arrow">無屬性唔剋任何屬性,只被暗屬性剋。</span></div>';

// ---------- 數據 ----------
document.getElementById('about-pad').innerHTML = '<div class="card"><h2>數據版本</h2>' +
  '<div class="kv"><span class="k">Steam Build</span><span>' + esc(D.meta.build) + '</span></div>' +
  '<div class="kv"><span class="k">遊戲數據抽取</span><span>' + new Date(D.meta.generated).toLocaleString('zh-HK') + '</span></div>' +
  '<div class="kv"><span class="k">本頁生成</span><span>' + new Date(D.meta.fetched).toLocaleString('zh-HK') + '</span></div>' +
  '<div class="kv"><span class="k">帕魯</span><span>' + D.pals.length + '</span></div></div>' +
  '<div class="card" style="margin-top:12px"><h2>來源</h2>' +
  D.meta.attribution.map(a => '<div class="kv"><span class="k"><a href="' + esc(a.url) + '" target="_blank" rel="noreferrer">' + esc(a.name) + '</a></span><span style="max-width:55%;text-align:right;font-size:12px">' + esc(a.for) + '</span></div>').join('') +
  '<p class="note" style="margin-bottom:0">呢個係單檔 Lite 版(無寵物圖示/道具頁,底圖壓縮)。完整版係本機 Vite 項目,行 npm run update-data 自動更新數據。非官方粉絲項目,與 Pocketpair, Inc. 無關。</p></div>';
})();
</script>
`;

// inject the (huge) data uris after template assembly to keep the template readable
let finalHtml = mapDataUri ? html.replace('"__MAP_URI__"', JSON.stringify(mapDataUri)) : html;
if (sprite) finalHtml = finalHtml.replace('"__SPRITE_URI__"', JSON.stringify(sprite.dataUri));
writeFileSync(OUT, finalHtml);
console.log('wrote', OUT, Math.round(finalHtml.length / 1024), 'KB');
