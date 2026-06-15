// bark.ts — a dog "woof woof".
//
// Default: synthesized with the Web Audio API (no asset) — a sawtooth tone
// pitched down fast, mixed with a short noise burst through formant filters,
// which reads like a bark. Optional exact sound: drop public/bark.mp3 (or
// .wav / .ogg) and it's used instead.

let ctx: AudioContext | null = null;
let lastBark = 0;
let noiseBuffer: AudioBuffer | null = null;

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
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function getNoise(audio: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const len = Math.floor(audio.sampleRate * 0.2);
    noiseBuffer = audio.createBuffer(1, len, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

async function tryLoadCustom(audio: AudioContext): Promise<void> {
  if (triedCustom) return;
  triedCustom = true;
  for (const url of ["/bark.mp3", "/bark.wav", "/bark.ogg"]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      customBuffer = await audio.decodeAudioData(await res.arrayBuffer());
      return;
    } catch {
      /* try the next */
    }
  }
}

/** Call once on the first user gesture to unlock + warm up audio. */
export function unlockAudio(): void {
  const audio = getContext();
  if (audio) tryLoadCustom(audio);
}

// One "woof": a low sawtooth that drops in pitch, plus a short filtered noise
// burst for the breathy attack.
function oneWoof(
  audio: AudioContext,
  t0: number,
  variation: number,
  level: number
): void {
  const dur = 0.19;

  const osc = audio.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(270 * variation, t0);
  osc.frequency.exponentialRampToValueAtTime(110 * variation, t0 + 0.05);
  osc.frequency.exponentialRampToValueAtTime(85 * variation, t0 + dur);

  const formant = audio.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.value = 900 * variation;
  formant.Q.value = 2.5;

  const lowpass = audio.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 2200;

  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(level, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(level * 0.5, t0 + 0.07);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(formant);
  formant.connect(lowpass);
  lowpass.connect(env);
  env.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);

  // Breathy noise transient at the attack.
  const noise = audio.createBufferSource();
  noise.buffer = getNoise(audio);
  const nbp = audio.createBiquadFilter();
  nbp.type = "bandpass";
  nbp.frequency.value = 1400 * variation;
  nbp.Q.value = 0.8;
  const nenv = audio.createGain();
  nenv.gain.setValueAtTime(level * 0.5, t0);
  nenv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
  noise.connect(nbp);
  nbp.connect(nenv);
  nenv.connect(audio.destination);
  noise.start(t0);
  noise.stop(t0 + 0.08);
}

/** Play a dog "woof woof". Debounced for rapid clicks. */
export function bark(): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  if (now - lastBark < 0.2) return;
  lastBark = now;

  if (customBuffer) {
    const src = audio.createBufferSource();
    src.buffer = customBuffer;
    const g = audio.createGain();
    g.gain.value = 0.9;
    src.connect(g);
    g.connect(audio.destination);
    src.start();
    return;
  }

  const variation = 0.92 + Math.random() * 0.18;
  oneWoof(audio, now, variation, 0.3);
  oneWoof(audio, now + 0.22, variation * 0.96, 0.26);
}

const BARK_VARIANTS = [
  "woof",
  "woof woof",
  "woof woof woof",
  "...woof?",
  "WOOF!",
  "arf",
  "bork",
  "awoo",
];

export function randomBarkVariant(): string {
  return BARK_VARIANTS[Math.floor(Math.random() * BARK_VARIANTS.length)];
}
