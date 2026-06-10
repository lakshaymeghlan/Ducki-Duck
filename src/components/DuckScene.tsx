"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Duck, type DuckHandle } from "./Duck";
import { useEggs } from "@/hooks/useEggs";
import { useBorderWalk, type WalkMode } from "@/hooks/useBorderWalk";
import {
  defaultEmoji,
  type Reminder,
  type ReminderType,
} from "@/lib/reminders";

type ReminderDraft = Omit<Reminder, "id" | "enabled" | "lastFired">;

interface DuckSceneProps {
  /** Whether this window lays eggs (only the primary window should). */
  layEnabled?: boolean;
  /**
   * Border-walking mode: "window" walks the viewport edge (web overlay),
   * "screen" walks the screen edge by moving the Tauri window, "off" stays put.
   */
  walkMode?: WalkMode;
  /** Add a reminder (used by the quick-add popover). */
  onAddReminder?: (draft: ReminderDraft) => void;
  /**
   * If provided, the right-click "Add reminder" calls this instead of opening
   * the popover — used by the tiny floating window to open the agenda window.
   */
  onRequestAgenda?: () => void;
}

const CONFETTI = ["#FFFFFF", "#F4C20D", "#E2922E", "#CC3A29", "#F1E6D0"];

interface Burst {
  id: number;
  x: number;
  y: number;
  parts: { dx: number; dy: number; rot: number; color: string }[];
}

// A small pixel egg.
function EggIcon() {
  return (
    <svg
      viewBox="0 0 12 16"
      className="h-full w-full"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <rect x="4" y="1" width="4" height="1" fill="#F7EFE0" />
      <rect x="3" y="2" width="6" height="2" fill="#F7EFE0" />
      <rect x="2" y="4" width="8" height="6" fill="#F1E6D0" />
      <rect x="2" y="10" width="8" height="4" fill="#E7D8B8" />
      <rect x="3" y="14" width="6" height="1" fill="#DFCBA4" />
      <rect x="3" y="3" width="2" height="2" fill="#FFFFFF" />
      <rect x="6" y="6" width="1" height="1" fill="#C9A24B" />
      <rect x="4" y="9" width="1" height="1" fill="#C9A24B" />
      <rect x="7" y="11" width="1" height="1" fill="#C9A24B" />
    </svg>
  );
}

