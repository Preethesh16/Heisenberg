import { useCallback, useReducer, useRef } from "react";
import * as api from "../api/client";

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
    diagnosisIssue: "",
    connectionIssue: "",
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
        ui: { ...state.ui, handwritingUrl: action.handwritingUrl, diagnosisIssue: "", connectionIssue: "" },
      };
    case "DIAGNOSIS_REJECTED":
      return {
        ...initialState,
        ui: { ...initialState.ui, diagnosisIssue: action.reason },
      };
    case "DIAGNOSIS_RECEIVED":
      // Chintu's opener is already in flight — hold the mic until it lands.
      return {
        ...state,
        stage: "debate",
        id: action.sessionId ?? state.id,
        diagnosis: action.diagnosis,
        ui: { ...state.ui, emotion: "thinking", isChintuThinking: true, connectionIssue: "" },
      };
    case "STUDENT_TURN_SENT":
      return {
        ...state,
        turns: [...state.turns, { role: "student", text: action.text }],
        ui: { ...state.ui, emotion: "listening", gesture: null, isChintuThinking: true, connectionIssue: "" },
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
        ui: { ...state.ui, emotion: "happy", gesture: null, isChintuThinking: false, connectionIssue: "" },
      };
    case "VERIFY_FAILED":
      return {
        ...state,
        stage: "judging",
        ui: { ...state.ui, isChintuThinking: false, connectionIssue: action.message },
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
      return {
        ...state,
        ui: {
          ...state.ui,
          gesture: null,
          isChintuThinking: false,
          connectionIssue: action.message || "That turn did not reach the session. Check the connection and try again.",
        },
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
  const turnInFlightRef = useRef(false);

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
      dispatch({
        type: "DIAGNOSIS_REJECTED",
        reason: "Chintu could not reach the diagnosis service. Check the connection and try the photo again.",
      });
      return;
    }
    if (response?.diagnosable === false || response?.misconception_id === "UNKNOWN") {
      dispatch({
        type: "DIAGNOSIS_REJECTED",
        reason: response?.reason || "No clear conceptual error was visible. Include the full question and a sharper view of the working.",
      });
      return;
    }
    const { sessionId: serverId, ...diagnosis } = response;
    if (serverId) idRef.current = serverId;
    dispatch({ type: "DIAGNOSIS_RECEIVED", diagnosis, sessionId: idRef.current });

    // Chintu opens the debate with the fresh problem before the student speaks.
    try {
      const opener = await api.chintuTurn({ sessionId: idRef.current, studentText: "" });
      setTimeout(() => dispatch({ type: "CHINTU_APPLIED", chintu: opener, judge: null }), REACTION_LAG_MS);
    } catch {
      dispatch({ type: "TURN_FAILED", message: "Chintu could not open the conversation. Check the connection and try again." });
    }
  }, []);

  const sendStudentTurn = useCallback(async (text) => {
    if (turnInFlightRef.current) return;
    turnInFlightRef.current = true;
    const sessionId = idRef.current;
    dispatch({ type: "STUDENT_TURN_SENT", text });
    let chintu, judge;
    try {
      // Sequential, judge first. The server session is stateful: parallel
      // calls interleave Chintu's reply with the verdict and verify, and the
      // Judge ends up reading a history where Chintu is still arguing after
      // the pass. Ordered calls keep the narrative coherent for live agents.
      judge = await api.judgeTurn({ sessionId, studentText: text });
      chintu = await api.chintuTurn({ sessionId, studentText: text });
    } catch {
      dispatch({ type: "TURN_FAILED" });
      turnInFlightRef.current = false;
      return;
    }
    turnInFlightRef.current = false;
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
            dispatch({ type: "VERIFY_FAILED", message: "The transfer check could not load. Retry when the connection is back." });
            return;
          }
          dispatch({ type: "VERIFY_RECEIVED", problem });
        }, YIELD_HOLD_MS);
      }
    }, REACTION_LAG_MS);
  }, []);

  const sendTransferAnswer = useCallback(async (text) => {
    if (turnInFlightRef.current) return;
    turnInFlightRef.current = true;
    const sessionId = idRef.current;
    dispatch({ type: "STUDENT_TURN_SENT", text });
    let judge;
    try {
      judge = await api.judgeTurn({ sessionId, studentText: text });
    } catch {
      dispatch({ type: "TURN_FAILED" });
      turnInFlightRef.current = false;
      return;
    }
    turnInFlightRef.current = false;
    // Transfer is verified by the Judge, never by the act of answering.
    setTimeout(() => {
      if (judge.passed) dispatch({ type: "TRANSFER_ANSWERED", judge });
      else dispatch({ type: "TRANSFER_RETRY", judge });
    }, REACTION_LAG_MS);
  }, []);

  const retryVerify = useCallback(async () => {
    if (turnInFlightRef.current || !idRef.current) return;
    turnInFlightRef.current = true;
    dispatch({ type: "JUDGING" });
    try {
      const problem = await api.verify({ sessionId: idRef.current });
      dispatch({ type: "VERIFY_RECEIVED", problem });
    } catch {
      dispatch({ type: "VERIFY_FAILED", message: "The transfer check still cannot load. Check the connection and retry." });
    } finally {
      turnInFlightRef.current = false;
    }
  }, []);

  const activateSttFallback = useCallback(() => dispatch({ type: "STT_FALLBACK" }), []);
  const consumeAudio = useCallback(() => dispatch({ type: "AUDIO_CONSUMED" }), []);

  return { session, startSession, sendStudentTurn, sendTransferAnswer, retryVerify, activateSttFallback, consumeAudio };
}
