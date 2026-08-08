// Manual check: node server/agents/isolation-test.js
// Asserts the product's core rule — nothing from the forbidden set
// (correct_model, repair_criteria, Judge output) can reach Chintu.
//
// This attacks the REAL production path: buildChintuRequest(session, text) is
// exactly what chintu() sends to Claude. The session below is poisoned with
// every forbidden value plus arbitrary secret markers; if any of them appears
// in the system prompt or any message, a leak exists in the adapter itself —
// not in a test-side reconstruction of it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildChintuRequest, buildChintuContextFromSession } from "./chintu.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const misconception = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "data", "misconceptions", "M-FRIC-04.json"), "utf8")
);

let failed = false;
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failed = true;
}

const SECRET_MARKERS = {
  judgeEvidence: "SECRET-JUDGE-EVIDENCE-7f3a",
  judgeMissing: "SECRET-JUDGE-MISSING-9c1d",
  arbitrary: "SECRET-ARBITRARY-MARKER-42",
  turnNote: "SECRET-TURN-ANNOTATION-b8e2",
};

// A full session as the orchestrator could ever hand it over, poisoned with
// everything Chintu must never see.
const session = {
  id: "isolation-test",
  stage: "debate",
  diagnosis: {
    topic: misconception.topic,
    misconception_id: misconception.id,
    misconception: misconception.false_belief,
    evidence: "used ground-frame velocity in step 3",
    confidence: 0.94,
    correct_model: misconception.correct_model,
    repair_criteria: misconception.repair_criteria,
  },
  turns: [
    {
      role: "chintu",
      text: "But it moves right, so friction is left, na?",
      emotion: "stubborn",
      judgeAnnotation: SECRET_MARKERS.turnNote,
    },
    { role: "student", text: "no, think about the belt surface" },
  ],
  beliefStrength: 0.8,
  scores: { solve: 72, spot: 61, explain: 44 },
  transferProblem: null,
  lastJudge: {
    passed: false,
    repair_evidence: SECRET_MARKERS.judgeEvidence,
    missing: SECRET_MARKERS.judgeMissing,
    tone: "harsh",
  },
  debugSecret: SECRET_MARKERS.arbitrary,
};

const studentText = "you are wrong, friction acts along the belt here";

// 1. The extraction boundary lets exactly the allowed fields through.
const ctx = buildChintuContextFromSession(session, studentText);
const allowedKeys = ["misconception", "common_argument", "problem", "history", "studentText"];
check(
  Object.keys(ctx).every((k) => allowedKeys.includes(k)) && Object.keys(ctx).length === allowedKeys.length,
  "context carries exactly {misconception, common_argument, problem, history, studentText}"
);
check(
  ctx.history.every((t) => Object.keys(t).length === 2 && "role" in t && "text" in t),
  "history turns stripped to {role, text} — extra turn fields dropped"
);

// 2. The exact request the production adapter sends to Claude.
const { system, messages } = buildChintuRequest(session, studentText);
const everythingSent = system + "\n" + messages.map((m) => `${m.role}: ${m.content}`).join("\n");

const forbidden = [
  ["correct_model", misconception.correct_model],
  ["repair_criteria", misconception.repair_criteria],
  ["judge repair_evidence", SECRET_MARKERS.judgeEvidence],
  ["judge missing", SECRET_MARKERS.judgeMissing],
  ["arbitrary session field", SECRET_MARKERS.arbitrary],
  ["turn annotation", SECRET_MARKERS.turnNote],
];
for (const [label, value] of forbidden) {
  check(!everythingSent.includes(value), `forbidden absent from request: ${label}`);
}

const required = [
  ["false belief", misconception.false_belief],
  ["common argument", misconception.common_argument],
  ["debate problem", misconception.debate_problem],
];
for (const [label, value] of required) {
  check(system.includes(value), `required present in system prompt: ${label}`);
}
check(
  messages.some((m) => m.role === "user" && m.content === studentText),
  "student's latest text reaches Chintu exactly once as a user message"
);
check(
  messages.filter((m) => m.content === studentText).length === 1,
  "no duplicated student turn in messages"
);

process.exit(failed ? 1 : 0);
