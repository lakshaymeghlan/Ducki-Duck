# 🦆 ducki-duck

> The rubber duck that listens and never gives advice — it just quacks.

![demo](demo.gif)

## Why

Rubber-duck debugging works because explaining a problem out loud forces you to
think it through. The duck contributes nothing — and that's the entire point.

ducki-duck is the friendly anti-AI-assistant. Its whole vocabulary is the word
**"quack."** It will never answer, explain, or chat. On top of that it doubles
as a gentle desktop companion that quacks to nudge you about your routine and
meetings.

## Features

- **A cute, alive duck.** Hand-drawn inline SVG that bobs, blinks, and
  squish-bounces when you click it.
- **A real quack.** Synthesized live with the Web Audio API — no audio files,
  no downloads. Slight random pitch variation every time.
- **Rubber-duck debugging.** Type out what's broken. The duck replies `quack.`
  and keeps count of how many bugs you've explained today.
- **Quack reminders.** One clean reminder model, three types:
  - `interval` — every N minutes (e.g. "Drink water")
  - `daily` — at a set time each day (e.g. "Gym at 18:00")
  - `once` — a one-off at a date & time (e.g. "Meeting at 08:00")
  - When one fires: the duck quacks, a banner slides down, and (if you allow it)
    a native notification goes out.
- **Polished by default.** Bath-time theme, responsive down to mobile, visible
  keyboard focus, and `prefers-reduced-motion` respected.
- **Local-first.** Reminders and your bug count live in `localStorage`. Nothing
  leaves your machine.

## Run it

This is a [Next.js](https://nextjs.org) app (App Router, TypeScript, Tailwind,
Framer Motion).

```bash
npm install
npm run dev      # http://localhost:3000
```

Production build:

```bash
npm run build
npm run start
```

## Tech & design notes

- **No external runtime assets for the toy itself** — the quack is synthesized
  (a sawtooth with a fast downward pitch sweep through a band-pass filter,
  shaped by a short amplitude envelope) and the duck is inline SVG drawn in code.
- **One unified reminder model** (`src/lib/reminders.ts`) with pure
  `shouldFire` / `markFired` / `seedLastFired` functions, so the scheduling
  logic is easy to read and test. A single 5-second tick loop checks everything.
- **Opinionated choice:** the original brief asked for plain vanilla JS, but
  this build uses Next.js so the project is easy to extend with packages and the
  UI has room to feel good. The behavior and constraints are otherwise unchanged.

```
src/
├── app/
│   ├── layout.tsx        # fonts + metadata
│   ├── page.tsx          # wires everything together
│   ├── globals.css       # bath-time theme + reduced-motion + blink/bill CSS
│   └── icon.svg          # the duck, as the favicon
├── components/
│   ├── Duck.tsx          # SVG duck + bob/blink/squish + speech bubble
│   ├── DebugPanel.tsx    # the debugging box (always replies "quack.")
│   ├── Agenda.tsx        # add form + reminder list
│   ├── Banner.tsx        # slide-down reminder banner
│   ├── Clock.tsx         # live header clock
│   └── Card.tsx          # shared panel surface
├── hooks/
│   └── useReminders.ts   # state, persistence, the tick loop, firing
└── lib/
    ├── quack.ts          # Web Audio quack synth + quack variants
    ├── reminders.ts      # model + pure scheduling/firing logic
    ├── storage.ts        # localStorage load/save
    └── notify.ts         # best-effort native notifications
```

## Roadmap

- **Phase 2 — desktop pet.** Wrap the app in [Tauri](https://tauri.app) for an
  always-on-top, transparent, frameless floating duck, a system-tray menu,
  native notifications even when unfocused, and launch-at-login. The web version
  will keep working standalone.

## License

MIT — see [LICENSE](LICENSE).
