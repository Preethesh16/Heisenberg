// Manual check: node server/agents/isolation-test.js
// Asserts the product's core rule — nothing from the forbidden set
// (correct_model, repair_criteria, judge output) can reach Chintu's prompt.
// Attacks the REAL seam: the session object the route hands to chintu()
// contains the full diagnosis (with correct_model) and judge-derived state;
// the adapter must let exactly four things through.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildChintuPayload, buildSystemPrompt } from "./chintu.js";
import { misconceptionForSession } from "./misconceptions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const misconception = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "data", "misconceptions", "M-FRIC-04.json"), "utf8")
);

let failed = false;
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failed = true;
}

// --- 1. The careless caller: spreads the whole file plus judge output. ---
const carelessInput = {
  ...misconception,
  judgeOutput: { passed: false, repair_evidence: "SECRET-JUDGE-TEXT" },
  misconception: misconception.false_belief,
  commonArgument: misconception.common_argument,
  problem: misconception.debate_problem,
};

const payload = buildChintuPayload(carelessInput);
const allowedKeys = ["misconception", "common_argument", "problem"];
check(
  Object.keys(payload).every((k) => allowedKeys.includes(k)) && Object.keys(payload).length === 3,
  "payload carries exactly {misconception, common_argument, problem}"
);

// --- 2. The real seam: a full session as routes.js builds it. ---
const session = {
  id: "test",
  stage: "debate",
  diagnosis: {
    topic: misconception.topic,
    misconception_id: misconception.id,
    misconception: misconception.false_belief,
    evidence: "used ground-frame velocity in step 3",
    confidence: 0.94,
    correct_model: misconception.correct_model, // the forbidden field, in the object we're handed
  },
  turns: [{ role: "chintu", text: "But it moves right, so friction is left, na?" }],
  beliefStrength: 0.8,
  scores: { solve: 72, spot: 61, explain: 44 },
  transferProblem: null,
};

const m = misconceptionForSession(session);
const sessionPayload = buildChintuPayload({
  misconception: session.diagnosis.misconception,
  commonArgument: m.common_argument,
  problem: m.debate_problem,
});
const prompt = buildSystemPrompt(sessionPayload);

const forbidden = [
  misconception.correct_model,
  misconception.repair_criteria,
  "SECRET-JUDGE-TEXT",
];
for (const s of forbidden) {
  check(!prompt.includes(s), `forbidden text absent from prompt: "${s.slice(0, 45)}..."`);
}

const required = [
  misconception.false_belief,
  misconception.common_argument,
  misconception.debate_problem,
];
for (const s of required) {
  check(prompt.includes(s), `required text present in prompt: "${s.slice(0, 45)}..."`);
}

process.exit(failed ? 1 : 0);
