// platform.ts — tell whether we're running inside the Tauri desktop shell
// (vs a plain browser). Tauri v2 injects `__TAURI_INTERNALS__` into window.

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}
