"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";
import { quack, randomQuackVariant, unlockAudio } from "@/lib/quack";

export interface DuckHandle {
  /** Quack + squish-bounce, and optionally show a specific line. */
  react: (line?: string) => void;
  /** Show a transient speech bubble (the only text the duck ever "says"). */
  say: (line: string) => void;
}

interface DuckProps {
  /** Called after a click reaction (e.g. to count playful interactions). */
  onPet?: () => void;
  /**
   * In the Tauri desktop shell, make the duck a window drag-region so you can
   * grab it and move the floating window anywhere. A plain click still quacks.
   */
  dragRegion?: boolean;
}

// The duck, drawn entirely in code — a blocky Minecraft chicken in 3/4 view.
// Recreated from scratch as voxel cubes (front + top + side faces, 3 shades
// each) for that lit-from-the-left Minecraft look. Flat colors, crisp edges.
const C = {
  bodyTop: "#FFFFFF",
  bodyFront: "#ECEEF0",
  bodySide: "#CFD3D7",
  bodyShade: "#BCC1C6",
  beakTop: "#F2B65E",
  beakFront: "#E29A3B",
  beakUnder: "#B26E22",
  wattle: "#CC3A29",
  wattleShade: "#A82C1D",
  leg: "#E2922E",
  legShade: "#BD7720",
  eye: "#1B1B1B",
};

function DuckArt() {
  return (
    <svg
      className="duck-svg w-full h-full overflow-visible"
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      role="img"
      aria-label="A blocky Minecraft chicken"
    >
      {/* ---- Body cube (upper right) ---- */}
      <polygon points="52,40 104,40 116,28 64,28" fill={C.bodyTop} />
      <polygon points="104,40 116,28 116,74 104,86" fill={C.bodySide} />
      <rect x="52" y="40" width="52" height="46" fill={C.bodyFront} />

      {/* Wing panel on the body's front face */}
      <rect x="72" y="50" width="26" height="26" fill={C.bodySide} />
      <rect x="72" y="64" width="26" height="3" fill={C.bodyShade} />
      <rect x="72" y="72" width="26" height="3" fill={C.bodyShade} />

      {/* ---- Legs + feet ---- */}
      <rect x="44" y="84" width="9" height="20" fill={C.leg} />
      <rect x="50" y="84" width="3" height="20" fill={C.legShade} />
      <rect x="68" y="84" width="9" height="20" fill={C.leg} />
      <rect x="74" y="84" width="3" height="20" fill={C.legShade} />
      <polygon points="36,104 56,104 60,110 40,110" fill={C.leg} />
      <polygon points="60,104 80,104 84,110 64,110" fill={C.leg} />
      <rect x="36" y="109" width="24" height="2" fill={C.legShade} />
      <rect x="60" y="109" width="24" height="2" fill={C.legShade} />

      {/* ---- Head cube (front left) ---- */}
      <polygon points="16,34 66,34 78,22 28,22" fill={C.bodyTop} />
      <polygon points="66,34 78,22 78,72 66,84" fill={C.bodySide} />
      <rect x="16" y="34" width="50" height="50" fill={C.bodyFront} />

      {/* Eye — squashes to blink (CSS .blinking) */}
      <g className="duck-eye">
        <rect x="34" y="44" width="9" height="13" fill={C.eye} />
      </g>

      {/* ---- Beak (orange), projecting left ---- */}
      <polygon points="2,52 28,52 36,44 10,44" fill={C.beakTop} />
      <rect x="2" y="52" width="26" height="12" fill={C.beakFront} />

      {/* Lower beak — drops open on quack (CSS .reacting) */}
      <g className="bill-bottom">
        <rect x="5" y="64" width="22" height="7" fill={C.beakUnder} />
      </g>

      {/* ---- Wattle (red) under the beak ---- */}
      <rect x="12" y="72" width="11" height="11" fill={C.wattle} />
      <rect x="20" y="72" width="3" height="11" fill={C.wattleShade} />
    </svg>
  );
}

