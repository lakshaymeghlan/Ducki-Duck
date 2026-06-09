"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createId,
  markFired,
  type Reminder,
  seedLastFired,
  shouldFire,
} from "@/lib/reminders";
import { loadReminders, REMINDERS_KEY, saveReminders } from "@/lib/storage";

const TICK_MS = 5000;

interface UseRemindersArgs {
  /** Called when a reminder fires, with the fired reminder. */
  onFire: (reminder: Reminder) => void;
  /**
   * Whether this window runs the firing loop. In Tauri the floating duck
   * window fires; the agenda window only manages, so they don't double-fire.
   * Defaults to true (the standalone web app is a single window).
   */
  fireEnabled?: boolean;
}

export function useReminders({ onFire, fireEnabled = true }: UseRemindersArgs) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Keep the latest values in refs so the tick loop reads fresh data
  // without re-subscribing the interval on every change.
  const remindersRef = useRef<Reminder[]>([]);
  const onFireRef = useRef(onFire);
  remindersRef.current = reminders;
  onFireRef.current = onFire;

  // Hydrate from localStorage on mount (client only).
  useEffect(() => {
    setReminders(loadReminders());
    setHydrated(true);
  }, []);

  // Persist whenever reminders change (after hydration, to avoid clobbering).
  useEffect(() => {
    if (hydrated) saveReminders(reminders);
  }, [reminders, hydrated]);

  // Keep windows in sync: when another window (e.g. the agenda window edits a
  // reminder), reload from localStorage so the firing window sees the change.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === REMINDERS_KEY) setReminders(loadReminders());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // The single tick loop: every ~5s, check all enabled reminders.
  useEffect(() => {
    if (!hydrated || !fireEnabled) return;

    const tick = () => {
      const now = new Date();
      let changed = false;
      const next = remindersRef.current.map((r) => {
        if (shouldFire(r, now)) {
          changed = true;
          onFireRef.current(r);
          return markFired(r, now);
        }
        return r;
      });
      if (changed) setReminders(next);
    };

    const id = window.setInterval(tick, TICK_MS);
    // Run once shortly after mount so "once" reminders in the past fire promptly.
    const warm = window.setTimeout(tick, 400);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(warm);
    };
  }, [hydrated, fireEnabled]);

  const addReminder = useCallback(
    (draft: Omit<Reminder, "id" | "enabled" | "lastFired">) => {
      const base: Reminder = {
        ...draft,
        id: createId(),
        enabled: true,
      };
      const seeded = seedLastFired(base, new Date());
      setReminders((prev) => [...prev, seeded]);
    },
    []
  );

  const toggleReminder = useCallback((id: string) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const enabled = !r.enabled;
        // Re-seed when re-enabling so it doesn't instantly fire.
        return enabled ? seedLastFired({ ...r, enabled }, new Date()) : { ...r, enabled };
      })
    );
  }, []);

  const deleteReminder = useCallback((id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    reminders,
    hydrated,
    addReminder,
    toggleReminder,
    deleteReminder,
  };
}
