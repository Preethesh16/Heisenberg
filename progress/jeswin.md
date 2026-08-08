# Progress — Jeswin (`feat/core`)

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
