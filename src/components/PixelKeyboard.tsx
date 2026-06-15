"use client";

import { motion } from "framer-motion";

// A tiny pixel keyboard that pops up in front of the dog while you type.
// Keys flash as you press (driven by `tick`).
const COLS = 7;
const ROWS = 3;
const KEYS = COLS * ROWS;

export function PixelKeyboard({ tick, excited }: { tick: number; excited: boolean }) {
  // Which keys are lit this frame — a couple of pseudo-random ones from tick.
  const lit = new Set<number>([
    (tick * 7) % KEYS,
    excited ? (tick * 13 + 3) % KEYS : -1,
  ]);

  const keyW = 4;
  const keyH = 4;
  const gap = 1;
  const padX = 2;
  const padY = 2;
  const w = padX * 2 + COLS * keyW + (COLS - 1) * gap;
  const h = padY * 2 + ROWS * keyH + (ROWS - 1) * gap;

  return (
    <motion.svg
      width={w * 4}
      height={h * 4}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden
      initial={{ opacity: 0, y: 6, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
    >
      {/* body */}
      <rect x="0" y="0" width={w} height={h} rx="1.5" fill="#3A2E2A" />
      <rect x="0" y="0" width={w} height={h} rx="1.5" fill="none" stroke="#1A1A1A" strokeWidth="0.6" />
      {Array.from({ length: KEYS }, (_, i) => {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        const x = padX + c * (keyW + gap);
        const y = padY + r * (keyH + gap);
        const on = lit.has(i);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={keyW}
            height={keyH}
            rx="0.6"
            fill={on ? "#FFE066" : "#EDE6DC"}
          />
        );
      })}
    </motion.svg>
  );
}
