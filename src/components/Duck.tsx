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
  useSpring,
} from "framer-motion";
import { quack, randomQuackVariant, unlockAudio } from "@/lib/quack";

export interface DuckHandle {
  /** Quack + squish-bounce, and optionally show a specific line. */
  react: (line?: string) => void;
  /** Show a transient speech bubble (the only text the duck ever "says"). */
  say: (line: string) => void;
}

interface DuckProps {
  /** 1 = facing right, -1 = facing left (flips to face travel direction). */
  facing?: number;
  /** Whether the duck is walking (drives the waddle + feet). */
  walking?: boolean;
  /** Notifies the parent so the walker can pause while you pet the duck. */
  onHoverChange?: (hovered: boolean) => void;
  onPet?: () => void;
}

// A simple pixel rubber duck (side view, facing right). Flat colors, crisp
// edges — one char per pixel.  Y body · w wing · O beak · b beak underside ·
// K eye · f foot
const PIXELS = [
  "................",
  "................",
  ".......YYYY.....",
  "......YYYYYY....",
  "......YYKKYY....",
  "......YYYYYYOOO.",
  "......YYYYYYbbO.",
  "....YYYYYYYYY...",
  "..YYYYYYYYYYYY..",
  ".YYYYYYYYYYYYYY.",
  ".YYYYYYwwwYYYYY.",
  ".YYYYYYwwwYYYYY.",
  "..YYYYYYYYYYYY..",
  "...YYYYYYYYYY...",
  "....ff....ff....",
  "................",
];

const COLOR: Record<string, string> = {
  Y: "#FFD23F",
  w: "#F2B100",
  O: "#FF9E3D",
  b: "#E07A14",
  K: "#23303A",
  f: "#F58A1F",
};

function pixels(only?: (ch: string) => boolean) {
  const rects: React.ReactElement[] = [];
  PIXELS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (!COLOR[ch]) continue;
      if (only ? !only(ch) : ch === "K") continue;
      rects.push(
        <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={COLOR[ch]} />
      );
    }
  });
  return rects;
}

function PixelDuckArt({ walking }: { walking: boolean }) {
  return (
    <svg
      className={`duck-svg h-full w-full overflow-visible ${walking ? "walking" : ""}`}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      role="img"
      aria-label="A simple pixel rubber duck"
    >
      {pixels()}
      {/* Eye — squashes to blink (CSS .blinking) */}
      <g className="duck-eye">{pixels((ch) => ch === "K")}</g>
    </svg>
  );
}

type Heart = {
  id: number;
  origin: "top" | "left" | "right";
  drift: number;
  dur: number;
  size: number;
};

