// Control flow is ordinary code. No LLM decides anything in this file — CLAUDE.md.
import { randomUUID } from "node:crypto";

export const STAGES = ["upload", "diagnosing", "debate", "judging", "transfer", "done"];

const sessions = new Map();
let currentId = null;

export function createSession() {
  const session = {
    id: randomUUID(),
    stage: "upload",
    diagnosis: null,
    turns: [],
    beliefStrength: 1.0,
    scores: { solve: 0, spot: 0, explain: 0, transfer: false },
    transferProblem: null,
    judgeCalls: 0,
  };
  sessions.set(session.id, session);
  currentId = session.id;
  return session;
}

// The demo runs one session at a time; a missing or unknown id resolves to the
// active session instead of erroring.
export function getSession(id) {
  if (id && sessions.has(id)) return sessions.get(id);
  if (currentId && sessions.has(currentId)) return sessions.get(currentId);
  return createSession();
}

export function applyDiagnosis(session, diagnosis) {
  session.diagnosis = diagnosis;
  session.stage = "debate";
}

export function addTurn(session, turn) {
  session.turns.push(turn);
}

export function applyChintu(session, out) {
  if (typeof out.belief_strength === "number") session.beliefStrength = out.belief_strength;
  addTurn(session, { role: "chintu", text: out.reply, emotion: out.emotion });
}

export function applyJudge(session, verdict, { transfer = false } = {}) {
  session.judgeCalls += 1;
  if (typeof verdict.belief_strength === "number") session.beliefStrength = verdict.belief_strength;
  if (verdict.scores) session.scores = { ...session.scores, ...verdict.scores };

  if (transfer) {
    // Transfer answers reuse the Judge — contract gap, flagged for Sync 1.
    if (verdict.passed) {
      session.scores.transfer = true;
      session.stage = "done";
    } else {
      session.stage = "transfer";
    }
    return;
  }
  session.stage = verdict.passed ? "transfer" : "debate";
}

export function applyTransfer(session, problem) {
  session.transferProblem = problem;
  session.stage = "transfer";
}
