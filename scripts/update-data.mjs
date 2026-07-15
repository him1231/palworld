/**
 * Palworld guide site — data pipeline.
 *
 * Fetches all upstream sources and regenerates public/data + public/img + public/map.
 * Run `npm run update-data` any time; safe to re-run (idempotent, caches images).
 *
 * Sources:
 *  - Pal stats / breeding / items / spawn coordinates:
 *      Awy64/palworld-atlas-data (GitHub Pages JSON, auto-extracted from the
 *      official dedicated server package every 6 h) — always current game build.
 *  - Static map POIs (towers, effigies, fast travel, dungeons, chests, …):
 *      Fandom "Map:Palpagos Islands" interactive map JSON via MediaWiki API (CC BY-SA).
 *  - Traditional Chinese pal names: paldb.cc/tw/Pals (parsed once per run).
 *  - Pal / element / work icons: stolenvw/pyPalworldAPI repo (fallback: paldb.cc CDN).
 *  - Palpagos world map underlay: palworld.wiki.gg World_Map.webp (8192×8192).
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const DATA = path.join(PUB, 'data');
const SKIP_IMAGES = process.argv.includes('--skip-images');
const FORCE = process.argv.includes('--force');

const ATLAS_BASE = 'https://awy64.github.io/palworld-atlas-data/v1';
const PYPAL_RAW = 'https://raw.githubusercontent.com/stolenvw/pyPalworldAPI/main/pyPalworldAPI/public/images';
const PALDB_CDN = 'https://cdn.paldb.cc/image/Pal/Texture';
const UA = 'palworld-guide-site-data-pipeline (personal fan project)';

const ELEMENT_ICON = { Normal: '00', Fire: '01', Water: '02', Electricity: '03', Leaf: '04', Dark: '05', Dragon: '06', Earth: '07', Ice: '08' };
const WORK_ICON = { EmitFlame: '00', Watering: '01', Seeding: '02', GenerateElectricity: '03', Handcraft: '04', Collection: '05', Deforest: '06', Mining: '07', ProductMedicine: '08', Cool: '09', Transport: '10', MonsterFarm: '11' };

// Fandom map category → site category (id, zh name, color, glyph). Alpha Boss is
// intentionally excluded: alpha pins come from atlas spawn data (fresher, 1.0).
const POI_CATS = {
  'Fast Travel':     { id: 'fast_travel',    zh: '快速傳送', color: '#22d3ee', glyph: '鷲' },
  'Faction Tower':   { id: 'tower',          zh: '討伐塔',   color: '#f43f5e', glyph: '塔' },
  'Statue of Power': { id: 'statue_power',   zh: '力量雕像', color: '#a78bfa', glyph: '力' },
  'Lifmunk Effigy':  { id: 'effigy',         zh: '翠葉鼠雕像', color: '#4ade80', glyph: '雕' },
  'Dungeon':         { id: 'dungeon',        zh: '地下城',   color: '#fb923c', glyph: '洞' },
  'Sealed Realm':    { id: 'sealed_realm',   zh: '封印遺跡', color: '#e879f9', glyph: '封' },
  'Poacher Camp':    { id: 'poacher_camp',   zh: '盜獵者營地', color: '#facc15', glyph: '營' },
  'Chest':           { id: 'chest',          zh: '寶箱',     color: '#fbbf24', glyph: '寶' },
  'Pal Egg':         { id: 'egg',            zh: '帕魯蛋',   color: '#f9a8d4', glyph: '蛋' },
  'Skill Fruit':     { id: 'skill_fruit',    zh: '技能果樹', color: '#86efac', glyph: '果' },
  'Journals':        { id: 'journal',        zh: '日誌',     color: '#94a3b8', glyph: '記' },
};

async function fetchWithRetry(url, opts = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...(opts.headers || {}) }, ...opts });
      if (res.ok) return res;
      if (res.status === 404) return res; // don't retry 404s
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (i === tries - 1) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}
const getJSON = async (url) => (await fetchWithRetry(url)).json();
const getText = async (url) => (await fetchWithRetry(url)).text();

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }));
  return out;
}

const writeJSON = async (rel, obj) => {
  const p = path.join(DATA, rel);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(obj));
  console.log(`  wrote data/${rel}`);
};

// ---------------------------------------------------------------- atlas
async function fetchAtlas() {
  console.log('[1/6] Atlas (pal stats / breeding / items / spawns)…');
  const latest = await getJSON(`${ATLAS_BASE}/latest.json`);
  const base = `${ATLAS_BASE}/${latest.buildPath}`;
  const [manifest, palsIdx, breeding, itemsIdx, spawnsPalpagos, spawnsTree] = await Promise.all([
    getJSON(`${base}/manifest.json`),
    getJSON(`${base}/pals/index.json`),
    getJSON(`${base}/breeding.json`),
    getJSON(`${base}/items/index.json`),
    getJSON(`${base}/maps/palpagos/spawns.json`),
    getJSON(`${base}/maps/tree/spawns.json`),
  ]);
  console.log(`  build ${manifest.steamBuildId} generated ${manifest.generatedAt}`);
  return { latest, manifest, palsIdx, breeding, itemsIdx, spawnsPalpagos, spawnsTree };
}

// ------------------------------------------------------- zh-TW pal names
async function fetchZhNames() {
  console.log('[2/6] zh-TW names from paldb.cc…');
  try {
    const html = await getText('https://paldb.cc/tw/Pals');
    const map = {};
    // Each pal card renders the icon (whose URL carries the internal id) followed
    // by the display-name link (class="itemname").
    const re = /PalIcon\/Normal\/T_([A-Za-z0-9_]+)_icon_normal\.webp[\s\S]*?class="itemname"[^>]*>([^<]+)<\/a>/g;
    let m;
    while ((m = re.exec(html))) {
      const [, id, name] = m;
      if (!map[id] && name.trim()) map[id] = name.trim();
    }
    // variants paldb lists under the base pal only
    if (!map.PlantSlime_Flower && map.PlantSlime) map.PlantSlime_Flower = `${map.PlantSlime}(花)`;
    console.log(`  parsed ${Object.keys(map).length} zh-TW names`);
    return map;
  } catch (e) {
    console.warn(`  ! paldb.cc fetch failed (${e.message}) — zh names skipped`);
    return {};
  }
}

// ------------------------------------------------- pyPalworldAPI SQL enrich
const PYPAL_SQL = 'https://raw.githubusercontent.com/stolenvw/pyPalworldAPI/main/mysqldb/PalAPI.sql';

/** Split one SQL VALUES row body into top-level values (handles quoted strings). */
function splitSqlRow(row) {
  const vals = [];
  let cur = '', inStr = false, depth = 0;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inStr) {
      if (ch === '\\') { cur += ch + (row[i + 1] ?? ''); i++; continue; }
      if (ch === "'" && row[i + 1] === "'") { cur += "\\'"; i++; continue; }
      if (ch === "'") { inStr = false; cur += ch; continue; }
      cur += ch;
      continue;
    }
    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { vals.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) vals.push(cur.trim());
  return vals;
}

