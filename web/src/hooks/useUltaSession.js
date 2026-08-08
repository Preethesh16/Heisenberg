import { useCallback, useReducer, useRef } from "react";
import * as api from "../api/client";

// One hook owns the whole Session (CONTRACTS.md §1) plus a small ui slice.
// It also stands in for server/orchestrator.js until Jeswin's state machine
// is live: each student turn fans out to Chintu and the Judge, a pass moves
// the stage forward. If the real orchestrator sequences differently, this is
// the only file that changes.

const REACTION_LAG_MS = 400; // face and meter react after the turn, never with it
const YIELD_HOLD_MS = 2200; // let the convinced line land before the stage moves

const initialState = {
  id: null,
  stage: "upload",
  diagnosis: null,
  turns: [],
  beliefStrength: 1.0,
  scores: { solve: 0, spot: 0, explain: 0, transfer: false },
  transferProblem: null,
  startedAt: null,
  ui: {
    emotion: "idle",
    gesture: null,
    isChintuThinking: false,
    sttFallbackActive: false,
    handwritingUrl: null,
    pendingAudio: null, // { text, emotion } for the tts effect in SessionScreen
  },
};

function reducer(state, action) {
  switch (action.type) {
    case "UPLOAD_SUBMITTED":
      return {
        ...state,
        id: action.sessionId,
        stage: "diagnosing",
        startedAt: action.startedAt,
        ui: { ...state.ui, handwritingUrl: action.handwritingUrl },
      };
    case "DIAGNOSIS_RECEIVED":
      return { ...state, stage: "debate", diagnosis: action.diagnosis };
    case "STUDENT_TURN_SENT":
      return {
        ...state,
        turns: [...state.turns, { role: "student", text: action.text }],
        ui: { ...state.ui, emotion: "listening", gesture: null, isChintuThinking: true },
      };
    case "CHINTU_THINKING":
      return { ...state, ui: { ...state.ui, emotion: "thinking", isChintuThinking: true } };
    case "CHINTU_APPLIED": {
      const { chintu, judge } = action;
      return {
        ...state,
        turns: [...state.turns, { role: "chintu", text: chintu.reply, emotion: chintu.emotion }],
        beliefStrength: judge ? judge.belief_strength : chintu.belief_strength,
        scores: judge ? { ...state.scores, ...judge.scores } : state.scores,
        ui: {
          ...state.ui,
          emotion: chintu.emotion,
          gesture: chintu.gesture,
          isChintuThinking: false,
          pendingAudio: { text: chintu.reply, emotion: chintu.emotion },
        },
      };
    }
    case "JUDGING":
      return { ...state, stage: "judging" };
    case "VERIFY_RECEIVED":
      return {
        ...state,
        stage: "transfer",
        transferProblem: action.problem,
        ui: { ...state.ui, emotion: "happy", gesture: null },
      };
    case "TRANSFER_ANSWERED":
      return {
        ...state,
        stage: "done",
        scores: { ...state.scores, transfer: true },
        ui: { ...state.ui, emotion: "convinced", gesture: "nod" },
      };
    case "STT_FALLBACK":
      return { ...state, ui: { ...state.ui, sttFallbackActive: true } };
    case "AUDIO_CONSUMED":
      return { ...state, ui: { ...state.ui, pendingAudio: null } };
    default:
      return state;
  }
}

export default function useUltaSession() {
  const [session, dispatch] = useReducer(reducer, initialState);
  const idRef = useRef(null);

  const startSession = useCallback(async ({ imageBase64, questionText, handwritingUrl }) => {
    const sessionId = `s-${Math.random().toString(36).slice(2, 10)}`;
    idRef.current = sessionId;
    dispatch({ type: "UPLOAD_SUBMITTED", sessionId, handwritingUrl, startedAt: Date.now() });
    const diagnosis = await api.diagnose({ imageBase64, questionText });
    dispatch({ type: "DIAGNOSIS_RECEIVED", diagnosis });
    // Chintu opens the debate with the fresh problem before the student speaks.
    const opener = await api.chintuTurn({ sessionId, studentText: "" });
    setTimeout(() => dispatch({ type: "CHINTU_APPLIED", chintu: opener, judge: null }), REACTION_LAG_MS);
  }, []);

  const sendStudentTurn = useCallback(async (text) => {
    const sessionId = idRef.current;
    dispatch({ type: "STUDENT_TURN_SENT", text });
    const [chintu, judge] = await Promise.all([
      api.chintuTurn({ sessionId, studentText: text }),
      api.judgeTurn({ sessionId, studentText: text }),
    ]);
    // The reply exists in memory now; the visible reaction waits.
    setTimeout(() => {
      dispatch({ type: "CHINTU_APPLIED", chintu, judge });
      if (judge.passed || chintu.should_yield) {
        setTimeout(async () => {
          dispatch({ type: "JUDGING" });
          const problem = await api.verify({ sessionId });
          dispatch({ type: "VERIFY_RECEIVED", problem });
        }, YIELD_HOLD_MS);
      }
    }, REACTION_LAG_MS);
  }, []);

  const sendTransferAnswer = useCallback(async (text) => {
    dispatch({ type: "STUDENT_TURN_SENT", text });
    // The Verifier already framed the problem; for the demo loop the answer
    // closes the session. The real orchestrator may re-judge here.
    setTimeout(() => dispatch({ type: "TRANSFER_ANSWERED" }), REACTION_LAG_MS + 600);
  }, []);

  const activateSttFallback = useCallback(() => dispatch({ type: "STT_FALLBACK" }), []);
  const consumeAudio = useCallback(() => dispatch({ type: "AUDIO_CONSUMED" }), []);

  return { session, startSession, sendStudentTurn, sendTransferAnswer, activateSttFallback, consumeAudio };
}
