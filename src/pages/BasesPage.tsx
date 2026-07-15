import { Link } from 'react-router-dom';
import { BASE_PHASE_ZH, BASE_SPOTS, type BasePhase } from '../lib/bases';

const PHASES: BasePhase[] = ['early', 'mid', 'late'];

export default function BasesPage() {
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <h1>基地選址攻略(1.0)</h1>
      <p className="sub">
        揀基地兩大鐵則:<b>地面平坦</b>(帕魯喺斜坡好易卡住罷工)同 <b>資源集中</b>。
        1.0 之後 raid 改咗波次制,高地唔再完全免疫,記得起圍牆;另外 1.0 有「採礦場/採煤場」建築,
        後期可以自己起礦場補足,選址壓力冇以前咁大。點「去地圖睇」會直接飛去嗰個位。
      </p>
      {PHASES.map((phase) => (
        <section key={phase} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, margin: '18px 0 10px' }}>{BASE_PHASE_ZH[phase]}</h2>
          <div className="base-grid">
            {BASE_SPOTS.filter((b) => b.phase === phase).map((b) => (
              <div className="card base-card" key={b.id}>
                <div className="base-head">
                  <h3>{b.name}</h3>
                  <span className="coords">({b.x}, {b.y}){b.approx ? ' 約' : ''}</span>
                </div>
                <div className="base-tags">
                  {b.tags.map((t) => <span className="chip" key={t}>{t}</span>)}
                </div>
                <p className="base-desc">{b.desc}</p>
                <div className="base-foot">
                  <span className="danger-note">⚠ {b.danger}</span>
                  <Link className="chip on" to={`/map?x=${b.x}&y=${b.y}&label=${encodeURIComponent(b.name)}`}>
                    ◎ 去地圖睇
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="sub">
        資料整理自社群攻略(drawpie / game8 / GameRant / Mobalytics,2026-07)。
        新區域座標或有偏差,以遊戲內為準。
      </p>
    </div>
  );
}
