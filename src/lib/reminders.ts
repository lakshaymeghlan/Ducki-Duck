// reminders.ts — one unified reminder model with three types, plus the
// pure scheduling/firing logic. No DOM, no React here: just data + time math.

export type ReminderType = "interval" | "daily" | "once";

export interface Reminder {
  id: string;
  label: string;
  type: ReminderType;
  emoji: string;
  enabled: boolean;
  /** interval: minutes between fires */
  intervalMinutes?: number;
  /** daily: "HH:MM" */
  time?: string;
  /** once: ISO-ish "YYYY-MM-DDTHH:MM" (from <input type="datetime-local">) */
  datetime?: string;
  /**
   * Guards against double-fires. Meaning depends on type:
   *  - interval: timestamp (ms) of the last fire
   *  - daily:    "YYYY-MM-DD" day key it last fired on
   *  - once:     timestamp (ms) when it fired (set => already fired)
   */
  lastFired?: number | string;
}

/** A sensible default emoji per reminder type when the user doesn't pick one. */
export function defaultEmoji(type: ReminderType): string {
  switch (type) {
    case "interval":
      return "⏳";
    case "daily":
      return "🗓";
    case "once":
      return "⏰";
    default:
      return "🦆";
  }
}

export function createId(): string {
  // Good enough for local, single-user data.
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Decide whether a reminder should fire at `now`. Pure function — given the
 * same reminder + time it always returns the same answer, so it's easy to test.
 */
export function shouldFire(r: Reminder, now: Date): boolean {
  if (!r.enabled) return false;

  switch (r.type) {
    case "interval": {
      const minutes = r.intervalMinutes ?? 0;
      if (minutes <= 0) return false;
      const last = typeof r.lastFired === "number" ? r.lastFired : 0;
      // First fire happens one interval after it was added (last is set on add).
      return now.getTime() - last >= minutes * 60_000;
    }
    case "daily": {
      if (!r.time) return false;
      const [h, m] = r.time.split(":").map(Number);
      const today = dayKey(now);
      if (r.lastFired === today) return false; // already fired today
      // Fire once the clock reaches the target time.
      return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
    }
    case "once": {
      if (!r.datetime) return false;
      if (r.lastFired) return false; // already fired
      const target = new Date(r.datetime).getTime();
      return now.getTime() >= target;
    }
    default:
      return false;
  }
}

/** Returns the reminder with its `lastFired` guard updated after a fire. */
export function markFired(r: Reminder, now: Date): Reminder {
  switch (r.type) {
    case "interval":
      return { ...r, lastFired: now.getTime() };
    case "daily":
      return { ...r, lastFired: dayKey(now) };
    case "once":
      return { ...r, lastFired: now.getTime() };
    default:
      return r;
  }
}

/**
 * Seed `lastFired` when a reminder is created so interval reminders count
 * from "now" and daily reminders don't instantly fire if added after their
 * time has already passed today.
 */
export function seedLastFired(r: Reminder, now: Date): Reminder {
  switch (r.type) {
    case "interval":
      return { ...r, lastFired: now.getTime() };
    case "daily": {
      if (!r.time) return r;
      const [h, m] = r.time.split(":").map(Number);
      const alreadyPassed =
        now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
      // If today's time already passed, mark today as fired so it waits for tomorrow.
      return alreadyPassed ? { ...r, lastFired: dayKey(now) } : r;
    }
    default:
      return r;
  }
}

/** Human-friendly "next fire" description for the list UI. */
export function describeNextFire(r: Reminder, now: Date): string {
  if (!r.enabled) return "Paused";

  switch (r.type) {
    case "interval": {
      const minutes = r.intervalMinutes ?? 0;
      const last = typeof r.lastFired === "number" ? r.lastFired : now.getTime();
      const next = new Date(last + minutes * 60_000);
      return `Every ${minutes} min · next ${formatClock(next)}`;
    }
    case "daily":
      return `Daily at ${r.time}`;
    case "once": {
      if (r.lastFired) return "Fired";
      if (!r.datetime) return "Once";
      return `Once · ${formatWhen(new Date(r.datetime))}`;
    }
    default:
      return "";
  }
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatWhen(d: Date): string {
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
