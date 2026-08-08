import { useRef, useState } from "react";
import { copy } from "../utils/copy";
import { speechToText } from "../api/client";

// Hold-to-talk, not toggle — a clear turn boundary. If STT fails for any
// reason the text input appears and stays for the rest of the session.
// Never an error screen.
export default function MicControl({ sessionId, lang, onLangChange, onStudentText, sttFallbackActive, onSttFallback, disabled }) {
  const [recording, setRecording] = useState(false);
  const [text, setText] = useState("");
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    if (disabled || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType });
        try {
          const { text: spoken } = await speechToText({ audioBlob, lang, sessionId });
          if (spoken?.trim()) onStudentText(spoken.trim());
        } catch {
          onSttFallback();
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      // Mic denied or unavailable — same quiet fallback as an STT outage.
      onSttFallback();
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  function sendTyped(e) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onStudentText(text.trim());
    setText("");
  }

  return (
    <div className="mic-control">
      <div className="mic-control__row">
        <button
          type="button"
          className={`mic-control__button${recording ? " mic-control__button--live" : ""}`}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={stopRecording}
          disabled={disabled}
        >
          ⏺ {recording ? copy.mic.release : copy.mic.hold}
        </button>
        <select
          className="mic-control__lang"
          value={lang}
          onChange={(e) => onLangChange(e.target.value)}
          aria-label="Language"
        >
          {copy.languages.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
      {sttFallbackActive && (
        <form className="mic-control__fallback" onSubmit={sendTyped}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={copy.mic.textPlaceholder}
            disabled={disabled}
          />
          <button type="submit" disabled={disabled || !text.trim()}>{copy.mic.textSend}</button>
        </form>
      )}
    </div>
  );
}
