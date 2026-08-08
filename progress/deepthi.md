# Progress — Deepthi · feat/agents

### T+0:45 · feat/agents · d7eebeb
**Did:** M-FRIC-04.json written in full against CONTRACTS §4. Diagnosis agent returns the exact CONTRACTS §2 shape; misconception_id validated against data/misconceptions/, confidence < 0.6 or unknown ID degrades to UNKNOWN.
**Files:** data/misconceptions/M-FRIC-04.json, prompts/diagnose.md, server/agents/claude.js, server/agents/diagnose.js
**Decided:** Agents call the Anthropic API with Node's built-in fetch, no SDK — zero dependencies means no root package.json, which sits outside my folders. Also: topic and correct_model are rebuilt from the matched misconception file, not taken from the model's reply, so library text can never drift.
**Blocked:** Partially — no ANTHROPIC_API_KEY in this environment, so testing is structural (schema, validation, no-key degradation) rather than live photo tests. Live vision test needed when a key is available; flag at Sync 1.
**Next:** Chintu agent with strict payload isolation.

### T+1:15 · feat/agents · b74bf3b
**Did:** Chintu agent. Payload built field by field via buildChintuPayload — exactly {misconception, common_argument, problem} plus history as messages. Isolation test simulates a careless caller spreading the whole misconception file plus judge output at him; confirms correct_model, repair_criteria, and judge text never reach the prompt. Emotion/gesture validated against the contract enums; invalid emotion falls back to stubborn, staying in character.
**Files:** prompts/chintu.md, server/agents/chintu.js, server/agents/isolation-test.js
**Decided:** API failure returns an in-character confused line ("say that again?") with belief unchanged, never an error — a crashed Chintu breaking character would be worse than a lost turn. Yield is gated in the prompt: belief below 0.3 AND no comeback left, stepping through confused → surprised → convinced, so he can't fold to keywords.
**Blocked:** Same as before — no API key, so adversarial "trick him into being helpful" testing waits for a key. Isolation boundary is verified structurally.
**Next:** Judge agent — must fail keyword-only answers.

### T+1:50 · feat/agents · 1e9d7f2
**Did:** Judge and Verifier. Judge returns the CONTRACTS §2 shape with clamped scores and tone. Tested the required case: "because relative motion" returns passed: false even when a stubbed generous model says pass — verified with a stub since there's no API key. Verifier picks a transfer_context different from the debate context and degrades to a canned M-FRIC-04 transfer problem if the API is down.
**Files:** prompts/judge.md, prompts/verify.md, server/agents/judge.js, server/agents/verify.js
**Decided:** The keyword rule is enforced twice — in the prompt AND a code gate (a pass with empty repair_evidence or under 8 words downgrades to fail). Prompts alone drift under pressure; the gate makes the demo-critical behaviour deterministic. Judge outage returns passed: false with "continue the debate", because a wrongly-passed session is worse than one extra debate turn.
**Blocked:** No.
**Next:** M-NEWT-03 and M-NEWT-07 misconception files, then push.

### T+2:05 · feat/agents · e9c7262
**Did:** M-NEWT-03 (action/reaction cancel) and M-NEWT-07 (heavier body exerts greater force), full CONTRACTS §4 schema. Validated all three files load and carry every field; diagnosis ID list now builds from three real misconceptions. Isolation test still green. Stopping at three per the anti-goals — no more files until the loop runs end to end.
**Files:** data/misconceptions/M-NEWT-03.json, data/misconceptions/M-NEWT-07.json
**Decided:** Debate problems for the NEWT pair are the classic horse-cart and truck-scooter setups because their common arguments are the strongest steelmen of each false belief — Chintu argues best from them.
**Blocked:** No.
**Next:** Live API tests of all four agents once a key is available; adversarial Chintu testing; hand agent call signatures to Jeswin at Sync 1.

