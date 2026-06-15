// notify.ts — platform-aware native notifications.
//   • In the Tauri desktop shell: use the Tauri notification plugin, so the
//     duck nudges you even when its window isn't focused.
//   • In a plain browser: use the Web Notifications API.
// Permission is requested lazily (on the first reminder added). If denied or
// unsupported, callers silently fall back to the in-app banner.

import { isTauri } from "./platform";

function webSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Ask for permission once, lazily. Safe to call repeatedly. */
export async function requestNotificationPermission(): Promise<void> {
  try {
    if (isTauri()) {
      const { isPermissionGranted, requestPermission } = await import(
        "@tauri-apps/plugin-notification"
      );
      if (!(await isPermissionGranted())) {
        await requestPermission();
      }
      return;
    }
    if (webSupported() && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    /* ignore — we'll fall back to the in-app banner */
  }
}

/** Fire a native notification if allowed; no-op otherwise. */
export async function sendNotification(
  title: string,
  body: string
): Promise<void> {
  try {
    if (isTauri()) {
      const { isPermissionGranted, requestPermission, sendNotification } =
        await import("@tauri-apps/plugin-notification");
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (granted) sendNotification({ title, body });
      return;
    }
    if (webSupported() && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/dog-icon.svg" });
    }
  } catch {
    /* ignore */
  }
}
