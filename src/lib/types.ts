export type ElementName =
  | 'Normal' | 'Fire' | 'Water' | 'Electricity' | 'Leaf'
  | 'Dark' | 'Dragon' | 'Earth' | 'Ice';

export type WorkName =
  | 'EmitFlame' | 'Watering' | 'Seeding' | 'GenerateElectricity' | 'Handcraft'
  | 'Collection' | 'Deforest' | 'Mining' | 'ProductMedicine' | 'Cool'
  | 'Transport' | 'MonsterFarm';

export interface Pal {
  id: string;
  tribe: string;
  name: string;
  nameZh: string | null;
  paldexNumber: number;
  rarity: number;
  elements: ElementName[];
  hp: number;
  attack: number;
  defense: number;
  runSpeed: number;
  stamina: number;
  food: number;
  breedingRank: number;
  nocturnal: boolean;
  workSuitability: Partial<Record<WorkName, number>>;
  icon: string | null;
  spawnCount: { palpagos: number; tree: number };
  alphaLevels: number[];
  /** true = can only be bred from the same species (excluded from rank matching) */
  ignoreCombi: boolean;
  breedOrder: number | null;
  maleProbability: number | null;
  craftSpeed: number | null;
  rideSpeed: number | null;
  price: number | null;
  genus: string | null;
  mount: { type: 'ground' | 'fly' | 'swim'; speed: number | null; sprint: number | null; tech: number | null } | null;
}

export interface PalEnrich {
  description: string | null;
  drops: { name: string; min: number; max: number; rate: number }[];
  partnerSkill: { name: string; description: string | null } | null;
  skills: { name: string; type: string; level: number; power: number; cooldown: number; description: string | null }[];
}

export interface BreedingData {
  sameSpeciesProducesSelf: boolean;
  uniquePairs: { parentAId: string; parentBId: string; childId: string }[];
}

export interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  rarity: number;
  rank: number;
  weight: number;
  price: number;
  maxStack: number;
}

export interface PoiCategory {
  id: string;
  name?: string;
  nameZh: string;
  /** zh group label (地點/收集/敵人/資源/釣魚/…) */
  group?: string;
  /** vendored icon path (paldb source) — falls back to color+glyph pin */
  icon?: string | null;
  color?: string;
  glyph?: string;
  count?: number;
}

export interface Poi {
  id: string;
  cat: string;
  x: number;
  y: number;
  name: string;
  link: string | null;
  /** respawn cooldown, e.g. "30 Mins" */
  cd?: string;
}

export interface PoiData { groups?: string[]; cats: PoiCategory[]; pois: Poi[] }

export interface AlphaSpawn {
  palId: string;
  name: string;
  nameZh: string | null;
  x: number;
  y: number;
  level: number;
  region: RegionId;
}

export type RegionId = 'palpagos' | 'tree';

export interface Region {
  id: RegionId;
  name: string;
  nameZh: string;
  /** view bounds [minX, minY, maxX, maxY] — covers all data, may exceed the image */
  extent: [number, number, number, number];
  /** where the underlay image is anchored (game map bounds) */
  imageBounds: [number, number, number, number];
  image: string | null;
}

/** [x, y, nightOnly(0|1), minLv, maxLv, groupSharePct] */
export type SpawnPoint = [number, number, 0 | 1, number, number, number?];

export type SpawnIndex = Record<RegionId, Record<string, number>>;

export interface PassiveSkill {
  name: string;
  ability: string | null;
  tier: number;
  description: string | null;
}

export interface Meta {
  steamBuildId: string;
  gameDataGeneratedAt: string;
  fetchedAt: string;
  counts: Record<string, number>;
  latestUrl: string;
  attribution: { name: string; url: string; for: string }[];
  disclaimer: string;
}
