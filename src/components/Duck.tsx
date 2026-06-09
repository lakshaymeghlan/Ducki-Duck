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
}

// The duck, drawn entirely in code — classic glossy rubber duck.
function DuckArt() {
  return (
    <svg
      className="duck-svg w-full h-full overflow-visible"
      viewBox="0 0 220 200"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="A cheerful rubber duck"
    >
      <defs>
        <radialGradient id="bodyGrad" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FFE680" />
          <stop offset="55%" stopColor="#FFD23F" />
          <stop offset="100%" stopColor="#F4B400" />
        </radialGradient>
        <radialGradient id="headGrad" cx="35%" cy="28%" r="85%">
          <stop offset="0%" stopColor="#FFEE9C" />
          <stop offset="60%" stopColor="#FFD23F" />
          <stop offset="100%" stopColor="#F6BC12" />
        </radialGradient>
        <linearGradient id="billGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFA53B" />
          <stop offset="100%" stopColor="#F47B1F" />
        </linearGradient>
      </defs>

      {/* Body */}
      <path
        d="M40 150 C 20 150, 14 120, 36 108 C 30 78, 60 60, 96 66 C 120 40, 168 44, 176 78 C 200 86, 200 128, 170 140 C 168 152, 150 160, 120 160 Z"
        fill="url(#bodyGrad)"
      />

      {/* Wing */}
      <path
        d="M70 120 C 92 104, 132 104, 150 120 C 132 134, 92 134, 70 120 Z"
        fill="#F2B100"
        opacity="0.55"
      />

      {/* Head */}
      <circle cx="150" cy="78" r="42" fill="url(#headGrad)" />

      {/* Bill — bottom rotates open on quack (CSS .reacting) */}
      <g className="duck-bill">
        <path
          className="bill-top"
          d="M176 74 C 206 66, 218 74, 214 84 C 210 92, 184 92, 176 86 Z"
          fill="url(#billGrad)"
        />
        <path
          className="bill-bottom"
          d="M176 86 C 188 96, 208 96, 212 90 C 214 96, 204 104, 184 102 C 178 100, 175 94, 176 86 Z"
          fill="#E06A12"
        />
      </g>

      {/* Eye — scaleY animates to blink (CSS .blinking) */}
      <g className="duck-eye">
        <circle cx="158" cy="66" r="7.5" fill="#1E2A38" />
        <circle cx="160.5" cy="63" r="2.4" fill="#FFFFFF" />
      </g>

      {/* Cheek blush */}
      <circle cx="138" cy="92" r="7" fill="#FFB36B" opacity="0.45" />

      {/* Glossy highlights */}
      <ellipse cx="78" cy="92" rx="26" ry="14" fill="#FFFFFF" opacity="0.35" />
      <ellipse cx="138" cy="56" rx="12" ry="7" fill="#FFFFFF" opacity="0.4" />
    </svg>
  );
}

export const Duck = forwardRef<DuckHandle, DuckProps>(function Duck(
  { onPet },
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
        className="group relative block rounded-full bg-transparent p-2 transition-transform active:scale-95"
      >
        {/* Outer element handles the squish-bounce (scale); the inner
            IdleBob handles the continuous translateY bob. Separate elements
            so the two transforms compose instead of overwriting each other. */}
        <motion.div
          ref={svgWrapRef}
          animate={controls}
          style={{ willChange: "transform" }}
          className="w-56 h-52 sm:w-64 sm:h-60"
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
