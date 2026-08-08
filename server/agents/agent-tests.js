// Manual check: node server/agents/agent-tests.js
// Deterministic agent test suite. Makes NO network calls: the API key is
// removed from the environment up front, so any code path that would hit the
// provider throws immediately and exercises its fallback instead.
delete process.env.ANTHROPIC_API_KEY;

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMisconceptions, misconceptionForSession } from "./misconceptions.js";
import { diagnose, detectImageMediaType, MIN_IMAGE_BYTES, normalizeDiagnosis } from "./diagnose.js";
import { normalizeChintuReply, buildChintuRequest } from "./chintu.js";
import { applyKeywordGate, buildJudgeMessages, buildJudgeInputs, evidenceGrounded, judgeTurn } from "./judge.js";
import { verifyTransfer } from "./verify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  ok ? passed++ : failed++;
}

// ---------- 1. Misconception schemas ----------
const REQUIRED_FIELDS = [
  "id", "topic", "concept", "false_belief", "observable_evidence",
  "common_argument", "repair_criteria", "debate_problem",
  "transfer_contexts", "correct_model",
];
const byId = loadMisconceptions();
check(Object.keys(byId).length === 3, "library holds exactly three misconceptions");
for (const [id, m] of Object.entries(byId)) {
  const missing = REQUIRED_FIELDS.filter((k) => !m[k] || (Array.isArray(m[k]) && m[k].length === 0));
  check(missing.length === 0, `${id} schema complete${missing.length ? ` (missing: ${missing})` : ""}`);
}

// ---------- 2. Verifier fallbacks, every ID ----------
for (const m of Object.values(byId)) {
  const out = await verifyTransfer({ misconception: m });
  check(out.problem_text && out.problem_text.trim().length > 0, `${m.id} fallback has problem_text`);
  check(out.expected_reasoning && out.expected_reasoning.trim().length > 0, `${m.id} fallback has expected_reasoning`);
  check(out.problem_text !== m.debate_problem, `${m.id} fallback differs from debate_problem`);
  check(m.transfer_contexts.includes(out.context_label), `${m.id} fallback context_label is a listed transfer_context`);
  check(out.misconception_id === m.id, `${m.id} fallback returns original misconception_id`);
}

// ---------- 3. Chintu yield normalization ----------
const base = { reply: "nahi yaar", emotion: "stubborn", gesture: null };
check(normalizeChintuReply({ ...base, should_yield: true, belief_strength: 0.8 }).should_yield === false, "yield=true belief=0.8 → false");
check(normalizeChintuReply({ ...base, should_yield: true, belief_strength: 0.29 }).should_yield === true, "yield=true belief=0.29 → true");
check(normalizeChintuReply({ ...base, should_yield: false, belief_strength: 0.1 }).should_yield === false, "yield=false belief=0.1 → false");
const invalidBelief = normalizeChintuReply({ ...base, should_yield: true, belief_strength: "high" });
check(invalidBelief.should_yield === false && invalidBelief.belief_strength === 0.8, "invalid belief → safe fallback 0.8, no yield");
check(normalizeChintuReply({ ...base, should_yield: true, belief_strength: NaN }).should_yield === false, "NaN belief → no yield");
check(normalizeChintuReply({ reply: "   ", emotion: "x", belief_strength: 0.5 }).reply.length > 0, "blank reply → non-empty fallback reply");

