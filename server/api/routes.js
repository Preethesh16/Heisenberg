import { Router } from "express";
import multer from "multer";
import { fixture, useFixtures } from "../lib/fixtures.js";
import * as orch from "../orchestrator.js";
import { transcribe } from "../voice/sarvam.js";
import { speak } from "../voice/maya.js";

export const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Agents are Deepthi's files (server/agents/). Until one lands, its fixture
// answers instead — main must always run end to end (CLAUDE.md).
async function agent(name) {
  try {
    return await import(`../agents/${name}.js`);
  } catch {
    return null;
  }
}

router.get("/health", (_req, res) => {
  res.json({ ok: true, fixtures: useFixtures() });
});

router.post("/diagnose", async (req, res) => {
  const session = orch.createSession();
  session.stage = "diagnosing";

  let result = null;
  if (!useFixtures()) {
    const mod = await agent("diagnose");
    if (mod?.diagnose) {
      try {
        result = await mod.diagnose(req.body ?? {});
      } catch (err) {
        console.warn("[diagnose] agent failed, falling back to fixture:", err.message);
      }
    }
  }
  // UNKNOWN, low confidence, or no agent yet → demo default (CLAUDE.md failure table)
  if (!result || result.misconception_id === "UNKNOWN") result = await fixture("diagnosis");

  orch.applyDiagnosis(session, result);
  // sessionId is additive to the frozen contract shape — flagged for Sync 1
  res.json({ ...result, sessionId: session.id });
});

router.post("/chintu", async (req, res) => {
  const { sessionId, studentText } = req.body ?? {};
  const session = orch.getSession(sessionId);
  if (studentText) orch.addTurn(session, { role: "student", text: studentText });

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
  if (!out) out = await fixture("chintu-turn-1");

  orch.applyChintu(session, out);
  res.json(out);
});

router.post("/judge", async (req, res) => {
  const { sessionId, studentText } = req.body ?? {};
  const session = orch.getSession(sessionId);
  const isTransferAnswer = session.stage === "transfer";
  session.stage = "judging";

  let verdict = null;
  if (!useFixtures()) {
    const mod = await agent("judge");
    if (mod?.judge) {
      try {
        verdict = await mod.judge({ session, studentText });
      } catch (err) {
        console.warn("[judge] agent failed, falling back to fixture:", err.message);
      }
    }
  }
  // Fixture arc: first judge call fails, later ones pass — so USE_FIXTURES=true
  // clicks through the full fail → teach again → pass story.
  if (!verdict) verdict = await fixture(session.judgeCalls >= 1 ? "judge-pass" : "judge-fail");

  orch.applyJudge(session, verdict, { transfer: isTransferAnswer });
  res.json(verdict);
});

router.post("/verify", async (req, res) => {
  const session = orch.getSession(req.body?.sessionId);

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
  const lang = req.body?.lang || "en";
  if (useFixtures()) return res.json(await fixture("stt"));
  try {
    if (!req.file) throw new Error("no audio in form data");
    res.json(await transcribe(req.file.buffer, req.file.mimetype, lang));
  } catch (err) {
    // Quiet degradation: the mic reveals a text input, never an error screen.
    console.warn("[stt] failed:", err.message);
    res.json({ text: "", lang, fallback: true });
  }
});

router.post("/tts", async (req, res) => {
  const { text, emotion } = req.body ?? {};
  if (useFixtures()) return res.json(await fixture("tts"));
  try {
    res.json({ audioUrl: await speak(text, emotion) });
  } catch (err) {
    // Quiet degradation: captions carry the turn, never an error screen.
    console.warn("[tts] failed:", err.message);
    res.json({ audioUrl: null });
  }
});
