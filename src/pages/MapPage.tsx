import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { Pal, Poi, PoiCategory, RegionId, SpawnPoint } from '../lib/types';
import {
  asset, loadAlphas, loadPals, loadPois, loadRegions, loadSpawnIndex, loadSpawns,
  palIconUrl, useData,
} from '../lib/data';
import { palDisplayName } from '../lib/i18n';
import { PalIcon } from '../components/shared';

/** dark-mode categorical slots (dataviz reference palette) for selected pals */
const PAL_COLORS = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'];

const ALPHA_CAT: PoiCategory = { id: 'alpha', name: 'Alpha Boss', nameZh: 'Alpha 頭目', color: '#e66767', glyph: '王' };

/** sidebar sections (op.gg-style grouping) */
const CAT_GROUPS: { id: string; name: string; catIds: string[] }[] = [
  { id: 'explore', name: '地點', catIds: ['fast_travel', 'tower', 'dungeon', 'sealed_realm'] },
  { id: 'collect', name: '收集品', catIds: ['effigy', 'statue_power', 'journal', 'chest', 'egg', 'skill_fruit'] },
  { id: 'enemy', name: '敵人', catIds: ['alpha', 'bounty', 'predator', 'poacher_camp'] },
];

interface SpawnSel { palId: string; color: string }

function esc(s: string) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function pinIcon(color: string, glyph: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #0b0d12;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.6)"><span style="transform:rotate(45deg);font-size:10px;font-weight:700;color:#0b0d12;line-height:1">${glyph}</span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });
}

/** greedy grid clustering for spawn-range circles */
function clusterPoints(pts: [number, number][], cell = 80): { cx: number; cy: number; r: number; n: number }[] {
  if (!pts.length) return [];
  const keyOf = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const cells = new Map<string, [number, number][]>();
  for (const [x, y] of pts) {
    const k = keyOf(x, y);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push([x, y]);
  }
  // union adjacent cells (8-neighbourhood) via BFS
  const seen = new Set<string>();
  const clusters: { cx: number; cy: number; r: number; n: number }[] = [];
  for (const start of cells.keys()) {
    if (seen.has(start)) continue;
    const stack = [start];
    const members: [number, number][] = [];
    seen.add(start);
    while (stack.length) {
      const k = stack.pop()!;
      members.push(...cells.get(k)!);
      const [gx, gy] = k.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nk = `${gx + dx},${gy + dy}`;
          if (!seen.has(nk) && cells.has(nk)) { seen.add(nk); stack.push(nk); }
        }
      }
    }
    let sx = 0, sy = 0;
    for (const [x, y] of members) { sx += x; sy += y; }
    const cx = sx / members.length, cy = sy / members.length;
    let r = 0;
    for (const [x, y] of members) r = Math.max(r, Math.hypot(x - cx, y - cy));
    clusters.push({ cx, cy, r: Math.max(r + 18, 30), n: members.length });
  }
  return clusters;
}