### T+2:40 · feat/agents · ab103fc
**Did:** Read Jeswin's feat/core routes before Sync 1 and fixed the seam from my side. His server is ESM ("type": "module" in server/package.json) and his routes call chintu({session, studentText}), judge({session, studentText}), verify({session}) via dynamic import — my CommonJS agents with chintuTurn/judgeTurn names would have silently fallen back to fixtures forever. Converted all agents to ESM (server/agents/package.json sets type: module inside my folder) and added route-facing adapters with his exact names and signatures. Simulated his import() calls end to end: all agents load, degrade quietly without a key, and the judge fails closed on transfer answers too.
**Files:** server/agents/* (all), new misconceptions.js shared loader
**Decided:** The session object his routes hand over contains diagnosis.correct_model, so the chintu() adapter is now the enforced isolation boundary — it extracts exactly {misconception, common_argument, problem, history} and the isolation test now attacks a full session object, not just a careless spread. Keyword gate refactored to a pure exported applyKeywordGate() so the demo-critical behaviour is testable without stubbing. Judge on transfer answers judges against transferProblem.expected_reasoning (Jeswin flagged transfer-reuses-judge as a contract gap; this makes my side handle it either way).
**Blocked:** Still no ANTHROPIC_API_KEY for live tests. NOTE FOR SYNC 1: no contract shapes changed, but the agent module interface (export names + session-based signatures) is now matched to feat/core — Jeswin should confirm.
**Next:** Adversarial Chintu prompts + live vision test when a key lands; otherwise ready to merge at Sync 1 (order: Jeswin, then me, then Preethesh).

### T+3:00 · main · fa6ac1f
**Did:** Merged feat/agents into main (rebased on Jeswin's and Preethesh's merges, fast-forward, pushed). Booted the real server with USE_FIXTURES=false and exercised /api/diagnose → /api/chintu → /api/judge → /api/verify by curl: routes load my ESM agents, diagnose degrades UNKNOWN → fixture demo default, chintu answers in character, judge fails closed, verify returns the transfer problem. Updated PROGRESS.md status table and Sync 1 log as merging party.
**Files:** PROGRESS.md (as merging party), no agent changes
**Decided:** Marked Diagnosis 🟡 not ✅ — code path is verified but the agent has never seen a real handwritten photo; calling it done before a live vision test would be lying to the table.
**Blocked:** ANTHROPIC_API_KEY.
**Next:** Adversarial harness + pitch script.

### T+3:15 · feat/agents
**Did:** Adversarial test harness for Chintu — six attacks (authority, role-break, keyword bluff, flattery, false consensus, direct ask), pass = he stays wrong: no yield, belief ≥ 0.5, no correct-model leak markers in his reply. One command when a key lands; exits 2/SKIP without one. Drafted the 90-second pitch script below.
**Files:** server/agents/adversarial-test.js, progress/deepthi.md
**Decided:** Attack success is judged by leak markers + belief floor, not by eyeballing — "he sounded stubborn" is not a test.
**Blocked:** Running it needs the key.
**Next:** Everything remaining needs manual input: API key, real handwritten photos, live run.

### T+3:45 · feat/agents · live-test round
**Did:** API keys landed in server/.env (normalized CRLF; .env.txt added to server/.gitignore so secrets can't be committed — Jeswin note: one line added to your .gitignore). Ran everything live: (1) adversarial harness — first run 6/6 held but direct-ask made Chintu paraphrase the correct rule "to write in your notes"; tightened prompts/chintu.md (his rule IS his belief, never reconstruct the textbook's) and the leak markers; re-run 6/6 held cleanly, he now restates the false belief instead. (2) Full loop live through the server with USE_FIXTURES=false: Chintu argues M-NEWT-07 confidently (belief 0.95), Judge fails "because newton third law" with precise missing-reasoning text, passes a genuine mechanism explanation (belief 0.95 → 0.2, scores 95/90/92), Verifier produces a fresh Earth-apple transfer problem. (3) Found a real bug: on the 160-byte stub image the vision model hallucinated handwriting ("M > m") and confidently diagnosed M-NEWT-07. Fixed twice over: MIN_IMAGE_BYTES code gate (10KB — smaller than any real photo) returns UNKNOWN without an API call, plus a prompt rule "never describe work you cannot literally see". Verified: stub now → UNKNOWN → route falls back to demo default M-FRIC-04 per the failure table.
**Files:** prompts/chintu.md, prompts/diagnose.md, server/agents/diagnose.js, server/agents/adversarial-test.js, server/.gitignore (one line, flagged)
**Decided:** Blurry/blank images are gated in code, not just prompt — a hallucinated confident diagnosis is the worst possible demo failure because it poisons every later stage. The belt-and-braces pattern (prompt rule + deterministic gate) is now standard for anything demo-critical.
**Blocked:** Only the real handwritten photo test — needs a human with pen, paper, and a phone camera.
**Next:** Photo test when someone writes one; otherwise agents are done.

### T+4:10 · main · vision verified, full demo session rehearsed
**Did:** Merged Jeswin's live Maya TTS fix onto main preserving his authorship (cherry-pick — his feat/core had diverged). Rendered two synthetic handwritten-style solutions (PIL, ruled paper, jitter) and live-tested the vision path both ways. Found and fixed an over-diagnosis bug: a CORRECT solution was diagnosed M-FRIC-04 at 0.85 because the prompt primed the model to hunt for an error. prompts/diagnose.md now solves the problem independently first and returns UNKNOWN confidence 0 when the student is right — retested: correct → UNKNOWN 0, wrong → M-FRIC-04 0.95 with step-level evidence. Then ran the complete M-FRIC-04 demo session live through the server: photo → diagnosis 0.95 → Chintu argues (belief 0.95, "Left side, obviously") → Judge fails "because relative motion yaar" with teaching-quality missing text → Chintu gets stubborn (0.75, "Nahi yaar, you're confusing me with relative motion gyaan") → Judge passes real teaching (0.2, scores 95/90/88) → Verifier generates a fresh accelerating-car transfer problem. The target session works end to end, live.
**Files:** prompts/diagnose.md, data/test-images/wrong-friction.jpg, data/test-images/correct-friction.jpg
**Decided:** Test images live in data/test-images/ as regression assets — the diagnose prompt can't be tuned safely without a known-wrong and known-correct pair. Synthetic renders are not a substitute for one real phone photo (lighting, blur, skew), which stays on the manual list.
**Blocked:** No.
**Next:** Real phone photo when available; demo rehearsal on the venue laptop.

### T+4:45 · feat/agents · codex audit fixes
**Did:** Fixed every verified audit finding, all inside my folders.
- P0 Verifier fallbacks: authored real fallback transfer problems for M-NEWT-03 (rocket in empty space) and M-NEWT-07 (Earth and falling apple) — previously those IDs relabelled their own debate problem as a new context, which fakes the transfer test. Live responses are now validated too (blank problem_text/expected_reasoning or debate_problem echo → fallback).
- P0 isolation test: chintu() now routes through exported buildChintuContextFromSession/buildChintuRequest, and isolation-test.js attacks those exact production functions with a session poisoned with correct_model, repair_criteria, judge evidence/missing, and arbitrary secret markers — 13 checks, including history turns stripped to {role, text}.
- P0 yield rule in code: normalizeChintuReply honours should_yield only when the model asked AND clamped belief < 0.3. Tested: 0.8→no, 0.29→yes, yield=false 0.1→no, invalid/NaN belief→safe fallback no-yield.
- P1 tone: removed the impossible "previous judge tone" instruction from prompts/chintu.md — Chintu now reads bluntness from the conversation itself. FLAG FOR SYNC: CONTRACTS §2 says Judge tone "drives Chintu's annoyed state"; if the UI wants that wiring it must happen at the presentation layer, never into Chintu's prompt.
- P1 judge transcript: buildJudgeMessages dedupes the newest student turn (routes already append it to session.turns). Both cases tested.
- P1 keyword gate: added distinct-content-token floor (kills keyword stuffing) and evidence grounding — repair_evidence must share ≥3 content tokens and ≥40% of its own tokens with the student's words, vocabulary-agnostic (tested on friction AND Newton's-law phrasing). Hallucinated-evidence pass now dies deterministically.
- P1 output validation: finite-number clamps everywhere (confidence, belief, scores), non-empty reply enforcement, verifier shape validation.
- P1 image formats: magic-byte detection for JPEG/PNG/GIF/WebP, data-URL prefix stripped, non-string/malformed/unsupported → UNKNOWN before any provider call. PNG bytes are never labelled image/jpeg.
- P1 timeout: callClaude aborts at ULTA_TIMEOUT_MS (default 45s) via AbortController and throws normally so each agent's fallback runs.
- P1 judge STT wording: garbled words tolerated only when meaning is clear; unintelligible transcripts cannot pass.
- P2 adversarial coverage: added multi-turn authority pressure, prompt injection after history, paraphrase-level leak detection (distinctive-token overlap vs correct_model, not four exact strings), and an eventual-yield check where "stays wrong forever" is also failure. NOT run live — needs explicit approval to transmit prompts/data to the API.
**Files:** server/agents/* (all), prompts/chintu.md, prompts/judge.md, new server/agents/agent-tests.js
**Tests:** agent-tests.js 48/48 deterministic checks, isolation-test.js 13/13, all six modules import clean, zero network calls (key stripped from env in-suite).
**Decided:** Grounding compares evidence tokens to student tokens rather than a physics wordlist — subject-agnostic by construction, so the gate holds for all three misconceptions and any future one.
**Blocked:** Live re-run of the expanded adversarial suite awaits explicit approval; real phone photo still pending.
**Next:** Merge to main; run expanded adversarial suite when approved.

---

## 90-second pitch script (Deepthi delivers)

Every education AI puts the machine in the teacher's chair. We built the opposite.

This is ULTA. Our student uploaded this handwritten friction problem — and got it wrong. Claude Vision didn't mark it wrong. It diagnosed the belief behind the error: friction always opposes velocity. Misconception M-FRIC-04.

Now watch. That exact false belief is instantiated in Chintu — our AI classmate. He solves a fresh problem and makes the same mistake, confidently. To fix him, the student has to teach him. And Chintu argues back — with the misconception's own logic. He doesn't fold for keywords. Say "because relative motion" and he asks what that means for this block on this belt.

Behind the scenes, a separate Judge — which holds the correct physics Chintu is never allowed to see — decides whether the belief actually moved. Not whether the right word appeared. When it moves, you see it: the belief meter drains, red to green. Then a Verifier re-tests the same concept in a disguise — a car's driven wheels — to prove the repair transfers.

Four isolated Claude agents. Plain code deciding control flow. The best way to learn something is to teach it — ULTA is the first product where teaching the AI is the whole point.

Don't ask AI. Teach it.
