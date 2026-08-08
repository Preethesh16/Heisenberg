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

  const imageBytes = Math.floor(String(imageBase64 || "").length * 0.75);
  if (imageBytes < MIN_IMAGE_BYTES) {
    return { ...UNKNOWN, evidence: "image too small to contain a handwritten solution" };
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
              source: { type: "base64", media_type: "image/jpeg", data: imageBase64 },
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

  const confidence = typeof raw.confidence === "number" ? raw.confidence : 0;
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
