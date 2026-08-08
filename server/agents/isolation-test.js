// Manual check: node server/agents/isolation-test.js
// Asserts the product's core rule — nothing from the forbidden set
// (correct_model, repair_criteria, judge output) can reach Chintu's prompt,
// even when a careless caller passes the whole misconception file through.
"use strict";

const fs = require("fs");
const path = require("path");
const { buildChintuPayload, buildSystemPrompt } = require("./chintu");

const misconception = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "data", "misconceptions", "M-FRIC-04.json"), "utf8")
);

// Simulate the worst caller: spreads the entire file plus judge output at Chintu.
const carelessInput = {
  ...misconception,
  judgeOutput: { passed: false, repair_evidence: "SECRET-JUDGE-TEXT" },
  misconception: misconception.false_belief,
  commonArgument: misconception.common_argument,
  problem: misconception.debate_problem,
};

const payload = buildChintuPayload(carelessInput);
const prompt = buildSystemPrompt(payload);

let failed = false;

const allowedKeys = ["misconception", "common_argument", "problem"];
const extraKeys = Object.keys(payload).filter((k) => !allowedKeys.includes(k));
if (extraKeys.length) {
  console.error("FAIL: payload leaked extra keys:", extraKeys);
  failed = true;
}

const forbiddenStrings = [
  misconception.correct_model,
  misconception.repair_criteria,
  "SECRET-JUDGE-TEXT",
];
for (const s of forbiddenStrings) {
  if (prompt.includes(s)) {
    console.error("FAIL: forbidden text reached Chintu's prompt:", s.slice(0, 60));
    failed = true;
  }
}

const requiredStrings = [
  misconception.false_belief,
  misconception.common_argument,
  misconception.debate_problem,
];
for (const s of requiredStrings) {
  if (!prompt.includes(s)) {
    console.error("FAIL: required text missing from Chintu's prompt:", s.slice(0, 60));
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("PASS: Chintu sees exactly {misconception, common_argument, problem} and nothing forbidden.");
