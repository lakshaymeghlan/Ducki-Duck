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
  type MotionValue,
  useAnimationControls,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { bark, randomBarkVariant, unlockAudio } from "@/lib/bark";

export interface DuckHandle {
  /** Woof + squish-bounce, and optionally show a specific line. */
  react: (line?: string) => void;
  /** Show a transient speech bubble. */
  say: (line: string) => void;
}

interface DuckProps {
  /** 1 = facing right, -1 = facing left (flips to face travel direction). */
  facing?: number;
  /** Whether the dog is walking (drives the waddle). */
  walking?: boolean;
  /** Notifies the parent so the walker can pause while you pet the dog. */
  onHoverChange?: (hovered: boolean) => void;
  /** Notifies the parent when the dog falls asleep / wakes (pauses walking). */
  onSleepingChange?: (sleeping: boolean) => void;
  onPet?: () => void;
}

// An original simple pixel DOG (side view, facing right). One char per pixel.
//   B body (tan) · L cream belly/snout · D dark ears/tail · N nose · E eye-white
const PIXELS = [
  "................",
  "................",
  "..........D..D..",
  ".D........BEEBB.",
  ".DD......BBEEBB.",
  "..DBBBBBBBBBBLLN",
  "..BBBBBBBBBBBLL.",
  ".BBBBBBBBBBBB...",
  ".BLLLLLLLLLBB...",
  "..BLLLLLLLBB....",
  "..BB.....BB.....",
  "..BB.....BB.....",
  "..LL.....LL.....",
  "................",
];

const COLOR: Record<string, string> = {
  B: "#D9A066", // tan body
  L: "#F4E3C6", // cream belly / snout
  D: "#8A5A2B", // dark brown ears / tail
  N: "#23303A", // nose
  E: "#FFFFFF", // eye white
};

function pixels(only?: (ch: string) => boolean) {
  const rects: React.ReactElement[] = [];
  PIXELS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (!COLOR[ch]) continue;
      if (only ? !only(ch) : ch === "E") continue; // eye handled separately
      rects.push(
        <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={COLOR[ch]} />
      );
    }
  });
  return rects;
}

function PixelDogArt({
  pupilX,
  pupilY,
  sleeping,
  walking,
}: {
  pupilX: MotionValue<number>;
  pupilY: MotionValue<number>;
  sleeping: boolean;
  walking: boolean;
}) {
  return (
    <svg
      className={`duck-svg h-full w-full overflow-visible ${walking ? "walking" : ""}`}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      role="img"
      aria-label="A simple pixel dog"
    >
      {pixels()}

      {/* Eye — white with a pupil that follows the cursor; squashes to blink */}
      <g className="duck-eye">
        {sleeping ? (
          <rect x="10.8" y="4" width="2.6" height="0.7" fill={COLOR.N} />
        ) : (
          <>
            {pixels((ch) => ch === "E")}
            <motion.g style={{ x: pupilX, y: pupilY }}>
              <rect x="11.2" y="3.2" width="1.4" height="1.6" fill="#23303A" />
            </motion.g>
          </>
        )}
      </g>
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

const IDLE_SLEEP_MS = 22000;

export const Duck = forwardRef<DuckHandle, DuckProps>(function Duck(
  { facing = 1, walking = false, onHoverChange, onSleepingChange, onPet },
  ref
) {
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();
  const svgWrapRef = useRef<HTMLDivElement>(null);

  const pupilX = useSpring(0, { stiffness: 220, damping: 18 });
  const pupilY = useSpring(0, { stiffness: 220, damping: 18 });
  const facingMV = useSpring(facing, { stiffness: 260, damping: 22 });
  useEffect(() => {
    facingMV.set(facing);
  }, [facing, facingMV]);

  const [happy, setHappy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [zzz, setZzz] = useState<number[]>([]);
  const bubbleTimer = useRef<number | null>(null);
  const bubbleKey = useRef(0);
  const heartTimer = useRef<number | null>(null);
  const heartId = useRef(0);
  const loveyTimer = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);
  const zzzId = useRef(0);
  const sleepingRef = useRef(false);

  const setSleep = useCallback(
    (v: boolean) => {
      sleepingRef.current = v;
      setSleeping(v);
      onSleepingChange?.(v);
    },
    [onSleepingChange]
  );

  // Idle → sleep. Any cursor movement resets the timer (and wakes the dog).
  const armIdle = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (reduceMotion) return;
    idleTimer.current = window.setTimeout(() => setSleep(true), IDLE_SLEEP_MS);
  }, [reduceMotion, setSleep]);

  // Periodic blink — faster while happy; none while asleep.
  useEffect(() => {
    if (reduceMotion || sleeping) return;
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
  }, [reduceMotion, happy, sleeping]);

  // Cursor tracking: pupils follow the pointer anywhere on screen; movement
  // also wakes the dog and re-arms the idle timer.
  useEffect(() => {
    armIdle();
    const onMove = (e: MouseEvent) => {
      if (sleepingRef.current) setSleep(false);
      armIdle();
      if (reduceMotion) return;
      const rect = svgWrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const sign = facing < 0 ? -1 : 1;
      pupilX.set(sign * Math.max(-0.8, Math.min(0.8, (dx / dist) * 0.8)));
      pupilY.set(Math.max(-0.6, Math.min(0.6, (dy / dist) * 0.6)));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [reduceMotion, facing, pupilX, pupilY, armIdle, setSleep]);

  // Little "Zzz" puffs while asleep.
  useEffect(() => {
    if (!sleeping || reduceMotion) return;
    const spawn = () => setZzz((z) => [...z, ++zzzId.current]);
    spawn();
    const id = window.setInterval(spawn, 1500);
    return () => window.clearInterval(id);
  }, [sleeping, reduceMotion]);
  useEffect(() => {
    if (zzz.length === 0) return;
    const id = window.setTimeout(
      () => setZzz((z) => z.slice(1)),
      1800
    );
    return () => window.clearTimeout(id);
  }, [zzz]);

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
      setSleep(false);
      bark();
      squish();
      say(line ?? randomBarkVariant());
    },
    [squish, say, setSleep]
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
    setSleep(false);
    if (reduceMotion) return;
    setHappy(true);
    controls.start({ y: [0, -6, 0], transition: { duration: 0.4 } });
    spawnHeart();
    heartTimer.current = window.setInterval(spawnHeart, 520);
    loveyTimer.current = window.setTimeout(() => {
      say("woof ❤️");
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
    armIdle();
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

      {/* Zzz while asleep */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
        <AnimatePresence>
          {zzz.map((id) => (
            <motion.div
              key={id}
              className="absolute left-1/2 top-1 font-[family-name:var(--font-display)] text-lg font-bold text-water-deep"
              initial={{ y: 0, x: 0, opacity: 0, scale: 0.6 }}
              animate={{ y: -42, x: 18, opacity: [0, 1, 1, 0], scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.7, ease: "easeOut" }}
            >
              z
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
        aria-label="Pet the dog — it woofs"
        className="group relative block rounded-full bg-transparent p-1"
      >
        <motion.div style={{ scaleX: facingMV }}>
          <motion.div ref={svgWrapRef} animate={controls}>
            <WalkBob
              walking={walking && !hovered && !sleeping}
              reduceMotion={!!reduceMotion}
            >
              <PixelDogArt
                pupilX={pupilX}
                pupilY={pupilY}
                sleeping={sleeping}
                walking={walking && !hovered && !sleeping}
              />
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
        walking ? { y: [0, -3, 0, -3, 0], rotate: [-3, 3, -3] } : { y: [0, -5, 0] }
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