function sqlValue(v) {
  if (v === 'NULL') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\\\/g, '\\');
  }
  return v;
}

function parseSqlTable(sql, table) {
  const rows = [];
  const re = new RegExp('INSERT INTO `' + table + '` \\(([^)]+)\\) VALUES\\s*', 'g');
  let m;
  while ((m = re.exec(sql))) {
    const cols = [...m[1].matchAll(/`(\w+)`/g)].map((x) => x[1]);
    // statement body runs until ');' at line end
    const end = sql.indexOf(');\n', m.index);
    const body = sql.slice(m.index + m[0].length, end + 1);
    // rows separated by '),\n(' — split carefully at top level
    let depth = 0, inStr = false, start = 0;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (inStr) {
        if (ch === '\\') i++;
        else if (ch === "'") inStr = false;
        continue;
      }
      if (ch === "'") inStr = true;
      else if (ch === '(') { if (depth === 0) start = i + 1; depth++; }
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          const vals = splitSqlRow(body.slice(start, i)).map(sqlValue);
          rows.push(Object.fromEntries(cols.map((c, j) => [c, vals[j]])));
        }
      }
    }
  }
  return rows;
}

const tryJSON = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; } };

async function fetchEnrichment() {
  console.log('[2.5] pyPalworldAPI SQL enrichment (drops / skills / partner skill / breeding flags)…');
  try {
    const sql = await getText(PYPAL_SQL);
    const rows = parseSqlTable(sql, 'pals');
    const enrich = {};
    for (const r of rows) {
      const id = r.Asset;
      if (!id) continue;
      const aura = tryJSON(r.Aura);
      const breeding = tryJSON(r.Breeding);
      const stats = tryJSON(r.Stats);
      enrich[id] = {
        description: r.Description || null,
        drops: (tryJSON(r.Drops) ?? []).map((d) => ({ name: d.Name, min: d.Min, max: d.Max, rate: d.Rate })),
        partnerSkill: aura?.Name ? { name: aura.Name, description: aura.Description ?? null } : null,
        skills: (tryJSON(r.Skills) ?? []).map((s) => ({ name: s.Name, type: s.Type, level: s.Level, power: s.Power, cooldown: s.Cooldown, description: s.Description ?? null })),
        maleProbability: breeding?.MaleProbability ?? null,
        breedOrder: breeding?.Order ?? null,
        ignoreCombi: r.IgnoreCombi === 1,
        rideSpeed: stats?.Speed?.Ride ?? null,
        craftSpeed: stats?.CraftSpeed ?? null,
        price: r.Price ?? null,
        genus: r.Genus || null,
      };
    }
    console.log(`  enriched ${Object.keys(enrich).length} pals (${Object.values(enrich).filter((e) => e.ignoreCombi).length} same-species-only)`);
    return enrich;
  } catch (e) {
    console.warn(`  ! enrichment failed (${e.message}) — continuing without`);
    return {};
  }
}

