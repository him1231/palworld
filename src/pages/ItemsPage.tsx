import { useMemo, useState } from 'react';
import { asset, loadItems, useData } from '../lib/data';

const CATEGORY_ZH: Record<string, string> = {
  Accessory: '飾品', Ammo: '彈藥', Armor: '防具', Blueprint: '設計圖',
  Consume: '消耗品', Essential: '重要物品',食物: '食物', Food: '食物',
  Glider: '滑翔翼', Ingredient: '食材', KeyItem: '重要物品', Material: '素材',
  MonsterEquipWeapon: '帕魯裝備', None: '其他', PalSphere: '帕魯球',
  SpecialWeapon: '特殊武器', Weapon: '武器', Medicine: '藥品', Egg: '蛋', Money: '貨幣',
};
const catZh = (c: string) => CATEGORY_ZH[c] ?? c;

export default function ItemsPage() {
  const items = useData(loadItems);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<{ key: 'name' | 'rarity' | 'weight' | 'price' | 'maxStack'; dir: 1 | -1 }>({ key: 'name', dir: 1 });

  const categories = useMemo(() => {
    if (!items) return [];
    return [...new Set(items.map((i) => i.category))].sort((a, b) => catZh(a).localeCompare(catZh(b), 'zh-Hant'));
  }, [items]);

  const rows = useMemo(() => {
    if (!items) return [];
    const s = q.trim().toLowerCase();
    let list = items.filter((i) => {
      if (cat && i.category !== cat) return false;
      if (s && !(
        (i.nameZh ?? '').toLowerCase().includes(s)
        || i.name.toLowerCase().includes(s)
        || i.id.toLowerCase().includes(s)
        || (i.descZh ?? '').toLowerCase().includes(s)
        || (i.description ?? '').toLowerCase().includes(s)
      )) return false;
      return true;
    });
    const { key, dir } = sort;
    list = [...list].sort((a, b) => {
      const c = key === 'name'
        ? (a.nameZh ?? a.name).localeCompare(b.nameZh ?? b.name, 'zh-Hant')
        : (a[key] as number) - (b[key] as number);
      return c * dir || (a.nameZh ?? a.name).localeCompare(b.nameZh ?? b.name, 'zh-Hant');
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
      <p className="sub">全部 {items.length} 件道具(來自遊戲數據,中文名/說明來自 paldb)</p>
      <div className="toolbar">
        <input type="search" placeholder="搜尋道具名 / 說明…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">全部分類</option>
          {categories.map((c) => <option key={c} value={c}>{catZh(c)}</option>)}
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
                <td>
                  <span className="pal-cell">
                    {i.icon
                      ? <img src={asset(`/img/items/${i.icon}`)} alt="" style={{ borderRadius: 6 }} loading="lazy" />
                      : <span style={{ width: 32, height: 32, display: 'inline-block' }} />}
                    <span className="names">
                      <div>{i.nameZh ?? i.name}</div>
                      <div className="en">{i.nameZh ? i.name : i.id}</div>
                    </span>
                  </span>
                </td>
                <td>{catZh(i.category)}{i.subcategory && i.subcategory !== i.category ? ` / ${catZh(i.subcategory)}` : ''}</td>
                <td className="num">{i.rarity}</td>
                <td className="num">{i.weight}</td>
                <td className="num">{i.price}</td>
                <td className="num">{i.maxStack}</td>
                <td style={{ whiteSpace: 'normal', maxWidth: 420, fontSize: 12.5, color: 'var(--ink-2)' }}>
                  {i.descZh ?? (i.description ?? '').replace(/<[^>]+>/g, '').replace(/\r?\n/g, ' ')}
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
