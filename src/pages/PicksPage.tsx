import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadPals, useData, workIconUrl } from '../lib/data';
import type { Pal, WorkName } from '../lib/types';
import { MOUNT_ZH, WORK_ORDER, WORK_ZH, palDisplayName } from '../lib/i18n';
import { COMBAT_PICKS, PICK_PHASE_ZH, WORK_EARLY_PICK, type PickPhase } from '../lib/picks';
import { ElementBadge, PalIcon } from '../components/shared';

type Tab = 'work' | 'combat' | 'mount';

/** mount unlock phase from saddle tech level */
const mountPhase = (tech: number | null): PickPhase => (tech == null ? 'late' : tech <= 20 ? 'early' : tech <= 45 ? 'mid' : 'late');
const PHASE_COLOR: Record<PickPhase, string> = { early: '#199e70', mid: '#3987e5', late: '#9085e9' };

export default function PicksPage() {
  const pals = useData(loadPals);
  const [tab, setTab] = useState<Tab>('work');

  const byName = useMemo(() => new Map((pals ?? []).map((p) => [p.name.toLowerCase(), p])), [pals]);

  if (!pals) return <div className="page">載入中…</div>;

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <h1>推薦帕魯</h1>
      <p className="sub">
        騎乘同工作排名<b>直接由遊戲數據計</b>(自動跟版本);戰鬥精選參考 op.gg 強度榜同社群攻略(2026-07)。
      </p>
      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={tab === 'work' ? 'on' : ''} onClick={() => setTab('work')}>🔧 工作用</button>
        <button className={tab === 'combat' ? 'on' : ''} onClick={() => setTab('combat')}>⚔️ 戰鬥用</button>
        <button className={tab === 'mount' ? 'on' : ''} onClick={() => setTab('mount')}>🏇 騎乘用</button>
      </div>
      {tab === 'work' && <WorkSection pals={pals} byName={byName} />}
      {tab === 'combat' && <CombatSection byName={byName} />}
      {tab === 'mount' && <MountSection pals={pals} />}
      <p className="sub" style={{ marginTop: 18 }}>
        參考:op.gg 強度榜 · game8 · nexttier · boostmatch(2026-07)。戰鬥強度會隨 patch 變,以實際版本為準。
      </p>
    </div>
  );
}

function PalRow({ pal, extra }: { pal: Pal; extra?: string }) {
  return (
    <Link className="pal-mini" to={`/pal/${pal.id}`}>
      <PalIcon pal={pal} size={22} />
      {palDisplayName(pal)}
      {extra && <span className="count-badge">{extra}</span>}
    </Link>
  );
}

function WorkSection({ pals, byName }: { pals: Pal[]; byName: Map<string, Pal> }) {
  return (
    <div className="base-grid">
      {WORK_ORDER.map((w: WorkName) => {
        const top = [...pals]
          .filter((p) => (p.workSuitability[w] ?? 0) > 0)
          .sort((a, b) => (b.workSuitability[w] ?? 0) - (a.workSuitability[w] ?? 0) || a.paldexNumber - b.paldexNumber)
          .slice(0, 5);
        const early = WORK_EARLY_PICK[w];
        const earlyPal = early && byName.get(early.name.toLowerCase());
        return (
          <div className="card" key={w}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src={workIconUrl(w)} alt="" style={{ width: 20, height: 20 }} />{WORK_ZH[w]}
            </h2>
            <div className="pair-grid" style={{ maxHeight: 'none' }}>
              {top.map((p, i) => (
                <div className="pair-row" key={p.id}>
                  <span className="count-badge" style={{ width: '2ch' }}>{i + 1}</span>
                  <PalRow pal={p} extra={`Lv${p.workSuitability[w]}`} />
                  {p.ignoreCombi && <span className="count-badge" title="限同種配種">🧬</span>}
                </div>
              ))}
            </div>
            {earlyPal && (
              <p className="base-desc" style={{ marginTop: 8, marginBottom: 0 }}>
                前期推薦:<b>{palDisplayName(earlyPal)}</b> — {early.reason}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CombatSection({ byName }: { byName: Map<string, Pal> }) {
  const phases: PickPhase[] = ['early', 'mid', 'late'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {phases.map((phase) => (
        <div className="card" key={phase}>
          <h2 style={{ color: PHASE_COLOR[phase] }}>{PICK_PHASE_ZH[phase]}</h2>
          <div className="base-grid">
            {COMBAT_PICKS[phase].map((pick) => {
              const pal = byName.get(pick.name.toLowerCase());
              if (!pal) return null;
              return (
                <div key={pick.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <PalIcon pal={pal} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Link to={`/pal/${pal.id}`} style={{ fontWeight: 700, color: 'var(--ink-1)' }}>{palDisplayName(pal)}</Link>
                      {pal.elements.map((el) => <ElementBadge key={el} el={el} />)}
                      {pick.tier && <span className="alpha-tag" style={{ color: pick.tier === 'S' ? '#c98500' : 'var(--accent)' }}>{pick.tier}</span>}
                      <span className="count-badge">攻 {pal.attack}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{pick.reason}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MountSection({ pals }: { pals: Pal[] }) {
  const types: ('ground' | 'fly' | 'swim')[] = ['ground', 'fly', 'swim'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="sub" style={{ margin: 0 }}>
        按騎乘速度排;顏色標示鞍具解鎖期:
        <span style={{ color: PHASE_COLOR.early }}> ●前期(科技≤20)</span>
        <span style={{ color: PHASE_COLOR.mid }}> ●中期(≤45)</span>
        <span style={{ color: PHASE_COLOR.late }}> ●後期(46+)</span>
      </p>
      {types.map((t) => {
        const list = pals
          .filter((p) => p.mount?.type === t)
          .sort((a, b) => (b.mount?.speed ?? 0) - (a.mount?.speed ?? 0))
          .slice(0, 12);
        return (
          <div className="card" key={t}>
            <h2>{t === 'ground' ? '🏇 地面坐騎' : t === 'fly' ? '🪽 飛行坐騎' : '🌊 水上坐騎'}</h2>
            <div className="tablewrap" style={{ maxHeight: 'none' }}>
              <table className="data">
                <thead>
                  <tr><th className="num">#</th><th>帕魯</th><th className="num">騎乘速度</th><th className="num">加速</th><th className="num">鞍具Lv</th><th>期數</th></tr>
                </thead>
                <tbody>
                  {list.map((p, i) => {
                    const ph = mountPhase(p.mount!.tech);
                    return (
                      <tr key={p.id}>
                        <td className="num">{i + 1}</td>
                        <td><PalRow pal={p} /></td>
                        <td className="num">{p.mount!.speed ?? ''}</td>
                        <td className="num">{p.mount!.sprint ?? ''}</td>
                        <td className="num">{p.mount!.tech ?? ''}</td>
                        <td><span style={{ color: PHASE_COLOR[ph] }}>● {MOUNT_ZH[p.mount!.type]}用・{PICK_PHASE_ZH[ph].slice(0, 2)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
