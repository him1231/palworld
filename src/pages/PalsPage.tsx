import { useEffect, useMemo, useRef, useState } from 'react';
import { loadPals, useData, elementIconUrl, workIconUrl } from '../lib/data';
import type { ElementName, Pal, WorkName } from '../lib/types';
import {
  ELEMENT_ORDER, ELEMENT_ZH, MOUNT_ZH, WORK_DESC, WORK_ORDER, WORK_ZH, elementTip,
} from '../lib/i18n';
import { PalNameCell, StatBar } from '../components/shared';

type ColId =
  | 'dex' | 'name' | 'elements' | 'hp' | 'attack' | 'defense' | 'runSpeed' | 'stamina'
  | 'food' | 'rarity' | 'breedingRank' | 'spawns' | `work:${WorkName}`
  | 'mountType' | 'mountSpeed' | 'mountSprint' | 'mountTech' | 'other';

interface Col { id: ColId; label: string; num?: boolean; sortable?: boolean; defaultOn?: boolean; work?: WorkName }

const COLS: Col[] = [
  { id: 'dex', label: '#', num: true, sortable: true, defaultOn: true },
  { id: 'name', label: '帕魯', sortable: true, defaultOn: true },
  { id: 'elements', label: '屬性', defaultOn: true },
  { id: 'hp', label: 'HP', num: true, sortable: true, defaultOn: true },
  { id: 'attack', label: '攻擊', num: true, sortable: true, defaultOn: true },
  { id: 'defense', label: '防禦', num: true, sortable: true, defaultOn: true },
  { id: 'runSpeed', label: '跑速', num: true, sortable: true, defaultOn: false },
  { id: 'stamina', label: '耐力', num: true, sortable: true, defaultOn: false },
  { id: 'food', label: '食量', num: true, sortable: true, defaultOn: true },
  { id: 'rarity', label: '稀有度', num: true, sortable: true, defaultOn: false },
  { id: 'breedingRank', label: '配種Rank', num: true, sortable: true, defaultOn: false },
  { id: 'spawns', label: '出現點', num: true, sortable: true, defaultOn: false },
  // one column per work type — sortable, so you can rank pals by e.g. 手工作業
  ...WORK_ORDER.map((w): Col => ({ id: `work:${w}`, label: WORK_ZH[w], num: true, sortable: true, defaultOn: true, work: w })),
  { id: 'mountType', label: '騎乘', sortable: true, defaultOn: true },
  { id: 'mountSpeed', label: '騎乘速度', num: true, sortable: true, defaultOn: true },
  { id: 'mountSprint', label: '加速速度', num: true, sortable: true, defaultOn: false },
  { id: 'mountTech', label: '鞍具Lv', num: true, sortable: true, defaultOn: false },
  { id: 'other', label: '其他', defaultOn: true },
];

const COLS_STORE_KEY = 'pal-cols-v2';

function loadColPrefs(): Set<ColId> {
  try {
    const raw = localStorage.getItem(COLS_STORE_KEY);
    if (raw) return new Set(JSON.parse(raw) as ColId[]);
  } catch { /* fall through */ }
  return new Set(COLS.filter((c) => c.defaultOn).map((c) => c.id));
}

