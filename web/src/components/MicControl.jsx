import { useEffect, useRef, useState } from "react";
import { copy } from "../utils/copy";
import { speechToText } from "../api/client";

// One-click turn recording: click once to listen, click again to transcribe
// and send. The component owns every MediaRecorder/MediaStream cleanup path.
export default function MicControl({ sessionId, lang, onLangChange, onStudentText, sttFallbackActive, onSttFallback, disabled }) {
  const [status, setStatus] = useState("idle");
  const [text, setText] = useState("");
  const [showText, setShowText] = useState(sttFallbackActive);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const operationRef = useRef(0);
  const discardRef = useRef(false);
  const mountedRef = useRef(true);

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (sttFallbackActive) setShowText(true);
  }, [sttFallbackActive]);

  useEffect(() => {
    if (!disabled) return;
    operationRef.current += 1;
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else releaseStream();
    setStatus("idle");
  }, [disabled]);

  useEffect(() => {
    // React StrictMode intentionally runs setup → cleanup → setup in dev.
    // Reset this flag in setup or every recording looks unmounted forever.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try { recorder.stop(); } catch { /* already stopping */ }
      }
      releaseStream();
    };
  }, []);

  async function startRecording() {
    if (disabled || status !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setShowText(true);
      onSttFallback();
      return;
    }

    const operation = ++operationRef.current;
    setStatus("requesting");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!mountedRef.current || operation !== operationRef.current || disabled) {
        stream.getTracks().forEach((track) => track.stop());
        if (mountedRef.current) setStatus("idle");
        return;
      }

      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];
      discardRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        discardRef.current = true;
        releaseStream();
        if (mountedRef.current) {
          setStatus("idle");
          setShowText(true);
          onSttFallback();
        }
      };
      recorder.onstop = async () => {
        releaseStream();
        recorderRef.current = null;
        const shouldDiscard = discardRef.current || operation !== operationRef.current || !mountedRef.current;
        if (shouldDiscard) {
          if (mountedRef.current) setStatus("idle");
          return;
        }

        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!audioBlob.size) {
          setStatus("idle");
          setShowText(true);
          onSttFallback();
          return;
        }

        setStatus("transcribing");
        try {
          const result = await speechToText({ audioBlob, lang, sessionId });
          if (!mountedRef.current || operation !== operationRef.current) return;
          const spoken = result?.text?.trim();
          if (result?.fallback || !spoken) {
            setShowText(true);
            onSttFallback();
          } else {
            onStudentText(spoken);
          }
        } catch {
          if (mountedRef.current && operation === operationRef.current) {
            setShowText(true);
            onSttFallback();
          }
        } finally {
          if (mountedRef.current && operation === operationRef.current) setStatus("idle");
        }
      };

      recorder.start(250);
      setStatus("recording");
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (mountedRef.current && operation === operationRef.current) {
        setStatus("idle");
        setShowText(true);
        onSttFallback();
      }
    }
  }

  function finishRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      setStatus("transcribing");
      recorder.stop();
    }
  }

  function toggleRecording() {
    if (status === "recording") finishRecording();
    else if (status === "idle") startRecording();
  }

  function sendTyped(event) {
    event.preventDefault();
    if (!text.trim() || disabled || status !== "idle") return;
    onStudentText(text.trim());
    setText("");
  }

  const recording = status === "recording";
  const processing = status === "requesting" || status === "transcribing";
  const label = copy.mic[status] || copy.mic.idle;

  return (
    <div className={`mic-control mic-control--${status}`}>
      <div className="mic-control__row">
        <button
          type="button"
          className="mic-control__button"
          onClick={toggleRecording}
          disabled={disabled || processing}
          aria-pressed={recording}
          aria-label={label}
        >
          <span className="mic-control__orb" aria-hidden="true">
            <span /><span /><span />
          </span>
          <span>{label}</span>
        </button>
        <select
          className="mic-control__lang"
          value={lang}
          onChange={(event) => onLangChange(event.target.value)}
          aria-label="Conversation language"
          disabled={disabled || status !== "idle"}
        >
          {copy.languages.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      <div className="mic-control__meta" aria-live="polite">
        <span>{recording ? copy.mic.recordingHint : processing ? copy.mic.processingHint : copy.mic.idleHint}</span>
        {!showText && (
          <button type="button" onClick={() => setShowText(true)} disabled={disabled}>Type instead</button>
        )}
      </div>

      {showText && (
        <form className="mic-control__fallback" onSubmit={sendTyped}>
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={copy.mic.textPlaceholder}
            disabled={disabled || status !== "idle"}
          />
          <button type="submit" disabled={disabled || status !== "idle" || !text.trim()}>{copy.mic.textSend}</button>
        </form>
      )}
    </div>
  );
}