// --------------------------------------------------------------- mounts
/** paldb.cc/tw/Mounts has three tables: ground / flying / water. */
async function fetchMounts() {
  console.log('[2.7] mount data from paldb.cc…');
  try {
    const html = await getText('https://paldb.cc/tw/Mounts');
    const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => m[0]);
    const types = ['ground', 'fly', 'swim'];
    const mounts = {};
    tables.slice(0, 3).forEach((t, ti) => {
      // row: pal icon URL carries the internal id; numeric cells follow
      const rows = t.split('<tr>').slice(2); // skip header
      for (const row of rows) {
        const id = /PalIcon\/Normal\/T_([A-Za-z0-9_]+)_icon_normal/.exec(row)?.[1];
        if (!id) continue;
        const nums = [...row.matchAll(/<td[^>]*>\s*([\d.]+)\s*<\/td>/g)].map((m) => Number(m[1]));
        // columns: 騎乘速度, 加速騎乘速度, 科技等級, GravityScale, JumpZVelocity, Stamina
        mounts[id] = { type: types[ti], speed: nums[0] ?? null, sprint: nums[1] ?? null, tech: nums[2] ?? null };
      }
    });
    console.log(`  ${Object.keys(mounts).length} mounts (${tables.length >= 3 ? 'ground/fly/swim' : 'unexpected table count!'})`);
    return mounts;
  } catch (e) {
    console.warn(`  ! mounts fetch failed (${e.message}) — skipped`);
    return {};
  }
}

// ------------------------------------------- wiki.gg bounty / predator POIs
async function fetchWikiggPois() {
  console.log('[3.5] wiki.gg bounty + predator markers…');
  try {
    const api = 'https://palworld.wiki.gg/api.php?action=query&prop=revisions&titles=Map:Fragments/Bounties%7CMap:Fragments/Predator%20Pals&rvslots=main&rvprop=content&format=json&formatversion=2';
    const res = await getJSON(api);
    const cats = [
      { id: 'bounty', name: 'Bounties', nameZh: '通緝目標', color: '#f97316', glyph: '緝' },
      { id: 'predator', name: 'Predator Pals', nameZh: '狂暴帕魯', color: '#dc2626', glyph: '暴' },
    ];
    const pois = [];
    for (const page of res.query.pages) {
      const j = JSON.parse(page.revisions[0].slots.main.content);
      const isBounty = page.title.includes('Bounties');
      const cat = isBounty ? 'bounty' : 'predator';
      for (const [group, markers] of Object.entries(j.markers ?? {})) {
        markers.forEach((mk, i) => {
          const desc = Array.isArray(mk.description) ? mk.description.join(' ') : (mk.description ?? '');
          pois.push({
            id: `${cat}-${mk.id ?? i}`,
            cat,
            x: Math.round(mk.x * 10) / 10,
            y: Math.round(mk.y * 10) / 10,
            name: (mk.name ?? group) + (desc ? `（${desc.replace(/Appears at night only\.?/, '夜間出現').replace(/Lv\./, 'Lv')}）` : ''),
            link: mk.article ?? null,
          });
        });
      }
    }
    console.log(`  ${pois.length} markers in 2 categories`);
    return { cats, pois };
  } catch (e) {
    console.warn(`  ! wiki.gg markers failed (${e.message}) — skipped`);
    return { cats: [], pois: [] };
  }
}

