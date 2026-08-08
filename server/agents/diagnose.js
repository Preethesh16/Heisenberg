// Agent 1 — Diagnosis. Claude Vision in, CONTRACTS.md §2 Diagnosis shape out.
// misconception_id is validated against data/misconceptions/; anything the
// model invents, and any confidence below 0.6, degrades to UNKNOWN so the
// orchestrator can fall back to the demo default instead of guessing.
"use strict";

const fs = require("fs");
const path = require("path");
const { callClaude, parseJson } = require("./claude");

const MISCONCEPTIONS_DIR = path.join(__dirname, "..", "..", "data", "misconceptions");
const PROMPT_PATH = path.join(__dirname, "..", "..", "prompts", "diagnose.md");
const MIN_CONFIDENCE = 0.6;

function loadMisconceptions() {
  const byId = {};
  for (const file of fs.readdirSync(MISCONCEPTIONS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const m = JSON.parse(fs.readFileSync(path.join(MISCONCEPTIONS_DIR, file), "utf8"));
    byId[m.id] = m;
  }
  return byId;
}

function buildPrompt(byId, questionText) {
  const template = fs.readFileSync(PROMPT_PATH, "utf8");
  const promptBody = template.split("---")[1] || template;
  const list = Object.values(byId)
    .map((m) => `- ${m.id} (${m.topic}): ${m.false_belief} Observable as: ${m.observable_evidence}`)
    .join("\n");
  return promptBody
    .replace("{{MISCONCEPTION_LIST}}", list)
    .replace("{{QUESTION_TEXT}}", questionText || "(not provided)")
    .trim();
}

const UNKNOWN = {
  topic: "Unknown",
  misconception_id: "UNKNOWN",
  misconception: "",
  evidence: "",
  confidence: 0,
  correct_model: "",
};

async function diagnose({ imageBase64, questionText }) {
  const byId = loadMisconceptions();

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

module.exports = { diagnose, loadMisconceptions, MIN_CONFIDENCE };
