// Agent 3 — Judge. Holds correct_model and repair_criteria; decides whether the
// belief actually moved. A keyword alone must never pass — the prompt enforces
// it and a code-level gate backstops it: passing with empty repair_evidence,
// or with an explanation too thin to contain reasoning, is downgraded to fail.
import { callClaude, parseJson } from "./claude.js";
import { misconceptionForSession, loadPrompt } from "./misconceptions.js";

// Fewer words than this cannot hold mechanism + application; it's a keyword.
export const MIN_REASONING_WORDS = 8;

function buildSystemPrompt({ correctModel, repairCriteria, problem }) {
  return loadPrompt("judge")
    .replace("{{CORRECT_MODEL}}", correctModel)
    .replace("{{REPAIR_CRITERIA}}", repairCriteria)
    .replace("{{PROBLEM}}", problem);
}

function toMessages(history, studentText) {
  const transcript = history
    .map((t) => `${t.role === "chintu" ? "Chintu" : "Student"}: ${t.text}`)
    .join("\n");
  return [
    {
      role: "user",
      content:
        `Debate so far:\n${transcript || "(first exchange)"}\n\n` +
        `Student's latest explanation to judge:\n"${studentText}"`,
    },
  ];
}

const FALLBACK = {
  passed: false,
  belief_strength: 0.8,
  tone: "neutral",
  repair_evidence: "",
  missing: "Judge unavailable — continue the debate.",
  scores: { solve: 0, spot: 0, explain: 0 },
};

function clamp01(n, dflt) {
  return typeof n === "number" ? Math.min(1, Math.max(0, n)) : dflt;
}

function clampScore(n) {
  return typeof n === "number" ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}

// Keyword gate, pure so it can be tested directly: a pass must be backed by
// evidence and by an explanation long enough to contain reasoning. "Because
// relative motion" fails here even if the model was feeling generous.
export function applyKeywordGate(verdict, studentText) {
  const wordCount = String(studentText || "").trim().split(/\s+/).filter(Boolean).length;
  if (verdict.passed && (!verdict.repair_evidence.trim() || wordCount < MIN_REASONING_WORDS)) {
    return {
      ...verdict,
      passed: false,
      missing: verdict.missing || "Named the idea but did not explain the mechanism for this problem.",
    };
  }
  return verdict;
}

export async function judgeTurn({ correctModel, repairCriteria, problem, history = [], studentText }) {
  let raw;
  try {
    const text = await callClaude({
      system: buildSystemPrompt({ correctModel, repairCriteria, problem }),
      messages: toMessages(history, studentText),
      maxTokens: 500,
    });
    raw = parseJson(text);
  } catch {
    return { ...FALLBACK, scores: { ...FALLBACK.scores } };
  }

  const scores = raw.scores || {};
  const verdict = {
    passed: raw.passed === true,
    belief_strength: clamp01(raw.belief_strength, FALLBACK.belief_strength),
    tone: raw.tone === "harsh" ? "harsh" : "neutral",
    repair_evidence: String(raw.repair_evidence || ""),
    missing: String(raw.missing || ""),
    scores: {
      solve: clampScore(scores.solve),
      spot: clampScore(scores.spot),
      explain: clampScore(scores.explain),
    },
  };

  return applyKeywordGate(verdict, studentText);
}

// Route-facing adapter — matches server/api/routes.js: judge({ session, studentText }).
// When a transfer problem is live, the student is answering that, so judge
// against it; otherwise judge the debate problem.
export async function judge({ session, studentText }) {
  const m = misconceptionForSession(session);
  const transfer = session?.transferProblem;
  return judgeTurn({
    correctModel: transfer
      ? `${m.correct_model} For this problem specifically: ${transfer.expected_reasoning}`
      : m.correct_model,
    repairCriteria: m.repair_criteria,
    problem: transfer ? transfer.problem_text : m.debate_problem,
    history: session?.turns || [],
    studentText,
  });
}
