# ULTA — PROGRESS

**Started:** ___:___  ·  **Demo at:** ___:___
**Demo misconception:** M-FRIC-04 — friction always opposes velocity

> Updated **only at sync points**, by whoever merges last. One writer per sync means this file never conflicts.
> Individual work goes in `progress/deepthi.md`, `progress/jeswin.md`, `progress/preethesh.md` — append there after every commit.

---

## Status

| | Deepthi · `feat/agents` | Jeswin · `feat/core` | Preethesh · `feat/web` |
|---|---|---|---|
| **Now** | all four agents + 3 misconception files merged; seam to feat/core verified live | server skeleton merged (routes, fixtures, orchestrator, voice wrappers) | fully live browser session verified: vision → debate → judge → transfer → defeat |
| **Last merge** | ab56f7e | 1850685 | (this merge) |
| **Blocked on** | — | — | hardware mic check |

### UI planning note

The UI direction now takes inspiration from [my AI Tutor](https://myaitutor.framer.website/): warm, approachable, rounded, spacious, and centred on one clear action at a time. For ULTA, that means a debate-first session screen where Chintu, the belief meter, captions, and stage rail remain dominant. The existing `Chintu.jsx` is the avatar reference; wire its emotion states, gestures, belief-threshold surprise flash, Maya lip-sync, and reduced-motion fallback without altering the component.

### Post-hackathon senior re-audit — Codex

This section supersedes stale implementation assumptions in the historical log below. The original three-misconception library remains only for deterministic fixture/demo mode; the live product now derives a validated concept package from the student's actual uploaded work and never silently substitutes M-FRIC-04.

- **Deepthi / agents:** Diagnosis accepts any academic subject from an uploaded page, spoken/typed reasoning, or both; rejects prompt injection; and runs a second independent evidence-grounded Sonnet audit before creating a session. Correct, vague, blurry, unrelated, malformed, and unsupported input returns `UNKNOWN` without a session. Chintu, Judge, and Verifier consume the validated dynamic concept package; all Claude agents share one Sonnet-only model configuration. Deterministic agent suite: 61 checks. Live regressions covered text-only algebra plus friction, algebra, chemistry, a correct solution, blur, unrelated UI, and image-borne prompt injection. Expanded live Chintu adversarial suite: 9/9 held, while a complete explanation still made him yield.
- **Jeswin / core:** Exact session IDs and legal stages are enforced; turns are deduplicated; arbitrary post-pass Chintu turns are rejected; Judge and provider failures fail closed; verification is idempotent; uploads and JSON bodies are bounded; API errors stay JSON; sessions expire after inactivity. Diagnosis accepts any non-empty combination of image and learner explanation. Sarvam STT defaults to live-tested `saaras:v3`, Maya uses Arjun, and both voice providers retain quiet browser-safe fallbacks. The 22-check core suite covers state transitions, cross-session isolation, text-only start, TTL cleanup, voice validation, providerless behavior, and dynamic fallback content.
- **Preethesh / web:** The shipped default calls the real server. Entry is genuinely multimodal: voice or typed reasoning can start without a photo, while a page optionally sharpens the diagnosis. Failure is honest and retryable, with no bundled misconception substitution. Voice is click once to record and click again to send, with typed fallback, stale-operation guards, stream cleanup, and exactly one submitted turn. The UI and full-body animated Chintu were redesigned around the agreed warm tutor reference while retaining captions, lip sync, reduced motion, and responsive layouts. Eight Playwright runs cover desktop and mobile entry, no-photo start, voice lifecycle, and the complete debate-to-transfer flow.
- **Live end-to-end evidence:** A dynamic algebra upload completed Vision diagnosis → Chintu debate → Judge → generated transfer problem → defeat screen in the browser, with Maya audio returned for Chintu turns. A forced Judge network failure recovered in place without advancing the stage or locking the mic. Providerless and oversized-upload paths were also exercised.

## Component state

| Component | Owner | Status | Notes |
|---|---|---|---|
| M-FRIC-04 misconception file | D | ✅ | full CONTRACTS §4 schema |
| M-NEWT-03, M-NEWT-07 | D | ✅ | library capped at three per anti-goals |
| Diagnosis agent | D | ✅ | vision verified live both ways: wrong work → M-FRIC-04 0.95, correct work → UNKNOWN; real phone photo still worth one check |
| Chintu agent | D | ✅ | adversarial run live: 6/6 attacks held after prompt fix |
| Judge agent | D | ✅ | live: fails keyword-only, passes real mechanism (0.95→0.2) |
| Verifier agent | D | ✅ | live: fresh transfer problem in a different context |
| Server + 6 routes | J | ✅ | verified live with USE_FIXTURES=false calling real agents |
| Fixtures | J | ✅ | full-session arc works |
| Orchestrator state machine | J | ✅ | |
| Sarvam STT | J | ✅ | live: real transcription round-trip through /api/stt |
| Maya TTS | J | ✅ | live: 8.5s Chintu audio via /api/tts (Arjun, emotion tags, PCM→WAV) |
| App shell + session screen | P | ✅ | §36 anatomy, browser-verified |
| Chintu avatar wired | P | ✅ | imported as-is, isolation kept in props |
| Belief meter | P | ✅ | 400ms lag, red→amber→green, Judge-driven |
| Captions | P | ✅ | always render; audio is enhancement |
| Defeat screen | P | ✅ | bars old→new, SPOT last, static dashboard slide |
| Full loop end to end | all | ✅ | live via API AND through the browser UI (headless): photo → diagnose → debate → judge pass → transfer verified → defeat screen. Demo laptop run still pending |

⬜ not started · 🟡 in progress · ✅ done · ⛔ blocked · ✂️ cut

---

## Sync log

### SYNC 1 — T+1:30
- Merged: feat/core (1850685, Jeswin first per plan), feat/web (0f050b3), feat/agents (4135711, rebased)
- Working end to end: fixture path clicks through; USE_FIXTURES=false verified live — routes load the real agents, agents degrade in character without a key
- Blocked: ANTHROPIC_API_KEY (agents), Sarvam/Maya keys (voice)
- Decided: agent module interface is ESM with session-based exports chintu/judge/verify matching routes.js; transfer answers judged against transferProblem.expected_reasoning
- Cut: nothing

### SYNC 2 — T+2:45
**Decision point: is a real session running end to end? If no, cut the Verifier and Transfer stage now.**
- Merged: feat/agents (ab56f7e), feat/web (judge-first sequencing fix)
- Verdict: YES — fully live session through the web UI: real vision diagnosis of the sample photo, live Chintu debate, judge pass, live transfer problem, transfer verified, defeat screen. Frontend defect found and fixed at this seam: parallel chintu+judge calls interleaved on the stateful server session and corrupted the Judge's view of history; turn calls are now sequential, judge first.
- Cut: nothing — Verifier and Transfer stay.

### SYNC 3 — T+3:45 — FEATURE FREEZE
- Merged:
- Known broken, accepted:
- Demo laptop tested: ⬜
- Backup recording made: ⬜

---

## Decisions

Anything that changes how the system behaves. Reason is mandatory — a decision without one gets relitigated at hour three.

| T+ | Who | Decision | Why |
|---|---|---|---|
| 0:20 | all | Contracts frozen | Three people can't build in parallel against a moving interface |
| 0:20 | all | M-FRIC-04 is the demo | One flawless session beats five shaky ones |
| 1:40 | P | Mock layer lives inside web/ behind VITE_USE_MOCKS | server/fixtures don't exist yet and web can't create them; flag flip swaps to real routes with zero component changes |
| 1:40 | P | Belief meter takes the Judge's belief_strength, not Chintu's | the meter only moves when the Judge confirms the model shifted |
| 2:00 | D | Judge keyword rule enforced in prompt AND a code gate (pass with empty repair_evidence or <8 words → fail) | prompts drift under pressure; the demo-critical behaviour must be deterministic |
| 2:40 | D | Agents are ESM with route-facing adapters; chintu() adapter is the isolation boundary | session handed by routes contains correct_model; extraction must be field-by-field where the routes call in |
| | | | |

---

## Contract changes

`CONTRACTS.md` changes only by agreement at a sync point. Every change logged here.

| T+ | Who | Changed | Agreed by |
|---|---|---|---|
| | | | |

---

## Demo runbook

Fill this in at Sync 3, not before. Read it out loud once before presenting.

1. Laptop, browser, tabs open:
2. `USE_FIXTURES` set to:
3. The handwritten sheet used:
4. Language selected:
5. The line that opens the pitch:
6. If it breaks: `USE_FIXTURES=true`, reload. If that breaks: play the recording.

**Who does what:** Deepthi pitches · Jeswin drives · Preethesh watches for breakage with the fixture flag ready.
