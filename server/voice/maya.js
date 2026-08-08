// Maya TTS (Maya 2). The voice — decides how Chintu sounds, never what he says
// (CLAUDE.md). Spec verified live on event day (docs.mayaresearch.ai):
// POST /v1/tts, Bearer auth, response is headerless raw PCM (16-bit LE, mono,
// 24 kHz). Browsers can't play bare PCM, so we wrap it in a WAV header and
// return a data URL; same-origin data URLs also keep the lip-sync analyser
// working (ULTA-DESIGN §39).

import { fetchWithDeadline } from "../lib/http.js";

const TTS_URL = process.env.MAYA_TTS_URL || "https://tts.mayaresearch.ai/v1/tts";
const TIMEOUT_MS = Number(process.env.MAYA_TIMEOUT_MS) || 30000;

// Exactly two voices exist: "Ananya" and "Arjun", case-sensitive — the model
// interpolates unknown names into garbage rather than erroring, so anything
// else normalizes to Arjun with a loud warning at startup.
const ALLOWED_VOICES = new Set(["Ananya", "Arjun"]);
const configuredVoice = process.env.MAYA_VOICE || "Arjun";
const VOICE = ALLOWED_VOICES.has(configuredVoice) ? configuredVoice : "Arjun";
if (!ALLOWED_VOICES.has(configuredVoice)) {
  console.warn(`[maya] MAYA_VOICE "${configuredVoice}" is not a Maya voice (Ananya | Arjun, case-sensitive) — using Arjun`);
}
if (process.env.MAYA_VOICE_ID) {
  console.warn("[maya] MAYA_VOICE_ID is obsolete — set MAYA_VOICE=Ananya|Arjun instead");
}

// "Maya 2 Native Emotional" is the only model honouring inline [tag]s. Language
// is deliberately omitted from requests: auto-detect is the documented path for
// code-mixed Hinglish, which is how Chintu talks.
const MODEL = process.env.MAYA_MODEL || "Maya 2 Native Emotional";

// Agent 2 emotion → Maya emotion tag (only tags Maya documents; the rest read
// fine untagged). convinced maps to [sighs] on purpose — the yield line is a
// softer register (ULTA-DESIGN §37), not a celebration.
const TAG = {
  stubborn: "[frustrated]",
  confused: "[curious]",
  surprised: "[excited]",
  happy: "[laughs]",
  convinced: "[sighs]",
};

const SAMPLE_RATE = 24000;

export function pcmToWavDataUrl(pcm) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return `data:audio/wav;base64,${Buffer.concat([header, pcm]).toString("base64")}`;
}

export async function speak(text, emotion) {
  const key = process.env.MAYA_API_KEY;
  if (!key) throw new Error("MAYA_API_KEY not set");
  if (!text) throw new Error("no text to speak");

  const tagged = TAG[emotion] ? `${TAG[emotion]} ${text}` : text;

  const res = await fetchWithDeadline(
    TTS_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ text: tagged, voice: VOICE, model: MODEL }),
    },
    TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`maya ${res.status}`);

  // Validate before wrapping: never WAV-wrap a JSON/HTML error body, and pass
  // through a response that is already a WAV container.
  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (type.includes("json") || type.includes("html")) {
    throw new Error(`maya returned ${type.split(";")[0] || "non-audio"} instead of audio`);
  }

  let pcm = Buffer.from(await res.arrayBuffer());
  if (pcm.length === 0) throw new Error("maya: empty audio");
  if (pcm.length >= 4 && pcm.toString("ascii", 0, 4) === "RIFF") {
    return `data:audio/wav;base64,${pcm.toString("base64")}`;
  }
  if (pcm.length % 2 === 1) {
    console.warn("[maya] odd PCM byte length — trimming trailing byte");
    pcm = pcm.subarray(0, pcm.length - 1);
  }
  return pcmToWavDataUrl(pcm);
}
