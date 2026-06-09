"use client";

import { useEffect, useState } from "react";

// Live clock in the header so the app feels alive.
export function Clock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="rounded-full bg-white/70 px-4 py-1.5 font-[family-name:var(--font-display)] text-lg font-semibold tabular-nums text-ink shadow-[var(--shadow-soft)] backdrop-blur"
      aria-label="Current time"
    >
      {time || "--:--"}
    </div>
  );
}
