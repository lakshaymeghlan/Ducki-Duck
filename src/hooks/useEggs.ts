"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EGG_INTERVAL_MS,
  EGGS_KEY,
  type Egg,
  type EggState,
  loadEggs,
  makeEgg,
  MAX_EGGS,
  saveEggs,
} from "@/lib/eggs";

const CHECK_MS = 60_000;

interface UseEggsArgs {
  /**
   * Whether this window lays eggs. Like reminders, only one window (the
   * floating duck / the single web window) should lay, so they don't double up.
   * Other windows still display + pop synced eggs.
   */
  layEnabled?: boolean;
  /** Called when an egg is popped (e.g. to quack). */
  onPop?: () => void;
}

export function useEggs({ layEnabled = true, onPop }: UseEggsArgs = {}) {
  const [state, setState] = useState<EggState>({ eggs: [], lastLaidAt: 0 });
  const [hydrated, setHydrated] = useState(false);
  const onPopRef = useRef(onPop);
  onPopRef.current = onPop;

  useEffect(() => {
    setState(loadEggs());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveEggs(state);
  }, [state, hydrated]);

  // Sync across windows (the agenda window shows the same eggs).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === EGGS_KEY) setState(loadEggs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Laying loop: every minute, if a full interval has passed, lay one egg.
  useEffect(() => {
    if (!hydrated || !layEnabled) return;

    const tick = () => {
      setState((prev) => {
        const now = Date.now();
        // Seed the clock on first run so it doesn't lay instantly.
        if (!prev.lastLaidAt) return { ...prev, lastLaidAt: now };
        if (now - prev.lastLaidAt < EGG_INTERVAL_MS) return prev;
        if (prev.eggs.length >= MAX_EGGS) {
          // Nest is full — hold off and reset the timer.
          return { ...prev, lastLaidAt: now };
        }
        return { eggs: [...prev.eggs, makeEgg(now)], lastLaidAt: now };
      });
    };

    const id = window.setInterval(tick, CHECK_MS);
    const warm = window.setTimeout(tick, 500);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(warm);
    };
  }, [hydrated, layEnabled]);

  const popEgg = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      eggs: prev.eggs.filter((e) => e.id !== id),
    }));
    onPopRef.current?.();
  }, []);

  const eggs: Egg[] = state.eggs;
  return { eggs, popEgg };
}
