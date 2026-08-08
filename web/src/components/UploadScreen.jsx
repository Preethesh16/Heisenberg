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
export default function UploadScreen({ stage, onStart }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [questionText, setQuestionText] = useState("");
  const inputRef = useRef(null);
  const diagnosing = stage === "diagnosing";

  async function pick(f) {
    if (!f) return;
    const jpeg = await toJpeg(f).catch(() => f); // undecodable? send as-is, quietly
    setFile(jpeg);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(jpeg);
    });
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