// ------------------------------------------------------------ fandom POIs
async function fetchFandomPois() {
  console.log('[3/6] Fandom static POIs…');
  const api = 'https://palworld.fandom.com/api.php?action=query&prop=revisions&titles=Map:Palpagos%20Islands&rvslots=main&rvprop=content&format=json&formatversion=2';
  const res = await getJSON(api);
  const map = JSON.parse(res.query.pages[0].revisions[0].slots.main.content);
  const catNameById = Object.fromEntries(map.categories.map((c) => [String(c.id), c.name]));

  // Markers whose popup description is exactly "x, y" carry in-game coordinates.
  const coordRe = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
  const known = [];
  for (const mk of map.markers) {
    const d = mk.popup?.description;
    const m = d && coordRe.exec(d);
    if (m) known.push({ px: mk.position[0], py: mk.position[1], gx: +m[1], gy: +m[2] });
  }
  // Fit per-axis linear transforms image px → game coords, trying both direct and
  // swapped axis assignment; keep whichever fits better.
  const fit1D = (pts, getIn, getOut) => {
    const n = pts.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const p of pts) { const x = getIn(p), y = getOut(p); sx += x; sy += y; sxx += x * x; sxy += x * y; }
    const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const b = (sy - a * sx) / n;
    let err = 0;
    for (const p of pts) err += Math.abs(a * getIn(p) + b - getOut(p));
    return { a, b, err: err / n };
  };
  // Robust fit: initial least squares, then drop outliers (bad wiki descriptions)
  // and refit.
  const robustFit1D = (pts, getIn, getOut) => {
    let cur = pts;
    let f = fit1D(cur, getIn, getOut);
    for (let round = 0; round < 3; round++) {
      const resid = cur.map((p) => Math.abs(f.a * getIn(p) + f.b - getOut(p)));
      const sorted = [...resid].sort((q, w) => q - w);
      const med = sorted[Math.floor(sorted.length / 2)];
      const keep = cur.filter((_, i) => resid[i] <= Math.max(3 * med, 2));
      if (keep.length === cur.length || keep.length < 20) break;
      cur = keep;
      f = fit1D(cur, getIn, getOut);
    }
    return { ...f, used: cur.length };
  };
  const direct = { x: robustFit1D(known, (p) => p.px, (p) => p.gx), y: robustFit1D(known, (p) => p.py, (p) => p.gy) };
  const swapped = { x: robustFit1D(known, (p) => p.py, (p) => p.gx), y: robustFit1D(known, (p) => p.px, (p) => p.gy) };
  const useSwap = swapped.x.err + swapped.y.err < direct.x.err + direct.y.err;
  const t = useSwap ? swapped : direct;
  console.log(`  affine fit from ${known.length} anchors (swap=${useSwap}, kept x:${t.x.used} y:${t.y.used}) mean abs err: x=${t.x.err.toFixed(1)} y=${t.y.err.toFixed(1)}`);

  const toGame = (pos) => {
    const [px, py] = pos;
    const ix = useSwap ? py : px, iy = useSwap ? px : py;
    return [t.x.a * ix + t.x.b, t.y.a * iy + t.y.b];
  };

  const cats = [];
  const catIndex = {};
  for (const [fandomName, meta] of Object.entries(POI_CATS)) {
    catIndex[fandomName] = meta.id;
    cats.push({ id: meta.id, name: fandomName, nameZh: meta.zh, color: meta.color, glyph: meta.glyph });
  }
  const pois = [];
  let skipped = 0;
  for (const mk of map.markers) {
    const catName = catNameById[String(mk.categoryId)];
    const cat = catIndex[catName];
    if (!cat) { skipped++; continue; } // Alpha Boss etc. — handled from atlas
    const d = mk.popup?.description;
    const m = d && coordRe.exec(d);
    const [gx, gy] = m ? [+m[1], +m[2]] : toGame(mk.position);
    pois.push({
      id: `${cat}-${mk.id}`,
      cat,
      x: Math.round(gx * 10) / 10,
      y: Math.round(gy * 10) / 10,
      name: mk.popup?.title || catName,
      link: mk.popup?.link?.url || null,
    });
  }
  console.log(`  ${pois.length} POIs in ${cats.length} categories (${skipped} markers deferred to atlas layers)`);
  return { cats, pois };
}

