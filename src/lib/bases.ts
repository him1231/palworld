/**
 * Curated base-building spots (Palworld 1.0), compiled 2026-07 from community
 * guides (drawpie / game8 / gamerant / mobalytics — see AboutPage credits).
 * Coordinates are in-game map coords; spots in 1.0-new zones are approximate.
 */
export type BasePhase = 'early' | 'mid' | 'late';

export interface BaseSpot {
  id: string;
  phase: BasePhase;
  name: string;
  x: number;
  y: number;
  /** short feature tags shown as chips */
  tags: string[];
  desc: string;
  danger: string;
  approx?: boolean;
}

export const BASE_PHASE_ZH: Record<BasePhase, string> = {
  early: '前期(開荒)', mid: '中期(量產)', late: '後期(特化)',
};

export const BASE_SPOTS: BaseSpot[] = [
  {
    id: 'plateau-north', phase: 'early', name: '初始高原北面', x: 232, y: -487,
    tags: ['地面平坦', '石/木/帕魯石', '新手安全', '傳送點近'],
    danger: '周圍敵人 Lv 1–3',
    desc: '最穩陣嘅第一個基地:超大平地,石、木、帕魯石晶齊,離初始傳送點近。想要礦嘅話南面 (264, -548) 有鐵礦節點,行路可達。',
  },
  {
    id: 'ore-galore', phase: 'early', name: '首塔旁礦山(Ore Galore)', x: 156, y: -396,
    tags: ['鐵礦×7', '天然要塞', '傳送點近'],
    danger: '低等級區',
    desc: '山頂得一條橋上嚟,野怪好難摸上你個基地。約 7 個鐵礦節點,啱想早期 rush 金屬裝備嘅玩法;平地位比初始高原少,擺工房要規劃下。',
  },
  {
    id: 'bamboo-ore-sulfur', phase: 'early', name: '竹林西北大平原', x: -345, y: -205,
    tags: ['地面平坦', '鐵礦+硫磺', '夠位起雙基地'],
    danger: '中低等級區',
    desc: '巨型平地,有鐵礦同硫磺,空間大到可以起兩個基地。由前期一直用到中期都唔嘥。',
  },
  {
    id: 'guardian-peak', phase: 'mid', name: '守護者礦峰(鐵+煤)', x: 180, y: -39,
    tags: ['鐵礦×8', '石炭×6', '高地易守', '傳送點近'],
    danger: '周圍敵人 Lv 20–25',
    desc: '公認主島最強全能基地:一個山頭齊晒鐵礦同石炭,起精煉金屬錠一條龍。旁邊有「守護者封印遺跡」雕像做傳送點。注意 1.0 之後 raid 改咗波次制,地形唔再 100% 免疫,記得起返啲防禦。',
  },
  {
    id: 'one-stop', phase: 'mid', name: '三礦一站式(鐵+硫磺+水晶)', x: 290, y: -100,
    tags: ['地面平坦', '鐵+硫磺+純水晶'],
    danger: '中等級區',
    desc: '一個位齊三種礦,想少啲基地位就攞多樣資源嘅話呢度好用;平坦地形帕魯唔會行到卡住。',
  },
  {
    id: 'verdant-brook', phase: 'mid', name: 'Verdant Brook 礦場', x: 259, y: -225,
    tags: ['鐵礦×8', '地面平坦'],
    danger: '中等級區',
    desc: '平坦高原加約 8 個鐵礦,採礦效率同帕魯 pathing 都一流,適合做專職金屬場。',
  },
  {
    id: 'coal-hardwood', phase: 'mid', name: '沙漠邊石炭+硬木', x: -160, y: -90,
    tags: ['石炭', '硬木', '鐵/硫磺近'],
    danger: '中等級區,沙漠要抗熱',
    desc: '石炭節點旁邊就係硬木樹,精煉金屬錠同高級建材一齊產;附近仲有鐵同硫磺補給。',
  },
  {
    id: 'obsidian-sulfur', phase: 'late', name: '黑曜火山硫磺場', x: -744, y: -442,
    tags: ['硫磺×7', '要抗熱裝'],
    danger: '敵人 Lv 25–36,火山環境傷血',
    desc: '量產火藥必備:約 7 個硫磺節點。記得著抗熱裝同帶啲遠程帕魯先好嚟。',
  },
  {
    id: 'astral-quartz', phase: 'late', name: '星空山脈純水晶場', x: -212, y: 250,
    tags: ['純水晶×9', '要抗寒裝'],
    danger: '雪山高等級區',
    desc: '製電路板/高級科技材料嘅純水晶,一個位 9 粒節點。雪地要抗寒裝,帕魯揀啲唔怕凍嘅。',
  },
  {
    id: 'sakurajima-oil', phase: 'late', name: '櫻花島油田', x: -646, y: 270,
    tags: ['原油', '後期核心資源'],
    danger: '敵人 Lv 50+',
    desc: '1.0 後期科技(聚合物/高級彈藥)食好多原油,呢個油田係公認嘅後期首選前哨基地。',
  },
  {
    id: 'feybreak-hexolite', phase: 'late', name: '霜語島六稜晶礦場', x: -1340, y: -1285,
    tags: ['六稜晶', '原油近'],
    danger: '敵人 Lv 52+',
    desc: '霜語島(Feybreak)專屬六稜晶,後期武器裝備必需;附近仲有油田可以一齊圈。',
  },
  {
    id: 'sunreach-soralite', phase: 'late', name: '天陽鄉烈陽金屬(約數)', x: -302, y: -1426, approx: true,
    tags: ['烈陽金屬', '天空島', '要 Plasma 採掘器'],
    danger: '1.0 終盤內容',
    desc: '1.0 新天空島 Sunreach 係烈陽金屬唯一產地(終盤裝備用)。要打完霜語塔 + 有電漿採掘工具先開採到。各攻略座標有出入,呢個係約數 — 用地圖對返地形。',
  },
];
