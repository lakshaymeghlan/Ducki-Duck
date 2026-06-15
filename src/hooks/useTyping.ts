"use client";

import { useEffect, useRef, useState } from "react";
import { isTauri } from "@/lib/platform";

// Detects typing and its speed. On the web it listens to the focused window's
// keydown. On the desktop it listens to a global key-press event emitted by the
// Rust side (timing only — never which keys), so the floating dog reacts to you
// typing in ANY app (requires macOS Input Monitoring permission).
export function useTyping() {
  const [typing, setTyping] = useState(false);
  const [rate, setRate] = useState(0); // key presses in the last second
  const [tick, setTick] = useState(0); // increments per press (key flashes)
  const times = useRef<number[]>([]);
  const stop = useRef<number | null>(null);

  useEffect(() => {
    const register = () => {
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

    // Desktop: global key presses from Rust.
    if (isTauri()) {
      let unlisten: (() => void) | undefined;
      let alive = true;
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen("global-keypress", () => register()).then((un) => {
          if (alive) unlisten = un;
          else un();
        });
      });
      return () => {
        alive = false;
        unlisten?.();
        if (stop.current) window.clearTimeout(stop.current);
      };
    }

    // Web: focused-window typing.
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== "Enter") return;
      register();
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
