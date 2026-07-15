import { useMemo, useState } from 'react';
import { loadItems, useData } from '../lib/data';

export default function ItemsPage() {
  const items = useData(loadItems);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<{ key: 'name' | 'rarity' | 'weight' | 'price' | 'maxStack'; dir: 1 | -1 }>({ key: 'name', dir: 1 });

  const categories = useMemo(() => {
    if (!items) return [];
    return [...new Set(items.map((i) => i.category))].sort();
  }, [items]);

  const rows = useMemo(() => {
    if (!items) return [];
    const s = q.trim().toLowerCase();
    let list = items.filter((i) => {
      if (cat && i.category !== cat) return false;
      if (s && !(i.name.toLowerCase().includes(s) || i.id.toLowerCase().includes(s) || (i.description ?? '').toLowerCase().includes(s))) return false;
      return true;
    });
    const { key, dir } = sort;
    list = [...list].sort((a, b) => {
      const c = key === 'name' ? a.name.localeCompare(b.name) : (a[key] as number) - (b[key] as number);
      return c * dir || a.name.localeCompare(b.name);
    });
    return list;
  }, [items, q, cat, sort]);

  if (!items) return <div className="page">載入中…</div>;

  const th = (key: typeof sort.key, label: string, num = false) => (
    <th className={`${num ? 'num' : ''} ${sort.key === key ? 'sorted' : ''}`}
      onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }))}>
      {label}{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="page">
      <h1>道具一覽</h1>
      <p className="sub">全部 {items.length} 件道具(來自遊戲數據)</p>
      <div className="toolbar">
        <input type="search" placeholder="搜尋道具名 / 說明…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">全部分類</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="count-badge">{rows.length} 件</span>
      </div>
      <div className="tablewrap">
        <table className="data">
          <thead>
            <tr>
              {th('name', '道具')}
              <th>分類</th>
              {th('rarity', '稀有度', true)}
              {th('weight', '重量', true)}
              {th('price', '價錢', true)}
              {th('maxStack', '疊加', true)}
              <th>說明</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.category}{i.subcategory && i.subcategory !== i.category ? ` / ${i.subcategory}` : ''}</td>
                <td className="num">{i.rarity}</td>
                <td className="num">{i.weight}</td>
                <td className="num">{i.price}</td>
                <td className="num">{i.maxStack}</td>
                <td style={{ whiteSpace: 'normal', maxWidth: 420, fontSize: 12.5, color: 'var(--ink-2)' }}>
                  {(i.description ?? '').replace(/<[^>]+>/g, '').replace(/\r?\n/g, ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 500 && <p className="sub" style={{ marginTop: 8 }}>只顯示頭 500 件 —— 請用搜尋收窄範圍。</p>}
    </div>
  );
}
