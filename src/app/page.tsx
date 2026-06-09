"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type DuckHandle } from "@/components/Duck";
import { DuckScene } from "@/components/DuckScene";
import { DebugPanel } from "@/components/DebugPanel";
import { Agenda } from "@/components/Agenda";
import { Banner, type BannerData } from "@/components/Banner";
import { Clock } from "@/components/Clock";
import { useReminders } from "@/hooks/useReminders";
import type { Reminder } from "@/lib/reminders";
import { loadBugCount, saveBugCount } from "@/lib/storage";
import {
  requestNotificationPermission,
  sendNotification,
} from "@/lib/notify";
import { isTauri } from "@/lib/platform";

export default function Home() {
  const duckRef = useRef<DuckHandle>(null);
  const [banner, setBanner] = useState<BannerData | null>(null);
  const bannerTimer = useRef<number | null>(null);
  const [bugCount, setBugCount] = useState(0);

  useEffect(() => {
    setBugCount(loadBugCount());
  }, []);

  const showBanner = useCallback((emoji: string, label: string) => {
    const data: BannerData = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      label,
    };
    setBanner(data);
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current);
    // Auto-dismiss after ~8s.
    bannerTimer.current = window.setTimeout(() => setBanner(null), 8000);
  }, []);

  // When a reminder fires: duck quacks + animates, banner slides down,
  // and (if allowed) a native notification goes out.
  const handleFire = useCallback(
    (r: Reminder) => {
      duckRef.current?.react();
      showBanner(r.emoji, r.label);
      sendNotification(`🦆 ${r.emoji} ${r.label}`, "quack.");
    },
    [showBanner]
  );

  // In the Tauri desktop shell this is the agenda window; the floating duck
  // window runs the firing loop, so we disable it here to avoid double-fires.
  // Standalone web is a single window, so it fires normally.
  const [desktop, setDesktop] = useState(false);
  useEffect(() => setDesktop(isTauri()), []);

  const { reminders, addReminder, toggleReminder, deleteReminder } =
    useReminders({ onFire: handleFire, fireEnabled: !desktop });

  // Lazily ask for notification permission on the first reminder added.
  const handleAdd = useCallback(
    (draft: Omit<Reminder, "id" | "enabled" | "lastFired">) => {
      requestNotificationPermission();
      addReminder(draft);
    },
    [addReminder]
  );

  // Rubber-duck debugging: the duck only ever replies `quack.`
  const handleExplain = useCallback(() => {
    duckRef.current?.react("quack.");
    setBugCount((c) => {
      const next = c + 1;
      saveBugCount(next);
      return next;
    });
  }, []);

  return (
    <div className="water-bg flex min-h-screen flex-col">
      <Banner banner={banner} onDismiss={() => setBanner(null)} />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-3xl" aria-hidden>
            🦆
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">
            ducki-duck
          </h1>
        </div>
        <Clock />
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 items-start gap-8 px-5 py-8 lg:grid-cols-[1fr_minmax(360px,420px)]">
        {/* Hero: the duck */}
        <section className="flex flex-col items-center justify-center gap-4 lg:sticky lg:top-8">
          <DuckScene
            ref={duckRef}
            layEnabled={!desktop}
            onAddReminder={handleAdd}
          />
          <p className="max-w-xs text-center text-sm text-ink-soft">
            Click to quack · right-click for reminders · it lays eggs you can pop.
          </p>
        </section>

        {/* Panels */}
        <div className="flex flex-col gap-6">
          <DebugPanel onExplain={handleExplain} bugCount={bugCount} />
          <Agenda
            reminders={reminders}
            onAdd={handleAdd}
            onToggle={toggleReminder}
            onDelete={deleteReminder}
          />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 pb-6 text-center text-sm text-ink-soft">
        It just quacks. Forever. By design.
      </footer>
    </div>
  );
}
