// Agent 4 — Verifier. Runs only after the Judge passes. Produces the
// CONTRACTS.md §2 Verifier shape: a transfer problem in a context that
// differs from the debate problem's, chosen from the misconception file.
"use strict";

const fs = require("fs");
const path = require("path");
const { callClaude, parseJson } = require("./claude");

const PROMPT_PATH = path.join(__dirname, "..", "..", "prompts", "verify.md");

// Deterministic fallback per misconception so a Verifier outage still ends the
// session on a transfer problem instead of an error. M-FRIC-04 is the demo.
const FALLBACKS = {
  "M-FRIC-04": {
    problem_text: "A car accelerates forward. Which way does friction act on the driven wheels?",
    context_label: "Accelerating vehicle",
    expected_reasoning: "Contact patch tends to slip backward, so friction acts forward.",
  },
};

function pickTransferContext(misconception, usedContext) {
  const contexts = misconception.transfer_contexts || [];
  return contexts.find((c) => c !== usedContext) || contexts[0] || "New situation";
}

function buildSystemPrompt(misconception, transferContext) {
  const template = fs.readFileSync(PROMPT_PATH, "utf8");
  const promptBody = template.split("---")[1] || template;
  return promptBody
    .replace("{{FALSE_BELIEF}}", misconception.false_belief)
    .replace("{{CORRECT_MODEL}}", misconception.correct_model)
    .replace("{{DEBATE_PROBLEM}}", misconception.debate_problem)
    .replace("{{TRANSFER_CONTEXT}}", transferContext)
    .trim();
}

// misconception: the full file object. usedContext: context label of the
// debate problem if the orchestrator tracked one (may be undefined).
async function verify({ misconception, usedContext }) {
  const transferContext = pickTransferContext(misconception, usedContext);

  let raw;
  try {
    const text = await callClaude({
      system: buildSystemPrompt(misconception, transferContext),
      messages: [{ role: "user", content: "Write the transfer problem." }],
      maxTokens: 300,
    });
    raw = parseJson(text);
  } catch (err) {
    const fallback = FALLBACKS[misconception.id];
    if (fallback) return { ...fallback, misconception_id: misconception.id };
    return {
      problem_text: misconception.debate_problem,
      context_label: transferContext,
      expected_reasoning: misconception.correct_model,
      misconception_id: misconception.id,
    };
  }

  return {
    problem_text: String(raw.problem_text || ""),
    context_label: transferContext,
    expected_reasoning: String(raw.expected_reasoning || ""),
    misconception_id: misconception.id,
  };
}

module.exports = { verify, pickTransferContext };
