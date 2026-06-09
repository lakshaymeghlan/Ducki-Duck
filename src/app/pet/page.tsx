"use client";

import { useCallback, useRef } from "react";
import { type DuckHandle } from "@/components/Duck";
import { DuckScene } from "@/components/DuckScene";
import { useReminders } from "@/hooks/useReminders";
import type { Reminder } from "@/lib/reminders";
import { sendNotification } from "@/lib/notify";

// The floating desktop pet: just the duck, transparent background, draggable.
// This window owns the reminder + egg loops, so the duck nudges you (quack +
// native notification) and lays eggs wherever it's sitting on your screen.
export default function Pet() {
  const duckRef = useRef<DuckHandle>(null);

  const handleFire = useCallback((r: Reminder) => {
    duckRef.current?.react();
    sendNotification(`🦆 ${r.emoji} ${r.label}`, "quack.");
  }, []);

  useReminders({ onFire: handleFire, fireEnabled: true });

  // Right-click "Add reminder" opens the full agenda window (the pet window
  // is too small for a form).
  const openAgenda = useCallback(async () => {
    try {
      const { WebviewWindow, getAllWebviewWindows } = await import(
        "@tauri-apps/api/webviewWindow"
      );
      const wins = await getAllWebviewWindows();
      const existing = wins.find((w) => w.label === "agenda");
      if (existing) {
        await existing.show();
        await existing.setFocus();
        return;
      }
      const win = new WebviewWindow("agenda", {
        url: "index.html",
        title: "ducki-duck — agenda",
        width: 920,
        height: 760,
        minWidth: 360,
        minHeight: 480,
      });
      win.once("tauri://error", (e) => console.error("agenda window", e));
    } catch (err) {
      console.error("openAgenda failed", err);
    }
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-transparent">
      <DuckScene ref={duckRef} dragRegion layEnabled onRequestAgenda={openAgenda} />
    </div>
  );
}
