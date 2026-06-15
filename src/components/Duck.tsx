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
import { isTauri } from "@/lib/platform";

export interface DuckHandle {
  /** Woof + squish-bounce, and optionally show a specific line. */
  react: (line?: string) => void;
  /** Show a transient speech bubble. */
  say: (line: string) => void;
}

interface DuckProps {
  /** Tauri desktop: make the dog a window drag-region (drag to move window). */
  dragRegion?: boolean;
  /** User is typing in the focused window → typing bounce. */
  typing?: boolean;
  /** Heavy typing → faster, excited bounce + occasional hearts. */
  excited?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  onSleepingChange?: (sleeping: boolean) => void;
  onPet?: () => void;
}

// Original front-facing sitting puppy (beagle-ish), high-contrast retro pixel
// art. One char per pixel.  B brown · D dark brown · W white · K black ·
// R red collar/tongue · E eye-white
const PIXELS = [
  "................",
  ".DD........DD...",
  ".DDD..BBBB..DDD.",
  ".DDDBBBBBBBBDDD.",
  ".DDDWWWWWWWWDDD.",
  ".DDWWWWWWWWWWDD.",
  "..DWWWWWWWWWWD..",
  "..WWWWWKKWWWWW..",
  "...WWWWRRWWWW...",
  "...BRRRRRRRRB...",
  "..BBWWWWWWWWBB..",
  "..BBWWWWWWWWBB..",
  ".BBBWWWWWWWWBBB.",
  ".BBWWWWWWWWWWBB.",
  "..WWWWWWWWWWWW..",
  "..WWWWWWWWWWWW..",
  "..WWW....WWW....",
  "................",
];

const COLOR: Record<string, string> = {
  B: "#B5723A", // brown body
  D: "#6E4523", // dark-brown ears / patches
  W: "#FFFFFF", // white face / chest / paws
  K: "#1A1A1A", // black nose
  R: "#D9342B", // red collar + tongue
  E: "#FFFFFF", // eye white
};

const GRID_W = 16;
const OUTLINE = "#1A1A1A"; // thick clean black outline

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

function isFilled(x: number, y: number) {
  const row = PIXELS[y];
  return !!(row && COLOR[row[x]]);
}

// Auto black outline: any empty cell touching the silhouette, drawn behind.
function outline() {
  const rects: React.ReactElement[] = [];
  for (let y = -1; y <= PIXELS.length; y++) {
    for (let x = -1; x <= GRID_W; x++) {
      if (isFilled(x, y)) continue;
      if (
        isFilled(x - 1, y) ||
        isFilled(x + 1, y) ||
        isFilled(x, y - 1) ||
        isFilled(x, y + 1)
      ) {
        rects.push(
          <rect key={`o${x}-${y}`} x={x} y={y} width="1.06" height="1.06" fill={OUTLINE} />
        );
      }
    }
  }
  return rects;
}