export const Duck = forwardRef<DuckHandle, DuckProps>(function Duck(
  { onPet, dragRegion = false },
  ref
) {
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(
    null
  );
  const bubbleTimer = useRef<number | null>(null);
  const bubbleKey = useRef(0);

  // Periodic blink: toggle a class on the eye group every few seconds.
  useEffect(() => {
    if (reduceMotion) return;
    let blinkTimeout: number;
    let clearTimeoutId: number;

    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 3500;
      blinkTimeout = window.setTimeout(() => {
        const eye = svgWrapRef.current?.querySelector(".duck-eye");
        if (eye) {
          eye.classList.add("blinking");
          clearTimeoutId = window.setTimeout(
            () => eye.classList.remove("blinking"),
            120
          );
        }
        scheduleBlink();
      }, delay);
    };

    scheduleBlink();
    return () => {
      window.clearTimeout(blinkTimeout);
      window.clearTimeout(clearTimeoutId);
    };
  }, [reduceMotion]);

  const say = useCallback((line: string) => {
    bubbleKey.current += 1;
    setBubble({ text: line, key: bubbleKey.current });
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 1700);
  }, []);

  // Squish-and-bounce + bill open (via .reacting class on the SVG).
  const squish = useCallback(() => {
    const svg = svgWrapRef.current?.querySelector(".duck-svg");
    if (svg) {
      svg.classList.remove("reacting");
      void (svg as SVGElement).getBoundingClientRect(); // restart CSS transition
      svg.classList.add("reacting");
      window.setTimeout(() => svg.classList.remove("reacting"), 420);
    }
    if (!reduceMotion) {
      controls.start({
        scale: [1, 0.86, 1.08, 1],
        scaleY: [1, 1.12, 0.95, 1],
        transition: { duration: 0.4, ease: "easeOut" },
      });
    }
  }, [controls, reduceMotion]);

  const react = useCallback(
    (line?: string) => {
      quack();
      squish();
      say(line ?? randomQuackVariant());
    },
    [squish, say]
  );

  useImperativeHandle(ref, () => ({ react, say }), [react, say]);

  const handleClick = () => {
    unlockAudio(); // first gesture unlocks the AudioContext
    react();
    onPet?.();
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Speech bubble — the duck's entire vocabulary lives here */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.key}
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className="absolute -top-2 -translate-y-full z-10 select-none rounded-2xl bg-white px-5 py-2.5 font-[family-name:var(--font-display)] text-xl font-semibold text-ink shadow-[var(--shadow-soft)]"
            role="status"
            aria-live="polite"
          >
            {bubble.text}
            <span className="absolute left-1/2 -bottom-2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white" />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={handleClick}
        aria-label="Pet the duck — it quacks"
        // The button itself is the drag-region target; inner content is
        // pointer-events:none so a grab anywhere on the duck moves the window.
        {...(dragRegion ? { "data-tauri-drag-region": true } : {})}
        className="group relative block rounded-full bg-transparent p-2 transition-transform active:scale-95"
      >
        {/* Outer element handles the squish-bounce (scale); the inner
            IdleBob handles the continuous translateY bob. Separate elements
            so the two transforms compose instead of overwriting each other. */}
        <motion.div
          ref={svgWrapRef}
          animate={controls}
          style={{ willChange: "transform" }}
          className={`w-56 h-52 sm:w-64 sm:h-60 ${
            dragRegion ? "pointer-events-none" : ""
          }`}
        >
          <IdleBob reduceMotion={!!reduceMotion}>
            <DuckArt />
          </IdleBob>
        </motion.div>
      </button>

      {/* Soft contact shadow so the duck reads as sitting on the surface */}
      <motion.div
        aria-hidden
        className="mt-1 h-3 w-40 rounded-[100%] bg-ink/25 blur-md"
        {...(!reduceMotion && {
          animate: { scaleX: [1, 0.9, 1], opacity: [0.28, 0.2, 0.28] },
          transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        })}
      />
    </div>
  );
});

// Idle bob wrapper — gentle continuous up/down unless reduced motion is on.
function IdleBob({
  children,
  reduceMotion,
}: {
  children: React.ReactNode;
  reduceMotion: boolean;
}) {
  if (reduceMotion) return <>{children}</>;
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="w-full h-full drop-shadow-[var(--shadow-duck)]"
    >
      {children}
    </motion.div>
  );
}
