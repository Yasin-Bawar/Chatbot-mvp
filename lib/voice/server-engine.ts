"use client";

/**
 * Voice through this app's server (lib/server/voice.ts):
 * - speaking: each sentence becomes an MP3 from /api/speech/tts (ElevenLabs),
 *   fetched ahead of time while the previous sentence plays;
 * - listening: the microphone is watched for speech (a simple loudness
 *   detector). When the student starts talking we report it at once (so the
 *   teacher can stop), record until they pause, and send the recording to
 *   /api/speech/stt (Groq Whisper or ElevenLabs Scribe).
 */

import type { Listener } from "./engines";

/* ---------- audio playback ---------- */

let player: HTMLAudioElement | null = null;

/** A 0.05 s silent WAV, to unlock audio playback inside a tap (needed on iPhones). */
function silentWav(): string {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/** Call inside the "start lesson" tap, before anything async. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  player ??= new Audio();
  player.src = silentWav();
  player.play().catch(() => {});
}

export interface ServerSpeaker {
  prefetch: (text: string) => void;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  isSpeaking: () => boolean;
  lastError: () => string;
}

export function serverSpeaker(): ServerSpeaker {
  const audio = (player ??= new Audio());
  const cache = new Map<string, Promise<string | null>>();
  const controllers = new Set<AbortController>();
  let epoch = 0;
  let speaking = false;
  let finish: (() => void) | null = null;
  let error = "";

  const load = (text: string) => {
    let p = cache.get(text);
    if (!p) {
      const c = new AbortController();
      controllers.add(c);
      p = fetch("/api/speech/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: c.signal,
      })
        .then(async (r) => {
          if (!r.ok) {
            const body = (await r.json().catch(() => null)) as { error?: string } | null;
            error = body?.error ?? "صدای معلم ساخته نشد.";
            return null;
          }
          error = "";
          return URL.createObjectURL(await r.blob());
        })
        .catch(() => null)
        .finally(() => controllers.delete(c));
      cache.set(text, p);
    }
    return p;
  };

  return {
    prefetch: (text) => void load(text),
    async speak(text) {
      const mine = epoch;
      const url = await load(text);
      cache.delete(text);
      if (!url) return;
      if (mine !== epoch) {
        URL.revokeObjectURL(url);
        return;
      }
      await new Promise<void>((resolve) => {
        speaking = true;
        const done = () => {
          if (finish !== done) return;
          finish = null;
          speaking = false;
          audio.onended = null;
          audio.onerror = null;
          URL.revokeObjectURL(url);
          resolve();
        };
        finish = done;
        audio.onended = done;
        audio.onerror = done;
        audio.src = url;
        audio.play().catch(done);
      });
    },
    stopSpeaking() {
      epoch++;
      controllers.forEach((c) => c.abort());
      controllers.clear();
      for (const p of cache.values()) void p.then((u) => u && URL.revokeObjectURL(u));
      cache.clear();
      audio.pause();
      finish?.();
    },
    isSpeaking: () => speaking,
    lastError: () => error,
  };
}

/* ---------- listening ---------- */

const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

export interface ServerListener {
  listen: (l: Listener) => Promise<void>;
  stopListening: () => void;
}

/** `teacherTalking` raises the bar while the teacher's own voice plays (less echo). */
export function serverListener(teacherTalking: () => boolean): ServerListener {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let recorder: MediaRecorder | null = null;

  const stopListening = () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    recorder = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    void ctx?.close().catch(() => {});
    ctx = null;
  };

  return {
    async listen(l) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        l.onError("اجازه استفاده از میکروفون داده نشد.");
        return;
      }
      const mime = RECORDING_TYPES.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);

      let noise = 0.008;
      let talking = false;
      let loudMs = 0;
      let quietMs = 0;
      let startedAt = 0;
      let chunks: Blob[] = [];
      const STEP = 50;

      const send = (blob: Blob, ms: number) => {
        if (ms < 450 || blob.size < 1500) {
          l.onPartial("");
          return;
        }
        const form = new FormData();
        form.append("audio", blob, "speech");
        fetch("/api/speech/stt", { method: "POST", body: form })
          .then(async (r) => {
            const data = (await r.json().catch(() => ({}))) as { text?: string; error?: string };
            if (!r.ok) throw new Error(data.error ?? "صدای شما به متن تبدیل نشد.");
            l.onPartial("");
            if (data.text?.trim()) l.onFinal(data.text.trim());
          })
          .catch((e: Error) => {
            l.onPartial("");
            l.onError(e.message || "صدای شما به متن تبدیل نشد.");
          });
      };

      const stopRecording = () => {
        const r = recorder;
        recorder = null;
        if (!r || r.state === "inactive") return;
        const ms = Date.now() - startedAt;
        r.onstop = () => send(new Blob(chunks, { type: r.mimeType || mime || "audio/webm" }), ms);
        r.stop();
      };

      timer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += v * v;
        const rms = Math.sqrt(sum / samples.length);
        const echo = teacherTalking();
        const threshold = Math.max(0.018, noise * 3) * (echo ? 2.2 : 1);

        if (!talking) {
          if (rms > threshold) {
            loudMs += STEP;
            if (loudMs >= (echo ? 250 : 120)) {
              talking = true;
              quietMs = 0;
              startedAt = Date.now();
              chunks = [];
              if (stream && typeof MediaRecorder !== "undefined") {
                recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
                recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
                recorder.start();
              }
              l.onSpeechStart?.();
              l.onPartial("…");
            }
          } else {
            loudMs = 0;
            noise = noise * 0.95 + rms * 0.05; // learn the room's background noise
          }
          return;
        }
        // Talking: end the turn after a pause, or after 30 s.
        if (rms < threshold * 0.7) quietMs += STEP;
        else quietMs = 0;
        if (quietMs >= 800 || Date.now() - startedAt > 30000) {
          talking = false;
          loudMs = 0;
          stopRecording();
        }
      }, STEP);
    },
    stopListening,
  };
}