export default function PalsPage() {
  const pals = useData(loadPals);
  const [q, setQ] = useState('');
  const [elements, setElements] = useState<Set<ElementName>>(new Set());
  const [works, setWorks] = useState<Set<WorkName>>(new Set());
  const [mountFilter, setMountFilter] = useState<Set<'ground' | 'fly' | 'swim'>>(new Set());
  const [nocturnalOnly, setNocturnalOnly] = useState(false);
  const [alphaOnly, setAlphaOnly] = useState(false);
  const [sort, setSort] = useState<{ key: ColId; dir: 1 | -1 }>({ key: 'dex', dir: 1 });
  const [visCols, setVisCols] = useState<Set<ColId>>(loadColPrefs);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(COLS_STORE_KEY, JSON.stringify([...visCols]));
  }, [visCols]);

  useEffect(() => {
    if (!colMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (!colMenuRef.current?.contains(e.target as Node)) setColMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [colMenuOpen]);

  const maxes = useMemo(() => {
    if (!pals) return null;
    const m = { hp: 1, attack: 1, defense: 1 };
    for (const p of pals) {
      m.hp = Math.max(m.hp, p.hp); m.attack = Math.max(m.attack, p.attack); m.defense = Math.max(m.defense, p.defense);
    }
    return m;
  }, [pals]);

  const rows = useMemo(() => {
    if (!pals) return [];
    const s = q.trim().toLowerCase();
    const list = pals.filter((p) => {
      if (s && !((p.nameZh ?? '').toLowerCase().includes(s) || p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s) || String(p.paldexNumber) === s)) return false;
      if (elements.size && !p.elements.some((e) => elements.has(e))) return false;
      if (works.size && ![...works].every((w) => (p.workSuitability[w] ?? 0) > 0)) return false;
      if (mountFilter.size && !(p.mount && mountFilter.has(p.mount.type))) return false;
      if (nocturnalOnly && !p.nocturnal) return false;
      if (alphaOnly && p.alphaLevels.length === 0) return false;
      return true;
    });
    const { key, dir } = sort;
    const val = (p: Pal): number | string => {
      if (key.startsWith('work:')) return p.workSuitability[key.slice(5) as WorkName] ?? 0;
      switch (key) {
        case 'dex': return p.paldexNumber;
        case 'name': return p.nameZh ?? p.name;
        case 'spawns': return p.spawnCount.palpagos + p.spawnCount.tree;
        case 'mountType': return p.mount ? { ground: 1, fly: 2, swim: 3 }[p.mount.type] : 99;
        case 'mountSpeed': return p.mount?.speed ?? -1;
        case 'mountSprint': return p.mount?.sprint ?? -1;
        case 'mountTech': return p.mount?.tech ?? 999;
        case 'hp': case 'attack': case 'defense': case 'runSpeed': case 'stamina':
        case 'food': case 'rarity': case 'breedingRank': return p[key];
        default: return 0;
      }
    };
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b);
      const c = typeof va === 'string' ? String(va).localeCompare(String(vb), 'zh-Hant') : (va as number) - (vb as number);
      return c * dir || a.paldexNumber - b.paldexNumber;
    });
  }, [pals, q, elements, works, mountFilter, nocturnalOnly, alphaOnly, sort]);

  if (!pals || !maxes) return <div className="page">載入中…</div>;

  const toggleSort = (c: Col) => {
    if (!c.sortable) return;
    setSort((cur) => (cur.key === c.id
      ? { key: c.id, dir: cur.dir === 1 ? -1 : 1 }
      : { key: c.id, dir: c.id === 'dex' || c.id === 'name' || c.id === 'mountTech' || c.id === 'mountType' ? 1 : -1 }));
  };
  const workLevel = (p: Pal, w: WorkName) => p.workSuitability[w] ?? 0;
  const toggleSet = <T,>(set: Set<T>, v: T): Set<T> => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  };

  const shown = COLS.filter((c) => visCols.has(c.id));

  const cellFor = (c: Col, p: Pal) => {
    if (c.work) {
      const lv = workLevel(p, c.work);
      return (
        <td key={c.id} className="num work-cell">
          {lv > 0
            ? <span data-tip={`${WORK_ZH[c.work]} Lv${lv}|${WORK_DESC[c.work]}`}>{lv}</span>
            : <span className="work-zero">·</span>}
        </td>
      );
    }
    switch (c.id) {
      case 'dex': return <td key={c.id} className="num">{p.paldexNumber}</td>;
      case 'name': return <td key={c.id}><PalNameCell pal={p} /></td>;
      case 'elements': return (
        <td key={c.id}>
          {p.elements.map((el) => (
            <span key={el} className="elem-badge" data-tip={elementTip(el)}>
              <img src={elementIconUrl(el)} alt="" />{ELEMENT_ZH[el]}
            </span>
          ))}
        </td>
      );
      case 'hp': return <td key={c.id} className="num"><StatBar value={p.hp} max={maxes.hp} /></td>;
      case 'attack': return <td key={c.id} className="num"><StatBar value={p.attack} max={maxes.attack} /></td>;
      case 'defense': return <td key={c.id} className="num"><StatBar value={p.defense} max={maxes.defense} /></td>;
      case 'runSpeed': return <td key={c.id} className="num">{p.runSpeed}</td>;
      case 'stamina': return <td key={c.id} className="num">{p.stamina}</td>;
      case 'food': return <td key={c.id} className="num">{p.food}</td>;
      case 'rarity': return <td key={c.id} className="num">{p.rarity}</td>;
      case 'breedingRank': return <td key={c.id} className="num">{p.breedingRank}</td>;
      case 'spawns': return <td key={c.id} className="num">{p.spawnCount.palpagos + p.spawnCount.tree}</td>;
      case 'mountType': return (
        <td key={c.id}>
          {p.mount && (
            <span className={`mount-tag mount-${p.mount.type}`} data-tip={`${MOUNT_ZH[p.mount.type]}坐騎|騎乘速度 ${p.mount.speed ?? '?'} · 加速 ${p.mount.sprint ?? '?'}|鞍具科技 Lv${p.mount.tech ?? '?'}`}>
              {p.mount.type === 'ground' ? '🏇 地面' : p.mount.type === 'fly' ? '🪽 飛行' : '🌊 水上'}
            </span>
          )}
        </td>
      );
      case 'mountSpeed': return <td key={c.id} className="num">{p.mount?.speed ?? ''}</td>;
      case 'mountSprint': return <td key={c.id} className="num">{p.mount?.sprint ?? ''}</td>;
      case 'mountTech': return <td key={c.id} className="num">{p.mount?.tech ?? ''}</td>;
      case 'other': return (
        <td key={c.id}>
          {p.nocturnal && <span data-tip="夜行性|夜晚活動,日間喺基地瞓覺(夜班工作)">🌙 </span>}
          {p.alphaLevels.length > 0 && (
            <span className="alpha-tag" data-tip={`野外 Alpha 頭目|Lv ${[...p.alphaLevels].sort((a, b) => a - b).join(' / ')}|擊敗或捕捉有額外獎勵`}>
              👑 Lv{Math.min(...p.alphaLevels)}
            </span>
          )}
          {p.ignoreCombi && <span data-tip="限同種配種|只可以由同種父母配出,唔會由其他組合出現"> 🧬</span>}
        </td>
      );
      default: return <td key={c.id} />;
    }
  };

  return (
    <div className="page" style={{ maxWidth: 1680 }}>
      <h1>帕魯圖鑑</h1>
      <p className="sub">全部 {pals.length} 隻帕魯 · 點欄位標題排序 · 圖示 hover 有解釋 · 點帕魯睇詳細</p>
      <div className="toolbar">
        <input type="search" placeholder="搜尋:中文名 / 英文名 / 編號…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
        <div className="col-picker" ref={colMenuRef}>
          <button className="chip" onClick={() => setColMenuOpen((v) => !v)}>⚙ 欄位 ▾</button>
          {colMenuOpen && (
            <div className="col-menu">
              {COLS.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={visCols.has(c.id)}
                    onChange={() => setVisCols((cur) => toggleSet(cur, c.id))}
                  />
                  {c.label}
                </label>
              ))}
              <button className="chip" style={{ margin: '6px 8px' }} onClick={() => setVisCols(new Set(COLS.filter((c) => c.defaultOn).map((c) => c.id)))}>
                還原預設
              </button>
            </div>
          )}
        </div>
        <span className="count-badge">{rows.length} 隻</span>
      </div>
      <div className="toolbar">
        {ELEMENT_ORDER.map((el) => (
          <button key={el} className={`chip${elements.has(el) ? ' on' : ''}`} data-tip={elementTip(el)}
            onClick={() => setElements((cur) => toggleSet(cur, el))}>
            <img src={elementIconUrl(el)} alt="" />{ELEMENT_ZH[el]}
          </button>
        ))}
      </div>
      <div className="toolbar">
        {WORK_ORDER.map((w) => (
          <button key={w} className={`chip${works.has(w) ? ' on' : ''}`} data-tip={`${WORK_ZH[w]}|${WORK_DESC[w]}|(可多選,同時符合先顯示)`}
            onClick={() => setWorks((cur) => toggleSet(cur, w))}>
            <img src={workIconUrl(w)} alt="" />{WORK_ZH[w]}
          </button>
        ))}
      </div>
      <div className="toolbar">
        {(['ground', 'fly', 'swim'] as const).map((t) => (
          <button key={t} className={`chip${mountFilter.has(t) ? ' on' : ''}`} data-tip={`只顯示${MOUNT_ZH[t]}坐騎`}
            onClick={() => setMountFilter((cur) => toggleSet(cur, t))}>
            {t === 'ground' ? '🏇 可騎' : t === 'fly' ? '🪽 可飛' : '🌊 可游'}
          </button>
        ))}
        <button className={`chip${nocturnalOnly ? ' on' : ''}`} data-tip="只顯示夜行性帕魯" onClick={() => setNocturnalOnly((v) => !v)}>🌙 夜行</button>
        <button className={`chip${alphaOnly ? ' on' : ''}`} data-tip="只顯示有野外 Alpha 頭目嘅帕魯" onClick={() => setAlphaOnly((v) => !v)}>👑 有Alpha</button>
      </div>
      <div className="tablewrap">
        <table className="data">
          <thead>
            <tr>
              {shown.map((c) => (
                <th
                  key={c.id}
                  className={`${c.num ? 'num' : ''} ${sort.key === c.id ? 'sorted' : ''} ${c.work ? 'work-col' : ''}`}
                  style={c.sortable ? undefined : { cursor: 'default' }}
                  onClick={() => toggleSort(c)}
                >
                  {c.work ? (
                    <span className="work-th" data-tip={`${WORK_ZH[c.work]}|${WORK_DESC[c.work]}|點擊可排序`}>
                      <img src={workIconUrl(c.work)} alt="" />
                      <span>{c.label}{sort.key === c.id ? (sort.dir === 1 ? '↑' : '↓') : ''}</span>
                    </span>
                  ) : (
                    <>{c.label}{sort.key === c.id ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => <tr key={p.id}>{shown.map((c) => cellFor(c, p))}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
