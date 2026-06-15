"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface BannerData {
  id: string;
  emoji: string;
  label: string;
}

interface BannerProps {
  banner: BannerData | null;
  onDismiss: () => void;
}

// Reminder banner that slides down from the top of the screen.
export function Banner({ banner, onDismiss }: BannerProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3">
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            initial={{ y: "-120%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-120%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="pointer-events-auto mt-3 flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-surface shadow-[var(--shadow-soft)]"
            role="alert"
          >
            <span className="text-2xl" aria-hidden>
              🐶
            </span>
            <span className="text-xl" aria-hidden>
              {banner.emoji}
            </span>
            <span className="flex-1 font-[family-name:var(--font-display)] text-lg font-medium">
              {banner.label}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss reminder"
              className="rounded-full px-2 py-0.5 text-2xl leading-none text-surface/70 transition-colors hover:text-surface"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