export const DuckScene = forwardRef<DuckHandle, DuckSceneProps>(
  function DuckScene(
    { layEnabled = true, walkMode = "off", onAddReminder, onRequestAgenda },
    ref
  ) {
    const duckRef = useRef<DuckHandle>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();

    // Walk the border; pause while the user is petting the duck.
    const [hovered, setHovered] = useState(false);
    const { x, y, facing, walking } = useBorderWalk({
      mode: walkMode,
      paused: hovered,
      reduceMotion: !!reduceMotion,
    });
    const isWindowWalk = walkMode === "window";

    useImperativeHandle(
      ref,
      () => ({
        react: (line?: string) => duckRef.current?.react(line),
        say: (line: string) => duckRef.current?.say(line),
      }),
      []
    );

    const { eggs, popEgg } = useEggs({
      layEnabled,
      onPop: () => duckRef.current?.react(),
    });

    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const [quickAdd, setQuickAdd] = useState(false);
    const [bursts, setBursts] = useState<Burst[]>([]);
    const burstId = useRef(0);

    const openMenuAt = (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Clamp within the container so it doesn't overflow a small window.
      const x = Math.min(e.clientX - rect.left, rect.width - 170);
      const y = Math.min(e.clientY - rect.top, rect.height - 90);
      setMenu({ x: Math.max(0, x), y: Math.max(0, y) });
    };

    const handleAddReminderClick = () => {
      setMenu(null);
      if (onRequestAgenda) onRequestAgenda();
      else setQuickAdd(true);
    };

    const handlePop = (eggId: string, e: React.MouseEvent) => {
      const cont = containerRef.current?.getBoundingClientRect();
      const btn = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (cont) {
        const cx = btn.left - cont.left + btn.width / 2;
        const cy = btn.top - cont.top + btn.height / 2;
        const parts = Array.from({ length: 12 }, (_, i) => ({
          dx: Math.cos((i / 12) * Math.PI * 2) * (24 + Math.random() * 26),
          dy:
            Math.sin((i / 12) * Math.PI * 2) * (24 + Math.random() * 26) -
            10,
          rot: Math.random() * 360,
          color: CONFETTI[i % CONFETTI.length],
        }));
        const id = ++burstId.current;
        setBursts((b) => [...b, { id, x: cx, y: cy, parts }]);
        window.setTimeout(
          () => setBursts((b) => b.filter((x) => x.id !== id)),
          800
        );
      }
      popEgg(eggId);
    };

    return (
      <motion.div
        ref={containerRef}
        className={
          isWindowWalk
            ? "fixed left-0 top-0 z-50 flex flex-col items-center"
            : "relative flex flex-col items-center"
        }
        style={isWindowWalk ? { x, y } : undefined}
        onContextMenu={openMenuAt}
      >
        <Duck
          ref={duckRef}
          facing={facing}
          walking={walking}
          onHoverChange={setHovered}
        />

        {/* Eggs the duck has laid — click to pop */}
        {eggs.length > 0 && (
          <div className="mt-1 flex items-end justify-center gap-1.5">
            <AnimatePresence>
              {eggs.map((egg) => (
                <motion.button
                  key={egg.id}
                  type="button"
                  onClick={(e) => handlePop(egg.id, e)}
                  aria-label="Pop the egg"
                  className="h-7 w-5 cursor-pointer"
                  initial={{ scale: 0, y: -8 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0, rotate: 35, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  whileHover={{ y: -3, rotate: -4 }}
                >
                  <EggIcon />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Confetti bursts when eggs pop */}
        {bursts.map((b) => (
          <div
            key={b.id}
            className="pointer-events-none absolute z-20"
            style={{ left: b.x, top: b.y }}
          >
            {b.parts.map((p, i) => (
              <motion.span
                key={i}
                className="absolute h-1.5 w-1.5"
                style={{ backgroundColor: p.color }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{ x: p.dx, y: p.dy, opacity: 0, rotate: p.rot }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            ))}
          </div>
        ))}

        {/* Right-click menu */}
        <AnimatePresence>
          {menu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenu(null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu(null);
                }}
              />
              <motion.div
                className="absolute z-40 w-[170px] overflow-hidden rounded-xl border border-water/60 bg-white py-1 shadow-[var(--shadow-soft)]"
                style={{ left: menu.x, top: menu.y }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.12 }}
              >
                <button
                  type="button"
                  onClick={handleAddReminderClick}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-water/30"
                >
                  <span aria-hidden>➕</span> Add reminder
                </button>
                <div className="px-3 py-1.5 text-xs text-ink-soft">
                  🥚 Eggs laid: {eggs.length}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Quick-add reminder popover (web / agenda window) */}
        <AnimatePresence>
          {quickAdd && onAddReminder && (
            <QuickAdd
              onClose={() => setQuickAdd(false)}
              onAdd={(draft) => {
                onAddReminder(draft);
                setQuickAdd(false);
                duckRef.current?.react("quack.");
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);

// Compact reminder form shown in a popover from the duck's right-click menu.
function QuickAdd({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (draft: ReminderDraft) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ReminderType>("interval");
  const [emoji, setEmoji] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [time, setTime] = useState("18:00");
  const [datetime, setDatetime] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    const draft: ReminderDraft = {
      label: trimmed,
      type,
      emoji: emoji.trim() || defaultEmoji(type),
    };
    if (type === "interval") draft.intervalMinutes = Math.max(1, intervalMinutes);
    if (type === "daily") draft.time = time;
    if (type === "once") {
      if (!datetime) return;
      draft.datetime = datetime;
    }
    onAdd(draft);
  };

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <motion.form
        onSubmit={submit}
        className="absolute left-1/2 top-full z-40 flex w-72 max-w-[80vw] -translate-x-1/2 flex-col gap-2 rounded-2xl border border-water/60 bg-white p-4 shadow-[var(--shadow-soft)]"
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 26 }}
      >
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
          Add a reminder
        </p>
        <input
          autoFocus
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Drink water"
          maxLength={60}
          className="rounded-xl border border-water/70 bg-white px-3 py-2 text-sm outline-none focus:border-water-deep"
        />
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReminderType)}
            className="flex-1 rounded-xl border border-water/70 bg-white px-2 py-2 text-sm outline-none focus:border-water-deep"
          >
            <option value="interval">Every N min</option>
            <option value="daily">Daily at</option>
            <option value="once">Once at</option>
          </select>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="💧"
            maxLength={4}
            className="w-14 rounded-xl border border-water/70 bg-white px-2 py-2 text-center text-sm outline-none focus:border-water-deep"
          />
        </div>
        {type === "interval" && (
          <input
            type="number"
            min={1}
            max={1440}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            className="rounded-xl border border-water/70 bg-white px-3 py-2 text-sm outline-none focus:border-water-deep"
          />
        )}
        {type === "daily" && (
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-xl border border-water/70 bg-white px-3 py-2 text-sm outline-none focus:border-water-deep"
          />
        )}
        {type === "once" && (
          <input
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            className="rounded-xl border border-water/70 bg-white px-3 py-2 text-sm outline-none focus:border-water-deep"
          />
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-full bg-duck px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-ink"
          >
            Add
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </motion.form>
    </>
  );
}
