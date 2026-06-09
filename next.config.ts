import type { NextConfig } from "next";

// Static export so the frontend can be bundled into the Tauri desktop app
// (Tauri serves the static `out/` directory). The web version still runs
// standalone with `npm run dev` / `npm run start` — this only shapes `build`.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Emit directory-style routes (out/pet/index.html) so Tauri's asset
  // resolver and `next dev` agree on the same URLs in both modes.
  trailingSlash: true,
};

export default nextConfig;
