import type { BreedingData, Pal } from './types';

export interface BreedingModel {
  pals: Pal[];
  byId: Map<string, Pal>;
  uniqueByPair: Map<string, string>;
  uniqueChildIds: Set<string>;
  /** rank-matchable candidates sorted by breedingRank */
  candidates: Pal[];
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function buildBreedingModel(pals: Pal[], breeding: BreedingData): BreedingModel {
  const byId = new Map(pals.map((p) => [p.id, p]));
  const uniqueByPair = new Map<string, string>();
  const uniqueChildIds = new Set<string>();
  for (const { parentAId, parentBId, childId } of breeding.uniquePairs) {
    uniqueByPair.set(pairKey(parentAId, parentBId), childId);
    uniqueChildIds.add(childId);
  }
  const candidates = pals
    .filter((p) => !uniqueChildIds.has(p.id) && !p.ignoreCombi)
    .sort((a, b) => a.breedingRank - b.breedingRank || (a.breedOrder ?? 99) - (b.breedOrder ?? 99) || a.paldexNumber - b.paldexNumber);
  return { pals, byId, uniqueByPair, uniqueChildIds, candidates };
}

/**
 * Palworld breeding: unique pairs first, same species → itself, otherwise the
 * rank-matchable pal whose CombiRank is closest to floor((a+b+1)/2).
 * (Tie-break approximates the game's internal ordering.)
 */
export function breedChild(model: BreedingModel, aId: string, bId: string): Pal | null {
  const a = model.byId.get(aId), b = model.byId.get(bId);
  if (!a || !b) return null;
  const unique = model.uniqueByPair.get(pairKey(aId, bId));
  if (unique) return model.byId.get(unique) ?? null;
  if (aId === bId) return a;
  const target = Math.floor((a.breedingRank + b.breedingRank + 1) / 2);
  const cand = model.candidates;
  // binary search for insertion point in rank-sorted candidates
  let lo = 0, hi = cand.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cand[mid].breedingRank < target) lo = mid + 1; else hi = mid;
  }
  let belowIdx = lo - 1;
  while (belowIdx > 0 && cand[belowIdx - 1].breedingRank === cand[belowIdx].breedingRank) belowIdx--;
  const below = cand[belowIdx] ?? null;
  const at = cand[lo] ?? null;
  if (!below) return at;
  if (!at) return below;
  const dBelow = Math.abs(below.breedingRank - target);
  const dAt = Math.abs(at.breedingRank - target);
  // tie → lower rank (approximates the game's internal ordering)
  return dBelow <= dAt ? below : at;
}

export interface ParentPair { a: Pal; b: Pal }

export interface BreedStep { parent: Pal; partner: Pal; child: Pal }

/**
 * Shortest breeding chain from `startId` to `targetId` (BFS over generations):
 * each step breeds the current pal with any partner. Returns null if the
 * target is unreachable (e.g. same-species-only pals).
 */
export function shortestPath(model: BreedingModel, startId: string, targetId: string, maxDepth = 6): BreedStep[] | null {
  if (startId === targetId) return [];
  const prev = new Map<string, { from: string; partner: string }>();
  let frontier = [startId];
  const seen = new Set(frontier);
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const partner of model.pals) {
        const child = breedChild(model, cur, partner.id);
        if (!child || seen.has(child.id)) continue;
        seen.add(child.id);
        prev.set(child.id, { from: cur, partner: partner.id });
        if (child.id === targetId) {
          const steps: BreedStep[] = [];
          let at = targetId;
          while (at !== startId) {
            const p = prev.get(at)!;
            steps.unshift({ parent: model.byId.get(p.from)!, partner: model.byId.get(p.partner)!, child: model.byId.get(at)! });
            at = p.from;
          }
          return steps;
        }
        next.push(child.id);
      }
    }
    frontier = next;
  }
  return null;
}

/** All unordered parent pairs producing the given child. Memoized. */
const parentCache = new Map<string, ParentPair[]>();
export function findParents(model: BreedingModel, childId: string): ParentPair[] {
  const key = childId;
  const hit = parentCache.get(key);
  if (hit) return hit;
  const out: ParentPair[] = [];
  const n = model.pals.length;
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const a = model.pals[i], b = model.pals[j];
      const child = breedChild(model, a.id, b.id);
      if (child?.id === childId) out.push({ a, b });
    }
  }
  parentCache.set(key, out);
  return out;
}
