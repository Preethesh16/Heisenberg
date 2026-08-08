import useUltaSession from "./hooks/useUltaSession";
import UploadScreen from "./components/UploadScreen";
import SessionScreen from "./components/SessionScreen";
import DefeatScreen from "./components/DefeatScreen";

// No router. The Stage enum is the whole navigation model.
export default function App() {
  const { session, startSession, sendStudentTurn, sendTransferAnswer, retryVerify, activateSttFallback, consumeAudio } =
    useUltaSession();

  if (session.stage === "upload" || session.stage === "diagnosing") {
    return <UploadScreen stage={session.stage} issue={session.ui.diagnosisIssue} onStart={startSession} />;
  }
  if (session.stage === "done") {
    return <DefeatScreen session={session} />;
  }
  return (
    <SessionScreen
      session={session}
      sendStudentTurn={sendStudentTurn}
      sendTransferAnswer={sendTransferAnswer}
      retryVerify={retryVerify}
      activateSttFallback={activateSttFallback}
      consumeAudio={consumeAudio}
    />
  );
}
