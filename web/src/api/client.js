// The only file that knows whether we're on mocks or the real server.
// Signatures match CONTRACTS.md exactly; components never change when
// VITE_USE_MOCKS flips.

import diagnosisFixture from "../mocks/diagnosis.json";
import verifyFixture from "../mocks/verify.json";
import { delay, mockChintuTurn, mockJudgeTurn, mockStudentLine } from "./mockRouter";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export async function diagnose({ imageBase64, questionText }) {
  if (USE_MOCKS) {
    await delay(900);
    return diagnosisFixture;
  }
  return post("/api/diagnose", { imageBase64, questionText });
}

export async function chintuTurn({ sessionId, studentText }) {
  if (USE_MOCKS) {
    await delay();
    return mockChintuTurn(sessionId);
  }
  return post("/api/chintu", { sessionId, studentText });
}

export async function judgeTurn({ sessionId, studentText }) {
  if (USE_MOCKS) {
    await delay();
    return mockJudgeTurn(sessionId);
  }
  return post("/api/judge", { sessionId, studentText });
}

export async function verify({ sessionId }) {
  if (USE_MOCKS) {
    await delay();
    return verifyFixture;
  }
  return post("/api/verify", { sessionId });
}

export async function speechToText({ audioBlob, lang, sessionId }) {
  if (USE_MOCKS) {
    await delay(400);
    return { text: mockStudentLine(sessionId), lang };
  }
  const form = new FormData();
  form.append("audio", audioBlob);
  form.append("lang", lang);
  const res = await fetch("/api/stt", { method: "POST", body: form });
  if (!res.ok) throw new Error(`stt ${res.status}`);
  return res.json();
}

export async function textToSpeech({ text, emotion }) {
  if (USE_MOCKS) {
    // No canned audio — captions carry the mock session, same as a TTS outage.
    return { audioUrl: null };
  }
  return post("/api/tts", { text, emotion });
}
