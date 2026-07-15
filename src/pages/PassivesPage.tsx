import { useMemo, useState } from 'react';
import { loadPassives, useData } from '../lib/data';

const TIER_COLOR: Record<number, string> = {
  1: '#8a8f9c', 2: '#3987e5', 3: '#9085e9', 4: '#c98500',
};

export default function PassivesPage() {
  const passives = useData(loadPassives);
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<number | null>(null);

  const rows = useMemo(() => {
    if (!passives) return [];
    const s = q.trim().toLowerCase();
    return passives
      .filter((p) => (tier == null || p.tier === tier)
        && (!s || p.name.toLowerCase().includes(s) || (p.nameZh ?? '').toLowerCase().includes(s) || (p.ability ?? '').toLowerCase().includes(s) || (p.description ?? '').toLowerCase().includes(s)))
      .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name));
  }, [passives, q, tier]);

  if (!passives) return <div className="page">載入中…</div>;
  const tiers = [...new Set(passives.map((p) => p.tier))].sort((a, b) => b - a);

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1>被動技能一覽</h1>
      <p className="sub">全部 {passives.length} 個被動(來自遊戲數據)。Tier 越高越強;負面被動記得配種洗走。</p>
      <div className="toolbar">
        <input type="search" placeholder="搜尋被動名 / 效果…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
        {tiers.map((t) => (
          <button key={t} className={`chip${tier === t ? ' on' : ''}`} onClick={() => setTier(tier === t ? null : t)}>
            Tier {t}
          </button>
        ))}
        <span className="count-badge">{rows.length} 個</span>
      </div>
      <div className="tablewrap">
        <table className="data">
          <thead>
            <tr><th>被動</th><th>類型</th><th className="num">Tier</th><th>效果</th></tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={i}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.nameZh ?? p.name}</div>
                  {p.nameZh && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{p.name}</div>}
                </td>
                <td style={{ color: 'var(--ink-2)' }}>{p.ability}</td>
                <td className="num">
                  <span style={{ color: TIER_COLOR[p.tier] ?? 'var(--ink-2)', fontWeight: 700 }}>{p.tier}</span>
                </td>
                <td style={{ whiteSpace: 'normal', minWidth: 260, color: 'var(--ink-2)' }}>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
