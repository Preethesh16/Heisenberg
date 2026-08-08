import { useCallback, useReducer, useRef } from "react";
import * as api from "../api/client";
import fallbackDiagnosis from "../mocks/diagnosis.json";
import fallbackVerify from "../mocks/verify.json";

// One hook owns the whole Session (CONTRACTS.md §1) plus a small ui slice.
// It also stands in for server/orchestrator.js until Jeswin's state machine
// is live: each student turn fans out to Chintu and the Judge; only the
// Judge's passed:true moves the stage forward. If the real orchestrator
// sequences differently, this is the only file that changes.

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
      // Chintu's opener is already in flight — hold the mic until it lands.
      return {
        ...state,
        stage: "debate",
        id: action.sessionId ?? state.id,
        diagnosis: action.diagnosis,
        ui: { ...state.ui, emotion: "thinking", isChintuThinking: true },
      };
    case "STUDENT_TURN_SENT":
      return {
        ...state,
        turns: [...state.turns, { role: "student", text: action.text }],
        ui: { ...state.ui, emotion: "listening", gesture: null, isChintuThinking: true },
      };
    case "CHINTU_APPLIED": {
      const { chintu, judge, lock } = action;
      return {
        ...state,
        turns: [...state.turns, { role: "chintu", text: chintu.reply, emotion: chintu.emotion }],
        beliefStrength: judge ? judge.belief_strength : chintu.belief_strength,
        scores: judge ? { ...state.scores, ...judge.scores } : state.scores,
        ui: {
          ...state.ui,
          emotion: chintu.emotion,
          gesture: chintu.gesture,
          // lock=true keeps the mic closed through the pass-to-transfer hold
          isChintuThinking: !!lock,
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
        ui: { ...state.ui, emotion: "happy", gesture: null, isChintuThinking: false },
      };
    case "TRANSFER_ANSWERED": {
      const { judge } = action;
      return {
        ...state,
        stage: "done",
        beliefStrength: judge?.belief_strength ?? state.beliefStrength,
        scores: { ...state.scores, ...(judge?.scores ?? {}), transfer: true },
        ui: { ...state.ui, emotion: "convinced", gesture: "nod", isChintuThinking: false },
      };
    }
    case "TRANSFER_RETRY": {
      // The Judge said the transfer answer didn't hold — stay here, mic open.
      const { judge } = action;
      return {
        ...state,
        beliefStrength: judge?.belief_strength ?? state.beliefStrength,
        scores: { ...state.scores, ...(judge?.scores ?? {}) },
        ui: { ...state.ui, emotion: "thinking", gesture: null, isChintuThinking: false },
      };
    }
    case "TURN_FAILED":
      // Quiet recovery: the turn is in the transcript, the mic reopens,
      // the student simply speaks again. Never an error screen.
      return { ...state, ui: { ...state.ui, gesture: null, isChintuThinking: false } };
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
    // Local id is the mock-mode fallback; the server's diagnose response
    // carries the authoritative sessionId.
    const localId = `s-${Math.random().toString(36).slice(2, 10)}`;
    idRef.current = localId;
    dispatch({ type: "UPLOAD_SUBMITTED", sessionId: localId, handwritingUrl, startedAt: Date.now() });

    let response;
    try {
      response = await api.diagnose({ imageBase64, questionText });
    } catch {
      // Diagnosis unreachable → demo default, per the CLAUDE.md failure table.
      response = fallbackDiagnosis;
    }
    const { sessionId: serverId, ...diagnosis } = response;
    if (serverId) idRef.current = serverId;
    dispatch({ type: "DIAGNOSIS_RECEIVED", diagnosis, sessionId: idRef.current });

    // Chintu opens the debate with the fresh problem before the student speaks.
    try {
      const opener = await api.chintuTurn({ sessionId: idRef.current, studentText: "" });
      setTimeout(() => dispatch({ type: "CHINTU_APPLIED", chintu: opener, judge: null }), REACTION_LAG_MS);
    } catch {
      dispatch({ type: "TURN_FAILED" }); // mic opens; the student starts instead
    }
  }, []);

  const sendStudentTurn = useCallback(async (text) => {
    const sessionId = idRef.current;
    dispatch({ type: "STUDENT_TURN_SENT", text });
    let chintu, judge;
    try {
      [chintu, judge] = await Promise.all([
        api.chintuTurn({ sessionId, studentText: text }),
        api.judgeTurn({ sessionId, studentText: text }),
      ]);
    } catch {
      dispatch({ type: "TURN_FAILED" });
      return;
    }
    // The reply exists in memory now; the visible reaction waits. Only the
    // Judge advances the stage — should_yield is presentation, not verdict.
    setTimeout(() => {
      dispatch({ type: "CHINTU_APPLIED", chintu, judge, lock: judge.passed });
      if (judge.passed) {
        setTimeout(async () => {
          dispatch({ type: "JUDGING" });
          let problem;
          try {
            problem = await api.verify({ sessionId });
          } catch {
            problem = fallbackVerify; // transfer still happens, from the bundled fixture
          }
          dispatch({ type: "VERIFY_RECEIVED", problem });
        }, YIELD_HOLD_MS);
      }
    }, REACTION_LAG_MS);
  }, []);

  const sendTransferAnswer = useCallback(async (text) => {
    const sessionId = idRef.current;
    dispatch({ type: "STUDENT_TURN_SENT", text });
    let judge;
    try {
      judge = await api.judgeTurn({ sessionId, studentText: text });
    } catch {
      dispatch({ type: "TURN_FAILED" });
      return;
    }
    // Transfer is verified by the Judge, never by the act of answering.
    setTimeout(() => {
      if (judge.passed) dispatch({ type: "TRANSFER_ANSWERED", judge });
      else dispatch({ type: "TRANSFER_RETRY", judge });
    }, REACTION_LAG_MS);
  }, []);

  const activateSttFallback = useCallback(() => dispatch({ type: "STT_FALLBACK" }), []);
  const consumeAudio = useCallback(() => dispatch({ type: "AUDIO_CONSUMED" }), []);

  return { session, startSession, sendStudentTurn, sendTransferAnswer, activateSttFallback, consumeAudio };
}