export const Duck = forwardRef<DuckHandle, DuckProps>(function Duck(
  { facing = 1, walking = false, onHoverChange, onPet },
  ref
) {
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();
  const svgWrapRef = useRef<HTMLDivElement>(null);

  const facingMV = useSpring(facing, { stiffness: 260, damping: 22 });
  useEffect(() => {
    facingMV.set(facing);
  }, [facing, facingMV]);

  const [happy, setHappy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const bubbleTimer = useRef<number | null>(null);
  const bubbleKey = useRef(0);
  const heartTimer = useRef<number | null>(null);
  const heartId = useRef(0);
  const loveyTimer = useRef<number | null>(null);

  // Periodic blink — faster while happy.
  useEffect(() => {
    if (reduceMotion) return;
    let blinkTimeout: number;
    let clearId: number;
    const schedule = () => {
      const delay = (happy ? 1100 : 2800) + Math.random() * (happy ? 1100 : 3200);
      blinkTimeout = window.setTimeout(() => {
        const eye = svgWrapRef.current?.querySelector(".duck-eye");
        if (eye) {
          eye.classList.add("blinking");
          clearId = window.setTimeout(() => eye.classList.remove("blinking"), 120);
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      window.clearTimeout(blinkTimeout);
      window.clearTimeout(clearId);
    };
  }, [reduceMotion, happy]);

  const say = useCallback((line: string) => {
    bubbleKey.current += 1;
    setBubble({ text: line, key: bubbleKey.current });
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 1700);
  }, []);

  const squish = useCallback(() => {
    const svg = svgWrapRef.current?.querySelector(".duck-svg");
    if (svg) {
      svg.classList.remove("reacting");
      void (svg as SVGElement).getBoundingClientRect();
      svg.classList.add("reacting");
      window.setTimeout(() => svg.classList.remove("reacting"), 380);
    }
    if (!reduceMotion) {
      controls.start({
        scale: [1, 0.88, 1.08, 1],
        transition: { duration: 0.38, ease: "easeOut" },
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

  const spawnHeart = useCallback(() => {
    const origins: Heart["origin"][] = ["top", "left", "right"];
    const id = ++heartId.current;
    setHearts((prev) => [
      ...prev,
      {
        id,
        origin: origins[id % 3],
        drift: (Math.random() - 0.5) * 22,
        dur: 1.2 + Math.random() * 0.5,
        size: 14 + Math.random() * 10,
      },
    ]);
    window.setTimeout(
      () => setHearts((prev) => prev.filter((h) => h.id !== id)),
      1900
    );
  }, []);

  const handleEnter = () => {
    setHovered(true);
    onHoverChange?.(true);
    if (reduceMotion) return;
    setHappy(true);
    controls.start({ y: [0, -6, 0], transition: { duration: 0.4 } });
    spawnHeart();
    heartTimer.current = window.setInterval(spawnHeart, 520);
    loveyTimer.current = window.setTimeout(() => {
      say("quack ❤️");
      controls.start({ rotate: [0, -5, 5, -3, 0], transition: { duration: 0.6 } });
    }, 2500);
  };
  const handleLeave = () => {
    setHovered(false);
    onHoverChange?.(false);
    setHappy(false);
    if (heartTimer.current) window.clearInterval(heartTimer.current);
    if (loveyTimer.current) window.clearTimeout(loveyTimer.current);
    heartTimer.current = null;
  };

  useEffect(() => {
    return () => {
      if (heartTimer.current) window.clearInterval(heartTimer.current);
      if (loveyTimer.current) window.clearTimeout(loveyTimer.current);
    };
  }, []);

  const handleClick = () => {
    unlockAudio();
    react();
    onPet?.();
  };

  const heartPos: Record<Heart["origin"], string> = {
    top: "left-1/2 top-0 -translate-x-1/2",
    left: "left-1 top-1/3",
    right: "right-1 top-1/3",
  };

  return (
    <div className="relative flex select-none flex-col items-center">
      {/* Speech bubble */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.key}
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className="absolute -top-1 z-20 -translate-y-full whitespace-nowrap rounded-2xl bg-white px-4 py-2 font-[family-name:var(--font-display)] text-base font-semibold text-ink shadow-[var(--shadow-soft)]"
            role="status"
            aria-live="polite"
          >
            {bubble.text}
            <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating hearts on hover */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
        <AnimatePresence>
          {hearts.map((h) => (
            <motion.div
              key={h.id}
              className={`absolute ${heartPos[h.origin]}`}
              initial={{ y: 6, opacity: 0, scale: 0.4 }}
              animate={{ y: -60, x: h.drift, opacity: [0, 1, 1, 0], scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: h.dur, ease: "easeOut" }}
            >
              <PixelHeart size={h.size} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        aria-label="Pet the duck — it quacks"
        className="group relative block rounded-full bg-transparent p-1"
      >
        {/* facing flip → squish/bounce → walk waddle → art */}
        <motion.div style={{ scaleX: facingMV }}>
          <motion.div ref={svgWrapRef} animate={controls}>
            <WalkBob walking={walking && !hovered} reduceMotion={!!reduceMotion}>
              <PixelDuckArt walking={walking && !hovered} />
            </WalkBob>
          </motion.div>
        </motion.div>
      </button>

      {/* Soft contact shadow */}
      <motion.div
        aria-hidden
        className="mt-0.5 h-2 w-20 rounded-[100%] bg-ink/25 blur-md"
        {...(!reduceMotion && {
          animate: { scaleX: [1, 0.9, 1], opacity: [0.28, 0.2, 0.28] },
          transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
        })}
      />
    </div>
  );
});

// Walk waddle (or gentle idle bob when standing). Reduced motion: static.
function WalkBob({
  children,
  walking,
  reduceMotion,
}: {
  children: React.ReactNode;
  walking: boolean;
  reduceMotion: boolean;
}) {
  if (reduceMotion)
    return <div className="h-32 w-32 sm:h-36 sm:w-36">{children}</div>;
  return (
    <motion.div
      className="h-32 w-32 drop-shadow-[var(--shadow-duck)] sm:h-36 sm:w-36"
      animate={
        walking ? { y: [0, -3, 0, -3, 0], rotate: [-3, 3, -3] } : { y: [0, -6, 0] }
      }
      transition={{
        duration: walking ? 0.6 : 3.4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}

// Tiny pixel heart shown on hover.
function PixelHeart({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 7 6" shapeRendering="crispEdges" aria-hidden>
      <rect x="1" y="0" width="2" height="1" fill="#E63B4B" />
      <rect x="4" y="0" width="2" height="1" fill="#E63B4B" />
      <rect x="0" y="1" width="7" height="2" fill="#E63B4B" />
      <rect x="1" y="3" width="5" height="1" fill="#E63B4B" />
      <rect x="2" y="4" width="3" height="1" fill="#E63B4B" />
      <rect x="3" y="5" width="1" height="1" fill="#E63B4B" />
      <rect x="1" y="1" width="1" height="1" fill="#FF9DA8" />
    </svg>
  );
}
