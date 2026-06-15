"use client";

import { useEffect, useRef, useState } from "react";

// Detects typing in the focused window. NOTE: a webview/desktop-pet window only
// receives key events while it's focused — it can't see keystrokes you make in
// other apps (that would need OS-level global key hooks). So this reacts when
// you type in the app/agenda window.
export function useTyping() {
  const [typing, setTyping] = useState(false);
  const [rate, setRate] = useState(0); // keystrokes in the last second
  const [tick, setTick] = useState(0); // increments per keystroke (key flashes)
  const times = useRef<number[]>([]);
  const stop = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only count "real" typing keys (letters, numbers, space, punctuation).
      if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== "Enter") return;
      const now = performance.now();
      times.current.push(now);
      times.current = times.current.filter((t) => now - t < 1000);
      setRate(times.current.length);
      setTyping(true);
      setTick((n) => (n + 1) % 1_000_000);
      if (stop.current) window.clearTimeout(stop.current);
      stop.current = window.setTimeout(() => {
        setTyping(false);
        setRate(0);
        times.current = [];
      }, 2000);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (stop.current) window.clearTimeout(stop.current);
    };
  }, []);

  return {
    typing,
    rate,
    tick,
    fast: rate >= 5,
    excited: rate >= 10,
  };
}
