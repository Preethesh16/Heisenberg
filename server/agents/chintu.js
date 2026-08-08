// Agent 2 — Chintu. Holds the misconception and argues back.
//
// THE RULE THE PRODUCT RESTS ON: Chintu's payload is built field by field from
// exactly four inputs — misconception, common_argument, problem, history.
// He never receives correct_model, repair_criteria, or Judge output. The
// session object the route hands us CONTAINS correct_model (inside diagnosis);
// buildChintuContextFromSession below is the single extraction point, and the
// isolation test attacks that exact production function.
import { callClaude, parseJson } from "./claude.js";
import { misconceptionForSession, loadPrompt } from "./misconceptions.js";

const EMOTIONS = new Set([
  "idle", "listening", "thinking", "confident", "stubborn",
  "confused", "surprised", "happy", "convinced",
]);
const GESTURES = new Set(["nod", "point_board"]);

// The prompt tells Chintu he may yield only when his conviction is nearly
// gone; enforce it in code so a glitchy model can't fold at high belief.
export const YIELD_BELIEF_CEILING = 0.3;

const OPENING_NUDGE = "(the student is waiting for your opening take on the problem)";

// The only fields Chintu is allowed to see.
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

// history: Turn[] — [{ role: "chintu" | "student", text }]
function toMessages(history, studentText) {
  const messages = history
    .filter((t) => t.text)
    .map((t) => ({
      role: t.role === "chintu" ? "assistant" : "user",
      content: String(t.text),
    }));
  // The route may have already appended this student turn to session.turns;
  // don't send it twice.
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || last.content !== studentText) {
    messages.push({ role: "user", content: studentText });
  }
  return messages;
}

// THE isolation boundary. From the whole session, exactly four things pass:
// the misconception, its common argument, the debate problem, and the turn
// history (role + text only — any extra fields on a turn are dropped).
// Never add session.diagnosis.correct_model, repair_criteria, or any
// Judge-derived field here.
export function buildChintuContextFromSession(session, studentText) {
  const m = misconceptionForSession(session);
  return {
    misconception: String(session?.diagnosis?.misconception || m.false_belief),
    common_argument: String(m.common_argument),
    problem: String(m.debate_problem),
    history: (session?.turns || [])
      .filter((t) => t && (t.role === "chintu" || t.role === "student"))
      .map((t) => ({ role: t.role, text: String(t.text || "") })),
    studentText: String(studentText || ""),
  };
}

// Everything Claude will see for this turn, produced only from the context
// above. The isolation test asserts over this exact output.
export function buildChintuRequest(session, studentText) {
  const ctx = buildChintuContextFromSession(session, studentText);
  return {
    system: buildSystemPrompt(buildChintuPayload({
      misconception: ctx.misconception,
      commonArgument: ctx.common_argument,
      problem: ctx.problem,
    })),
    messages: toMessages(ctx.history, ctx.studentText || OPENING_NUDGE),
  };
}

const FALLBACK = {
  reply: "Hmm, wait — say that again? My head went blank for a second.",
  emotion: "confused",
  gesture: null,
  belief_strength: 0.8,
  should_yield: false,
};

// Deterministic normalization of whatever the model returned. Yield is only
// honoured when the model asked for it AND clamped belief is below the
// ceiling — the Judge remains the sole authority that advances the session.
export function normalizeChintuReply(raw) {
  const belief = Number.isFinite(raw?.belief_strength)
    ? Math.min(1, Math.max(0, raw.belief_strength))
    : FALLBACK.belief_strength;
  const reply = typeof raw?.reply === "string" && raw.reply.trim()
    ? raw.reply.trim()
    : FALLBACK.reply;
  return {
    reply,
    emotion: EMOTIONS.has(raw?.emotion) ? raw.emotion : "stubborn",
    gesture: GESTURES.has(raw?.gesture) ? raw.gesture : null,
    belief_strength: belief,
    should_yield: raw?.should_yield === true && belief < YIELD_BELIEF_CEILING,
  };
}

// Low-level entry used by the adversarial harness (explicit fields, no session).
export async function chintuTurn({ misconception, commonArgument, problem, history = [], studentText }) {
  const payload = buildChintuPayload({ misconception, commonArgument, problem });
  let raw;
  try {
    const text = await callClaude({
      system: buildSystemPrompt(payload),
      messages: toMessages(
        history.map((t) => ({ role: t.role, text: String(t.text || "") })),
        studentText || OPENING_NUDGE
      ),
      maxTokens: 400,
    });
    raw = parseJson(text);
  } catch {
    return { ...FALLBACK };
  }
  return normalizeChintuReply(raw);
}

// Route-facing adapter — matches server/api/routes.js: chintu({ session, studentText }).
export async function chintu({ session, studentText }) {
  const { system, messages } = buildChintuRequest(session, studentText);
  let raw;
  try {
    const text = await callClaude({ system, messages, maxTokens: 400 });
    raw = parseJson(text);
  } catch {
    return { ...FALLBACK };
  }
  return normalizeChintuReply(raw);
}
