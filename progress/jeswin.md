# Progress — Jeswin (`feat/core`)

### 2026-08-08 · multimodal diagnosis route
**Did:** `/api/diagnose` now accepts image evidence, spoken/typed text evidence, or both, while rejecting requests with neither and retaining all size/type limits. Fixture and live session creation share the same input contract.
**Tests:** 22/22 core checks, including a text-only session with no image.
**Blocked:** No.

### 2026-08-08 · post-hackathon core audit
**Did:** Re-audited the complete HTTP/orchestrator boundary. Added executable coverage for exact-session isolation, legal stage transitions, paired-route turn deduplication, post-pass Chintu restrictions, idempotent verification, transfer completion, cross-session fixture independence, bounded JSON/image/audio input, JSON-only errors, providerless fallbacks, dynamic concept fallbacks, and idle-session cleanup. Live unknown diagnoses no longer create a friction session. STT now receives `sessionId`; Sarvam defaults to the live-tested `saaras:v3` transcription path while retaining the legacy rollback.
**Tests:** 21/21 core checks, both dependency audits clean, providerless routes and oversized uploads exercised manually, Maya-to-Sarvam round trip verified live.
**Decided:** Real-mode Judge failures remain fail-closed, and no backend recovery path may invent M-FRIC-04 for a learner's upload.
**Blocked:** No.