// ---------- 4. Judge keyword gate ----------
const pass = (evidence) => ({
  passed: true, belief_strength: 0.2, tone: "neutral",
  repair_evidence: evidence, missing: "",
  scores: { solve: 90, spot: 90, explain: 90 },
});
check(
  applyKeywordGate(pass("relative motion"), "because relative motion").passed === false,
  "gate fails: 'because relative motion'"
);
check(
  applyKeywordGate(pass("relative motion"), "relative motion relative motion relative motion relative motion relative").passed === false,
  "gate fails: repeated keyword stuffing"
);
check(
  applyKeywordGate(pass("slips backward relative to belt so friction forward"), "one two three four five six seven eight").passed === false,
  "gate fails: eight filler words with hallucinated evidence"
);
check(
  applyKeywordGate(
    pass("Student distinguished the block's velocity from relative slipping at the contact surface"),
    "honestly sir the answer is definitely completely obviously toward left side yaar"
  ).passed === false,
  "gate fails: non-empty evidence not grounded in the student's words"
);
check(
  applyKeywordGate(
    pass("block slips backward relative to the belt surface so friction acts forward"),
    "the block slips backward relative to the belt surface, so friction on the block acts forward until slipping stops"
  ).passed === true,
  "gate passes: grounded friction reasoning"
);
check(
  applyKeywordGate(
    pass("forces act on different bodies so they cannot cancel on the cart's own diagram"),
    "the two forces act on different bodies, one on the horse and one on the cart, so they can never cancel on the cart's own free body diagram"
  ).passed === true,
  "gate passes: grounded Newton's-law reasoning (not friction-specific)"
);
check(evidenceGrounded("", "anything at all here") === false, "empty evidence is never grounded");

// ---------- 5. Judge transcript dedup ----------
const historyWith = [
  { role: "chintu", text: "friction is left, obviously" },
  { role: "student", text: "the belt slips under the block" },
];
const msgsDup = buildJudgeMessages(historyWith, "the belt slips under the block");
const bodyDup = msgsDup[0].content;
check(
  (bodyDup.match(/the belt slips under the block/g) || []).length === 1,
  "history ending with studentText → explanation appears exactly once"
);
const msgsNew = buildJudgeMessages(historyWith, "a completely new explanation about slipping");
const bodyNew = msgsNew[0].content;
check(
  bodyNew.includes("the belt slips under the block") &&
  (bodyNew.match(/a completely new explanation about slipping/g) || []).length === 1,
  "history without studentText → transcript kept, new explanation appears once"
);

// ---------- 6. Image type detection ----------
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4]).toString("base64");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3, 4]).toString("base64");
const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4]).toString("base64");
const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 1, 2, 3, 4]).toString("base64");
const junk = Buffer.from("this is definitely not an image at all").toString("base64");
check(detectImageMediaType(jpeg) === "image/jpeg", "magic bytes: JPEG");
check(detectImageMediaType(png) === "image/png", "magic bytes: PNG");
check(detectImageMediaType(gif) === "image/gif", "magic bytes: GIF");
check(detectImageMediaType(webp) === "image/webp", "magic bytes: WebP");
check(detectImageMediaType(junk) === null, "magic bytes: junk → null");
check(detectImageMediaType("!!!not-base64!!!") === null, "malformed base64 → null");

// ---------- 7. Diagnose input gates (no provider call possible — key removed) ----------
const big = (buf) => Buffer.concat([buf, Buffer.alloc(MIN_IMAGE_BYTES + 5000)]).toString("base64");
const d1 = await diagnose({});
check(d1.misconception_id === "UNKNOWN", "missing image → UNKNOWN");
const d2 = await diagnose({ imageBase64: jpeg });
check(d2.misconception_id === "UNKNOWN" && d2.reason.includes("too small"), "tiny image → UNKNOWN before any call");
const d3 = await diagnose({ imageBase64: big(Buffer.from("A".repeat(24))) });
check(d3.misconception_id === "UNKNOWN" && d3.reason.includes("JPEG"), "large but non-image bytes → UNKNOWN (unsupported format)");
const d4 = await diagnose({ imageBase64: big(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8])) });
check(d4.misconception_id === "UNKNOWN" && d4.reason.includes("unavailable"), "valid PNG magic, no key → gates passed, degrades truthfully");
const d5 = await diagnose({ imageBase64: 12345 });
check(d5.misconception_id === "UNKNOWN", "non-string image input → UNKNOWN");

