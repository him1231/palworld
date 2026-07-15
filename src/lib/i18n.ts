import type { ElementName, WorkName } from './types';

export const ELEMENT_ZH: Record<ElementName, string> = {
  Normal: '無', Fire: '火', Water: '水', Electricity: '雷', Leaf: '草',
  Dark: '暗', Dragon: '龍', Earth: '地', Ice: '冰',
};

/** Game-convention element hues — decorative only; icon + text carry identity. */
export const ELEMENT_COLOR: Record<ElementName, string> = {
  Normal: '#9aa0ae', Fire: '#e5673b', Water: '#4f9fe0', Electricity: '#e6c14f',
  Leaf: '#6fbf5a', Dark: '#a06bd6', Dragon: '#7a6bf0', Earth: '#c09055', Ice: '#6fd0e0',
};

export const WORK_ZH: Record<WorkName, string> = {
  EmitFlame: '生火', Watering: '澆水', Seeding: '播種', GenerateElectricity: '發電',
  Handcraft: '手工作業', Collection: '採集', Deforest: '伐木', Mining: '挖掘',
  ProductMedicine: '製藥', Cool: '冷卻', Transport: '搬運', MonsterFarm: '牧場',
};

export const WORK_ORDER: WorkName[] = [
  'EmitFlame', 'Watering', 'Seeding', 'GenerateElectricity', 'Handcraft', 'Collection',
  'Deforest', 'Mining', 'ProductMedicine', 'Cool', 'Transport', 'MonsterFarm',
];

export const ELEMENT_ORDER: ElementName[] = [
  'Normal', 'Fire', 'Water', 'Electricity', 'Leaf', 'Dark', 'Dragon', 'Earth', 'Ice',
];

/** Palworld element effectiveness cycle: attacker → strong against. */
export const ELEMENT_STRONG_VS: Record<ElementName, ElementName[]> = {
  Normal: [], Fire: ['Leaf', 'Ice'], Water: ['Fire'], Electricity: ['Water'],
  Leaf: ['Earth'], Earth: ['Electricity'], Ice: ['Dragon'], Dragon: ['Dark'], Dark: ['Normal'],
};

export function palDisplayName(p: { name: string; nameZh: string | null }): string {
  return p.nameZh ?? p.name;
}

/** brief descriptions for hover tooltips */
export const WORK_DESC: Record<WorkName, string> = {
  EmitFlame: '點燃烤爐、熔爐等生火設施',
  Watering: '澆灌農田、推動水力設備',
  Seeding: '喺農田播種',
  GenerateElectricity: '為發電機供電',
  Handcraft: '喺工作台製作物品',
  Collection: '採收農作物同漿果',
  Deforest: '喺伐木場斬樹攞木材',
  Mining: '挖礦場採礦、敲碎礦石',
  ProductMedicine: '喺製藥台調配藥品',
  Cool: '雪櫃保鮮、冷卻設施',
  Transport: '將物資搬運入倉庫',
  MonsterFarm: '喺牧場產出物品(蛋、羊毛等)',
};

export const MOUNT_ZH: Record<'ground' | 'fly' | 'swim', string> = {
  ground: '地面', fly: '飛行', swim: '水上',
};

export function elementTip(el: ElementName): string {
  const strong = ELEMENT_STRONG_VS[el];
  const weakTo = (Object.keys(ELEMENT_STRONG_VS) as ElementName[]).filter((a) => ELEMENT_STRONG_VS[a].includes(el));
  return `${ELEMENT_ZH[el]}屬性`
    + (strong.length ? `|剋:${strong.map((e) => ELEMENT_ZH[e]).join('、')}` : '|唔剋任何屬性')
    + (weakTo.length ? `|被剋:${weakTo.map((e) => ELEMENT_ZH[e]).join('、')}` : '|冇屬性剋佢');
}
