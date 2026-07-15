import { useEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import L from 'leaflet';
import {
  asset, loadAlphas, loadBreeding, loadEnrich, loadPals, loadRegions, loadSpawnIndex, loadSpawns,
  palIconUrl, useData, elementIconUrl,
} from '../lib/data';
import type { Pal, Region, SpawnPoint } from '../lib/types';
import { WORK_ORDER, palDisplayName } from '../lib/i18n';
import { ElementBadge, PalIcon, WorkBadge } from '../components/shared';
import { buildBreedingModel, findParents } from '../lib/breeding';

const STAT_MAX = { hp: 150, attack: 150, defense: 150, runSpeed: 1600, stamina: 500, food: 9 };

export default function PalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const pals = useData(loadPals);
  const breeding = useData(loadBreeding);
  const alphas = useData(loadAlphas);
  const regions = useData(loadRegions);
  const spawnIndex = useData(loadSpawnIndex);
  const enrichAll = useData(loadEnrich);

  const pal = useMemo(() => pals?.find((p) => p.id === id) ?? null, [pals, id]);
  const model = useMemo(() => (pals && breeding ? buildBreedingModel(pals, breeding) : null), [pals, breeding]);

  const uniqueAsParent = useMemo(() => {
    if (!breeding || !pal || !model) return [];
    return breeding.uniquePairs
      .filter((u) => u.parentAId === pal.id || u.parentBId === pal.id)
      .map((u) => ({
        other: model.byId.get(u.parentAId === pal.id ? u.parentBId : u.parentAId),
        child: model.byId.get(u.childId),
      }));
  }, [breeding, pal, model]);

  const parentPairs = useMemo(() => {
    if (!model || !pal) return [];
    return findParents(model, pal.id);
  }, [model, pal]);

  const myAlphas = useMemo(() => (alphas ?? []).filter((a) => a.palId === id), [alphas, id]);

  if (!pals || !pal || !regions || !spawnIndex) return <div className="page">載入中…</div>;

  const enrich = enrichAll?.[pal.id] ?? null;
  const spawnRegion = pal.spawnCount.palpagos > 0 ? 'palpagos' : pal.spawnCount.tree > 0 ? 'tree' : null;

  return (
    <div className="page">
      <div className="detail-head">
        {palIconUrl(pal) && <img className="big" src={palIconUrl(pal)!} alt={palDisplayName(pal)} />}
        <div>
          <h1 style={{ margin: 0 }}>
            <span style={{ color: 'var(--ink-3)', marginRight: 8 }}>#{pal.paldexNumber}</span>
            {pal.nameZh ?? pal.name}
            {pal.nameZh && <span style={{ color: 'var(--ink-3)', fontSize: 15, marginLeft: 8 }}>{pal.name}</span>}
          </h1>
          <div style={{ marginTop: 6 }}>
            {pal.elements.map((el) => <ElementBadge key={el} el={el} />)}
            {pal.nocturnal && <span className="chip" style={{ marginLeft: 6 }}>🌙 夜行性</span>}
            {pal.ignoreCombi && <span className="chip" style={{ marginLeft: 6 }}>🧬 限同種配種</span>}
            {myAlphas.length > 0 && <span className="alpha-tag" style={{ marginLeft: 6 }}>👑 Alpha Lv{myAlphas.map((a) => a.level).join('/')}</span>}
          </div>
          {enrich?.description && (
            <p style={{ maxWidth: 640, color: 'var(--ink-2)', marginBottom: 0 }}>{enrich.description}</p>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <h2>基礎數值</h2>
          {([
            ['HP', pal.hp, STAT_MAX.hp],
            ['攻擊', pal.attack, STAT_MAX.attack],
            ['防禦', pal.defense, STAT_MAX.defense],
            ['跑速', pal.runSpeed, STAT_MAX.runSpeed],
            ['耐力', pal.stamina, STAT_MAX.stamina],
            ['食量', pal.food, STAT_MAX.food],
          ] as [string, number, number][]).map(([label, v, max]) => (
            <div className="statrow" key={label}>
              <span className="label">{label}</span>
              <span className="track"><span className="fill" style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></span>
              <span className="val">{v}</span>
            </div>
          ))}
          <div className="kv"><span className="k">稀有度</span><span>{pal.rarity}</span></div>
          <div className="kv"><span className="k">配種 Rank</span><span>{pal.breedingRank}</span></div>
          {pal.maleProbability != null && <div className="kv"><span className="k">公/母比例</span><span>♂ {pal.maleProbability}% / ♀ {100 - pal.maleProbability}%</span></div>}
          {pal.craftSpeed != null && <div className="kv"><span className="k">工作速度</span><span>{pal.craftSpeed}</span></div>}
          {pal.rideSpeed != null && pal.rideSpeed > 0 && <div className="kv"><span className="k">騎乘速度</span><span>{pal.rideSpeed}</span></div>}
          {pal.price != null && <div className="kv"><span className="k">售價</span><span>{pal.price}</span></div>}
          <div className="kv"><span className="k">內部 ID</span><span>{pal.id}</span></div>
        </div>

        {enrich?.partnerSkill && (
          <div className="card">
            <h2>夥伴技能 — {enrich.partnerSkill.nameZh ?? enrich.partnerSkill.name}</h2>
            <p style={{ color: 'var(--ink-2)', margin: 0 }}>{enrich.partnerSkill.descZh ?? enrich.partnerSkill.description}</p>
            {enrich.drops.length > 0 && (
              <>
                <h2 style={{ marginTop: 14 }}>掉落物</h2>
                {enrich.drops.map((d, i) => (
                  <div className="kv" key={i}>
                    <span className="k">{d.nameZh ?? d.name}</span>
                    <span>{d.min === d.max ? d.min : `${d.min}–${d.max}`} 個 · {d.rate}%</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {enrich && enrich.skills.length > 0 && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h2>技能（升級學習）</h2>
            <div className="tablewrap" style={{ maxHeight: 320 }}>
              <table className="data">
                <thead>
                  <tr><th className="num">Lv</th><th>技能</th><th>屬性</th><th className="num">威力</th><th className="num">CT</th><th>說明</th></tr>
                </thead>
                <tbody>
                  {enrich.skills.map((s, i) => (
                    <tr key={i}>
                      <td className="num">{s.level}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.nameZh ?? s.name}</div>
                        {s.nameZh && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.name}</div>}
                      </td>
                      <td><img src={elementIconUrl(s.type === 'Neutral' ? 'Normal' : s.type)} alt="" style={{ width: 18, height: 18, verticalAlign: '-4px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></td>
                      <td className="num">{s.power || '—'}</td>
                      <td className="num">{s.cooldown}s</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 240, fontSize: 12.5, color: 'var(--ink-2)' }}>{s.descZh ?? s.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <h2>工作適性</h2>
          {WORK_ORDER.filter((w) => pal.workSuitability[w]).map((w) => (
            <div className="kv" key={w}>
              <span className="k"><WorkBadge work={w} level={pal.workSuitability[w]!} /></span>
              <span>Lv {pal.workSuitability[w]}</span>
            </div>
          ))}
          {WORK_ORDER.every((w) => !pal.workSuitability[w]) && <p className="sub">無工作適性資料</p>}
          <h2 style={{ marginTop: 14 }}>出現地區</h2>
          <div className="kv"><span className="k">帕魯帕格斯群島</span><span>{pal.spawnCount.palpagos} 個出現點</span></div>
          <div className="kv"><span className="k">世界樹</span><span>{pal.spawnCount.tree} 個出現點</span></div>
          {spawnRegion && (
            <p style={{ marginTop: 8 }}>
              <Link to="/map">去大地圖睇出現範圍 →</Link>
            </p>
          )}
        </div>

        {spawnRegion && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h2>出現範圍（{spawnRegion === 'palpagos' ? '帕魯帕格斯群島' : '世界樹'}）</h2>
            <MiniSpawnMap
              palId={pal.id}
              region={regions.find((r) => r.id === spawnRegion)!}
            />
          </div>
        )}

        <div className="card">
          <h2>特殊配種組合</h2>
          {uniqueAsParent.length === 0 && <p className="sub">呢隻帕魯無特殊配種組合。</p>}
          <div className="pair-grid">
            {uniqueAsParent.map((u, i) => u.other && u.child && (
              <div className="pair-row" key={i}>
                <PalMini pal={pal} />
                <span className="arrow">×</span>
                <PalMini pal={u.other} />
                <span className="arrow">→</span>
                <PalMini pal={u.child} />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>點樣配出佢？（共 {parentPairs.length} 組）</h2>
          <div className="pair-grid">
            {parentPairs.slice(0, 200).map((pp, i) => (
              <div className="pair-row" key={i}>
                <PalMini pal={pp.a} />
                <span className="arrow">×</span>
                <PalMini pal={pp.b} />
              </div>
            ))}
            {parentPairs.length > 200 && <p className="sub">仲有 {parentPairs.length - 200} 組…（去配種計算器睇全部）</p>}
            {parentPairs.length === 0 && <p className="sub">冇一般配種組合（可能只可以捉或特殊組合取得）。</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PalMini({ pal }: { pal: Pal }) {
  return (
    <Link className="pal-mini" to={`/pal/${pal.id}`}>
      <PalIcon pal={pal} size={22} />
      {palDisplayName(pal)}
    </Link>
  );
}

function MiniSpawnMap({ palId, region }: { palId: string; region: Region }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!divRef.current) return;
    const [minX, minY, maxX, maxY] = region.extent;
    const bounds = L.latLngBounds([[minY, minX], [maxY, maxX]]);
    const ib = region.imageBounds ?? region.extent;
    const imgBounds = L.latLngBounds([[ib[1], ib[0]], [ib[3], ib[2]]]);
    const map = L.map(divRef.current, {
      crs: L.CRS.Simple, minZoom: -3, maxZoom: 2, zoomSnap: 0.5,
      attributionControl: false, preferCanvas: true,
    });
    mapRef.current = map;
    if (region.image) {
      L.imageOverlay(asset(region.image), imgBounds).addTo(map);
    } else {
      L.rectangle(bounds, { color: '#2c3140', weight: 1, fillColor: '#131722', fillOpacity: 1, interactive: false }).addTo(map);
    }
    map.fitBounds(bounds);

    let alive = true;
    loadSpawns(region.id, palId).then((pts: SpawnPoint[]) => {
      if (!alive || !mapRef.current) return;
      for (const p of pts) {
        L.circleMarker([p[1], p[0]], {
          radius: 4, color: '#0b0d12', weight: 1.5,
          fillColor: p[2] === 1 ? '#6d7ce0' : '#c98500', fillOpacity: 0.9,
        }).bindPopup(`Lv ${p[3]}–${p[4]} · ${p[2] === 1 ? '夜間限定' : '日夜都出'}${p[5] != null ? ` · 出現率約 ${p[5]}%` : ''}`).addTo(mapRef.current);
      }
    }).catch(() => {});
    return () => { alive = false; map.remove(); mapRef.current = null; };
  }, [palId, region]);

  return (
    <>
      <div ref={divRef} className="detail-map" />
      <p className="sub" style={{ marginTop: 8 }}>
        <span style={{ color: '#c98500' }}>●</span> 日夜都出現
        <span style={{ color: '#6d7ce0' }}>●</span> 夜間限定
      </p>
    </>
  );
}
