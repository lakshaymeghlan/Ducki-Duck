// quack.ts — a duck "quack quack".
//
// Default: synthesized with the Web Audio API (no asset needed) — a sawtooth
// glottal source through two vocal formant band-passes with a buzzy amplitude
// "rattle", which reads much more like a real duck than a plain beep.
//
// Optional exact sound: drop a real recording at public/quack.mp3 (or .wav /
// .ogg) and it's used instead — handy if you want a specific quack.

let ctx: AudioContext | null = null;
let lastQuack = 0;

let customBuffer: AudioBuffer | null = null;
let triedCustom = false;

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
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

// Look for an optional user-provided quack recording once, lazily.
async function tryLoadCustom(audio: AudioContext): Promise<void> {
  if (triedCustom) return;
  triedCustom = true;
  for (const url of ["/quack.mp3", "/quack.wav", "/quack.ogg"]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const arr = await res.arrayBuffer();
      customBuffer = await audio.decodeAudioData(arr);
      return;
    } catch {
      /* try the next extension */
    }
  }
}

/** Call once on the first user gesture to unlock + warm up audio. */
export function unlockAudio(): void {
  const audio = getContext();
  if (audio) tryLoadCustom(audio);
}

// One synthesized quack: a sawtooth glottal source pitched down a little,
// filtered through two vocal formants and given a buzzy AM "rattle".
function oneQuack(
  audio: AudioContext,
  t0: number,
  variation: number,
  level: number
): void {
  const dur = 0.2;
  const f0 = 300 * variation;

  const osc = audio.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(f0 * 1.15, t0);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.72, t0 + dur);

  // Two vocal formants give the nasal "aack" of a duck.
  const f1 = audio.createBiquadFilter();
  f1.type = "bandpass";
  f1.frequency.value = 720 * variation;
  f1.Q.value = 7;
  const f2 = audio.createBiquadFilter();
  f2.type = "bandpass";
  f2.frequency.value = 2250 * variation;
  f2.Q.value = 10;

  const mix = audio.createGain();
  osc.connect(f1);
  f1.connect(mix);
  osc.connect(f2);
  f2.connect(mix);

  // Buzzy "rattle": modulate amplitude with a ~55 Hz LFO.
  const am = audio.createGain();
  am.gain.value = 0.7;
  const lfo = audio.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 55;
  const lfoGain = audio.createGain();
  lfoGain.gain.value = 0.35;
  lfo.connect(lfoGain);
  lfoGain.connect(am.gain);

  // Amplitude envelope: quick attack, short decay.
  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(level, t0 + 0.015);
  env.gain.exponentialRampToValueAtTime(level * 0.5, t0 + 0.07);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  mix.connect(am);
  am.connect(env);
  env.connect(audio.destination);

  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  lfo.start(t0);
  lfo.stop(t0 + dur + 0.02);
}

function playCustom(audio: AudioContext): void {
  if (!customBuffer) return;
  const src = audio.createBufferSource();
  src.buffer = customBuffer;
  const g = audio.createGain();
  g.gain.value = 0.9;
  src.connect(g);
  g.connect(audio.destination);
  src.start();
}

/** Play a duck "quack quack". Debounced for rapid clicks. */
export function quack(): void {
  const audio = getContext();
  if (!audio) return;

  const now = audio.currentTime;
  if (now - lastQuack < 0.2) return;
  lastQuack = now;

  // A user-provided recording wins, if present.
  if (customBuffer) {
    playCustom(audio);
    return;
  }

  // Otherwise synthesize two quacks: "quack quack".
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
