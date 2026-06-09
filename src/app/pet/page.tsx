"use client";

import { useCallback, useRef } from "react";
import { Duck, type DuckHandle } from "@/components/Duck";
import { useReminders } from "@/hooks/useReminders";
import type { Reminder } from "@/lib/reminders";
import { sendNotification } from "@/lib/notify";

// The floating desktop pet: just the duck, transparent background, draggable.
// This window owns the reminder firing loop, so the duck nudges you (quack +
// native notification) wherever it's sitting on your screen — no banner here,
// the OS notification is the nudge.
export default function Pet() {
  const duckRef = useRef<DuckHandle>(null);

  const handleFire = useCallback((r: Reminder) => {
    duckRef.current?.react();
    sendNotification(`🦆 ${r.emoji} ${r.label}`, "quack.");
  }, []);

  useReminders({ onFire: handleFire, fireEnabled: true });

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-transparent">
      <Duck ref={duckRef} dragRegion />
    </div>
  );
}
