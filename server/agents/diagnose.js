// Agent 1 — Diagnosis. Claude Vision in, CONTRACTS.md §2 Diagnosis shape out.
// misconception_id is validated against data/misconceptions/; anything the
// model invents, and any confidence below 0.6, degrades to UNKNOWN so the
// orchestrator can fall back to the demo default instead of guessing.
import { callClaude, parseJson } from "./claude.js";
import { loadMisconceptions, loadPrompt } from "./misconceptions.js";

export const MIN_CONFIDENCE = 0.6;
// A photo of a handwritten page is far bigger than this; anything smaller is a
// stub, a thumbnail, or corruption. Gate in code — on a near-blank image the
// vision model hallucinates handwriting rather than admitting it sees nothing.
export const MIN_IMAGE_BYTES = 10_000;

// The frontend normalizes uploads to JPEG, but never trust that: detect the
// real format from magic bytes and never label PNG/WebP bytes as JPEG.
// Returns an Anthropic-supported media type, or null for anything else.
export function detectImageMediaType(imageBase64) {
  let bytes;
  try {
    bytes = Buffer.from(String(imageBase64).slice(0, 32), "base64");
  } catch {
    return null;
  }
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}
export { loadMisconceptions };

function buildPrompt(byId, questionText) {
  const list = Object.values(byId)
    .map((m) => `- ${m.id} (${m.topic}): ${m.false_belief} Observable as: ${m.observable_evidence}`)
    .join("\n");
  return loadPrompt("diagnose")
    .replace("{{MISCONCEPTION_LIST}}", list)
    .replace("{{QUESTION_TEXT}}", questionText || "(not provided)");
}

const UNKNOWN = {
  topic: "Unknown",
  misconception_id: "UNKNOWN",
  misconception: "",
  evidence: "",
  confidence: 0,
  correct_model: "",
};

export async function diagnose({ imageBase64, questionText } = {}) {
  const byId = loadMisconceptions();

  // All input gates run before any provider call: missing/tiny/unsupported
  // input degrades to UNKNOWN for free.
  const b64 = typeof imageBase64 === "string"
    ? imageBase64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "")
    : "";
  const imageBytes = Math.floor(b64.length * 0.75);
  if (!b64 || imageBytes < MIN_IMAGE_BYTES) {
    return { ...UNKNOWN, evidence: "image missing or too small to contain a handwritten solution" };
  }
  const mediaType = detectImageMediaType(b64);
  if (!mediaType) {
    return { ...UNKNOWN, evidence: "unsupported or malformed image format" };
  }

  let raw;
  try {
    const text = await callClaude({
      system: buildPrompt(byId, questionText),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: b64 },
            },
            { type: "text", text: "Diagnose this handwritten solution." },
          ],
        },
      ],
    });
    raw = parseJson(text);
  } catch (err) {
    // Diagnosis failure is never an error screen — UNKNOWN triggers the demo default.
    return { ...UNKNOWN, evidence: `diagnosis unavailable: ${err.message}` };
  }

  const confidence = Number.isFinite(raw.confidence)
    ? Math.min(1, Math.max(0, raw.confidence))
    : 0;
  const known = byId[raw.misconception_id];
  if (!known || confidence < MIN_CONFIDENCE) {
    return { ...UNKNOWN, evidence: String(raw.evidence || ""), confidence };
  }

  // Rebuild from the matched file so topic/correct_model can't drift from the library.
  return {
    topic: known.topic,
    misconception_id: known.id,
    misconception: known.false_belief,
    evidence: String(raw.evidence || ""),
    confidence,
    correct_model: known.correct_model,
  };
}
