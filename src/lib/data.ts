import type {
  AlphaSpawn, BreedingData, Item, Meta, Pal, PalEnrich, PoiData, Region, RegionId,
  SpawnIndex, SpawnPoint,
} from './types';

const cache = new Map<string, Promise<unknown>>();

/** Prefixes site base path (e.g. "/palworld/" on GitHub Pages) onto absolute asset paths. */
export const asset = (p: string) => import.meta.env.BASE_URL.replace(/\/$/, '') + p;

function load<T>(path: string): Promise<T> {
  const url = asset(path);
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(url) as Promise<T>;
}

export const loadPals = () => load<Pal[]>('/data/pals.json');
export const loadEnrich = () => load<Record<string, PalEnrich>>('/data/enrich.json');
export const loadBreeding = () => load<BreedingData>('/data/breeding.json');
export const loadItems = () => load<Item[]>('/data/items.json');
export const loadPois = () => load<PoiData>('/data/map/pois.json');
export const loadAlphas = () => load<AlphaSpawn[]>('/data/map/alphas.json');
export const loadRegions = () => load<Region[]>('/data/map/regions.json');
export const loadSpawnIndex = () => load<SpawnIndex>('/data/spawns-index.json');
export const loadMeta = () => load<Meta>('/data/meta.json');
export const loadSpawns = (region: RegionId, palId: string) =>
  load<SpawnPoint[]>(`/data/spawns/${region}/${palId}.json`);

export const palIconUrl = (pal: Pal) => (pal.icon ? asset(`/img/pals/${pal.icon}`) : null);
export const elementIconUrl = (el: string) => asset(`/img/elements/${el}.png`);
export const workIconUrl = (w: string) => asset(`/img/work/${w}.png`);

/** Checks upstream for a newer game build than the one baked into public/data. */
export async function checkDataFreshness(meta: Meta): Promise<{ fresh: boolean; latestBuild?: string }> {
  try {
    const res = await fetch(meta.latestUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { fresh: true };
    const latest = (await res.json()) as { steamBuildId?: string };
    if (latest.steamBuildId && latest.steamBuildId !== meta.steamBuildId) {
      return { fresh: false, latestBuild: latest.steamBuildId };
    }
    return { fresh: true };
  } catch {
    return { fresh: true }; // offline / blocked — don't nag
  }
}

/** React-friendly tiny suspenseless loader hook. */
import { useEffect, useState } from 'react';
export function useData<T>(loader: () => Promise<T>): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    loader().then((d) => { if (alive) setData(d); }).catch((e) => console.error(e));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}
