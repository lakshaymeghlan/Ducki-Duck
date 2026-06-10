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
  useMotionValue,
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
  /** 1 = facing right, -1 = facing left (the duck flips to face travel). */
  facing?: number;
  /** Whether the duck is currently walking (drives the waddle + feet). */
  walking?: boolean;
  /** Notifies the parent so the walker can pause while you pet the duck. */
  onHoverChange?: (hovered: boolean) => void;
  onPet?: () => void;
}

// An original, chunky-cute rubber duck: big round head, two large sparkly eyes
// with trackable pupils, tiny orange beak, chubby cheeks, a little wing + feet.
function CuteDuckArt({
  pupilX,
  pupilY,
  happy,
  walking,
}: {
  pupilX: MotionValue<number>;
  pupilY: MotionValue<number>;
  happy: boolean;
  walking: boolean;
}) {
  return (
    <svg
      className={`duck-svg h-full w-full overflow-visible ${
        walking ? "walking" : ""
      }`}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="A cute rubber duck"
    >
      <defs>
        <radialGradient id="duckBody" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#FFEFAE" />
          <stop offset="55%" stopColor="#FFD23F" />
          <stop offset="100%" stopColor="#F3B100" />
        </radialGradient>
        <radialGradient id="duckHead" cx="36%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#FFF3C0" />
          <stop offset="60%" stopColor="#FFD752" />
          <stop offset="100%" stopColor="#F6BC18" />
        </radialGradient>
        <linearGradient id="duckBeak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB347" />
          <stop offset="100%" stopColor="#F58A1F" />
        </linearGradient>
      </defs>

      {/* Feet */}
      <g className="duck-foot duck-foot-l">
        <ellipse cx="42" cy="92" rx="7" ry="4" fill="#F58A1F" />
      </g>
      <g className="duck-foot duck-foot-r">
        <ellipse cx="58" cy="92" rx="7" ry="4" fill="#F58A1F" />
      </g>

      {/* Tail */}
      <path d="M14 62 q-8 -6 -2 -12 q6 2 9 8 z" fill="#F3B100" />

      {/* Body */}
      <ellipse cx="50" cy="66" rx="33" ry="25" fill="url(#duckBody)" />

      {/* Wing */}
      <path
        className="duck-wing"
        d="M34 58 q-9 6 -3 18 q8 2 12 -4 q-3 -10 -9 -14 z"
        fill="#F7C521"
      />

      {/* Head */}
      <circle cx="60" cy="38" r="24" fill="url(#duckHead)" />

      {/* Cheeks (blush) */}
      <ellipse
        cx="50"
        cy="46"
        rx="5.5"
        ry="3.6"
        fill="#FF9AA0"
        opacity={happy ? 0.8 : 0.5}
      />
      <ellipse
        cx="74"
        cy="46"
        rx="5.5"
        ry="3.6"
        fill="#FF9AA0"
        opacity={happy ? 0.8 : 0.5}
      />

      {/* Beak */}
      <path
        d="M76 38 q14 -3 17 5 q-1 3 -5 3 q-8 1 -12 -3 z"
        fill="url(#duckBeak)"
      />
      <g className="bill-bottom">
        <path d="M76 44 q8 4 13 2 q-2 4 -8 4 q-4 0 -5 -3 z" fill="#E07A14" />
      </g>

      {/* Eyes — pupils track the cursor; whole group squashes to blink */}
      <g className="duck-eye">
        <circle cx="54" cy="34" r="8.5" fill="#FFFFFF" />
        <circle cx="72" cy="34" r="8.5" fill="#FFFFFF" />
        <motion.g style={{ x: pupilX, y: pupilY }}>
          <circle cx="54" cy="34" r="4.6" fill="#23303A" />
          <circle cx="72" cy="34" r="4.6" fill="#23303A" />
          <circle cx="55.6" cy="32" r="1.5" fill="#FFFFFF" />
          <circle cx="73.6" cy="32" r="1.5" fill="#FFFFFF" />
        </motion.g>
        {/* Happy squint lids fade in when happy */}
        <g
          style={{ opacity: happy ? 1 : 0, transition: "opacity 120ms" }}
          stroke="#23303A"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        >
          <path d="M48 35 q6 -6 12 0" />
          <path d="M66 35 q6 -6 12 0" />
        </g>
      </g>

      {/* Glossy highlights */}
      <ellipse cx="48" cy="28" rx="9" ry="5" fill="#FFFFFF" opacity="0.45" />
      <ellipse cx="36" cy="58" rx="10" ry="5" fill="#FFFFFF" opacity="0.3" />
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

  // Pupil + head tracking (springs = smooth, no re-renders).
  const pupilX = useSpring(0, { stiffness: 220, damping: 18 });
  const pupilY = useSpring(0, { stiffness: 220, damping: 18 });
  const headTilt = useSpring(0, { stiffness: 180, damping: 16 });
  const facingMV = useSpring(facing, { stiffness: 260, damping: 22 });
  useEffect(() => {
    facingMV.set(facing);
  }, [facing, facingMV]);

  const [happy, setHappy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(
    null
  );
  const [hearts, setHearts] = useState<Heart[]>([]);
  const bubbleTimer = useRef<number | null>(null);
  const bubbleKey = useRef(0);
  const heartTimer = useRef<number | null>(null);
  const heartId = useRef(0);
  const loveyTimer = useRef<number | null>(null);

  const cursor = useRef({ x: 0, y: 0, has: false });

  // Periodic blink — faster while happy.
  useEffect(() => {
    if (reduceMotion) return;
    let blinkTimeout: number;
    let clearId: number;
    const schedule = () => {
      const delay = (happy ? 1200 : 2800) + Math.random() * (happy ? 1200 : 3200);
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

  // Cursor tracking: aim pupils + tilt head toward the pointer.
  useEffect(() => {
    if (reduceMotion) return;
    const onMove = (e: MouseEvent) => {
      cursor.current = { x: e.clientX, y: e.clientY, has: true };
      const rect = svgWrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const sign = facing < 0 ? -1 : 1;
      // Clamp pupil travel (SVG units) so it never looks creepy.
      pupilX.set(sign * Math.max(-3.2, Math.min(3.2, (dx / dist) * 3.2)));
      pupilY.set(Math.max(-2.6, Math.min(2.6, (dy / dist) * 2.6)));
      headTilt.set(Math.max(-7, Math.min(7, (dx / 40) * 7)) * sign);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduceMotion, facing, pupilX, pupilY, headTilt]);

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
    controls.start({ y: [-0, -6, 0], transition: { duration: 0.4 } });
    spawnHeart();
    heartTimer.current = window.setInterval(spawnHeart, 520);
    // After a couple seconds of attention, the duck gets lovey.
    loveyTimer.current = window.setTimeout(() => {
      say("quack ❤️");
      controls.start({
        rotate: [0, -5, 5, -3, 0],
        transition: { duration: 0.6 },
      });
    }, 2500);
  };
  const handleLeave = () => {
    setHovered(false);
    onHoverChange?.(false);
    setHappy(false);
    pupilX.set(0);
    pupilY.set(0);
    headTilt.set(0);
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
    left: "left-2 top-1/3",
    right: "right-2 top-1/3",
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
              animate={{ y: -64, x: h.drift, opacity: [0, 1, 1, 0], scale: 1 }}
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
        style={{ perspective: 500 }}
      >
        {/* facing flip → squish/bounce → walk waddle → head tilt → art */}
        <motion.div style={{ scaleX: facingMV }}>
          <motion.div ref={svgWrapRef} animate={controls}>
            <WalkBob walking={walking && !hovered} reduceMotion={!!reduceMotion}>
              <motion.div style={{ rotate: headTilt }} className="h-full w-full">
                <CuteDuckArt
                  pupilX={pupilX}
                  pupilY={pupilY}
                  happy={happy}
                  walking={walking && !hovered}
                />
              </motion.div>
            </WalkBob>
          </motion.div>
        </motion.div>
      </button>

      {/* Soft contact shadow */}
      <motion.div
        aria-hidden
        className="mt-0.5 h-2 w-24 rounded-[100%] bg-ink/25 blur-md"
        {...(!reduceMotion && {
          animate: { scaleX: [1, 0.9, 1], opacity: [0.28, 0.2, 0.28] },
          transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
        })}
      />
    </div>
  );
});

// Walk waddle (or gentle idle bob when standing). Reduced-motion: static.
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
    return <div className="h-36 w-36 sm:h-40 sm:w-40">{children}</div>;
  return (
    <motion.div
      className="h-36 w-36 drop-shadow-[var(--shadow-duck)] sm:h-40 sm:w-40"
      animate={
        walking
          ? { y: [0, -3, 0, -3, 0], rotate: [-3, 3, -3] }
          : { y: [0, -6, 0] }
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
