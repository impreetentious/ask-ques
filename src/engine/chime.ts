/**
 * Three notes and a fourth an octave up, synthesised on the spot.
 *
 * No audio file, nothing preloaded, and it only ever runs inside the click that
 * answers yes — which is a user gesture, so no browser has to block it and
 * nobody gets ambushed by sound on load.
 */

/** C5 · E5 · G5 · C6 — a plain major arpeggio, which is the point. */
const NOTES = [523.25, 659.25, 783.99, 1046.5];
const SPACING = 0.085;
const DECAY = 0.9;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: AudioContextCtor };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

export function playChime(): void {
  const Ctor = audioContextCtor();
  if (!Ctor) return;

  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return;
  }

  const master = ctx.createGain();
  master.gain.value = 0.16;
  master.connect(ctx.destination);

  const start = ctx.currentTime + 0.01;

  NOTES.forEach((frequency, index) => {
    const at = start + index * SPACING;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(1, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + DECAY);
    gain.connect(master);

    // Two oscillators a few cents apart: one alone sounds like a test tone.
    for (const [type, detune, level] of [
      ['triangle', 0, 1],
      ['sine', 7, 0.6],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      const trim = ctx.createGain();
      trim.gain.value = level;
      osc.connect(trim).connect(gain);
      osc.start(at);
      osc.stop(at + DECAY + 0.05);
    }
  });

  const total = (start - ctx.currentTime + NOTES.length * SPACING + DECAY + 0.3) * 1000;
  globalThis.setTimeout(() => void ctx.close().catch(() => {}), total);
}
