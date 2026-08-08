// Maya TTS (Maya1). The voice — decides how Chintu sounds, never what he says
// (CLAUDE.md). Endpoint and field names follow Maya's public docs; if a request
// 4xxs once the venue key arrives, fix them here — no other file changes.

const TTS_URL = process.env.MAYA_TTS_URL || "https://v3.mayaresearch.ai/v1/tts/generate";

// One string = one voice. Reusing it verbatim every call is what keeps Chintu
// sounding like the same person. Do not tweak mid-demo.
const CHINTU_VOICE =
  "Young Indian male student, late teens, Indian English accent, energetic, slightly nasal, casual conversational tone";

// Agent 2 emotion → Maya inline emotion tag. Speaking emotions only; the rest
// read fine untagged.
const TAG = {
  stubborn: "<angry>",
  confused: "<sigh>",
  surprised: "<gasp>",
  happy: "<laugh>",
  convinced: "<laugh>",
};

export async function speak(text, emotion) {
  const key = process.env.MAYA_API_KEY;
  if (!key) throw new Error("MAYA_API_KEY not set");
  if (!text) throw new Error("no text to speak");

  const tagged = TAG[emotion] ? `${TAG[emotion]} ${text}` : text;

  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": key },
    body: JSON.stringify({
      text: tagged,
      voice_description: CHINTU_VOICE,
      output_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`maya ${res.status}: ${(await res.text()).slice(0, 200)}`);

  // Always return a data URL: cross-origin audio makes the lip-sync analyser
  // read zeros (ULTA-DESIGN §39), and data URLs sidestep CORS entirely.
  const type = res.headers.get("content-type") || "";
  if (type.includes("json")) {
    const data = await res.json();
    const b64 = data.audio ?? data.audio_base64 ?? data.data;
    if (b64) return `data:audio/mpeg;base64,${b64}`;
    const remote = data.audio_url ?? data.audioUrl;
    if (remote) {
      // Remote URL → fetch server-side and inline it, for the same CORS reason.
      const audio = await fetch(remote);
      const buf = Buffer.from(await audio.arrayBuffer());
      return `data:audio/mpeg;base64,${buf.toString("base64")}`;
    }
    throw new Error("maya: unrecognised response shape");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:audio/mpeg;base64,${buf.toString("base64")}`;
}
