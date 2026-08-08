// Agent 4 — Verifier. Runs only after the Judge passes. Produces the
// CONTRACTS.md §2 Verifier shape: a transfer problem in a context that
// differs from the debate problem's, chosen from the misconception file.
import { callClaude, parseJson } from "./claude.js";
import { misconceptionForSession, loadPrompt } from "./misconceptions.js";

// Deterministic fallbacks so a Verifier outage still ends the session on a
// REAL transfer problem. One per misconception ID, each using a listed
// transfer_context and genuinely different from that file's debate_problem —
// relabelling the debate problem as a new context would fake the transfer test.
export const FALLBACKS = {
  "M-FRIC-04": {
    problem_text: "A car accelerates forward. Which way does friction act on the driven wheels?",
    context_label: "Accelerating vehicle",
    expected_reasoning: "Contact patch tends to slip backward, so friction acts forward.",
  },
  "M-NEWT-03": {
    problem_text:
      "A rocket drifting in empty space fires its engine: it pushes exhaust gas backward, and the gas pushes the rocket forward with an equal force. Do these two forces cancel, and how does the rocket speed up?",
    context_label: "Rocket in empty space",
    expected_reasoning:
      "The equal and opposite forces act on different bodies — the forward force acts on the rocket and the backward force on the gas — so nothing cancels on the rocket's own free-body diagram and it accelerates.",
  },
  "M-NEWT-07": {
    problem_text:
      "An apple falls from a tree. Compare the gravitational pull the apple exerts on Earth with the pull Earth exerts on the apple, and explain why only the apple visibly accelerates.",
    context_label: "Earth and a falling apple",
    expected_reasoning:
      "The two pulls are equal in magnitude; the apple's tiny mass gives it a large acceleration while Earth's enormous mass makes its acceleration imperceptible.",
  },
};

export function pickTransferContext(misconception, usedContext) {
  const contexts = misconception.transfer_contexts || [];
  return contexts.find((c) => c !== usedContext) || contexts[0] || "New situation";
}

// Last line of defence for an ID with no authored fallback: build a fresh
// conceptual prompt from the correct model. Never reuses debate_problem.
function fallbackFor(misconception, transferContext) {
  const authored = FALLBACKS[misconception.id];
  if (authored) return { ...authored, misconception_id: misconception.id };
  return {
    problem_text: `Consider this situation: ${transferContext.toLowerCase()}. Apply the idea you just taught and explain what happens here, and why.`,
    context_label: transferContext,
    expected_reasoning: misconception.correct_model,
    misconception_id: misconception.id,
  };
}

function buildSystemPrompt(misconception, transferContext) {
  return loadPrompt("verify")
    .replace("{{FALSE_BELIEF}}", misconception.false_belief)
    .replace("{{CORRECT_MODEL}}", misconception.correct_model)
    .replace("{{DEBATE_PROBLEM}}", misconception.debate_problem)
    .replace("{{TRANSFER_CONTEXT}}", transferContext);
}

// A usable transfer problem has real text, real expected reasoning, and is
// not the debate problem wearing a new label.
function isValidTransfer(raw, misconception) {
  return (
    raw &&
    typeof raw.problem_text === "string" && raw.problem_text.trim().length > 0 &&
    typeof raw.expected_reasoning === "string" && raw.expected_reasoning.trim().length > 0 &&
    raw.problem_text.trim() !== misconception.debate_problem.trim()
  );
}

export async function verifyTransfer({ misconception, usedContext }) {
  const transferContext = pickTransferContext(misconception, usedContext);

  let raw;
  try {
    const text = await callClaude({
      system: buildSystemPrompt(misconception, transferContext),
      messages: [{ role: "user", content: "Write the transfer problem." }],
      maxTokens: 300,
    });
    raw = parseJson(text);
  } catch {
    return fallbackFor(misconception, transferContext);
  }

  if (!isValidTransfer(raw, misconception)) {
    return fallbackFor(misconception, transferContext);
  }

  return {
    problem_text: raw.problem_text.trim(),
    context_label: transferContext,
    expected_reasoning: raw.expected_reasoning.trim(),
    misconception_id: misconception.id,
  };
}

// Route-facing adapter — matches server/api/routes.js: verify({ session }).
export async function verify({ session, misconception, usedContext } = {}) {
  const m = misconception || misconceptionForSession(session);
  return verifyTransfer({ misconception: m, usedContext });
}
