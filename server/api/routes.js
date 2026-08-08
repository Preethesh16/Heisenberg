import { Router } from "express";
import multer from "multer";
import { fixture, useFixtures } from "../lib/fixtures.js";
import * as orch from "../orchestrator.js";
import { transcribe } from "../voice/sarvam.js";
import { speak } from "../voice/maya.js";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const EMOTIONS = new Set([
  "idle", "listening", "thinking", "confident", "stubborn",
  "confused", "surprised", "happy", "convinced",
]);
const MAX_IMAGE_BASE64 = 20 * 1024 * 1024; // ~15MB decoded
const MAX_TTS_CHARS = 2000;

const fail = (res, status, code) => res.status(status).json({ error: code, fallback: true });

// Strict session resolution (audit P0): exact ID only, controlled JSON errors,
// never an implicit session, never "the most recently created one".
function requireSession(req, res) {
  const { sessionId } = req.body ?? {};
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    fail(res, 400, "missing_session_id");
    return null;
  }
  const session = orch.getSession(sessionId);
  if (!session) {
    fail(res, 404, "unknown_session");
    return null;
  }
  return session;
}

// Agents are Deepthi's files (server/agents/). A missing or broken module must
// not masquerade as fixture mode silently — log once per failure kind.
const loggedAgentFailures = new Set();
async function agent(name) {
  try {
    return await import(`../agents/${name}.js`);
  } catch (err) {
    const key = `${name}:${err.code || err.name}`;
    if (!loggedAgentFailures.has(key)) {
      loggedAgentFailures.add(key);
      const reason = String(err.message || err).split("\n")[0];
      console.warn(`[agents] ${name} unavailable (${err.code || err.name}: ${reason}) — fallback active`);
    }
    return null;
  }
}

// ---- Fixture story (audit P1) ----------------------------------------------
// One believable demo session, sequenced per session: confidently wrong opener
// → incomplete student answer → judge fail → argue back → full mechanism →
// judge pass → transfer answer → transfer pass. STT has no sessionId in the
// frozen contract, so its sequence is module-scoped and resets on /diagnose —
// fixture mode is the single-laptop demo path.
const CHINTU_STORY = ["chintu-opener", "chintu-turn-1", "chintu-yield"];
const STT_STORY = ["stt-1", "stt-2", "stt-3"];
let sttFixtureSeq = 0;

async function nextChintuFixture(session) {
  const i = Math.min(session.fixtureSeq.chintu, CHINTU_STORY.length - 1);
  session.fixtureSeq.chintu += 1;
  return fixture(CHINTU_STORY[i]);
}

async function nextJudgeFixture(session, isTransfer) {
  if (isTransfer) return fixture("judge-pass");
  const i = session.fixtureSeq.judge;
  session.fixtureSeq.judge += 1;
  return fixture(i === 0 ? "judge-fail" : "judge-pass");
}

async function nextSttFixture(sessionId) {
  const session = orch.getSession(sessionId);
  if (session) {
    const i = Math.min(session.fixtureSeq.stt, STT_STORY.length - 1);
    session.fixtureSeq.stt += 1;
    return fixture(STT_STORY[i]);
  }
  const i = Math.min(sttFixtureSeq, STT_STORY.length - 1);
  sttFixtureSeq += 1;
  return fixture(STT_STORY[i]);
}

// A broken evaluator never advances the session (audit P0). Used only when the
// judge module is missing, throws, or returns a malformed verdict in real mode.
function failClosedVerdict(session) {
  return {
    passed: false,
    belief_strength: session.beliefStrength,
    tone: "neutral",
    repair_evidence: "",
    missing: "The judge could not evaluate this turn. Ask the student to explain once more.",
    scores: {
      solve: session.scores.solve,
      spot: session.scores.spot,
      explain: session.scores.explain,
    },
  };
}

// ---- Routes -----------------------------------------------------------------

router.get("/health", (_req, res) => {
  res.json({ ok: true, fixtures: useFixtures() });
});

router.post("/diagnose", async (req, res) => {
  const { imageBase64, questionText } = req.body ?? {};
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) return fail(res, 400, "invalid_image");
  if (imageBase64.length > MAX_IMAGE_BASE64) return fail(res, 413, "image_too_large");
  if (questionText !== undefined && typeof questionText !== "string") return fail(res, 400, "invalid_request");

  const session = orch.createSession();
  session.stage = "diagnosing";
  sttFixtureSeq = 0; // a fresh demo session restarts the fixture story

  let result = null;
  if (!useFixtures()) {
    const mod = await agent("diagnose");
    if (mod?.diagnose) {
      try {
        result = await mod.diagnose({ imageBase64, questionText });
      } catch (err) {
        console.warn("[diagnose] agent failed, falling back to fixture:", err.message);
      }
    }
  }
  // UNKNOWN, low confidence, or no agent → demo default (CLAUDE.md failure table)
  if (!result || result.misconception_id === "UNKNOWN") result = await fixture("diagnosis");

  orch.applyDiagnosis(session, result);
  // sessionId is additive to the frozen contract shape — flagged for sync
  res.json({ ...result, sessionId: session.id });
});

