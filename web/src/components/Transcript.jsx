import { useEffect, useRef } from "react";
import { copy } from "../utils/copy";

// Captions are the primary channel; audio is enhancement. Every turn renders
// as text no matter what happened to TTS.
export default function Transcript({ turns, isChintuThinking }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, isChintuThinking]);

  return (
    <div className="transcript" aria-live="polite">
      {turns.length === 0 && <p className="transcript__empty">{copy.transcript.empty}</p>}
      {turns.map((turn, i) => (
        <div key={i} className={`transcript__turn transcript__turn--${turn.role}`}>
          <span className="transcript__who">{turn.role === "chintu" ? "Chintu" : "You"}</span>
          <p className="transcript__text">{turn.text}</p>
        </div>
      ))}
      {isChintuThinking && (
        <div className="transcript__turn transcript__turn--chintu transcript__thinking">
          <span className="transcript__who">Chintu</span>
          <p className="transcript__text">…</p>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
