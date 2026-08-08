// Control flow is ordinary code. No LLM decides anything in this file — CLAUDE.md.
import { randomUUID } from "node:crypto";

export const STAGES = ["upload", "diagnosing", "debate", "judging", "transfer", "done"];

const TTL_MINUTES = Number(process.env.SESSION_TTL_MINUTES) || 60;

const sessions = new Map();

export function createSession() {
  const session = {
    id: randomUUID(),
    stage: "upload",
    diagnosis: null,
    turns: [],
    beliefStrength: 1.0,
    scores: { solve: 0, spot: 0, explain: 0, transfer: false },
    transferProblem: null,
    // Internal bookkeeping — not part of the CONTRACTS §1 session shape.
    debateVerified: false, // debate Judge passed; gates /verify
    pendingTurn: null, // { text, seenBy: Set } — dedupes parallel /chintu + /judge
    fixtureSeq: { chintu: 0, judge: 0, stt: 0 }, // per-session fixture story
    touchedAt: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

// Strict: the exact ID or nothing. No fallback to "most recent session" — that
// attached one user's turns to another user's history (Codex audit P0).
export function getSession(id) {
  if (typeof id !== "string" || id.length === 0) return undefined;
  const session = sessions.get(id);
  if (session) session.touchedAt = Date.now();
  return session;
}

// Both /chintu and /judge record the student turn before their provider calls:
// whichever arrives first writes it, the other recognises it. The same text
// arriving again from the SAME route is a genuine repeated turn and is kept.
export function addStudentTurnOnce(session, studentText, source) {
  if (!studentText) return; // Chintu's opener carries no student turn
  const pending = session.pendingTurn;
  if (pending && pending.text === studentText && !pending.seenBy.has(source)) {
    pending.seenBy.add(source);
    return;
  }
  session.turns.push({ role: "student", text: studentText });
  session.pendingTurn = { text: studentText, seenBy: new Set([source]) };
}

export function applyDiagnosis(session, diagnosis) {
  session.diagnosis = diagnosis;
  session.stage = "debate";
}

export function applyChintu(session, out) {
  if (typeof out.belief_strength === "number") session.beliefStrength = out.belief_strength;
  session.turns.push({ role: "chintu", text: out.reply, emotion: out.emotion });
}

// Debate verdicts: a pass parks the session in "judging" until /verify installs
// the transfer problem — never stage=transfer without one (audit P0). Transfer
// verdicts: a pass completes the session, a fail stays in transfer.
export function applyJudge(session, verdict, { transfer = false } = {}) {
  if (typeof verdict.belief_strength === "number") session.beliefStrength = verdict.belief_strength;
  if (verdict.scores) session.scores = { ...session.scores, ...verdict.scores };

  if (transfer) {
    if (verdict.passed) {
      session.scores.transfer = true;
      session.stage = "done";
    }
    return;
  }
  if (verdict.passed) {
    session.debateVerified = true;
    session.stage = "judging";
  } else {
    session.stage = "debate";
  }
}

export function applyTransfer(session, problem) {
  session.transferProblem = problem;
  session.stage = "transfer";
}

// Sessions idle past the TTL are dropped; anything the demo is touching keeps
// refreshing touchedAt through getSession, so an active session never expires.
export function cleanupExpired(now = Date.now()) {
  const ttlMs = TTL_MINUTES * 60 * 1000;
  let removed = 0;
  for (const [id, session] of sessions) {
    if (now - session.touchedAt > ttlMs) {
      sessions.delete(id);
      removed += 1;
    }
  }
  return removed;
}

export function startCleanup() {
  const timer = setInterval(() => cleanupExpired(), 60 * 1000);
  timer.unref?.();
  return timer;
}