// ---------- 7a. Dynamic diagnosis package ----------
const dynamicRaw = {
  work_status: "incorrect_concept",
  diagnosable: true,
  reason: "A visible conceptual reversal causes the conclusion.",
  topic: "Algebra — quadratic equations",
  concept: "Relationship between roots and coefficients",
  misconception: "The product of the roots equals b over a.",
  evidence: "The learner writes alpha beta = b/a on the second line.",
  confidence: 0.93,
  correct_model: "For ax² + bx + c = 0, the product of the roots is c/a.",
  common_argument: "The middle coefficient controls both the sum and product of the roots.",
  repair_criteria: "The learner derives or applies the c/a product and distinguishes it from the -b/a sum.",
  debate_problem: "For 2x² - 7x + 3 = 0, what is the product of the roots and why?",
  transfer_contexts: ["Forming a polynomial from roots", "Checking factorised quadratics"],
};
const dynamic = normalizeDiagnosis(dynamicRaw);
check(dynamic.diagnosable === true && dynamic.misconception_id.startsWith("DYN-"), "valid Vision result becomes a dynamic concept package");
check(dynamic.misconception_id === normalizeDiagnosis(dynamicRaw).misconception_id, "dynamic misconception ID is deterministic");
const dynamicResolved = misconceptionForSession({ diagnosis: dynamic });
check(dynamicResolved.correct_model === dynamicRaw.correct_model, "dynamic session resolves its Vision-derived correct model");
check(dynamicResolved.debate_problem === dynamicRaw.debate_problem, "dynamic session resolves its Vision-derived debate problem");
const incomplete = normalizeDiagnosis({ ...dynamicRaw, transfer_contexts: [] });
check(incomplete.diagnosable === false && incomplete.misconception_id === "UNKNOWN", "incomplete dynamic package fails closed");
const lowConfidence = normalizeDiagnosis({ ...dynamicRaw, confidence: 0.4 });
check(lowConfidence.diagnosable === false, "low-confidence dynamic diagnosis remains UNKNOWN");

// ---------- 7b. Transfer judging is standalone ----------
const debateSession = {
  diagnosis: { misconception_id: "M-FRIC-04" },
  turns: [
    { role: "chintu", text: "friction is left, obviously" },
    { role: "student", text: "no, the belt slips under the block" },
  ],
  transferProblem: null,
};
const debateInputs = buildJudgeInputs(debateSession, "an answer");
check(debateInputs.problem === byId["M-FRIC-04"].debate_problem, "debate judging targets debate_problem");
check(debateInputs.history.length === 2, "debate judging keeps full history");

const transferSession = {
  ...debateSession,
  transferProblem: {
    problem_text: "Which way does friction act on the driven wheels?",
    expected_reasoning: "Contact patch tends to slip backward, so friction acts forward.",
    context_label: "Accelerating vehicle",
    misconception_id: "M-FRIC-04",
  },
};
const transferInputs = buildJudgeInputs(transferSession, "friction acts forward because the patch slips back");
check(transferInputs.problem === transferSession.transferProblem.problem_text, "transfer judging targets the transfer problem");
check(transferInputs.history.length === 0, "transfer judging drops debate history (flake fix)");
check(transferInputs.correctModel.includes("Contact patch tends to slip backward"), "transfer judging carries expected_reasoning");
check(transferInputs.repairCriteria.includes("no Chintu error to spot"), "transfer judging tells the judge there is no Chintu error");

// ---------- 8. Judge fails closed without provider ----------
const j = await judgeTurn({ correctModel: "c", repairCriteria: "r", problem: "p", studentText: "any words at all here to be safe" });
check(j.passed === false, "judge without provider fails closed");

// ---------- 9. Chintu request built from poisoned session leaks nothing (spot check; full version in isolation-test.js) ----------
const m4 = byId["M-FRIC-04"];
const poisoned = {
  diagnosis: { misconception_id: m4.id, misconception: m4.false_belief, correct_model: m4.correct_model },
  turns: [],
  lastJudge: { repair_evidence: "SECRET-XYZ" },
};
const req = buildChintuRequest(poisoned, "teach attempt");
check(!(req.system + JSON.stringify(req.messages)).includes(m4.correct_model), "chintu request omits correct_model");
check(!(req.system + JSON.stringify(req.messages)).includes("SECRET-XYZ"), "chintu request omits judge output");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
