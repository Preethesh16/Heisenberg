# Progress — Preethesh · feat/web

### T+0:25 · feat/web · 2ff25d5
**Did:** Vite + React app scaffolded in web/ with plain-CSS shell, /api dev proxy to :3000.
**Files:** web/package.json, web/vite.config.js, web/index.html, web/src/main.jsx, web/src/styles.css, web/.env.local
**Decided:** No router and no state library — the whole app is one state machine over the Stage enum, so App.jsx switches on session.stage and a single useReducer hook holds the Session. Plain CSS over Tailwind because there's no config risk and the design spec's palette is small.
**Blocked:** No.
**Next:** Move Chintu.jsx into web/ and wire the avatar panel.

### T+0:35 · feat/web · 15e2425
**Did:** Chintu.jsx imported into web/src/components byte-for-byte (verified with diff against the original), plus ChintuPanel and BeliefMeter around it. All UI strings centralised in utils/copy.js.
**Files:** web/src/components/Chintu.jsx, ChintuPanel.jsx, BeliefMeter.jsx, web/src/utils/copy.js
**Decided:** ChintuPanel takes exactly {emotion, gesture, beliefStrength, speaking, audioRef} — never correct_model, repair_criteria, or Judge output. The server's Agent-2 isolation rule, kept in the UI layer too. Belief meter thresholds: >0.66 held #E24B4A, 0.33–0.66 slipping #BA7517, <0.33 repaired #639922 per ULTA-DESIGN §34. copy.js exists so the no-praise-copy audit is a one-file grep before the demo.
**Blocked:** No.
**Next:** Mock layer so the session clicks through with no server.

### T+0:40 · feat/web · 5370204
**Did:** Removed the root-level Chintu.jsx copy — it now lives only in web/src/components.
**Files:** Chintu.jsx (deleted)
**Decided:** One canonical copy inside web/, per the repo layout in CLAUDE.md. Kept the deletion as its own commit so the move is easy to see in history.
**Blocked:** No.
**Next:** Mock fixture layer.

### T+0:55 · feat/web · 191a592
**Did:** Local mock fixtures mirroring every CONTRACTS.md shape, api/client.js with a VITE_USE_MOCKS toggle, and useUltaSession — the reducer that owns the Session object and turn flow.
**Files:** web/src/mocks/*.json, web/src/api/client.js, web/src/api/mockRouter.js, web/src/hooks/useUltaSession.js
**Decided:** Jeswin's fixtures/ and server don't exist yet and I can't create files there, so mocks live inside web/ behind the same function signatures the real routes will use — flipping VITE_USE_MOCKS=false changes zero components. The 400ms face/meter reaction lag is applied in the hook AFTER the response resolves (setTimeout on dispatch), never as request latency, so it survives the swap to the real server. Each student turn calls chintu + judge in parallel and the meter takes the Judge's belief_strength — the meter only moves when the Judge confirms. This frontend-side sequencing is a stand-in for server/orchestrator.js and is confined to the hook, so the real orchestrator changes one file. Mock arc: 0.92 → 0.78 → 0.44 (surprise flash crosses 0.5) → 0.12 pass, three student turns to a reliable demo finish.
**Blocked:** No.
**Next:** Screens.

### T+1:15 · feat/web · 9fa7dd5
**Did:** Upload, session, and defeat screens; full session clicks through on mocks end to end. Role banner with timer, misconception card, transcript with always-on captions, hold-to-talk mic with language picker, stage rail, pinned handwriting thumbnail, sequenced Mirror Score bars.
**Files:** web/src/components/* (screens + leaves), web/src/App.jsx
**Decided:** Mic failure (denied permission or STT error) reveals a persistent text input and the session continues — never an error screen, per CONTRACTS.md §3. One <audio> element for the whole session with src swapped per turn, because createMediaElementSource runs once per element (ULTA-DESIGN §39). Defeat screen animates solve → explain → spot so SPOT lands last, then "M-FRIC-04 DEFEATED"; correct_model renders only here, after the belief is already repaired. Teacher dashboard is one static image that hides itself if the screenshot isn't present.
**Blocked:** No. Build passes, dev server boots, praise-copy grep is clean.
**Next:** Real-device pass on mic hold-to-talk, screenshot asset for the dashboard slide, then swap VITE_USE_MOCKS=false when Jeswin's routes land.
