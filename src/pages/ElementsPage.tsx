import { Link } from 'react-router-dom';
import { ELEMENT_ORDER, ELEMENT_STRONG_VS } from '../lib/i18n';
import { ElementBadge } from '../components/shared';

export default function ElementsPage() {
  return (
    <div className="page">
      <h1>屬性相剋</h1>
      <p className="sub">攻擊方 → 剋制(造成 2 倍傷害)。Palworld 每屬性只剋一至兩種,無「抵抗」概念(被剋一方受雙倍傷)。</p>
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="elem-cycle">
          {ELEMENT_ORDER.filter((el) => ELEMENT_STRONG_VS[el].length > 0).map((el) => (
            <div className="elem-line" key={el}>
              <ElementBadge el={el} />
              <span className="arrow">──剋──▶</span>
              {ELEMENT_STRONG_VS[el].map((t) => <ElementBadge key={t} el={t} />)}
            </div>
          ))}
          <div className="elem-line">
            <ElementBadge el="Normal" />
            <span className="arrow">無屬性唔剋任何屬性,亦只被暗屬性剋。</span>
          </div>
        </div>
      </div>
      <p className="sub" style={{ marginTop: 14 }}>
        揀返啱屬性嘅帕魯打頭目事半功倍 —— 去 <Link to="/">圖鑑</Link> 用屬性篩選。
      </p>
    </div>
  );
}