function PixelDogArt({
  pupilX,
  pupilY,
  sleeping,
}: {
  pupilX: MotionValue<number>;
  pupilY: MotionValue<number>;
  sleeping: boolean;
}) {
  return (
    <svg
      className="duck-svg h-full w-full overflow-visible"
      viewBox="-1 -1 18 20"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      role="img"
      aria-label="A cute pixel puppy"
    >
      {outline()}
      {pixels()}

      {/* Googly eyes — round eyeballs with a black rim and a heavy pupil that
          swings to the cursor and wobbles. Smooth (not pixel-snapped). */}
      <g className="duck-eye" shapeRendering="geometricPrecision">
        {sleeping ? (
          <>
            <rect x="3.6" y="5.0" width="3.6" height="0.85" rx="0.4" fill={COLOR.K} />
            <rect x="8.8" y="5.0" width="3.6" height="0.85" rx="0.4" fill={COLOR.K} />
          </>
        ) : (
          <>
            <circle cx="5.4" cy="5.3" r="1.75" fill="#1A1A1A" />
            <circle cx="10.6" cy="5.3" r="1.75" fill="#1A1A1A" />
            <circle cx="5.4" cy="5.3" r="1.5" fill="#FFFFFF" />
            <circle cx="10.6" cy="5.3" r="1.5" fill="#FFFFFF" />
            <motion.g style={{ x: pupilX, y: pupilY }}>
              <circle cx="5.4" cy="5.3" r="0.9" fill="#1A1A1A" />
              <circle cx="10.6" cy="5.3" r="0.9" fill="#1A1A1A" />
              <circle cx="5.72" cy="4.98" r="0.3" fill="#FFFFFF" />
              <circle cx="10.92" cy="4.98" r="0.3" fill="#FFFFFF" />
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
  { dragRegion = false, typing = false, excited = false, onHoverChange, onSleepingChange, onPet },
  ref
) {
  const reduceMotion = useReducedMotion();
  const controls = useAnimationControls();
  const svgWrapRef = useRef<HTMLDivElement>(null);

  // Underdamped springs → googly-eye wobble: pupils overshoot and jiggle.
  const pupilX = useSpring(0, { stiffness: 170, damping: 7, mass: 0.85 });
  const pupilY = useSpring(0, { stiffness: 170, damping: 7, mass: 0.85 });
  const headTilt = useSpring(0, { stiffness: 150, damping: 14 });

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

  const armIdle = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (reduceMotion) return;
    idleTimer.current = window.setTimeout(() => setSleep(true), IDLE_SLEEP_MS);
  }, [reduceMotion, setSleep]);

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
        size: 13 + Math.random() * 9,
      },
    ]);
    window.setTimeout(() => setHearts((prev) => prev.filter((h) => h.id !== id)), 1900);
  }, []);

  // Periodic blink + occasional head tilt; none while asleep.
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
        // Sometimes give a curious little head tilt.
        if (Math.random() < 0.4) {
          const dir = Math.random() < 0.5 ? -6 : 6;
          headTilt.set(dir);
          window.setTimeout(() => headTilt.set(0), 700);
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      window.clearTimeout(blinkTimeout);
      window.clearTimeout(clearId);
    };
  }, [reduceMotion, happy, sleeping, headTilt]);

  // Cursor tracking: pupils follow the pointer; movement wakes the dog.
  useEffect(() => {
    armIdle();
    const aim = (dx: number, dy: number) => {
      const dist = Math.hypot(dx, dy) || 1;
      // Big travel so the pupils swing right to the edges like googly eyes.
      pupilX.set(Math.max(-1.0, Math.min(1.0, (dx / dist) * 1.0)));
      pupilY.set(Math.max(-0.95, Math.min(0.95, (dy / dist) * 0.95)));
    };

    // Desktop: poll the global cursor so the eyes track anywhere on screen.
    if (isTauri()) {
      let alive = true;
      let timer = 0;
      let geom: { cx: number; cy: number } | null = null;
      let last = { x: -1, y: -1 };
      (async () => {
        const [{ invoke }, { getCurrentWindow }] = await Promise.all([
          import("@tauri-apps/api/core"),
          import("@tauri-apps/api/window"),
        ]);
        const win = getCurrentWindow();
        const refresh = async () => {
          try {
            const p = await win.outerPosition();
            const s = await win.outerSize();
            const scale = await win.scaleFactor();
            geom = {
              cx: p.x / scale + s.width / scale / 2,
              cy: p.y / scale + s.height / scale / 2,
            };
          } catch {
            /* ignore */
          }
        };
        await refresh();
        let count = 0;
        const tick = async () => {
          if (!alive) return;
          try {
            const [cx, cy] = (await invoke("global_cursor")) as [number, number];
            if (count++ % 12 === 0) await refresh(); // window may have been dragged
            if (geom) {
              if (!reduceMotion) aim(cx - geom.cx, cy - geom.cy);
              if (Math.abs(cx - last.x) + Math.abs(cy - last.y) > 2) {
                last = { x: cx, y: cy };
                if (sleepingRef.current) setSleep(false);
                armIdle();
              }
            }
          } catch {
            /* ignore */
          }
          timer = window.setTimeout(tick, 90);
        };
        tick();
      })();
      return () => {
        alive = false;
        if (timer) window.clearTimeout(timer);
        if (idleTimer.current) window.clearTimeout(idleTimer.current);
      };
    }

    // Web: track the pointer within the page.
    const onMove = (e: MouseEvent) => {
      if (sleepingRef.current) setSleep(false);
      armIdle();
      if (reduceMotion) return;
      const rect = svgWrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      aim(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [reduceMotion, pupilX, pupilY, armIdle, setSleep]);

  // "Zzz" while asleep.
  useEffect(() => {
    if (!sleeping || reduceMotion) return;
    const spawn = () => setZzz((z) => [...z, ++zzzId.current]);
    spawn();
    const id = window.setInterval(spawn, 1500);
    return () => window.clearInterval(id);
  }, [sleeping, reduceMotion]);
  useEffect(() => {
    if (zzz.length === 0) return;
    const id = window.setTimeout(() => setZzz((z) => z.slice(1)), 1800);
    return () => window.clearTimeout(id);
  }, [zzz]);

  // Typing → wake + occasional excited hearts; happy bounce when typing stops.
  useEffect(() => {
    if (typing) setSleep(false);
  }, [typing, setSleep]);
  useEffect(() => {
    if (!excited || reduceMotion) return;
    const id = window.setInterval(spawnHeart, 3500);
    return () => window.clearInterval(id);
  }, [excited, reduceMotion, spawnHeart]);
  const prevTyping = useRef(false);
  useEffect(() => {
    if (prevTyping.current && !typing && !reduceMotion) {
      controls.start({ y: [0, -7, 0], transition: { duration: 0.4 } });
    }
    prevTyping.current = typing;
  }, [typing, controls, reduceMotion]);

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

      {/* Floating hearts on hover / excited typing */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
        <AnimatePresence>
          {hearts.map((h) => (
            <motion.div
              key={h.id}
              className={`absolute ${heartPos[h.origin]}`}
              initial={{ y: 6, opacity: 0, scale: 0.4 }}
              animate={{ y: -58, x: h.drift, opacity: [0, 1, 1, 0], scale: 1 }}
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
        {...(dragRegion ? { "data-tauri-drag-region": true } : {})}
        className="group relative block rounded-full bg-transparent p-1"
      >
        <motion.div
          ref={svgWrapRef}
          animate={controls}
          className={dragRegion ? "pointer-events-none" : undefined}
        >
          <motion.div style={{ rotate: headTilt }}>
            <Breathe typing={typing} excited={excited} reduceMotion={!!reduceMotion}>
              <PixelDogArt pupilX={pupilX} pupilY={pupilY} sleeping={sleeping} />
            </Breathe>
          </motion.div>
        </motion.div>
      </button>

      {/* Soft contact shadow */}
      <motion.div
        aria-hidden
        className="mt-0.5 h-2 w-16 rounded-[100%] bg-ink/25 blur-md"
        {...(!reduceMotion && {
          animate: { scaleX: [1, 0.9, 1], opacity: [0.28, 0.2, 0.28] },
          transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
        })}
      />
    </div>
  );
});

// Gentle idle breathing; a quicker tap-bounce while typing (faster if excited).
function Breathe({
  children,
  typing,
  excited,
  reduceMotion,
}: {
  children: React.ReactNode;
  typing: boolean;
  excited: boolean;
  reduceMotion: boolean;
}) {
  const cls = "h-24 w-24 drop-shadow-[var(--shadow-duck)] sm:h-28 sm:w-28";
  if (reduceMotion) return <div className={cls}>{children}</div>;
  return (
    <motion.div
      className={cls}
      animate={
        typing
          ? { y: [0, -2.5, 0], scaleY: [1, 0.97, 1] }
          : { y: [0, -2, 0], scaleY: [1, 1.02, 1] }
      }
      transition={{
        duration: typing ? (excited ? 0.18 : 0.28) : 3.2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}

// Tiny pixel heart.
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
