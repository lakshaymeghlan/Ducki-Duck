// eggs.ts — the duck quietly lays an egg every couple of hours. They pile up
// next to it (capped) and you can pop them for fun. Persisted to localStorage
// so they survive reloads and sync across windows.

export interface Egg {
  id: string;
  laidAt: number;
}

export interface EggState {
  eggs: Egg[];
  lastLaidAt: number;
}

export const EGG_INTERVAL_MS = 2 * 60 * 60 * 1000; // ~2 hours
export const MAX_EGGS = 6;
export const EGGS_KEY = "ducki-duck:eggs";

export function loadEggs(): EggState {
  if (typeof window === "undefined") return { eggs: [], lastLaidAt: 0 };
  try {
    const raw = window.localStorage.getItem(EGGS_KEY);
    if (!raw) return { eggs: [], lastLaidAt: 0 };
    const parsed = JSON.parse(raw) as EggState;
    return {
      eggs: Array.isArray(parsed.eggs) ? parsed.eggs : [],
      lastLaidAt: typeof parsed.lastLaidAt === "number" ? parsed.lastLaidAt : 0,
    };
  } catch {
    return { eggs: [], lastLaidAt: 0 };
  }
}

export function saveEggs(state: EggState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EGGS_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

export function makeEgg(now: number): Egg {
  return {
    id: `egg_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    laidAt: now,
  };
}
