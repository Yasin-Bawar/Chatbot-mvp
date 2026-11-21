"use client";

/**
 * Hearing and speaking for the voice teachers. Two engines:
 * - "azure": Microsoft Azure Speech (natural Persian voice and recognition).
 *   Used when the server has AZURE_SPEECH_KEY and AZURE_SPEECH_REGION; the
 *   browser only gets a short-lived token from /api/speech/token.
 * - "browser": the browser's own speech, free. Listening works in Chrome and
 *   Edge; a Persian voice is built into Edge (and some phones).
 */

export interface Listener {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}

export interface VoiceEngine {
  kind: "azure" | "browser";
  canListen: boolean;
  canSpeak: boolean;
  listen: (l: Listener) => Promise<void>;
  stopListening: () => void;
  /** Resolves when the sentence has been spoken (or was stopped). */
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  dispose: () => void;
}

const LANG = "fa-IR";

type TokenInfo = { provider: "azure"; token: string; region: string; voice: string } | { provider: "browser" };

export async function createVoiceEngine(): Promise<VoiceEngine> {
  const info = (await fetch("/api/speech/token", { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => ({ provider: "browser" }))) as TokenInfo;
  if (info.provider === "azure") {
    try {
      return await azureEngine(info.token, info.region, info.voice);
    } catch (err) {
      console.error("[voice] Azure failed, using the browser voice", err);
    }
  }
  return browserEngine();
}

/* ---------------- browser ---------------- */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

async function persianVoice(): Promise<SpeechSynthesisVoice | null> {
  if (typeof speechSynthesis === "undefined") return null;
  const pick = () => {
    const voices = speechSynthesis.getVoices();
    return (
      voices.find((v) => /^fa/i.test(v.lang) && /natural|online|neural/i.test(v.name)) ??
      voices.find((v) => /^fa/i.test(v.lang)) ??
      voices.find((v) => /^prs|^ps/i.test(v.lang)) ??
      null
    );
  };
  if (speechSynthesis.getVoices().length) return pick();
  // Voices load late in some browsers.
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 1500);
    speechSynthesis.addEventListener("voiceschanged", () => (clearTimeout(t), resolve()), { once: true });
  });
  return pick();
}

async function browserEngine(): Promise<VoiceEngine> {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  const voice = await persianVoice();
  let rec: Recognition | null = null;
  let active = false;
  let pending: (() => void)[] = [];

  const stopSpeaking = () => {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    const done = pending;
    pending = [];
    done.forEach((f) => f());
  };

  return {
    kind: "browser",
    canListen: Boolean(SR),
    canSpeak: Boolean(voice),
    async listen(l) {
      if (!SR) return;
      active = true;
      const start = () => {
        rec = new SR();
        rec.lang = LANG;
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e) => {
          let interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) l.onFinal(r[0].transcript);
            else interim += r[0].transcript;
          }
          l.onPartial(interim);
        };
        rec.onerror = (e) => {
          if (e.error === "not-allowed" || e.error === "service-not-allowed") {
            active = false;
            l.onError("اجازه استفاده از میکروفون داده نشد.");
          } else if (e.error === "network") {
            l.onError("شناختن صدا به انترنت نیاز دارد.");
          }
        };
        // Browsers stop listening after a while; keep going while the lesson is on.
        rec.onend = () => {
          if (active) setTimeout(() => active && start(), 250);
        };
        try {
          rec.start();
        } catch {
          // already started
        }
      };
      start();
    },
    stopListening() {
      active = false;
      rec?.abort();
      rec = null;
    },
    speak(text) {
      if (!voice) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = 0.95;
        const done = () => {
          pending = pending.filter((f) => f !== done);
          resolve();
        };
        pending.push(done);
        u.onend = done;
        u.onerror = done;
        speechSynthesis.speak(u);
      });
    },
    stopSpeaking,
    dispose() {
      active = false;
      rec?.abort();
      stopSpeaking();
    },
  };
}

/* ---------------- Azure ---------------- */

async function azureEngine(token: string, region: string, voiceName: string): Promise<VoiceEngine> {
  const sdk = await import("microsoft-cognitiveservices-speech-sdk");
  const config = sdk.SpeechConfig.fromAuthorizationToken(token, region);
  config.speechRecognitionLanguage = LANG;
  config.speechSynthesisVoiceName = voiceName;

  let recognizer: InstanceType<typeof sdk.SpeechRecognizer> | null = null;
  let current: { player: InstanceType<typeof sdk.SpeakerAudioDestination>; done: () => void } | null = null;

  // Tokens last 10 minutes; renew every 8.
  const refresh = setInterval(
    async () => {
      const info = (await fetch("/api/speech/token", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null)) as TokenInfo | null;
      if (info?.provider !== "azure") return;
      config.authorizationToken = info.token;
      if (recognizer) recognizer.authorizationToken = info.token;
    },
    8 * 60 * 1000,
  );

  const stopSpeaking = () => {
    const c = current;
    current = null;
    if (!c) return;
    try {
      c.player.pause();
      c.player.close();
    } catch {
      // already closed
    }
    c.done();
  };

  return {
    kind: "azure",
    canListen: true,
    canSpeak: true,
    async listen(l) {
      recognizer = new sdk.SpeechRecognizer(config, sdk.AudioConfig.fromDefaultMicrophoneInput());
      recognizer.recognizing = (_s, e) => l.onPartial(e.result.text);
      recognizer.recognized = (_s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) l.onFinal(e.result.text);
      };
      recognizer.canceled = (_s, e) => {
        if (e.reason === sdk.CancellationReason.Error) l.onError("صدا شنیده نشد. میکروفون یا انترنت را بررسی کنید.");
      };
      await new Promise<void>((resolve, reject) =>
        recognizer!.startContinuousRecognitionAsync(resolve, (e) => reject(new Error(e))),
      );
    },
    stopListening() {
      const r = recognizer;
      recognizer = null;
      r?.stopContinuousRecognitionAsync(
        () => r.close(),
        () => r.close(),
      );
    },
    speak(text) {
      return new Promise<void>((resolve) => {
        const player = new sdk.SpeakerAudioDestination();
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          if (current?.player === player) current = null;
          resolve();
        };
        player.onAudioEnd = done;
        current = { player, done };
        const synth = new sdk.SpeechSynthesizer(config, sdk.AudioConfig.fromSpeakerOutput(player));
        synth.speakTextAsync(
          text,
          (result) => {
            synth.close();
            if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) done();
          },
          () => {
            synth.close();
            done();
          },
        );
      });
    },
    stopSpeaking,
    dispose() {
      clearInterval(refresh);
      stopSpeaking();
      const r = recognizer;
      recognizer = null;
      r?.stopContinuousRecognitionAsync(
        () => r.close(),
        () => r.close(),
      );
    },
  };
}