// ------------------------------------------------------------- transforms
// Palpagos spawns arrive in in-game map coordinates. Tree spawns arrive as raw
// world units (axis-swapped); scale them to a similar magnitude for display.
const TREE_SCALE = 1 / 459;

function normalizeSpawns(raw, region) {
  const scale = region === 'tree' ? TREE_SCALE : 1;
  const byPal = new Map();
  const alphas = [];
  for (const s of raw.spawns) {
    const x = Math.round(s.mapX * scale * 10) / 10;
    const y = Math.round(s.mapY * scale * 10) / 10;
    if (s.kind === 'alpha') {
      alphas.push({ palId: s.palId, name: s.palName, x, y, level: s.maxLevel, region });
      continue;
    }
    if (!byPal.has(s.palId)) byPal.set(s.palId, []);
    // [x, y, nightOnly, minLv, maxLv]
    byPal.get(s.palId).push([x, y, s.availability === 'night' ? 1 : 0, s.minLevel, s.maxLevel]);
  }
  const extent = raw.extent.map((v) => v * scale);
  return { byPal, alphas, extent };
}

// ------------------------------------------------------------------ images
async function downloadImage(url, dest, headers = {}) {
  if (!FORCE && existsSync(dest)) return 'cached';
  try {
    const res = await fetchWithRetry(url, { headers, redirect: 'follow' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null; // error stub, not an image
    await writeFile(dest, buf);
    return 'ok';
  } catch {
    return null;
  }
}

async function fetchIcons(palIds, enNameById) {
  console.log('[4/6] icons…');
  const palDir = path.join(PUB, 'img', 'pals');
  if (SKIP_IMAGES) {
    // no downloads — reference whatever is already on disk
    const iconExt = {};
    for (const id of palIds) {
      if (existsSync(path.join(palDir, `${id}.png`))) iconExt[id] = 'png';
      else if (existsSync(path.join(palDir, `${id}.webp`))) iconExt[id] = 'webp';
    }
    console.log(`  --skip-images (${Object.keys(iconExt).length} icons already on disk)`);
    return iconExt;
  }
  const elDir = path.join(PUB, 'img', 'elements');
  const workDir = path.join(PUB, 'img', 'work');
  await Promise.all([palDir, elDir, workDir].map((d) => mkdir(d, { recursive: true })));

  const iconExt = {};
  let missing = [];
  await pool(palIds, 8, async (id) => {
    const png = path.join(palDir, `${id}.png`);
    const webp = path.join(palDir, `${id}.webp`);
    if (!FORCE && existsSync(png)) { iconExt[id] = 'png'; return; }
    if (!FORCE && existsSync(webp)) { iconExt[id] = 'webp'; return; }
    if (await downloadImage(`${PYPAL_RAW}/pals/T_${id}_icon_normal.png`, png)) { iconExt[id] = 'png'; return; }
    if (await downloadImage(`${PALDB_CDN}/PalIcon/Normal/T_${id}_icon_normal.webp`, webp, { Referer: 'https://paldb.cc/' })) { iconExt[id] = 'webp'; return; }
    const enName = enNameById[id];
    if (enName && await downloadImage(`https://palworld.wiki.gg/wiki/Special:FilePath/${encodeURIComponent(enName.replace(/ /g, '_'))}_icon.png`, png)) { iconExt[id] = 'png'; return; }
    missing.push(id);
  });
  if (missing.length) console.warn(`  ! no icon found for: ${missing.join(', ')}`);
  await pool(Object.entries(ELEMENT_ICON), 4, ([name, idx]) =>
    downloadImage(`${PYPAL_RAW}/elements/T_Icon_element_s_${idx}.png`, path.join(elDir, `${name}.png`)));
  await pool(Object.entries(WORK_ICON), 4, ([name, idx]) =>
    downloadImage(`${PYPAL_RAW}/suitability/T_icon_palwork_${idx}.png`, path.join(workDir, `${name}.png`)));
  console.log(`  pal icons: ${Object.keys(iconExt).length}/${palIds.length}`);
  return iconExt;
}

async function fetchMapImage() {
  console.log('[5/6] world map underlay…');
  if (SKIP_IMAGES) { console.log('  --skip-images'); return; }
  const dir = path.join(PUB, 'map');
  const cacheDir = path.join(ROOT, '.cache');
  await mkdir(dir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  const full = path.join(cacheDir, 'palpagos-8192.webp');
  const out = path.join(dir, 'palpagos.webp');
  if (!FORCE && existsSync(out)) { console.log('  cached'); return; }
  const r = await downloadImage('https://palworld.wiki.gg/images/World_Map.webp', full);
  if (!r) { console.warn('  ! map image download failed'); return; }
  // resize: sips on macOS, ImageMagick elsewhere (GitHub Actions runners)
  const attempts = [
    ['sips', ['-Z', '4096', '-s', 'format', 'webp', full, '--out', out]],
    ['sips', ['-Z', '4096', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', full, '--out', out.replace('.webp', '.jpg')]],
    ['magick', [full, '-resize', '4096x4096', '-quality', '85', out.replace('.webp', '.jpg')]],
    ['convert', [full, '-resize', '4096x4096', '-quality', '85', out.replace('.webp', '.jpg')]],
  ];
  let done = false;
  for (const [cmd, args] of attempts) {
    try { execFileSync(cmd, args, { stdio: 'pipe' }); done = true; break; } catch { /* next */ }
  }
  if (!done) console.warn('  ! no image resizer available (sips/magick/convert); using original size');
  console.log('  map underlay ready');
}

// -------------------------------------------------------------------- main
async function main() {
  await mkdir(DATA, { recursive: true });
  const atlas = await fetchAtlas();
  const [zhNames, fandom, enrich, mounts, wikigg] = await Promise.all([
    fetchZhNames(), fetchFandomPois(), fetchEnrichment(), fetchMounts(), fetchWikiggPois(),
  ]);
  // localize predator names ("Predator <EN name>" → "狂暴 <zh>")
  const zhByEn = Object.fromEntries(atlas.palsIdx.records.map((r) => [r.name, zhNames[r.id]]));
  for (const poi of wikigg.pois) {
    if (poi.cat !== 'predator') continue;
    const en = poi.name.replace(/^Predator /, '').replace(/（.*$/, '');
    if (zhByEn[en]) poi.name = poi.name.replace(`Predator ${en}`, `狂暴 ${zhByEn[en]}`);
  }
  fandom.cats.push(...wikigg.cats);
  fandom.pois.push(...wikigg.pois);

  const pal = normalizeSpawns(atlas.spawnsPalpagos, 'palpagos');
  const tree = normalizeSpawns(atlas.spawnsTree, 'tree');

  const palIds = atlas.palsIdx.records.map((r) => r.id);
  const enNameById = Object.fromEntries(atlas.palsIdx.records.map((r) => [r.id, r.name]));
  const iconExt = await fetchIcons(palIds, enNameById);
  await fetchMapImage();

  console.log('[6/6] writing data files…');
  // pals.json — the master list
  const pals = atlas.palsIdx.records.map((r) => {
    const e = enrich[r.id] ?? {};
    return {
      ...r,
      nameZh: zhNames[r.id] || null,
      icon: iconExt[r.id] ? `${r.id}.${iconExt[r.id]}` : null,
      spawnCount: { palpagos: pal.byPal.get(r.id)?.length || 0, tree: tree.byPal.get(r.id)?.length || 0 },
      alphaLevels: [...pal.alphas, ...tree.alphas].filter((a) => a.palId === r.id).map((a) => a.level),
      ignoreCombi: e.ignoreCombi ?? false,
      breedOrder: e.breedOrder ?? null,
      maleProbability: e.maleProbability ?? null,
      craftSpeed: e.craftSpeed ?? null,
      rideSpeed: e.rideSpeed ?? null,
      price: e.price ?? null,
      genus: e.genus ?? null,
      mount: mounts[r.id] ?? null,
    };
  });
  await writeJSON('pals.json', pals);
  // heavier per-pal text (drops / skills / partner skill / description) lives separately
  await writeJSON('enrich.json', Object.fromEntries(Object.entries(enrich).map(([id, e]) => [id, {
    description: e.description, drops: e.drops, partnerSkill: e.partnerSkill, skills: e.skills,
  }])));
  await writeJSON('breeding.json', atlas.breeding);
  await writeJSON('items.json', atlas.itemsIdx.records.map(({ id, name, description, category, subcategory, rarity, rank, weight, price, maxStack }) => ({ id, name, description, category, subcategory, rarity, rank, weight, price, maxStack })));

  // map data
  const nameZhFor = (palId) => zhNames[palId] || null;
  await writeJSON('map/pois.json', fandom);
  await writeJSON('map/alphas.json', [...pal.alphas, ...tree.alphas].map((a) => ({ ...a, nameZh: nameZhFor(a.palId) })));
  await writeJSON('map/regions.json', [
    { id: 'palpagos', name: 'Palpagos Islands', nameZh: '帕魯帕格斯群島', extent: pal.extent, image: existsSync(path.join(PUB, 'map', 'palpagos.webp')) ? '/map/palpagos.webp' : existsSync(path.join(PUB, 'map', 'palpagos.jpg')) ? '/map/palpagos.jpg' : null },
    { id: 'tree', name: 'World Tree', nameZh: '世界樹', extent: tree.extent, image: existsSync(path.join(PUB, 'map', 'tree.webp')) ? '/map/tree.webp' : null },
  ]);

  // per-pal spawn files + index
  const spawnIndex = { palpagos: {}, tree: {} };
  for (const [region, data] of [['palpagos', pal], ['tree', tree]]) {
    for (const [palId, pts] of data.byPal) {
      spawnIndex[region][palId] = pts.length;
      await mkdir(path.join(DATA, 'spawns', region), { recursive: true });
      await writeFile(path.join(DATA, 'spawns', region, `${palId}.json`), JSON.stringify(pts));
    }
  }
  console.log(`  wrote ${Object.keys(spawnIndex.palpagos).length}+${Object.keys(spawnIndex.tree).length} per-pal spawn files`);
  await writeJSON('spawns-index.json', spawnIndex);

  await writeJSON('meta.json', {
    steamBuildId: atlas.manifest.steamBuildId,
    gameDataGeneratedAt: atlas.manifest.generatedAt,
    fetchedAt: new Date().toISOString(),
    counts: atlas.manifest.counts,
    latestUrl: `${ATLAS_BASE}/latest.json`,
    attribution: [
      { name: 'palworld-atlas-data', url: 'https://github.com/Awy64/palworld-atlas-data', for: 'Pal stats, breeding, items, spawn coordinates (extracted from the official dedicated server package)' },
      { name: 'Palworld Wiki (Fandom)', url: 'https://palworld.fandom.com/wiki/Map:Palpagos_Islands', for: 'Static map POIs (CC BY-SA 3.0)' },
      { name: 'palworld.wiki.gg', url: 'https://palworld.wiki.gg/', for: 'World map image' },
      { name: 'pyPalworldAPI', url: 'https://github.com/stolenvw/pyPalworldAPI', for: 'Pal / element / work icons' },
      { name: 'paldb.cc', url: 'https://paldb.cc/tw/', for: 'Traditional Chinese pal names' },
    ],
    disclaimer: 'Unofficial fan project. Not affiliated with Pocketpair, Inc. Game content © Pocketpair, Inc.',
  });
  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
