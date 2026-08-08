import { useEffect, useRef, useState } from "react";
import { copy } from "../utils/copy";
import Chintu from "./Chintu";
import MicControl from "./MicControl";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// The diagnosis agent sends images to Claude as image/jpeg, so normalize
// whatever the picker returns (PNG, WEBP, HEIC-decoded) to a JPEG — and cap
// the long edge so phone photos stay well under the backend JSON limit.
async function toJpeg(file, maxDim = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("jpeg encode failed");
  return blob;
}

// The entry flow — one focused action: hand over the page.
export default function UploadScreen({ stage, issue, onStart }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [questionText, setQuestionText] = useState("");
  const [lang, setLang] = useState("en");
  const inputRef = useRef(null);
  const previewRef = useRef(null);
  const diagnosing = stage === "diagnosing";

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  async function pick(f) {
    if (!f) return;
    const jpeg = await toJpeg(f).catch(() => f); // undecodable? send as-is, quietly
    setFile(jpeg);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      const next = URL.createObjectURL(jpeg);
      previewRef.current = next;
      return next;
    });
  }

  async function start(textOverride = questionText) {
    const learnerText = String(textOverride || "").trim();
    if ((!file && !learnerText) || diagnosing) return;
    if (learnerText) setQuestionText(learnerText);
    const imageBase64 = file ? await fileToBase64(file) : undefined;
    const handwritingUrl = file ? `data:${file.type || "image/jpeg"};base64,${imageBase64}` : null;
    onStart({ imageBase64, questionText: learnerText || undefined, handwritingUrl });
  }

  return (
    <main className="upload-screen">
      <div className="ambient-orb ambient-orb--one" />
      <div className="ambient-orb ambient-orb--two" />

      <section className="upload-screen__intro">
        <span className="upload-screen__eyebrow">Multimodal teach-back learning</span>
        <h1 className="upload-screen__logo">{copy.appName}</h1>
        <p className="upload-screen__tagline">{copy.tagline}</p>
        <p className="upload-screen__promise">Tell or show Chintu how you reasoned. He picks up the idea behind the mistake, then you teach him out of it.</p>
        <div className="upload-screen__chips" aria-label="How it works">
          <span>Scan any subject</span><span>Talk naturally</span><span>Prove it transfers</span>
        </div>
        <div className="upload-screen__mascot"><Chintu emotion="thinking" beliefStrength={0.86} size={210} /></div>
      </section>

      <aside className="intake-sidebar" aria-label="Chat with Chintu">
        <header className="intake-sidebar__header">
          <div className="intake-sidebar__avatar"><Chintu emotion={diagnosing ? "thinking" : "listening"} beliefStrength={0.86} size={76} /></div>
          <div>
            <span>Chintu · study buddy</span>
            <strong>{copy.upload.heading}</strong>
          </div>
          <i aria-hidden="true" />
        </header>

        <div className="intake-sidebar__messages" aria-live="polite">
          <div className="intake-message intake-message--chintu">
            <span>Chintu</span>
            <p>{copy.upload.chatIntro}</p>
          </div>
          {questionText && (
            <div className="intake-message intake-message--student">
              <span>You</span>
              <p>{questionText}</p>
            </div>
          )}
          {issue && (
            <div className="intake-message intake-message--issue" role="status">
              <span>Try again</span>
              <p>{issue}</p>
            </div>
          )}
          {diagnosing && (
            <div className="intake-message intake-message--chintu intake-message--thinking">
              <span>Chintu</span>
              <p>Let me find the exact idea behind that…</p>
            </div>
          )}
        </div>

        <button
          type="button"
          className={`intake-sidebar__attachment${previewUrl ? " intake-sidebar__attachment--filled" : ""}`}
          onClick={() => inputRef.current?.click()}
          disabled={diagnosing}
        >
          {previewUrl ? <img src={previewUrl} alt="Attached solution" /> : <span aria-hidden="true">+</span>}
          <div>
            <strong>{previewUrl ? "Page attached" : copy.upload.attach}</strong>
            <small>{previewUrl ? "Tap to replace it" : copy.upload.attachHint}</small>
          </div>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />

        <div className="intake-sidebar__composer">
          <MicControl
            sessionId={null}
            lang={lang}
            onLangChange={setLang}
            onStudentText={(text) => start(text)}
            sttFallbackActive
            onSttFallback={() => {}}
            disabled={diagnosing}
            textPlaceholder={copy.upload.questionPlaceholder}
            textSend="Start"
          />
        </div>

        {file && !questionText && (
          <button type="button" className="upload-screen__cta" onClick={() => start("")} disabled={diagnosing}>
            {diagnosing ? copy.upload.diagnosing : copy.upload.photoCta}
          </button>
        )}
      </aside>
    </main>
  );
}
