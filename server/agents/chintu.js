// Agent 2 — Chintu. Holds the misconception and argues back.
//
// THE RULE THE PRODUCT RESTS ON: Chintu's payload is built field by field from
// exactly four inputs — misconception, common_argument, problem, history.
// He never receives correct_model, repair_criteria, or Judge output. Do not
// spread the diagnosis or misconception object into this file's prompt path.
"use strict";

const fs = require("fs");
const path = require("path");
const { callClaude, parseJson } = require("./claude");

const PROMPT_PATH = path.join(__dirname, "..", "..", "prompts", "chintu.md");

const EMOTIONS = new Set([
  "idle", "listening", "thinking", "confident", "stubborn",
  "confused", "surprised", "happy", "convinced",
]);
const GESTURES = new Set(["nod", "point_board"]);

// The only fields Chintu is allowed to see. Exported so the isolation test
// (and anyone reviewing) can assert the boundary in one place.
function buildChintuPayload({ misconception, commonArgument, problem }) {
  return {
    misconception: String(misconception),
    common_argument: String(commonArgument),
    problem: String(problem),
  };
}

function buildSystemPrompt(payload) {
  const template = fs.readFileSync(PROMPT_PATH, "utf8");
  const promptBody = template.split("---")[1] || template;
  return promptBody
    .replace("{{MISCONCEPTION}}", payload.misconception)
    .replace("{{COMMON_ARGUMENT}}", payload.common_argument)
    .replace("{{PROBLEM}}", payload.problem)
    .trim();
}

// history: Turn[] from the session — [{ role: "chintu" | "student", text }]
function toMessages(history, studentText) {
  const messages = history.map((t) => ({
    role: t.role === "chintu" ? "assistant" : "user",
    content: t.text,
  }));
  messages.push({ role: "user", content: studentText });
  return messages;
}

const FALLBACK = {
  reply: "Hmm, wait — say that again? My head went blank for a second.",
  emotion: "confused",
  gesture: null,
  belief_strength: 0.8,
  should_yield: false,
};

async function chintuTurn({ misconception, commonArgument, problem, history = [], studentText }) {
  const payload = buildChintuPayload({ misconception, commonArgument, problem });

  let raw;
  try {
    const text = await callClaude({
      system: buildSystemPrompt(payload),
      messages: toMessages(history, studentText),
      maxTokens: 400,
    });
    raw = parseJson(text);
  } catch (err) {
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

module.exports = { chintuTurn, buildChintuPayload, buildSystemPrompt };
