// Sarvam STT. The ear — transcribes and nothing else (CLAUDE.md).
// saarika:v2.5 is the live-verified default for today's demo. Sarvam's docs now
// mark it legacy and recommend saaras:v3 with a mode parameter — supported here
// behind SARVAM_STT_MODEL / SARVAM_STT_MODE, so the switch (and the rollback)
// is a .env change. Flip only after a live check, never mid-demo.

import { fetchWithDeadline } from "../lib/http.js";

const STT_URL = process.env.SARVAM_STT_URL || "https://api.sarvam.ai/speech-to-text";
const MODEL = process.env.SARVAM_STT_MODEL || "saarika:v2.5";
const MODE = process.env.SARVAM_STT_MODE || ""; // e.g. transcribe | codemix (saaras models only)
const TIMEOUT_MS = Number(process.env.SARVAM_TIMEOUT_MS) || 15000;

const LANG = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" };
const EXT = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/flac": "flac",
};

export async function transcribe(buffer, mimetype = "audio/webm", lang = "en") {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("SARVAM_API_KEY not set");

  const baseType = String(mimetype || "").split(";")[0].trim();
  const ext = EXT[baseType] || "webm";

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimetype }), `audio.${ext}`);
  form.append("model", MODEL);
  if (MODE && MODEL.startsWith("saaras")) form.append("mode", MODE);
  form.append("language_code", LANG[lang] || "unknown");

  const res = await fetchWithDeadline(
    STT_URL,
    { method: "POST", headers: { "api-subscription-key": key }, body: form },
    TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`sarvam ${res.status}`);

  const data = await res.json();
  // Blank transcripts are normalized to "" — the route turns that into the
  // fallback shape so the mic reveals the text input.
  return { text: String(data.transcript ?? data.text ?? "").trim(), lang };
}
