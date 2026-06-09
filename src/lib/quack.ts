// quack.ts — synthesize a cartoonish duck quack with the Web Audio API.
// No audio files: a sawtooth with a fast downward pitch sweep through a
// band-pass filter, shaped by a short amplitude envelope. Tiny random
// pitch variation per quack keeps it from sounding mechanical.

let ctx: AudioContext | null = null;
let lastQuack = 0;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  // Browsers block audio until a user gesture; resume lazily.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Call once on the first user gesture to unlock audio. */
export function unlockAudio(): void {
  getContext();
}

// One blocky "bawk" cluck note: a square wave with a quick up-then-down pitch
// contour through a band-pass, softened by a low-pass. Square gives the chunky,
// 8-bit Minecraft timbre.
function cluck(
  audio: AudioContext,
  t0: number,
  base: number,
  level: number
): void {
  const dur = 0.12;

  const osc = audio.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(base * 0.78, t0);
  osc.frequency.exponentialRampToValueAtTime(base * 1.3, t0 + 0.028);
  osc.frequency.exponentialRampToValueAtTime(base * 0.55, t0 + dur);

  // A touch of triangle underneath for body.
  const sub = audio.createOscillator();
  sub.type = "triangle";
  sub.frequency.setValueAtTime(base * 0.5, t0);
  sub.frequency.exponentialRampToValueAtTime(base * 0.34, t0 + dur);

  const bandpass = audio.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = base * 2.1;
  bandpass.Q.value = 4.5;

  const lowpass = audio.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 2600;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(level, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(level * 0.5, t0 + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(bandpass);
  sub.connect(bandpass);
  bandpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(audio.destination);

  osc.start(t0);
  sub.start(t0);
  osc.stop(t0 + dur + 0.02);
  sub.stop(t0 + dur + 0.02);
}

/** Play a chicken-y double cluck ("ba-gawk"). Debounced for rapid clicks. */
export function quack(): void {
  const audio = getContext();
  if (!audio) return;

  const now = audio.currentTime;
  // Debounce: the full two-note cluck is ~0.25s, so don't retrigger too fast.
  if (now - lastQuack < 0.16) return;
  lastQuack = now;

  // Slight random variation so no two clucks are identical.
  const variation = 0.9 + Math.random() * 0.2; // 0.9–1.1
  const base = 300 * variation;

  // Two syllables: a lower "ba" then a higher "gawk".
  cluck(audio, now, base * 0.85, 0.22);
  cluck(audio, now + 0.12, base * 1.18, 0.26);
}

const QUACK_VARIANTS = [
  "quack",
  "quack quack",
  "quack quack quack",
  "...quack?",
  "QUACK!",
  "quack…",
  "quaaack",
  "quack quack?",
];

export function randomQuackVariant(): string {
  return QUACK_VARIANTS[Math.floor(Math.random() * QUACK_VARIANTS.length)];
}