export default function MapPage() {
  const pals = useData(loadPals);
  const poiData = useData(loadPois);
  const alphas = useData(loadAlphas);
  const regions = useData(loadRegions);
  const spawnIndex = useData(loadSpawnIndex);

  const [region, setRegion] = useState<RegionId>('palpagos');
  const [catOn, setCatOn] = useState<Record<string, boolean>>({ fast_travel: true, tower: true, alpha: true });
  const [pinOff, setPinOff] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pinFilter, setPinFilter] = useState('');
  const [spawnSel, setSpawnSel] = useState<SpawnSel[]>([]);
  const [dayNight, setDayNight] = useState<'all' | 'day' | 'night'>('all');
  const [spawnMode, setSpawnMode] = useState<'points' | 'circles'>('circles');
  const [spawnData, setSpawnData] = useState<Record<string, SpawnPoint[]>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const [palFilter, setPalFilter] = useState('');

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{ base?: L.Layer; pois?: L.LayerGroup; spawns?: L.LayerGroup }>({});

  const byId = useMemo(() => new Map((pals ?? []).map((p) => [p.id, p])), [pals]);
  const regionInfo = useMemo(() => regions?.find((r) => r.id === region) ?? null, [regions, region]);
  // the map div only mounts once everything is loaded (early return below), so
  // effects must key on readiness, not just their own data
  const ready = !!(pals && poiData && alphas && regions && spawnIndex);

  const alphaAsPois: Poi[] = useMemo(() =>
    (alphas ?? [])
      .filter((a) => a.region === region)
      .map((a, i) => ({
        id: `alpha-${a.region}-${i}-${a.palId}`,
        cat: 'alpha',
        x: a.x, y: a.y,
        name: `Lv${a.level} ${a.nameZh ?? a.name}`,
        link: null,
        palId: a.palId,
      }) as Poi & { palId: string }),
  [alphas, region]);

  const cats: PoiCategory[] = useMemo(() => {
    const base = region === 'palpagos' ? (poiData?.cats ?? []) : [];
    return [ALPHA_CAT, ...base];
  }, [poiData, region]);

  const poisByCat = useMemo(() => {
    const m = new Map<string, Poi[]>();
    m.set('alpha', alphaAsPois);
    if (region === 'palpagos') {
      for (const p of poiData?.pois ?? []) {
        if (!m.has(p.cat)) m.set(p.cat, []);
        m.get(p.cat)!.push(p);
      }
    }
    return m;
  }, [poiData, alphaAsPois, region]);

  // ---- map init / region switch ----
  useEffect(() => {
    if (!ready || !mapDiv.current || !regionInfo) return;
    const [minX, minY, maxX, maxY] = regionInfo.extent;
    const bounds = L.latLngBounds([[minY, minX], [maxY, maxX]]);

    if (!mapRef.current) {
      const map = L.map(mapDiv.current, {
        crs: L.CRS.Simple,
        minZoom: -3,
        maxZoom: 3,
        zoomSnap: 0.5,
        attributionControl: false,
        preferCanvas: true,
      });
      mapRef.current = map;
      map.on('mousemove', (e: L.LeafletMouseEvent) => {
        setCursor([Math.round(e.latlng.lng), Math.round(e.latlng.lat)]);
      });
    }
    const map = mapRef.current;
    if (layersRef.current.base) { map.removeLayer(layersRef.current.base); layersRef.current.base = undefined; }

    if (regionInfo.image) {
      layersRef.current.base = L.imageOverlay(asset(regionInfo.image), bounds).addTo(map);
    } else {
      // no underlay available yet (World Tree) — draw a subtle grid
      const g = L.layerGroup();
      L.rectangle(bounds, { color: '#2c3140', weight: 1, fillColor: '#131722', fillOpacity: 1, interactive: false }).addTo(g);
      const step = 100;
      for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
        L.polyline([[minY, x], [maxY, x]], { color: '#222838', weight: 1, interactive: false }).addTo(g);
      }
      for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
        L.polyline([[y, minX], [y, maxX]], { color: '#222838', weight: 1, interactive: false }).addTo(g);
      }
      layersRef.current.base = g.addTo(map);
    }
    map.setMaxBounds(bounds.pad(0.25));
    map.fitBounds(bounds);
    return () => { /* map persists across region switches */ };
  }, [regionInfo, ready]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  // ---- POI + alpha layer ----
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    layersRef.current.pois?.remove();
    const group = L.layerGroup();
    for (const cat of cats) {
      if (!catOn[cat.id]) continue;
      for (const poi of poisByCat.get(cat.id) ?? []) {
        if (pinOff.has(poi.id)) continue;
        const mk = L.marker([poi.y, poi.x], { icon: pinIcon(cat.color, cat.glyph) });
        const palId = (poi as Poi & { palId?: string }).palId;
        const pal = palId ? byId.get(palId) : null;
        const iconHtml = pal && palIconUrl(pal) ? `<img src="${palIconUrl(pal)}" style="width:34px;height:34px;border-radius:50%;float:left;margin-right:8px" alt=""/>` : '';
        mk.bindPopup(
          `<div>${iconHtml}<div class="popup-title">${esc(poi.name)}</div>` +
          `<div class="popup-sub">${esc(cat.nameZh)} · (${Math.round(poi.x)}, ${Math.round(poi.y)})</div>` +
          (pal ? `<a href="${asset(`/pal/${pal.id}`)}">睇 ${esc(palDisplayName(pal))} 詳細 →</a>` : '') +
          `</div>`,
        );
        mk.addTo(group);
      }
    }
    layersRef.current.pois = group.addTo(map);
  }, [cats, poisByCat, catOn, pinOff, byId, ready]);

  // ---- spawn data fetch ----
  useEffect(() => {
    for (const sel of spawnSel) {
      const key = `${region}:${sel.palId}`;
      if (spawnData[key]) continue;
      if (!spawnIndex?.[region]?.[sel.palId]) { setSpawnData((d) => ({ ...d, [key]: [] })); continue; }
      loadSpawns(region, sel.palId)
        .then((pts) => setSpawnData((d) => ({ ...d, [key]: pts })))
        .catch(() => setSpawnData((d) => ({ ...d, [key]: [] })));
    }
  }, [spawnSel, region, spawnIndex, spawnData]);

  // ---- spawn layer ----
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    layersRef.current.spawns?.remove();
    const group = L.layerGroup();
    for (const sel of spawnSel) {
      const pts = spawnData[`${region}:${sel.palId}`] ?? [];
      const pal = byId.get(sel.palId);
      const filtered = pts.filter((p) => {
        if (dayNight === 'day') return p[2] === 0;
        if (dayNight === 'night') return true; // night-only + anytime pals both appear at night
        return true;
      });
      const dayPts = filtered.filter((p) => p[2] === 0);
      const nightPts = filtered.filter((p) => p[2] === 1);
      const name = pal ? palDisplayName(pal) : sel.palId;

      if (spawnMode === 'circles') {
        const mk = (list: SpawnPoint[], dashed: boolean) => {
          for (const c of clusterPoints(list.map((p) => [p[0], p[1]]))) {
            const lv = levelRange(list);
            L.circle([c.cy, c.cx], {
              radius: c.r, color: sel.color, weight: 2,
              dashArray: dashed ? '6 5' : undefined,
              fillColor: sel.color, fillOpacity: 0.13,
            }).bindPopup(
              `<div><div class="popup-title">${esc(name)}</div>` +
              `<div class="popup-sub">${dashed ? '夜間出現' : '日夜出現'} · ${c.n} 個出現點 · Lv ${lv}</div></div>`,
            ).addTo(group);
          }
        };
        if (dayNight !== 'night') mk(dayPts, false);
        if (dayNight !== 'day' && nightPts.length) mk(nightPts, true);
      } else {
        const show = dayNight === 'night' ? filtered : dayNight === 'day' ? dayPts : filtered;
        for (const p of show) {
          const night = p[2] === 1;
          L.circleMarker([p[1], p[0]], {
            radius: 4.5, color: '#0b0d12', weight: 1.5,
            fillColor: sel.color, fillOpacity: night ? 0.25 : 0.95,
          }).bindPopup(
            `<div><div class="popup-title">${esc(name)}</div>` +
            `<div class="popup-sub">Lv ${p[3]}–${p[4]} · ${night ? '夜間限定' : '日夜都出'} · (${Math.round(p[0])}, ${Math.round(p[1])})</div></div>`,
          ).addTo(group);
        }
      }
    }
    layersRef.current.spawns = group.addTo(map);
  }, [spawnSel, spawnData, spawnMode, dayNight, region, byId, ready]);

  if (!pals || !poiData || !alphas || !regions || !spawnIndex) {
    return <div className="page">載入地圖數據中…</div>;
  }

  const addSpawnPal = (pal: Pal) => {
    setSpawnSel((cur) => {
      if (cur.some((s) => s.palId === pal.id) || cur.length >= PAL_COLORS.length) return cur;
      const used = new Set(cur.map((s) => s.color));
      const color = PAL_COLORS.find((c) => !used.has(c)) ?? PAL_COLORS[0];
      return [...cur, { palId: pal.id, color }];
    });
  };

  const toggleCat = (id: string) => setCatOn((c) => ({ ...c, [id]: !c[id] }));
  const togglePin = (id: string) => setPinOff((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const setAllPins = (catId: string, on: boolean) => setPinOff((s) => {
    const next = new Set(s);
    for (const p of poisByCat.get(catId) ?? []) {
      if (on) next.delete(p.id); else next.add(p.id);
    }
    return next;
  });
  const locate = (poi: Poi) => {
    mapRef.current?.flyTo([poi.y, poi.x], Math.max(mapRef.current.getZoom(), 1), { duration: 0.6 });
    if (window.innerWidth <= 800) setSidebarOpen(false);
  };

  return (
    <div className="map-layout">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)}>☰ 圖層</button>
      <div className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="region-tabs">
          {regions.map((r) => (
            <button key={r.id} className={region === r.id ? 'on' : ''} onClick={() => setRegion(r.id)}>
              {r.nameZh}
            </button>
          ))}
        </div>
        {region === 'tree' && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            世界樹（1.0 新地區）暫時未有地圖底圖,先用格網顯示座標同出現點。
          </div>
        )}
        {region === 'palpagos' && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            底圖仲係 1.0 之前版本 —— 1.0 新增嘅小島會顯示喺海上,wiki 出新圖後更新數據就會自動換。
          </div>
        )}

        <h3>地圖標記</h3>
        <input
          type="search" placeholder="篩選標記名稱…" value={pinFilter}
          onChange={(e) => setPinFilter(e.target.value)}
        />
        {CAT_GROUPS.map((g) => {
          const groupCats = cats.filter((c) => g.catIds.includes(c.id) && (poisByCat.get(c.id)?.length ?? 0) > 0);
          if (!groupCats.length) return null;
          const groupOpen = !closedGroups.has(g.id);
          const total = groupCats.reduce((n, c) => n + (poisByCat.get(c.id)?.length ?? 0), 0);
          const setGroup = (on: boolean) => setCatOn((cur) => {
            const next = { ...cur };
            for (const c of groupCats) next[c.id] = on;
            return next;
          });
          return (
            <div key={g.id} className="cat-group">
              <div className="group-head">
                <button
                  className="group-toggle"
                  onClick={() => setClosedGroups((cur) => {
                    const next = new Set(cur);
                    if (next.has(g.id)) next.delete(g.id); else next.add(g.id);
                    return next;
                  })}
                >
                  {groupOpen ? '▾' : '▸'} {g.name}
                  <span className="count-badge">{total}</span>
                </button>
                <button className="locate" onClick={() => setGroup(true)}>全開</button>
                <button className="locate" onClick={() => setGroup(false)}>全關</button>
              </div>
              {groupOpen && groupCats.map((cat) => {
                const pois = (poisByCat.get(cat.id) ?? []).filter(
                  (p) => !pinFilter || p.name.toLowerCase().includes(pinFilter.toLowerCase()),
                );
                if (!pois.length && pinFilter) return null;
                const isOpen = expanded === cat.id;
                const offCount = pois.filter((p) => pinOff.has(p.id)).length;
                return (
                  <div className="cat-row" key={cat.id}>
                    <div className="cat-head">
                      <label>
                        <input type="checkbox" checked={!!catOn[cat.id]} onChange={() => toggleCat(cat.id)} />
                        <span className="cat-glyph" style={{ background: cat.color }}>{cat.glyph}</span>
                        <span>{cat.nameZh}</span>
                        <span className="count-badge">{pois.length - offCount}/{pois.length}</span>
                      </label>
                      <button className="cat-expand" onClick={() => setExpanded(isOpen ? null : cat.id)}>
                        {isOpen ? '▲' : '▼'}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="pin-list">
                        <div className="pin-row" style={{ borderBottom: '1px solid var(--hairline)' }}>
                          <button className="locate" onClick={() => setAllPins(cat.id, true)}>全開</button>
                          <button className="locate" onClick={() => setAllPins(cat.id, false)}>全關</button>
                        </div>
                        {pois.map((p) => (
                          <div className="pin-row" key={p.id}>
                            <label>
                              <input
                                type="checkbox"
                                checked={!pinOff.has(p.id)}
                                onChange={() => togglePin(p.id)}
                              />
                              <span className="pin-name">{p.name}</span>
                            </label>
                            <button className="locate" title="喺地圖顯示" onClick={() => locate(p)}>◎</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        <h3>帕魯出現範圍</h3>
        <div className="spawn-controls">
          {spawnSel.map((sel) => {
            const pal = byId.get(sel.palId);
            if (!pal) return null;
            const cnt = spawnIndex[region]?.[sel.palId] ?? 0;
            return (
              <div className="spawn-pal-row" key={sel.palId}>
                <span className="swatch" style={{ background: sel.color }} />
                <PalIcon pal={pal} size={26} />
                <span className="grow">{palDisplayName(pal)} <span className="count-badge">{cnt} 點</span></span>
                <button className="rm" onClick={() => setSpawnSel((c) => c.filter((s) => s.palId !== sel.palId))}>✕</button>
              </div>
            );
          })}
          {spawnSel.length > 0 && (
            <>
              <div className="seg">
                <button className={spawnMode === 'circles' ? 'on' : ''} onClick={() => setSpawnMode('circles')}>範圍圈</button>
                <button className={spawnMode === 'points' ? 'on' : ''} onClick={() => setSpawnMode('points')}>出現點</button>
              </div>
              <div className="seg">
                <button className={dayNight === 'all' ? 'on' : ''} onClick={() => setDayNight('all')}>全部</button>
                <button className={dayNight === 'day' ? 'on' : ''} onClick={() => setDayNight('day')}>☀ 日間</button>
                <button className={dayNight === 'night' ? 'on' : ''} onClick={() => setDayNight('night')}>🌙 夜間</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                實線/實心＝日夜都出現;虛線/空心＝夜間限定。最多同時顯示 {PAL_COLORS.length} 隻。
              </div>
            </>
          )}
          <input
            type="search" placeholder="搜尋帕魯(中/英文名)…" value={palFilter}
            onChange={(e) => setPalFilter(e.target.value)}
          />
          <div className="spawn-results">
            {pals
              .filter((p) => (spawnIndex[region]?.[p.id] ?? 0) > 0 && !spawnSel.some((s) => s.palId === p.id))
              .filter((p) => {
                const s = palFilter.trim().toLowerCase();
                return !s || (p.nameZh ?? '').toLowerCase().includes(s) || p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s);
              })
              .sort((a, b) => a.paldexNumber - b.paldexNumber)
              .map((p) => (
                <button key={p.id} className="spawn-result-row" onClick={() => addSpawnPal(p)}>
                  <PalIcon pal={p} size={24} />
                  <span>{palDisplayName(p)}</span>
                  <span className="cnt">{spawnIndex[region]?.[p.id]} 點</span>
                </button>
              ))}
          </div>
        </div>
      </div>

      <div className="map-area">
        <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />
        <div className="map-legend">
          {cursor && <div>座標 ({cursor[0]}, {cursor[1]})</div>}
          {spawnSel.length > 0 && <div><span className="dot" style={{ background: 'var(--ink-2)' }} />實心＝日間 · 空心/虛線＝夜間</div>}
        </div>
      </div>
    </div>
  );
}

function levelRange(pts: SpawnPoint[]): string {
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { lo = Math.min(lo, p[3]); hi = Math.max(hi, p[4]); }
  return lo === Infinity ? '?' : `${lo}–${hi}`;
}
