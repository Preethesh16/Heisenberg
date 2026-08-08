// Sarvam STT (saarika). The ear — transcribes and nothing else (CLAUDE.md).
// Field names follow Sarvam's public docs; if a request 4xxs once the venue
// key arrives, fix them here — no other file changes.

const STT_URL = process.env.SARVAM_STT_URL || "https://api.sarvam.ai/speech-to-text";
const LANG = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" };

export async function transcribe(buffer, mimetype = "audio/webm", lang = "en") {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("SARVAM_API_KEY not set");

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimetype }), "audio.webm");
  form.append("model", process.env.SARVAM_STT_MODEL || "saarika:v2.5");
  form.append("language_code", LANG[lang] || "unknown");

  const res = await fetch(STT_URL, {
    method: "POST",
    headers: { "api-subscription-key": key },
    body: form,
  });
  if (!res.ok) throw new Error(`sarvam ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  return { text: data.transcript ?? data.text ?? "", lang };
}
