# 帕魯攻略 — Palworld 圖鑑 · 互動地圖 · 配種計算

非官方 Palworld 攻略站(繁中介面)。核心賣點:**數據唔使自己 maintain** —
一個 command 就由自動更新嘅數據源重新生成所有資料。

## 功能

- **圖鑑** — 全部 289 隻帕魯所有數值(HP/攻/防/速度/耐力/食量/稀有度/配種 Rank/工作適性/夜行/Alpha),任意欄排序,屬性/工作/搜尋篩選
- **互動地圖** — 帕魯帕格斯群島 + 世界樹(1.0 新地區)
  - 12 類地圖標記(快速傳送、討伐塔、翠葉鼠雕像、地下城、封印遺跡、力量雕像、寶箱、帕魯蛋、技能果樹、日誌、盜獵者營地、Alpha 頭目)
  - 成類 on/off,或展開逐粒 pin on/off,「◎」飛去嗰粒 pin
  - 帕魯出現範圍:揀最多 8 隻寵(每隻一隻色),範圍圈/出現點兩種顯示,日/夜篩選,顯示等級範圍
- **帕魯詳細頁** — 數值條、夥伴技能、掉落物、技能表(升級學習)、公母比例、出現範圍 mini 地圖、特殊配種組合、「點樣配出佢」
- **配種計算器** — 父母→仔 / 目標仔→所有父母組合(用遊戲內部 CombiRank + 特殊組合 + 限同種名單)
- **屬性相剋表**、**道具一覽**(1,891 件)、**關於**(數據版本 + 來源)
- 導覽列會自動偵測遊戲有無新 build,提示你更新數據

## 起步

```sh
npm install
npm run update-data   # 拉最新遊戲數據(必須行一次)
npm run dev           # 開發模式
npm run build         # 生產 build(輸出 dist/,任何 static host 都得)
```

`npm run update-data` 選項:`--skip-images`(唔重新下載圖片)、`--force`(強制重新下載)。

## 自動部署(GitHub Pages)

Push 上 GitHub 之後乜都唔使做:[.github/workflows/deploy.yml](.github/workflows/deploy.yml)
每日 05:00(HKT)自動由上游拉最新遊戲數據、重新 build、發佈上 GitHub Pages;
push 落 `main` 或者手動 Run workflow 都會即刻重新部署。
生成嘅數據唔入 repo(`.gitignore` 咗),圖片會用 Actions cache 留住,唔會日日重新下載。

## 數據來源(全部自動)

| 來源 | 內容 | 更新頻率 |
|---|---|---|
| [palworld-atlas-data](https://github.com/Awy64/palworld-atlas-data) | 帕魯數值、配種、道具、**全部出現座標**(直接由官方 dedicated server 抽取) | 每 6 小時自動 |
| [Palworld Wiki (Fandom)](https://palworld.fandom.com/wiki/Map:Palpagos_Islands) | 地圖靜態 POI(CC BY-SA 3.0) | 社群維護 |
| [pyPalworldAPI](https://github.com/stolenvw/pyPalworldAPI) | 掉落/技能/夥伴技能/IgnoreCombi + 全部圖示 | 跟遊戲版本 |
| [palworld.wiki.gg](https://palworld.wiki.gg/) | 8192×8192 世界地圖底圖 | 社群維護 |
| [paldb.cc](https://paldb.cc/tw/) | 繁中帕魯名 | 社群維護 |

## 已知限制

- 世界樹(1.0)未有 wiki 底圖,暫時用格網;wiki 出圖後 `update-data` 會自動換
- 帕魯帕格斯底圖係 1.0 前版本,1.0 新增小島上嘅出現點會顯示喺「海」上
- 配種計算喺同 Rank 並列時用近似 tie-break,極少數組合可能同遊戲有出入
- 技能/掉落物名稱暫時只有英文(數據源未有中文)

## 技術

Vite + React + TypeScript + Leaflet(CRS.Simple,遊戲內座標直接做地圖座標)。
無 backend — 純 static site,數據喺 build 時生成放喺 `public/data/`。

`scripts/check-map.mjs` 同 `scripts/check-interactions.mjs` 係 Playwright 驗證 script(要先 `npm run dev -- --port 5199`)。

---
本站與 Pocketpair, Inc. 無關;遊戲內容版權屬 Pocketpair, Inc.。地圖 POI 資料以 CC BY-SA 3.0 轉載自 Palworld Wiki。
