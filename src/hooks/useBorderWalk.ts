"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue } from "framer-motion";

export type WalkMode = "off" | "window" | "screen";

interface Args {
  mode: WalkMode;
  /** Pause walking (e.g. while the user is petting the duck). */
  paused: boolean;
  /** On-screen footprint of the duck in px (window mode). */
  size?: number;
  reduceMotion?: boolean;
}

// Position along the perimeter of a rectangle, plus which way we're facing.
// Returns the duck CENTER (window mode) or window TOP-LEFT (screen mode).
function perimeterPoint(
  d: number,
  left: number,
  top: number,
  w: number,
  h: number
): { x: number; y: number; facing: number } {
  const W = Math.max(1, w);
  const H = Math.max(1, h);
  const P = 2 * (W + H);
  let t = ((d % P) + P) % P;
  // Top edge → right, right edge → face interior (left), bottom → left,
  // left edge → face interior (right). Keeps the duck upright + cute.
  if (t < W) return { x: left + t, y: top, facing: 1 };
  t -= W;
  if (t < H) return { x: left + W, y: top + t, facing: -1 };
  t -= H;
  if (t < W) return { x: left + W - t, y: top + H, facing: -1 };
  t -= W;
  return { x: left, y: top + H - t, facing: 1 };
}

export function useBorderWalk({ mode, paused, size = 150, reduceMotion }: Args) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [facing, setFacing] = useState(1);
  const [walking, setWalking] = useState(false);

  // Mutable bits the rAF loop reads without re-subscribing.
  const dist = useRef(Math.random() * 400);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const idleUntil = useRef(0);
  const facingRef = useRef(1);

  useEffect(() => {
    if (mode === "off" || reduceMotion) {
      setWalking(false);
      return;
    }

    let raf = 0;
    let last = 0;
    const speed = mode === "screen" ? 70 : 48; // px/sec
    const margin = 16;

    // Lazily-loaded Tauri window mover + screen geometry (screen mode).
    let moveWindow: ((px: number, py: number) => void) | null = null;
    let geom: { left: number; top: number; w: number; h: number } | null = null;
    let lastMove = 0;

    if (mode === "screen") {
      (async () => {
        try {
          const [{ getCurrentWindow, currentMonitor }, { PhysicalPosition }] =
            await Promise.all([
              import("@tauri-apps/api/window"),
              import("@tauri-apps/api/dpi"),
            ]);
          const w = getCurrentWindow();
          const monitor = await currentMonitor();
          const outer = await w.outerSize();
          moveWindow = (px, py) => {
            w.setPosition(new PhysicalPosition(px, py)).catch(() => {});
          };
          if (monitor) {
            const ms = monitor.size;
            const mp = monitor.position;
            geom = {
              left: mp.x + margin,
              top: mp.y + margin,
              w: ms.width - outer.width - margin * 2,
              h: ms.height - outer.height - margin * 3, // extra room for the dock
            };
          }
        } catch {
          /* not in Tauri or API unavailable — stay put */
        }
      })();
    }

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;

      const idling = ts < idleUntil.current;
      const moving = !pausedRef.current && !idling;
      setWalking((w) => (w !== moving ? moving : w));

      if (moving) {
        dist.current += speed * dt;
        // Occasionally take a little break to look around.
        if (Math.random() < 0.0016) idleUntil.current = ts + 900 + Math.random() * 2200;
      }

      if (mode === "window") {
        const inset = size / 2 + margin;
        const left = inset;
        const top = inset;
        const w = window.innerWidth - inset * 2;
        const h = window.innerHeight - inset * 2;
        const p = perimeterPoint(dist.current, left, top, w, h);
        x.set(p.x - size / 2);
        y.set(p.y - size / 2);
        if (p.facing !== facingRef.current) {
          facingRef.current = p.facing;
          setFacing(p.facing);
        }
      } else if (mode === "screen" && moveWindow && geom) {
        const p = perimeterPoint(dist.current, geom.left, geom.top, geom.w, geom.h);
        if (p.facing !== facingRef.current) {
          facingRef.current = p.facing;
          setFacing(p.facing);
        }
        // Throttle the (IPC) window moves to ~33fps.
        if (moving && ts - lastMove > 30) {
          lastMove = ts;
          moveWindow(Math.round(p.x), Math.round(p.y));
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, reduceMotion, size, x, y]);

  return { x, y, facing, walking };
}
