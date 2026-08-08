// Mock-mode helpers. Turn counting lives here so client.js stays a thin switch.
// Simulated network latency is separate from the deliberate 400ms reaction lag
// in useUltaSession — do not merge the two.

import chintuTurns from "../mocks/chintu-turns.json";
import judgeFails from "../mocks/judge-fail.json";
import judgePass from "../mocks/judge-pass.json";

const counters = new Map();

function nextIndex(sessionId, key) {
  const k = `${sessionId}:${key}`;
  const n = counters.get(k) ?? 0;
  counters.set(k, n + 1);
  return n;
}

export function resetMockSession(sessionId) {
  for (const k of counters.keys()) {
    if (k.startsWith(`${sessionId}:`)) counters.delete(k);
  }
}

export function delay(ms = 250 + Math.random() * 350) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mockChintuTurn(sessionId) {
  const i = Math.min(nextIndex(sessionId, "chintu"), chintuTurns.length - 1);
  return chintuTurns[i];
}

export function mockJudgeTurn(sessionId) {
  const i = nextIndex(sessionId, "judge");
  return i < judgeFails.length ? judgeFails[i] : judgePass;
}

// Canned student lines so a one-click voice demo works with no real STT behind it.
const studentLines = [
  "But the block is not sliding on the ground, it is sitting on the belt.",
  "Friction does not care about the ground. It acts between the two surfaces that touch.",
  "Relative to the belt, the block slips backward. So friction on the block acts forward, and that is what accelerates it.",
  "The contact patch tends to slip backward, so friction pushes it forward.",
];

export function mockStudentLine(sessionId) {
  const i = Math.min(nextIndex(sessionId, "stt"), studentLines.length - 1);
  return studentLines[i];
}
