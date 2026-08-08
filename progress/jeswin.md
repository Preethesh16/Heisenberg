# Progress — Jeswin (`feat/core`)

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
