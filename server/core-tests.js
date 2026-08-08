// Reproducible deterministic verification for Jeswin's API/state-machine work.
// Run from server/: npm test. No provider calls are made.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import {
  createSession,
  addStudentTurnOnce,
  applyDiagnosis,
  applyJudge,
  applyTransfer,
  cleanupExpired,
} from "./orchestrator.js";
import { chintuFallbackForSession, transferFallbackForSession } from "./api/routes.js";

const port = 34000 + (process.pid % 10000);
const base = `http://127.0.0.1:${port}/api`;
let passed = 0;

function pass(label) {
  passed += 1;
  console.log(`PASS: ${label}`);
}

async function json(path, body, init = {}) {
  const res = await fetch(`${base}${path}`, {
    method: init.method || "POST",
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    body: init.raw ?? JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data, headers: res.headers };
}

async function waitForServer(child) {
  let last;
  for (let i = 0; i < 80; i += 1) {
    if (child.exitCode != null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return;
      last = new Error(`health ${res.status}`);
    } catch (err) {
      last = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw last || new Error("server did not start");
}

const child = spawn(process.execPath, ["index.js"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, PORT: String(port), USE_FIXTURES: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
child.stdout.on("data", (chunk) => { serverLog += chunk; });
child.stderr.on("data", (chunk) => { serverLog += chunk; });

try {
  await waitForServer(child);

  const health = await fetch(`${base}/health`).then((r) => r.json());
  assert.deepEqual(health, { ok: true, fixtures: true });
  pass("health exposes explicit fixture mode");

  let out = await json("/chintu", { studentText: "" });
  assert.equal(out.status, 400);
  assert.equal(out.data.error, "missing_session_id");
  pass("missing session ID fails with JSON");

  out = await json("/judge", { sessionId: "not-a-session", studentText: "explanation" });
  assert.equal(out.status, 404);
  pass("unknown session cannot attach to another learner");

  const first = await json("/diagnose", { imageBase64: "aGVsbG8=" });
  const second = await json("/diagnose", { imageBase64: "aGVsbG8=" });
  assert.equal(first.status, 200);
  assert.notEqual(first.data.sessionId, second.data.sessionId);
  assert.equal(first.data.diagnosable, true);
  pass("diagnose creates isolated fixture sessions");

  out = await json("/diagnose", {
    questionText: "For a quadratic equation I used b over a as the product of its roots because b is next to x.",
  });
  assert.equal(out.status, 200);
  assert.equal(out.data.diagnosable, true);
  assert.ok(out.data.sessionId);
  pass("voice or text reasoning can start a session without an image");

  const sid = first.data.sessionId;
  out = await json("/verify", { sessionId: sid });
  assert.equal(out.status, 409);
  pass("verify cannot run before a passing Judge verdict");

  out = await json("/chintu", { sessionId: sid, studentText: "" });
  assert.equal(out.status, 200);
  pass("Chintu opener is legal exactly at debate start");

  const weak = "because relative motion";
  out = await json("/judge", { sessionId: sid, studentText: weak });
  assert.equal(out.data.passed, false);
  pass("fixture Judge rejects first teaching attempt");

  out = await json("/chintu", { sessionId: sid, studentText: weak });
  assert.equal(out.status, 200);
  pass("matching Chintu reaction records the turn once");

  const strong = "The contacting surfaces tend to slip relative to each other, so friction opposes that contact slipping rather than ground velocity.";
  out = await json("/judge", { sessionId: sid, studentText: strong });
  assert.equal(out.data.passed, true);
  pass("second fixture teaching attempt advances to judging");

  out = await json("/chintu", { sessionId: sid, studentText: "unjudged extra text" });
  assert.equal(out.status, 409);
  pass("judging stage rejects arbitrary unjudged Chintu input");

  out = await json("/chintu", { sessionId: sid, studentText: strong });
  assert.equal(out.status, 200);
  out = await json("/chintu", { sessionId: sid, studentText: strong });
  assert.equal(out.status, 409);
  pass("post-pass Chintu reaction is exact and one-shot");

  const verify1 = await json("/verify", { sessionId: sid });
  const verify2 = await json("/verify", { sessionId: sid });
  assert.equal(verify1.status, 200);
  assert.deepEqual(verify2.data, verify1.data);
  pass("Verifier is idempotent");

  out = await json("/judge", { sessionId: sid, studentText: "The contact patch tends to slip backward, so road friction acts forward." });
  assert.equal(out.data.passed, true);
  out = await json("/judge", { sessionId: sid, studentText: "again" });
  assert.equal(out.status, 409);
  pass("transfer pass completes and seals the session");

  out = await json("/judge", { sessionId: second.data.sessionId, studentText: "the other learner's first attempt" });
  assert.equal(out.data.passed, false);
  pass("one learner's fixture progression cannot advance another session");

  out = await json("/diagnose", null, { raw: "{broken" });
  assert.equal(out.status, 400);
  assert.deepEqual(out.data, { error: "invalid_json", fallback: true });
  pass("malformed JSON never produces an HTML error page");

  out = await json("/tts", { text: "" });
  assert.equal(out.status, 400);
  out = await json("/tts", { text: "x".repeat(2001) });
  assert.equal(out.status, 400);
  pass("TTS validates blank and oversized text in fixture mode");

  const missingAudio = await fetch(`${base}/stt`, { method: "POST", body: new FormData() });
  assert.equal(missingAudio.status, 400);
  const form = new FormData();
  form.append("audio", new Blob([Buffer.from("fixture audio")], { type: "audio/webm" }), "turn.webm");
  form.append("lang", "en");
  form.append("sessionId", second.data.sessionId);
  const stt = await fetch(`${base}/stt`, { method: "POST", body: form });
  assert.equal(stt.status, 200);
  assert.ok((await stt.json()).text);
  pass("STT validates audio and supports per-session fixture sequencing");

  const isolated = createSession();
  applyDiagnosis(isolated, { misconception_id: "M-FRIC-04" });
  addStudentTurnOnce(isolated, "same words", "judge");
  addStudentTurnOnce(isolated, "same words", "chintu");
  assert.equal(isolated.turns.filter((t) => t.role === "student").length, 1);
  addStudentTurnOnce(isolated, "same words", "judge");
  assert.equal(isolated.turns.filter((t) => t.role === "student").length, 2);
  pass("orchestrator deduplicates paired routes but keeps genuine repeats");

  const illegal = createSession();
  applyDiagnosis(illegal, { misconception_id: "M-FRIC-04" });
  applyJudge(illegal, { passed: true, belief_strength: 0.1, scores: {} });
  assert.equal(illegal.stage, "judging");
  applyTransfer(illegal, { problem_text: "new", expected_reasoning: "reason" });
  assert.equal(illegal.stage, "transfer");
  pass("state machine never labels transfer before a problem is installed");

  const dynamicSession = {
    beliefStrength: 0.87,
    diagnosis: {
      dynamic: true,
      misconception_id: "DYN-ALGEBRA-TEST",
      topic: "Algebra",
      concept: "Product of roots",
      misconception: "The product of roots equals b/a.",
      correct_model: "The product of roots equals c/a.",
      debate_problem: "Find the product of roots of 2x² + 7x + 3.",
      transfer_contexts: ["forming a polynomial from roots", "checking factorisation"],
    },
  };
  const dynamicChintu = chintuFallbackForSession(dynamicSession, "but why?");
  const dynamicTransfer = transferFallbackForSession(dynamicSession);
  assert.ok(dynamicChintu.reply.includes("product of roots"));
  assert.ok(!dynamicChintu.reply.toLowerCase().includes("friction"));
  assert.equal(dynamicTransfer.misconception_id, "DYN-ALGEBRA-TEST");
  assert.ok(!dynamicTransfer.problem_text.toLowerCase().includes("friction"));
  pass("dynamic module fallbacks stay on the Vision-derived concept");

  assert.ok(cleanupExpired(Date.now() + 61 * 60 * 1000) >= 2);
  pass("idle session TTL cleanup removes expired state");

  console.log(`\n${passed} core checks passed`);
} catch (err) {
  console.error("FAIL:", err);
  if (serverLog) console.error(serverLog);
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
}