router.post("/chintu", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { studentText } = req.body ?? {};
  if (studentText !== undefined && typeof studentText !== "string") return fail(res, 400, "invalid_request");
  // Debate turns, plus the yield line: the frontend sequences judge-first, so
  // Chintu's reaction to a passing verdict arrives while the session sits in
  // "judging" (before /verify installs the transfer problem).
  if (session.stage !== "debate" && session.stage !== "judging") return fail(res, 409, "invalid_stage");
  // Empty text is legal only for Chintu's opening turn.
  if (!studentText && session.turns.some((t) => t.role === "student")) return fail(res, 400, "invalid_request");

  orch.addStudentTurnOnce(session, studentText, "chintu");

  let out = null;
  if (!useFixtures()) {
    const mod = await agent("chintu");
    if (mod?.chintu) {
      try {
        out = await mod.chintu({ session, studentText });
      } catch (err) {
        console.warn("[chintu] agent failed, falling back to fixture:", err.message);
      }
    }
  }
  if (!out) out = await nextChintuFixture(session);

  orch.applyChintu(session, out);
  res.json(out);
});

router.post("/judge", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { studentText } = req.body ?? {};
  if (typeof studentText !== "string" || studentText.length === 0) return fail(res, 400, "invalid_request");

  // Legal stages only: debate verdicts during debate, transfer verdicts only
  // once a transfer problem is installed. Anything else is rejected unchanged.
  const isTransfer = session.stage === "transfer" && session.transferProblem != null;
  if (!isTransfer && session.stage !== "debate") return fail(res, 409, "invalid_stage");

  orch.addStudentTurnOnce(session, studentText, "judge");

  let verdict = null;
  if (useFixtures()) {
    verdict = await nextJudgeFixture(session, isTransfer);
  } else {
    const mod = await agent("judge");
    if (mod?.judge) {
      try {
        const raw = await mod.judge({ session, studentText });
        if (raw && typeof raw.passed === "boolean") verdict = raw;
        else console.warn("[judge] malformed verdict — failing closed");
      } catch (err) {
        console.warn("[judge] agent failed — failing closed:", err.message);
      }
    }
    if (!verdict) verdict = failClosedVerdict(session);
  }

  orch.applyJudge(session, verdict, { transfer: isTransfer });
  res.json(verdict);
});

router.post("/verify", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  // Idempotent: never silently replace an installed transfer problem.
  if (session.transferProblem) return res.json(session.transferProblem);
  if (!session.debateVerified) return fail(res, 409, "invalid_stage");

  let out = null;
  if (!useFixtures()) {
    const mod = await agent("verify");
    if (mod?.verify) {
      try {
        out = await mod.verify({ session });
      } catch (err) {
        console.warn("[verify] agent failed, falling back to fixture:", err.message);
      }
    }
  }
  if (!out) out = await fixture("verify");

  orch.applyTransfer(session, out);
  res.json(out);
});

router.post("/stt", upload.single("audio"), async (req, res) => {
  const lang = typeof req.body?.lang === "string" && req.body.lang ? req.body.lang : "en";
  if (useFixtures()) return res.json(await nextSttFixture(req.body?.sessionId));

  if (!req.file || req.file.size === 0) return fail(res, 400, "missing_audio");
  if (!/^audio\//.test(req.file.mimetype || "")) return fail(res, 400, "invalid_audio");

  try {
    const out = await transcribe(req.file.buffer, req.file.mimetype, lang);
    if (!out.text) {
      // Sarvam can 200 with an empty transcript; the mic must still reveal the
      // text input instead of silently doing nothing (audit P1).
      return res.json({ text: "", lang, fallback: true });
    }
    res.json(out);
  } catch (err) {
    // Quiet degradation: the mic reveals a text input, never an error screen.
    console.warn("[stt] failed:", err.message);
    res.json({ text: "", lang, fallback: true });
  }
});

router.post("/tts", async (req, res) => {
  const { text } = req.body ?? {};
  let { emotion } = req.body ?? {};
  if (typeof text !== "string" || text.trim().length === 0) return fail(res, 400, "invalid_request");
  if (text.length > MAX_TTS_CHARS) return fail(res, 400, "text_too_long");
  if (typeof emotion !== "string" || !EMOTIONS.has(emotion)) emotion = undefined; // normalize safely

  if (useFixtures()) return res.json(await fixture("tts"));
  try {
    res.json({ audioUrl: await speak(text, emotion) });
  } catch (err) {
    // Quiet degradation: captions carry the turn, never an error screen.
    console.warn("[tts] failed:", err.message);
    res.json({ audioUrl: null });
  }
});
