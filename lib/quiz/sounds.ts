"use client";

/** Tiny game sounds made with WebAudio (no audio files to download). */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = "sine", volume = 0.18) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export function playCorrect() {
  tone(660, 0, 0.16, "triangle");
  tone(990, 0.1, 0.24, "triangle");
}

export function playWrong() {
  tone(220, 0, 0.22, "sawtooth", 0.08);
  tone(180, 0.12, 0.28, "sawtooth", 0.08);
}

export function playFinish() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, "triangle", 0.16));
}

export function vibrate(ms = 120) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // not supported
  }
}
