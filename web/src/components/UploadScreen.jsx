import { useRef, useState } from "react";
import { copy } from "../utils/copy";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// The entry flow — one focused action: hand over the page.
export default function UploadScreen({ stage, onStart }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [questionText, setQuestionText] = useState("");
  const inputRef = useRef(null);
  const diagnosing = stage === "diagnosing";

  function pick(f) {
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function start() {
    if (!file || diagnosing) return;
    const imageBase64 = await fileToBase64(file);
    onStart({ imageBase64, questionText: questionText || undefined, handwritingUrl: previewUrl });
  }

  return (
    <main className="upload-screen">
      <h1 className="upload-screen__logo">{copy.appName}</h1>
      <p className="upload-screen__tagline">{copy.tagline}</p>

      <section className="upload-screen__card">
        <h2>{copy.upload.heading}</h2>
        <p className="upload-screen__sub">{copy.upload.sub}</p>

        <button
          type="button"
          className={`upload-screen__drop${previewUrl ? " upload-screen__drop--filled" : ""}`}
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Your solution" />
          ) : (
            <span>Tap to choose a photo</span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />

        <label className="upload-screen__question">
          {copy.upload.questionLabel}
          <input
            type="text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder={copy.upload.questionPlaceholder}
          />
        </label>

        <button
          type="button"
          className="upload-screen__cta"
          onClick={start}
          disabled={!file || diagnosing}
        >
          {diagnosing ? copy.upload.diagnosing : copy.upload.cta}
        </button>
      </section>
    </main>
  );
}
