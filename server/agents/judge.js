// Agent 3 — Judge. Holds correct_model and repair_criteria; decides whether the
// belief actually moved. A keyword alone must never pass — the prompt enforces
// it and a code-level gate backstops it: a pass survives only when the student
// wrote enough distinct reasoning AND the cited repair_evidence is actually
// grounded in the student's own words.
import { callClaude, parseJson } from "./claude.js";
import { misconceptionForSession, loadPrompt } from "./misconceptions.js";

// Fewer words than this cannot hold mechanism + application; it's a keyword.
export const MIN_REASONING_WORDS = 8;
// Fewer distinct content words than this is keyword stuffing, however long.
export const MIN_DISTINCT_CONTENT_TOKENS = 5;
// Evidence must share at least this many content tokens with the student's
// words, and at least this fraction of its own content tokens.
export const MIN_GROUNDING_SHARED = 3;
export const MIN_GROUNDING_RATIO = 0.4;

const STOPWORDS = new Set([
  "a", "an", "the", "of", "and", "or", "to", "in", "on", "at", "by", "as",
  "is", "are", "was", "were", "be", "been", "it", "its", "that", "this",
  "these", "those", "so", "because", "with", "for", "not", "no", "but",
  "he", "she", "they", "you", "i", "we", "his", "her", "their", "my",
  "your", "our", "them", "him", "me", "us", "do", "does", "did", "has",
  "have", "had", "will", "would", "can", "could", "if", "then", "than",
  "there", "here", "what", "which", "who", "how", "why", "when", "also",
  "just", "only", "very", "between",
]);

// Lowercase, strip punctuation, drop stopwords, crude plural stem.
export function contentTokens(text) {
  const out = new Set();
  for (const w of String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (!w || STOPWORDS.has(w)) continue;
    out.add(w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
  }
  return out;
}

// The model must not be able to invent evidence absent from the student's
// words. Deliberately vocabulary-agnostic: it compares the two texts to each
// other, so it works for friction and Newton's-law sessions alike.
export function evidenceGrounded(repairEvidence, studentText) {
  const evidence = contentTokens(repairEvidence);
  const student = contentTokens(studentText);
  if (evidence.size === 0 || student.size === 0) return false;
  let shared = 0;
  for (const t of evidence) if (student.has(t)) shared += 1;
  return shared >= MIN_GROUNDING_SHARED && shared / evidence.size >= MIN_GROUNDING_RATIO;
}

function buildSystemPrompt({ correctModel, repairCriteria, problem }) {
  return loadPrompt("judge")
    .replace("{{CORRECT_MODEL}}", correctModel)
    .replace("{{REPAIR_CRITERIA}}", repairCriteria)
    .replace("{{PROBLEM}}", problem);
}

// The route may have already appended the latest student turn to the session
// history; the newest matching student turn must appear exactly once.
export function buildJudgeMessages(history, studentText) {
  const norm = (s) => String(s || "").trim();
  let items = (history || []).filter((t) => t && t.text);
  const last = items[items.length - 1];
  if (last && last.role === "student" && norm(last.text) === norm(studentText)) {
    items = items.slice(0, -1);
  }
  const transcript = items
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
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : dflt;
}

function clampScore(n) {
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}

// Keyword gate, pure so it can be tested directly. A pass is downgraded to
// fail when the explanation is too short, is keyword stuffing, or when the
// cited evidence is not grounded in what the student actually said.
export function applyKeywordGate(verdict, studentText) {
  if (!verdict.passed) return verdict;

  const words = String(studentText || "").trim().split(/\s+/).filter(Boolean);
  const distinct = contentTokens(studentText);

  let reason = "";
  if (words.length < MIN_REASONING_WORDS) {
    reason = "Named the idea but did not explain the mechanism for this problem.";
  } else if (distinct.size < MIN_DISTINCT_CONTENT_TOKENS) {
    reason = "Repeated the same words without adding reasoning.";
  } else if (!evidenceGrounded(verdict.repair_evidence, studentText)) {
    reason = "The cited evidence of understanding does not appear in the student's own explanation.";
  }

  if (!reason) return verdict;
  return { ...verdict, passed: false, missing: verdict.missing || reason };
}

export async function judgeTurn({ correctModel, repairCriteria, problem, history = [], studentText }) {
  let raw;
  try {
    const text = await callClaude({
      system: buildSystemPrompt({ correctModel, repairCriteria, problem }),
      messages: buildJudgeMessages(history, studentText),
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
