import { useEffect, useRef, useState } from "react";
import RoleBanner from "./RoleBanner";
import MisconceptionCard from "./MisconceptionCard";
import ChintuPanel from "./ChintuPanel";
import Transcript from "./Transcript";
import MicControl from "./MicControl";
import StageRail from "./StageRail";
import HandwritingThumbnail from "./HandwritingThumbnail";
import { copy } from "../utils/copy";
import { textToSpeech } from "../api/client";

export default function SessionScreen({ session, sendStudentTurn, sendTransferAnswer, retryVerify, activateSttFallback, consumeAudio }) {
  const { stage, diagnosis, turns, beliefStrength, transferProblem, startedAt, ui } = session;
  const [lang, setLang] = useState("en");
  const [speaking, setSpeaking] = useState(false);
  // One <audio> element for the whole session — createMediaElementSource only
  // runs once per element, so we swap src per turn instead of remounting.
  const audioRef = useRef(null);
  // A newer Chintu line supersedes an in-flight TTS request; unmount voids all.
  const ttsSeqRef = useRef(0);
  useEffect(() => () => { ttsSeqRef.current = -1; }, []);

  useEffect(() => {
    const item = ui.pendingAudio;
    if (!item) return;
    const seq = ++ttsSeqRef.current;
    consumeAudio(); // clears pendingAudio; `item` is already captured, request runs once
    (async () => {
      try {
        const { audioUrl } = await textToSpeech(item);
        if (seq !== ttsSeqRef.current || !audioUrl || !audioRef.current) return;
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
      } catch {
        // TTS down or play() rejected — captions already carry the line.
        setSpeaking(false);
      }
    })();
  }, [ui.pendingAudio, consumeAudio]);

  const inDebate = stage === "debate";
  const inTransfer = stage === "transfer";
  const micDisabled = ui.isChintuThinking || stage === "judging";
  const onStudentText = inTransfer ? sendTransferAnswer : sendStudentTurn;

  return (
    <div className="session-screen">
      <RoleBanner stage={stage} startedAt={startedAt} />

      {diagnosis && (
        <MisconceptionCard
          misconceptionId={diagnosis.misconception_id}
          misconception={diagnosis.misconception}
          topic={diagnosis.topic}
          concept={diagnosis.concept}
        />
      )}

      {inTransfer && transferProblem && (
        <section className="transfer-card">
          <span className="transfer-card__label">{transferProblem.context_label}</span>
          <p className="transfer-card__intro">{copy.transferIntro}</p>
          <p className="transfer-card__problem">{transferProblem.problem_text}</p>
        </section>
      )}

      {ui.connectionIssue && (
        <div className="connection-banner" role="status">
          <span>{ui.connectionIssue}</span>
          {stage === "judging" && <button type="button" onClick={retryVerify}>Retry transfer</button>}
        </div>
      )}

      <div className="session-screen__main">
        <div className="session-screen__left">
          <ChintuPanel
            emotion={ui.emotion}
            gesture={ui.gesture}
            beliefStrength={beliefStrength}
            speaking={speaking}
            audioRef={audioRef}
          />
          <HandwritingThumbnail src={ui.handwritingUrl} />
        </div>

        <div className="session-screen__right">
          <Transcript turns={turns} isChintuThinking={ui.isChintuThinking} />
          <MicControl
            sessionId={session.id}
            lang={lang}
            onLangChange={setLang}
            onStudentText={onStudentText}
            sttFallbackActive={ui.sttFallbackActive}
            onSttFallback={activateSttFallback}
            disabled={micDisabled || !(inDebate || inTransfer)}
          />
        </div>
      </div>

      <StageRail stage={stage} />

      <audio
        ref={audioRef}
        onPlay={() => setSpeaking(true)}
        onEnded={() => setSpeaking(false)}
        onError={() => setSpeaking(false)}
      />
    </div>
  );
}
