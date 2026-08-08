// Agent 2 — Chintu. Holds the misconception and argues back.
//
// THE RULE THE PRODUCT RESTS ON: Chintu's payload is built field by field from
// exactly four inputs — misconception, common_argument, problem, history.
// He never receives correct_model, repair_criteria, or Judge output. The
// session object the route hands us CONTAINS correct_model (inside diagnosis);
// the adapter below extracts only the allowed fields and nothing else.
import { callClaude, parseJson } from "./claude.js";
import { misconceptionForSession, loadPrompt } from "./misconceptions.js";

const EMOTIONS = new Set([
  "idle", "listening", "thinking", "confident", "stubborn",
  "confused", "surprised", "happy", "convinced",
]);
const GESTURES = new Set(["nod", "point_board"]);

// The only fields Chintu is allowed to see. Exported so the isolation test
// (and anyone reviewing) can assert the boundary in one place.
export function buildChintuPayload({ misconception, commonArgument, problem }) {
  return {
    misconception: String(misconception),
    common_argument: String(commonArgument),
    problem: String(problem),
  };
}

export function buildSystemPrompt(payload) {
  return loadPrompt("chintu")
    .replace("{{MISCONCEPTION}}", payload.misconception)
    .replace("{{COMMON_ARGUMENT}}", payload.common_argument)
    .replace("{{PROBLEM}}", payload.problem);
}

// history: Turn[] from the session — [{ role: "chintu" | "student", text }]
function toMessages(history, studentText) {
  const messages = history
    .filter((t) => t.text)
    .map((t) => ({
      role: t.role === "chintu" ? "assistant" : "user",
      content: t.text,
    }));
  // The route may have already appended this student turn to session.turns;
  // don't send it twice.
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || last.content !== studentText) {
    messages.push({ role: "user", content: studentText });
  }
  return messages;
}

const FALLBACK = {
  reply: "Hmm, wait — say that again? My head went blank for a second.",
  emotion: "confused",
  gesture: null,
  belief_strength: 0.8,
  should_yield: false,
};

export async function chintuTurn({ misconception, commonArgument, problem, history = [], studentText }) {
  const payload = buildChintuPayload({ misconception, commonArgument, problem });

  let raw;
  try {
    const text = await callClaude({
      system: buildSystemPrompt(payload),
      messages: toMessages(history, studentText || "(the student is waiting for your opening take on the problem)"),
      maxTokens: 400,
    });
    raw = parseJson(text);
  } catch {
    return { ...FALLBACK };
  }

  const belief = typeof raw.belief_strength === "number"
    ? Math.min(1, Math.max(0, raw.belief_strength))
    : FALLBACK.belief_strength;

  return {
    reply: String(raw.reply || FALLBACK.reply),
    emotion: EMOTIONS.has(raw.emotion) ? raw.emotion : "stubborn",
    gesture: GESTURES.has(raw.gesture) ? raw.gesture : null,
    belief_strength: belief,
    should_yield: raw.should_yield === true,
  };
}

// Route-facing adapter — matches server/api/routes.js: chintu({ session, studentText }).
// This is the isolation boundary: from the whole session, exactly four things
// pass through. Never add session.diagnosis.correct_model or judge output here.
export async function chintu({ session, studentText }) {
  const m = misconceptionForSession(session);
  return chintuTurn({
    misconception: session?.diagnosis?.misconception || m.false_belief,
    commonArgument: m.common_argument,
    problem: m.debate_problem,
    history: session?.turns || [],
    studentText,
  });
}
