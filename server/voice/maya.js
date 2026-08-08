// Maya TTS (Maya 2). The voice — decides how Chintu sounds, never what he says
// (CLAUDE.md). Spec: docs.mayaresearch.ai — POST /v1/tts, Bearer auth, response
// is headerless raw PCM (16-bit LE, mono, 24 kHz). Browsers can't play bare
// PCM, so we wrap it in a WAV header and return a data URL; same-origin data
// URLs also keep the lip-sync analyser working (ULTA-DESIGN §39).

const TTS_URL = process.env.MAYA_TTS_URL || "https://tts.mayaresearch.ai/v1/tts";

// Exactly two voices exist: "Ananya" and "Arjun", case-sensitive — the model
// interpolates unknown names into garbage rather than erroring.
const VOICE = process.env.MAYA_VOICE || "Arjun";

// "Maya 2 Native Emotional" honours inline [tag]s. Language is deliberately
// omitted from requests: auto-detect is the documented path for code-mixed
// Hinglish, which is exactly how Chintu talks.
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

function pcmToWavDataUrl(pcm) {
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

  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ text: tagged, voice: VOICE, model: MODEL }),
  });
  if (!res.ok) throw new Error(`maya ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const pcm = Buffer.from(await res.arrayBuffer());
  if (pcm.length === 0) throw new Error("maya: empty audio");
  return pcmToWavDataUrl(pcm);
}
