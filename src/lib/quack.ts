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

// One real-duck "quack": a sawtooth with a fast downward pitch sweep through a
// band-pass formant, shaped by a short amplitude envelope. Cartoonish + reedy,
// the classic quack vowel.
function oneQuack(
  audio: AudioContext,
  t0: number,
  variation: number,
  level: number
): void {
  const dur = 0.16;
  const startFreq = 320 * variation;
  const endFreq = 130 * variation;

  const osc = audio.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(startFreq, t0);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);

  const bandpass = audio.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(1200 * variation, t0);
  bandpass.frequency.exponentialRampToValueAtTime(700 * variation, t0 + dur);
  bandpass.Q.value = 6;

  const lowpass = audio.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 3500;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(level, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(level * 0.45, t0 + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(bandpass);
  bandpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(audio.destination);

  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Play a real duck "quack quack" — two quacks. Debounced for rapid clicks. */
export function quack(): void {
  const audio = getContext();
  if (!audio) return;

  const now = audio.currentTime;
  // The full "quack quack" is ~0.35s; don't retrigger too fast.
  if (now - lastQuack < 0.2) return;
  lastQuack = now;

  // Slight random variation so no two quacks are identical.
  const variation = 0.9 + Math.random() * 0.25;
  oneQuack(audio, now, variation, 0.26);
  oneQuack(audio, now + 0.19, variation * 1.04, 0.24);
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
