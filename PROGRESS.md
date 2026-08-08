# ULTA — PROGRESS

**Started:** ___:___  ·  **Demo at:** ___:___
**Demo misconception:** M-FRIC-04 — friction always opposes velocity

> Updated **only at sync points**, by whoever merges last. One writer per sync means this file never conflicts.
> Individual work goes in `progress/deepthi.md`, `progress/jeswin.md`, `progress/preethesh.md` — append there after every commit.

---

## Status

| | Deepthi · `feat/agents` | Jeswin · `feat/core` | Preethesh · `feat/web` |
|---|---|---|---|
| **Now** | not started | not started | not started |
| **Last merge** | — | — | — |
| **Blocked on** | — | — | — |

## Component state

| Component | Owner | Status | Notes |
|---|---|---|---|
| M-FRIC-04 misconception file | D | ⬜ | |
| M-NEWT-03, M-NEWT-07 | D | ⬜ | after the loop works |
| Diagnosis agent | D | ⬜ | |
| Chintu agent | D | ⬜ | isolation test must pass |
| Judge agent | D | ⬜ | must fail keyword-only answers |
| Verifier agent | D | ⬜ | cuttable at Sync 2 |
| Server + 6 routes | J | ⬜ | |
| Fixtures | J | ⬜ | **unblocks the other two — do first** |
| Orchestrator state machine | J | ⬜ | |
| Sarvam STT | J | ⬜ | |
| Maya TTS | J | ⬜ | |
| App shell + session screen | P | ⬜ | |
| Chintu avatar wired | P | ⬜ | component already written |
| Belief meter | P | ⬜ | 400ms lag, red→amber→green |
| Captions | P | ⬜ | never optional |
| Defeat screen | P | ⬜ | SPOT bar animates last |
| Full loop end to end | all | ⬜ | **the only thing that must work** |

⬜ not started · 🟡 in progress · ✅ done · ⛔ blocked · ✂️ cut

---

## Sync log

### SYNC 1 — T+1:30
- Merged:
- Working end to end:
- Blocked:
- Decided:
- Cut:

### SYNC 2 — T+2:45
**Decision point: is a real session running end to end? If no, cut the Verifier and Transfer stage now.**
- Merged:
- Verdict:
- Cut:

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
