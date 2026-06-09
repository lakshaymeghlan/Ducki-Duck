"use client";

import { useEffect, useState } from "react";
import { Card } from "./Card";
import {
  describeNextFire,
  type Reminder,
  type ReminderType,
} from "@/lib/reminders";

interface AgendaProps {
  reminders: Reminder[];
  onAdd: (draft: Omit<Reminder, "id" | "enabled" | "lastFired">) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<ReminderType, string> = {
  interval: "Every N minutes",
  daily: "Daily at a time",
  once: "Once at a time",
};

export function Agenda({ reminders, onAdd, onToggle, onDelete }: AgendaProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ReminderType>("interval");
  const [emoji, setEmoji] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [time, setTime] = useState("18:00");
  const [datetime, setDatetime] = useState("");

  // Re-render once a minute so "next fire" text stays roughly fresh.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;

    const draft: Omit<Reminder, "id" | "enabled" | "lastFired"> = {
      label: trimmed,
      type,
      emoji: emoji.trim() || defaultEmoji(type),
    };
    if (type === "interval") draft.intervalMinutes = Math.max(1, intervalMinutes);
    if (type === "daily") draft.time = time;
    if (type === "once") {
      if (!datetime) return;
      draft.datetime = datetime;
    }

    onAdd(draft);
    setLabel("");
    setEmoji("");
  };

  const now = new Date();

  return (
    <Card title="Quack reminders" subtitle="The duck will nudge you. Out loud.">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="r-label" className="text-sm font-medium text-ink-soft">
            Label
          </label>
          <input
            id="r-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            maxLength={60}
            placeholder="Drink water"
            className="rounded-xl border border-water/70 bg-white px-3 py-2 outline-none focus:border-water-deep"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="r-type" className="text-sm font-medium text-ink-soft">
              Type
            </label>
            <select
              id="r-type"
              value={type}
              onChange={(e) => setType(e.target.value as ReminderType)}
              className="rounded-xl border border-water/70 bg-white px-3 py-2 outline-none focus:border-water-deep"
            >
              {(Object.keys(TYPE_LABELS) as ReminderType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-20 flex-col gap-1">
            <label htmlFor="r-emoji" className="text-sm font-medium text-ink-soft">
              Emoji
            </label>
            <input
              id="r-emoji"
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              placeholder="💧"
              className="rounded-xl border border-water/70 bg-white px-3 py-2 text-center outline-none focus:border-water-deep"
            />
          </div>
        </div>

        {/* Only the relevant time/interval input is shown for the chosen type */}
        {type === "interval" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="r-interval" className="text-sm font-medium text-ink-soft">
              Every (minutes)
            </label>
            <input
              id="r-interval"
              type="number"
              min={1}
              max={1440}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              className="rounded-xl border border-water/70 bg-white px-3 py-2 outline-none focus:border-water-deep"
            />
          </div>
        )}
        {type === "daily" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="r-time" className="text-sm font-medium text-ink-soft">
              At (time)
            </label>
            <input
              id="r-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-xl border border-water/70 bg-white px-3 py-2 outline-none focus:border-water-deep"
            />
          </div>
        )}
        {type === "once" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="r-datetime" className="text-sm font-medium text-ink-soft">
              At (date &amp; time)
            </label>
            <input
              id="r-datetime"
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="rounded-xl border border-water/70 bg-white px-3 py-2 outline-none focus:border-water-deep"
            />
          </div>
        )}

        <button
          type="submit"
          className="self-start rounded-full bg-duck px-5 py-2.5 font-[family-name:var(--font-display)] text-lg font-semibold text-ink shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Add reminder
        </button>
      </form>

      <div className="mt-5">
        {reminders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-water-deep/40 bg-white/50 px-4 py-6 text-center text-sm text-ink-soft">
            No quacks scheduled yet. Add one and the duck will nudge you.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reminders.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm"
              >
                <span className="text-2xl" aria-hidden>
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate font-medium ${
                      r.enabled ? "text-ink" : "text-ink-soft line-through"
                    }`}
                  >
                    {r.label}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {describeNextFire(r, now)}
                  </p>
                </div>

                {/* Enable/disable toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={`${r.enabled ? "Disable" : "Enable"} ${r.label}`}
                  onClick={() => onToggle(r.id)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    r.enabled ? "bg-water-deep" : "bg-ink/20"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      r.enabled ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>

                <button
                  type="button"
                  aria-label={`Delete ${r.label}`}
                  onClick={() => onDelete(r.id)}
                  className="shrink-0 rounded-full px-2 py-1 text-xl leading-none text-ink-soft transition-colors hover:text-ink"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function defaultEmoji(type: ReminderType): string {
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
