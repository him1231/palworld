import { useMemo, useState } from 'react';
import { loadBreeding, loadPals, useData } from '../lib/data';
import type { Pal } from '../lib/types';
import { palDisplayName } from '../lib/i18n';
import { PalIcon, PalPicker } from '../components/shared';
import { breedChild, buildBreedingModel, findParents } from '../lib/breeding';
import { Link } from 'react-router-dom';

export default function BreedingPage() {
  const pals = useData(loadPals);
  const breeding = useData(loadBreeding);
  const model = useMemo(() => (pals && breeding ? buildBreedingModel(pals, breeding) : null), [pals, breeding]);

  const [parentA, setParentA] = useState<Pal | null>(null);
  const [parentB, setParentB] = useState<Pal | null>(null);
  const [target, setTarget] = useState<Pal | null>(null);

  const child = useMemo(() => {
    if (!model || !parentA || !parentB) return null;
    return breedChild(model, parentA.id, parentB.id);
  }, [model, parentA, parentB]);

  const parentPairs = useMemo(() => {
    if (!model || !target) return null;
    return findParents(model, target.id);
  }, [model, target]);

  if (!pals || !model) return <div className="page">載入中…</div>;

  return (
    <div className="page">
      <h1>配種計算器</h1>
      <p className="sub">
        用遊戲內部 CombiRank 計算(特殊組合優先,同種＝同種)。罕見情況下同 Rank 並列時結果可能有出入。
      </p>
      <div className="breed-cols">
        <div className="card">
          <h2>父母 → 仔</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <SelectedRow label="父/母 A" pal={parentA} onClear={() => setParentA(null)} />
            {!parentA && <PalPicker pals={pals} onPick={setParentA} />}
            <SelectedRow label="父/母 B" pal={parentB} onClear={() => setParentB(null)} />
            {!parentB && <PalPicker pals={pals} onPick={setParentB} />}
          </div>
          {child && parentA && parentB && (
            <div className="breed-result">
              <PalIcon pal={child} size={56} />
              <div>
                <div style={{ fontWeight: 700 }}>
                  <Link to={`/pal/${child.id}`}>{palDisplayName(child)}</Link>
                </div>
                <div className="popup-sub">
                  {palDisplayName(parentA)} × {palDisplayName(parentB)} → #{child.paldexNumber}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2>目標仔 → 父母組合</h2>
          <SelectedRow label="目標帕魯" pal={target} onClear={() => setTarget(null)} />
          {!target && <PalPicker pals={pals} onPick={setTarget} />}
          {parentPairs && target && (
            <>
              <p className="sub" style={{ margin: '10px 0 6px' }}>共 {parentPairs.length} 組(得意組合會好多,建議用搜尋)</p>
              <PairList pairs={parentPairs} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectedRow({ label, pal, onClear }: { label: string; pal: Pal | null; onClear: () => void }) {
  if (!pal) return <div className="popup-sub">{label}:未揀</div>;
  return (
    <div className="spawn-pal-row">
      <PalIcon pal={pal} size={26} />
      <span className="grow">{label}:{palDisplayName(pal)}</span>
      <button className="rm" onClick={onClear}>✕</button>
    </div>
  );
}

function PairList({ pairs }: { pairs: { a: Pal; b: Pal }[] }) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(100);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return pairs;
    const hit = (p: Pal) => (p.nameZh ?? '').toLowerCase().includes(s) || p.name.toLowerCase().includes(s);
    return pairs.filter((pp) => hit(pp.a) || hit(pp.b));
  }, [pairs, q]);
  return (
    <div>
      <input type="search" placeholder="篩選父母名…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(100); }}
        style={{ width: '100%', marginBottom: 8, background: 'var(--surface-2)', color: 'var(--ink-1)', border: '1px solid var(--hairline)', borderRadius: 6, padding: '6px 10px' }} />
      <div className="pair-grid">
        {filtered.slice(0, limit).map((pp, i) => (
          <div className="pair-row" key={i}>
            <Link className="pal-mini" to={`/pal/${pp.a.id}`}><PalIcon pal={pp.a} size={22} />{palDisplayName(pp.a)}</Link>
            <span className="arrow">×</span>
            <Link className="pal-mini" to={`/pal/${pp.b.id}`}><PalIcon pal={pp.b} size={22} />{palDisplayName(pp.b)}</Link>
          </div>
        ))}
      </div>
      {filtered.length > limit && (
        <button className="chip" style={{ marginTop: 8 }} onClick={() => setLimit((l) => l + 200)}>
          顯示更多（仲有 {filtered.length - limit} 組）
        </button>
      )}
    </div>
  );
}
