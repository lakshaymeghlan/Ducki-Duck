// notify.ts — best-effort native notifications. Permission is requested
// lazily (on the first reminder the user adds). If denied or unsupported,
// callers silently fall back to the in-app banner.

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Ask for permission once, lazily. Safe to call repeatedly. */
export function requestNotificationPermission(): void {
  if (!notificationsSupported()) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

/** Fire a native notification if allowed; no-op otherwise. */
export function sendNotification(title: string, body: string): void {
  if (!notificationsSupported()) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/duck-icon.svg" });
  } catch {
    /* some browsers throw if not from a SW context — ignore */
  }
}
