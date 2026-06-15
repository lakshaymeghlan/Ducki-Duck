"use client";

import { useEffect, useRef } from "react";
import { useMotionValue } from "framer-motion";

const KEY = "doggy-dog:pos";

// Drag the pet around the page with the pointer and remember where it's dropped
// (web). It never moves on its own. Returns motion values for the fixed
// container plus a pointer-down handler, and a ref telling whether the last
// gesture actually dragged (so a plain click still woofs).
export function useWebDrag(enabled: boolean) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const moved = useRef(false);

  // Restore last position (or default to the bottom-right) on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const size = 124;
    let px = window.innerWidth - size - 16;
    let py = window.innerHeight - size - 16;
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.x === "number" && typeof p.y === "number") {
          px = p.x;
          py = p.y;
        }
      }
    } catch {
      /* ignore */
    }
    // Keep it on-screen if the window changed since last time.
    px = Math.max(0, Math.min(px, window.innerWidth - size));
    py = Math.max(0, Math.min(py, window.innerHeight - size));
    x.set(px);
    y.set(py);
  }, [x, y]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled) return;
    moved.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = x.get();
    const oy = y.get();

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
      x.set(ox + dx);
      y.set(oy + dy);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ x: x.get(), y: y.get() }));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return { x, y, onPointerDown, moved };
}
