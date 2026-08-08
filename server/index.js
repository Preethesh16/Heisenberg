import "dotenv/config";
import express from "express";
import cors from "cors";
import { router } from "./api/routes.js";
import { startCleanup } from "./orchestrator.js";

const app = express();

// Dev origins by default; add the deployed frontend via CORS_ORIGIN (comma-
// separated). Requests proxied through Vite are same-origin and skip CORS.
const origins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins }));

app.use(express.json({ limit: "25mb" })); // handwriting photos arrive as base64
app.use("/api", router);

// Every error leaves as JSON with a stable shape — no HTML error pages, no
// stack traces, no provider bodies, no paths (Codex audit P0).
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "invalid_json", fallback: true });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "payload_too_large", fallback: true });
  if (err?.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "audio_too_large", fallback: true });
    return res.status(400).json({ error: "invalid_audio", fallback: true });
  }
  console.warn("[server] unexpected error:", err?.name || "Error", String(err?.message || "").split("\n")[0]);
  res.status(500).json({ error: "internal", fallback: true });
});

startCleanup();

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`ULTA server on :${port} — fixtures=${process.env.USE_FIXTURES === "true"}`);
});
