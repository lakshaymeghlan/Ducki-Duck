"use client";

import { useState } from "react";
import { Card } from "./Card";

interface DebugPanelProps {
  /** Triggers the dog.s reply (a single `quack.`). */
  onExplain: () => void;
  bugCount: number;
}

// Rubber-duck debugging: you talk, the duck listens and contributes nothing.
export function DebugPanel({ onExplain, bugCount }: DebugPanelProps) {
  const [text, setText] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onExplain();
    setText("");
  };

  return (
    <Card
      title="Explain your bug"
      subtitle="Say it out loud. The dog listens and contributes nothing. That is the point."
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="debug-input" className="visually-hidden">
          Tell the dog what&apos;s broken
        </label>
        <textarea
          id="debug-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Tell the dog what.s broken…"
          className="w-full resize-y rounded-2xl border border-water/70 bg-white px-4 py-3 text-ink outline-none transition-colors placeholder:text-ink-soft/60 focus:border-water-deep"
        />
        <button
          type="submit"
          className="self-start rounded-full bg-duck px-5 py-2.5 font-[family-name:var(--font-display)] text-lg font-semibold text-ink shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >Tell the dog</button>
      </form>

      {bugCount > 0 && (
        <p className="mt-3 text-sm text-ink-soft">
          You&apos;ve explained{" "}
          <strong className="text-ink">{bugCount}</strong>{" "}
          {bugCount === 1 ? "bug" : "bugs"} to the dog today. It still has no
          notes.
        </p>
      )}
    </Card>
  );
}
