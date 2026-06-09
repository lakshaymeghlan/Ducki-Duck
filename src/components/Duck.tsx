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

// Front-facing 3/4 view to match the reference: big white head with two black
// eyes, a chunky orange beak pointing toward you, a red wattle below, the body
// peeking out to the right with a wing, and two orange legs with forward feet.
function DuckArt() {
  return (
    <svg
      className="duck-svg w-full h-full overflow-visible"
      viewBox="0 0 134 130"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      role="img"
      aria-label="A blocky Minecraft chicken"
    >
      {/* ---- Body (behind, to the right) ---- */}
      <polygon points="80,48 124,48 132,38 88,38" fill={C.bodyTop} />
      <polygon points="124,48 132,38 132,92 124,102" fill={C.bodySide} />
      <rect x="80" y="48" width="44" height="54" fill={C.bodyFront} />

      {/* Wing on the visible part of the body */}
      <rect x="98" y="58" width="22" height="32" fill={C.bodySide} />
      <rect x="98" y="70" width="22" height="2.5" fill={C.bodyShade} />
      <rect x="98" y="79" width="22" height="2.5" fill={C.bodyShade} />

      {/* ---- Legs + forward feet ---- */}
      <rect x="50" y="94" width="11" height="22" fill={C.leg} />
      <rect x="56" y="94" width="5" height="22" fill={C.legShade} />
      <rect x="74" y="94" width="11" height="22" fill={C.leg} />
      <rect x="80" y="94" width="5" height="22" fill={C.legShade} />
      <rect x="44" y="114" width="24" height="7" fill={C.leg} />
      <rect x="44" y="119" width="24" height="2" fill={C.legShade} />
      <rect x="70" y="114" width="24" height="7" fill={C.leg} />
      <rect x="70" y="119" width="24" height="2" fill={C.legShade} />

      {/* ---- Head (front) ---- */}
      <polygon points="34,28 90,28 104,14 48,14" fill={C.bodyTop} />
      <polygon points="90,28 104,14 104,80 90,94" fill={C.bodySide} />
      <rect x="34" y="28" width="56" height="66" fill={C.bodyFront} />

      {/* Two eyes — squash to blink (CSS .blinking) */}
      <g className="duck-eye">
        <rect x="46" y="42" width="12" height="13" fill={C.eye} />
        <rect x="74" y="42" width="12" height="13" fill={C.eye} />
      </g>

      {/* ---- Beak (orange), pointing toward you ---- */}
      <polygon points="26,58 76,58 86,50 36,50" fill={C.beakTop} />
      <rect x="26" y="58" width="50" height="18" fill={C.beakFront} />

      {/* Lower beak — drops open on quack (CSS .reacting) */}
      <g className="bill-bottom">
        <rect x="30" y="76" width="40" height="7" fill={C.beakUnder} />
      </g>

      {/* ---- Wattle (red) under the beak ---- */}
      <rect x="40" y="76" width="16" height="18" fill={C.wattle} />
      <rect x="52" y="76" width="4" height="18" fill={C.wattleShade} />
    </svg>
  );
}

// A tiny pixel heart (the Minecraft health-heart vibe), shown on hover.
function PixelHeart({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 7 6"
      shapeRendering="crispEdges"
      aria-hidden
    >
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

  // Optional exact-image override: show the hand-drawn SVG chicken by default,
  // and only swap to /duck.png once we've confirmed (client-side) that it
  // actually loads. Probing with new Image() avoids the SSR race where an
  // <img> 404s before React can attach onError, leaving a broken image.
  // (Drop the reference PNG into public/duck.png to use it.)
  const [hasCustomImg, setHasCustomImg] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const probe = new window.Image();
    probe.onload = () => setHasCustomImg(true);
    probe.onerror = () => setHasCustomImg(false);
    probe.src = "/duck.png";
  }, []);

  // Hover: the duck "looks at you" (tilts toward the cursor) and floats hearts.
  const rotX = useSpring(0, { stiffness: 200, damping: 18 });
  const rotY = useSpring(0, { stiffness: 200, damping: 18 });
  const [hearts, setHearts] = useState<
    { id: number; left: number; drift: number; dur: number; size: number }[]
  >([]);
  const heartId = useRef(0);
  const heartTimer = useRef<number | null>(null);

  const spawnHeart = useCallback(() => {
    const id = ++heartId.current;
    const heart = {
      id,
      left: 18 + Math.random() * 64,
      drift: (Math.random() - 0.5) * 36,
      dur: 1.2 + Math.random() * 0.6,
      size: 16 + Math.random() * 12,
    };
    setHearts((prev) => [...prev, heart]);
    window.setTimeout(
      () => setHearts((prev) => prev.filter((h) => h.id !== id)),
      heart.dur * 1000 + 80
    );
  }, []);

  const handleEnter = () => {
    if (reduceMotion || heartTimer.current) return;
    spawnHeart();
    heartTimer.current = window.setInterval(spawnHeart, 360);
  };
  const handleLeave = () => {
    if (heartTimer.current) {
      window.clearInterval(heartTimer.current);
      heartTimer.current = null;
    }
    rotX.set(0);
    rotY.set(0);
  };
  const handleMove = (e: React.MouseEvent) => {
    if (reduceMotion) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const my = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    rotY.set(Math.max(-1, Math.min(1, mx)) * 14);
    rotX.set(Math.max(-1, Math.min(1, my)) * -10);
  };

  useEffect(() => {
    return () => {
      if (heartTimer.current) window.clearInterval(heartTimer.current);
    };
  }, []);

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

      {/* Floating hearts on hover */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
        <AnimatePresence>
          {hearts.map((h) => (
            <motion.div
              key={h.id}
              className="absolute"
              style={{ left: `${h.left}%`, top: "28%" }}
              initial={{ y: 10, opacity: 0, scale: 0.4 }}
              animate={{ y: -72, x: h.drift, opacity: [0, 1, 1, 0], scale: 1 }}
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
        onMouseMove={handleMove}
        aria-label="Pet the duck — it quacks"
        // The button itself is the drag-region target; inner content is
        // pointer-events:none so a grab anywhere on the duck moves the window.
        {...(dragRegion ? { "data-tauri-drag-region": true } : {})}
        className="group relative block rounded-full bg-transparent p-2 transition-transform active:scale-95"
        style={{ perspective: 600 }}
      >
        {/* Tilt toward the cursor ("looks at you") wraps the squish (scale),
            which wraps the idle bob (translateY) — separate elements so the
            transforms compose instead of overwriting each other. */}
        <motion.div style={{ rotateX: rotX, rotateY: rotY }}>
          <motion.div
            ref={svgWrapRef}
            animate={controls}
            style={{ willChange: "transform" }}
            className={`w-56 h-52 sm:w-64 sm:h-60 ${
              dragRegion ? "pointer-events-none" : ""
            }`}
          >
            <IdleBob reduceMotion={!!reduceMotion}>
              {hasCustomImg ? (
                <div className="duck-svg h-full w-full drop-shadow-[var(--shadow-duck)]">
                  {/* Exact reference image (public/duck.png) once confirmed. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/duck.png"
                    alt="A Minecraft chicken"
                    draggable={false}
                    onError={() => setHasCustomImg(false)}
                    className="h-full w-full select-none object-contain"
                  />
                </div>
              ) : (
                <DuckArt />
              )}
            </IdleBob>
          </motion.div>
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
