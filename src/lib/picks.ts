/**
 * Curated pal recommendations (Palworld 1.0), compiled 2026-07 from op.gg
 * tier list + game8 / nexttier / boostmatch guides. Pals are referenced by
 * English name and resolved against live data at render time — entries that
 * stop matching after a patch are silently dropped.
 *
 * Mount & work rankings are data-driven on the page itself; this file only
 * holds the hand-curated layers (combat picks + early-game work picks).
 */
import type { WorkName } from './types';

export type PickPhase = 'early' | 'mid' | 'late';

export const PICK_PHASE_ZH: Record<PickPhase, string> = {
  early: '前期(Lv 1–20)', mid: '中期(Lv 20–45)', late: '後期(Lv 45+)',
};

export interface CombatPick { name: string; reason: string; tier?: string }

export const COMBAT_PICKS: Record<PickPhase, CombatPick[]> = {
  early: [
    { name: 'Direhowl', reason: '最早入手嘅地面坐騎之一,自身攻擊都唔錯,騎住打省帕魯技能 CD' },
    { name: 'Penking', reason: '前期萬用打手,水+冰技能齊,打第一、二個塔好使' },
    { name: 'Nox', reason: '夜間暗屬性打手,剋無屬性野怪' },
    { name: 'Rushoar', reason: '衝撞開荒,順便幫手撞礦' },
    { name: 'Bushi', reason: '早中期斬擊輸出,火屬性,亦係伐木工' },
    { name: 'Univolt', reason: '雷屬性騎乘打手,一直用到中期' },
  ],
  mid: [
    { name: 'Anubis', reason: '中期配種就攞到(睇配種計算器),地面系輸出+迴避,同時係頂級手工/挖掘工' },
    { name: 'Grizzbolt', reason: '塔主同款,雷屬性泛用輸出,米魯加農炮夥伴技能勁' },
    { name: 'Faleris', reason: '火鳥,中後期火系主力,兼職搬運' },
    { name: 'Verdash', reason: '草系速攻,打地面系野怪,兼頂級播種/採集工' },
    { name: 'Rayhound', reason: '雷系坐騎+輸出,二段跳好用' },
    { name: 'Sekhmet', reason: '1.0 新地面系打手,攻擊數值高' },
  ],
  late: [
    { name: 'Dandilord', reason: 'op.gg S — 1.0 傳說級草系,綜合最強之一(限同種配種)', tier: 'S' },
    { name: 'Celesdir Noct', reason: 'op.gg S — 1.0 暗龍系頂級輸出', tier: 'S' },
    { name: 'Solenne', reason: 'op.gg S — 暗系高攻,兼 Lv8 手工大師', tier: 'S' },
    { name: 'Renjishi', reason: 'op.gg S — 燎火舞伶,火系終盤主力', tier: 'S' },
    { name: 'Bastigor', reason: 'op.gg S — 1.0 冰系傳說(限同種配種)', tier: 'S' },
    { name: 'Selyne', reason: 'op.gg S — 輝月伊,暗/無雙屬性,月刃輸出+手工 Lv7', tier: 'S' },
    { name: 'Shaolong', reason: 'op.gg S — 霄龍,龍/水,飛行坐騎兼輸出', tier: 'S' },
    { name: 'Orserk', reason: 'op.gg S — 塔主同款,龍/雷雙屬性爆發', tier: 'S' },
    { name: 'Jetragon', reason: 'op.gg A — 傳說火箭龍,最經典嘅飛行戰鬥坐騎', tier: 'A' },
    { name: 'Astegon', reason: 'op.gg A — 龍/暗,挖礦 Lv4 兼終盤輸出', tier: 'A' },
    { name: 'Frostallion Noct', reason: 'op.gg A — 暗馬,夜行輸出坐騎', tier: 'A' },
    { name: 'Aegidron', reason: 'op.gg A — 磐甲龍,1.0 新龍/地,挖掘 Lv9 兼打手', tier: 'A' },
  ],
};

/** hand-picked "easy to get early" worker per job (the page auto-ranks the rest) */
export const WORK_EARLY_PICK: Partial<Record<WorkName, CombatPick>> = {
  EmitFlame: { name: 'Foxparks', reason: '開場一陣就捉到,生火一腳踢' },
  Watering: { name: 'Pengullet', reason: '前期水電凍三用神' },
  Seeding: { name: 'Lifmunk', reason: '五種工作樣樣掂嘅前期萬能工' },
  GenerateElectricity: { name: 'Jolthog', reason: '初始高原就有,前期發電夠用' },
  Handcraft: { name: 'Cattiva', reason: '第一日就捉到嘅四職工人' },
  Collection: { name: 'Chikipi', reason: '兼職牧場生蛋' },
  Deforest: { name: 'Tanzee', reason: '前期五職工,同 Lifmunk 一齊用' },
  Mining: { name: 'Fuddler', reason: '前期專職挖礦,平坦礦場神器' },
  ProductMedicine: { name: 'Lifmunk', reason: '前期唯一易入手嘅製藥工' },
  Cool: { name: 'Pengullet', reason: '前期唯一實用冷卻工' },
  Transport: { name: 'Cattiva', reason: '早期搬運靠佢' },
  MonsterFarm: { name: 'Chikipi', reason: '牧場生蛋,食物來源' },
};
