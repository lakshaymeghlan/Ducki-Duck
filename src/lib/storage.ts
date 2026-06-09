// storage.ts — tiny localStorage wrapper. This is a real local web app, so
// localStorage is the right home for reminders + the bug count.

import type { Reminder } from "./reminders";

export const REMINDERS_KEY = "ducki-duck:reminders";
const BUGCOUNT_KEY = "ducki-duck:bug-count";

export function loadReminders(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REMINDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Reminder[]) : [];
  } catch {
    return [];
  }
}

export function saveReminders(reminders: Reminder[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  } catch {
    // Storage full or disabled — fail quietly; it's a toy.
  }
}

export function loadBugCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(BUGCOUNT_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function saveBugCount(count: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BUGCOUNT_KEY, String(count));
  } catch {
    /* noop */
  }
}
