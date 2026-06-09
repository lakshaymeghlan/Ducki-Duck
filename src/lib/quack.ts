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

/** Play a single quack. Debounced so rapid clicks don't get harsh. */
export function quack(): void {
  const audio = getContext();
  if (!audio) return;

  const now = audio.currentTime;
  // Debounce: ignore quacks within ~70ms of the previous one.
  if (now - lastQuack < 0.07) return;
  lastQuack = now;

  // Slight random variation so no two quacks are identical.
  const variation = 0.85 + Math.random() * 0.3; // 0.85–1.15
  const startFreq = 320 * variation;
  const endFreq = 130 * variation;
  const dur = 0.18;

  // Source: sawtooth gives the buzzy, reedy vowel of a quack.
  const osc = audio.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

  // Band-pass carves a vocal-ish formant out of the buzz.
  const bandpass = audio.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(1200 * variation, now);
  bandpass.frequency.exponentialRampToValueAtTime(700 * variation, now + dur);
  bandpass.Q.value = 6;

  // Gentle high cut so it isn't fizzy.
  const lowpass = audio.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 3500;

  // Amplitude envelope: quick attack, short decay — a little "quack" blip.
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(bandpass);
  bandpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(audio.destination);

  osc.start(now);
  osc.stop(now + dur + 0.02);
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