### T+3:30 · feat/core · (this commit)
**Did:** Fixed all defects from the Codex deterministic audit. 43-check verification suite passes, plus two live smoke tests (blank-STT fallback, Maya through the new deadline wrapper).
**Files:** server/orchestrator.js, server/api/routes.js, server/index.js, server/voice/sarvam.js, server/voice/maya.js, server/lib/http.js (new), fixtures/chintu-opener.json, fixtures/chintu-yield.json, fixtures/stt-1..3.json (new), fixtures/stt.json (removed), server/.env.example
**Decided:**
- **P0 session isolation:** `getSession` no longer falls back to the latest session. Routes require the exact `sessionId`; missing → 400, unknown → 404, never an implicit session. Frontend already sends the backend id (verified in Preethesh's hook), so no frontend change needed.
- **P0 legal stages:** chintu/judge only in `debate`; a debate Judge pass parks the session in `judging` until `/verify` installs the transfer problem (never `transfer` without one); transfer judge only with a problem installed; failed transfer stays in `transfer`; repeat `/verify` is idempotent (returns the same problem, never replaces it); out-of-order calls get 409 JSON without mutating state.
- **P0 turns-once:** `addStudentTurnOnce(session, text, source)` — parallel /chintu + /judge write the student turn exactly once; a transfer answer via /judge alone is recorded; identical repeats from the same route are genuine turns and kept.
- **P0 fail-closed judge:** in real mode a missing/throwing/malformed judge returns `passed:false` with current scores and never advances the stage. The fail→pass fixture arc now exists only under `USE_FIXTURES=true` (and Deepthi's judge also fails closed internally — two layers).
- **P0 JSON errors:** final error middleware — malformed JSON, oversized payloads, multer errors, and unexpected throws all return `{error, fallback:true}` JSON. No HTML error pages, stacks, provider bodies, or paths in responses.
- **P1 validation:** diagnose (base64 string + 20MB bound), chintu/judge (sessionId + text rules, empty text only for the opener), stt (audio/* MIME + size), tts (non-empty ≤2000 chars, unknown emotion normalizes to untagged).
- **P1 timeouts:** `SARVAM_TIMEOUT_MS` (15s) / `MAYA_TIMEOUT_MS` (30s) with AbortController and at most one bounded retry on 429/5xx; aborts flow into the existing quiet fallbacks.
- **P1 Maya validation:** voice locked to Ananya|Arjun (unknown → Arjun + loud warning; obsolete MAYA_VOICE_ID detected); response validated before WAV-wrap (JSON/HTML bodies rejected, RIFF passthrough, odd PCM trimmed); `pcmToWavDataUrl` exported and unit-tested.
- **P1 Sarvam config:** model/mode behind env. Default stays live-verified `saarika:v2.5` for the demo; `saaras:v3` + `SARVAM_STT_MODE` supported for the migration after a live check. Blank transcript (HTTP 200, empty text) now returns `{text:"", fallback:true}` so the mic reveals the text input. Upload filename extension follows the real MIME type.
- **P1 fixture story:** per-session sequences — confident opener → incomplete answer → judge fail → argue back → full mechanism → judge pass → transfer answer → pass. STT sequence is per-session when sessionId is provided; otherwise module-scoped and reset on /diagnose (STT has no sessionId in the frozen contract — flag at sync if we want one).
- **P1 agent logging:** dynamic-import failures now log once per failure kind (name + error type) instead of silently looking like fixture mode.
- **P2:** CORS restricted to `CORS_ORIGIN` (localhost:5173 defaults); sessions expire after `SESSION_TTL_MINUTES` (60) of idleness — active sessions refresh on every touch.
**Blocked:** No.
**FLAG AT SYNC (contract-adjacent, all additive):** (1) sessionId in diagnose response + strict session requirement; (2) transfer answers reuse /api/judge; (3) new 400/404/409 JSON error shapes `{error, fallback:true}`; (4) optional sessionId field on /api/stt would make fixture sequencing fully per-session.
**Next:** restart demo server on :3001 with this code; final browser rehearsals.

### T+2:00 · feat/core · b727ad9
**Did:** All three providers verified LIVE with venue keys. Claude: 200 on the agents' default model. Sarvam STT: real transcription round-trip through `/api/stt` (auth, endpoint, field names all correct as written). Maya TTS: was completely broken — researched endpoint didn't exist — rewrote wrapper against the real docs (docs.mayaresearch.ai) and got 8.5s of Chintu audio through `/api/tts`.
**Files:** server/voice/maya.js, server/.env.example
**Decided:**
- Real Maya API: `POST https://tts.mayaresearch.ai/v1/tts`, `Authorization: Bearer`, body `{text, voice, model}`. Only two voices exist (`Ananya`/`Arjun`, case-sensitive — unknown names interpolate into garbage, so the `Noah` value that was in .env would have produced garbage audio). Chintu = `Arjun`.
- Model pinned to `Maya 2 Native Emotional` — the only one honouring inline emotion tags. Tags are square-bracket (`[frustrated]`, `[laughs]`, `[sighs]`…); mapped from Agent 2's emotion enum. `convinced` → `[sighs]` deliberately: the yield line is a softer register (ULTA-DESIGN §37).
- `language` field deliberately omitted from requests — auto-detect is the documented path for code-mixed Hinglish, which is how Chintu talks.
- Maya returns headerless raw PCM (16-bit LE mono 24kHz); wrapper adds a WAV header server-side and returns a `data:audio/wav` URL — browsers can't play bare PCM, and same-origin data URLs keep the lip-sync analyser working (§39).
**Blocked:** No. Voice pipeline fully live.
**Next:** Wire Deepthi's agents when her branch merges; then full live loop + break-it-on-purpose testing (Block 3).

### T+1:15 · feat/core · 1b4ca38
**Did:** Server skeleton complete. All six contract routes serve fixtures with `USE_FIXTURES=true`; full session arc tested end to end (diagnose → chintu → judge fail → judge pass → verify → transfer judge → done). Orchestrator is a plain state machine over the Stage enum. Sarvam STT and Maya TTS wrappers behind `/api/stt` and `/api/tts`. Real mode with no keys and no agent files degrades quietly on every route — warnings in server log only, never an error to the client.
**Files:** server/index.js, server/orchestrator.js, server/api/routes.js, server/voice/sarvam.js, server/voice/maya.js, server/lib/fixtures.js, fixtures/*
**Decided:**
- `/api/tts` returns audio as a **data URL**, never a remote URL — cross-origin audio makes the lip-sync analyser read zeros (ULTA-DESIGN §39), and data URLs sidestep CORS entirely.
- Fixture judge arc is sequenced: first `/api/judge` call fails, later calls pass — so fixture mode clicks through the full fail → teach again → pass story instead of being stuck at one verdict.
- A `/api/judge` call while stage is `transfer` scores the transfer answer and moves the session to `done` — the contracts don't define how the transfer answer is judged. **FLAG AT SYNC 1.**
- `/api/diagnose` response carries an additive `sessionId` field (contract shape otherwise untouched); a missing sessionId on later calls resolves to the active session. **FLAG AT SYNC 1.**
- Routes never 5xx to the client: STT failure → `{text:"", fallback:true}` (mic reveals text input), TTS failure → `{audioUrl:null}` (captions carry it), missing/broken agent → fixture.
- Missing agent modules (server/agents/) fall back to fixtures automatically, so main runs end to end before Deepthi lands anything.
**Blocked:** No. Maya/Sarvam request field names unverified until venue keys arrive — both isolated in server/voice/, one-file fix each.
**Next:** Fill real keys into server/.env, flip USE_FIXTURES=false, verify Sarvam + Maya live. Wire Deepthi's agents as they land.
