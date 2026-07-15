import { loadMeta, useData } from '../lib/data';

export default function AboutPage() {
  const meta = useData(loadMeta);
  if (!meta) return <div className="page">載入中…</div>;

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1>關於本站</h1>
      <p className="sub">非官方粉絲攻略站,與 Pocketpair, Inc. 無關。遊戲內容版權屬 Pocketpair, Inc. 所有。</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2>數據版本</h2>
        <div className="kv"><span className="k">遊戲 Steam Build</span><span>{meta.steamBuildId}</span></div>
        <div className="kv"><span className="k">遊戲數據抽取時間</span><span>{new Date(meta.gameDataGeneratedAt).toLocaleString('zh-HK')}</span></div>
        <div className="kv"><span className="k">本站數據更新時間</span><span>{new Date(meta.fetchedAt).toLocaleString('zh-HK')}</span></div>
        <div className="kv"><span className="k">帕魯</span><span>{meta.counts.pals}</span></div>
        <div className="kv"><span className="k">道具</span><span>{meta.counts.items}</span></div>
        <div className="kv"><span className="k">野生出現點</span><span>{(meta.counts.palpagosSpawns ?? 0) + (meta.counts.treeSpawns ?? 0)}</span></div>
        <div className="kv"><span className="k">Alpha 出現點</span><span>{meta.counts.alphaSpawns}</span></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2>更新數據</h2>
        <p>
          遊戲每次更新後,喺 project 目錄行一次:
        </p>
        <pre style={{ background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 6 }}>npm run update-data && npm run build</pre>
        <p className="sub">
          數據源每 6 小時自動由官方 dedicated server 抽取,所以唔使自己 maintain。
          當偵測到新 build 時,導覽列會顯示「⟳ 有新遊戲數據」提示。
        </p>
      </div>

      <div className="card">
        <h2>數據來源 / 鳴謝</h2>
        {meta.attribution.map((a) => (
          <div className="kv" key={a.name}>
            <span className="k"><a href={a.url} target="_blank" rel="noreferrer">{a.name}</a></span>
            <span style={{ textAlign: 'right', maxWidth: '60%', fontSize: 12.5 }}>{a.for}</span>
          </div>
        ))}
        <p className="sub" style={{ marginTop: 10 }}>
          地圖 POI 資料以 CC BY-SA 3.0 授權轉載自 Palworld Wiki (Fandom)。
          配種計算為近似演算法,同 Rank 並列時或有出入。
        </p>
      </div>
    </div>
  );
}
