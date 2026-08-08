# ULTA — TEAM PLAN

**Team:** Deepthi · Jeswin · Preethesh
**Budget:** 4h30m
**Rule that makes this work:** you own folders, not features. Nobody edits outside their folder without asking. That's what keeps three branches from fighting.

---

## 1. Ownership map

| | Deepthi | Jeswin | Preethesh |
|---|---|---|---|
| **Role** | The mind | The spine | The face |
| **Branch** | `feat/agents` | `feat/core` | `feat/web` |
| **Owns** | `server/agents/`<br>`data/misconceptions/`<br>`prompts/` | `server/api/`<br>`server/voice/`<br>`server/orchestrator.js`<br>`fixtures/` | `web/` (entire React app) |
| **Never touches** | `web/`, `server/api/` | `web/`, `prompts/` | `server/`, `data/` |
| **Shared, read-only** | `CONTRACTS.md` — changes only at sync points, by agreement | | |

If someone's stuck outside their folder, they ask the owner in chat. They don't reach in.

**Swap rule:** if Deepthi is the strongest frontend dev, swap her with Preethesh now, before T+0:20. After that, no swapping.

---

## 2. Hour by hour

### T+0:00 → T+0:20 — All three, together, one screen

Do not split up yet. Twenty minutes here saves ninety later.

1. Read `CONTRACTS.md` aloud. Argue about it now. Freeze it.
2. Create the repo, push `main` with the folder skeleton, `CLAUDE.md`, `CONTRACTS.md`, and empty fixture files.
3. Everyone branches off that commit.
4. Agree the demo misconception: **M-FRIC-04**. Everything is built to make that one session flawless.

### T+0:20 → T+1:30 — Parallel block 1

**Deepthi** — Write `M-FRIC-04.json` in full. Then the Diagnosis agent prompt: Claude Vision in, structured JSON out, validated against the ID list. Test on three photos of real handwritten friction solutions (write them yourself on paper, phone camera, deliberately wrong).

**Jeswin** — Server up. All six routes returning fixtures. Session state machine. `USE_FIXTURES` flag. Get `/api/stt` talking to Sarvam and `/api/tts` talking to Maya as soon as the routes exist — voice providers are your unknown, and unknowns go early, not last.

**Preethesh** — App shell, routing, and the session screen from `ULTA-DESIGN.md` §36. Drop in `Chintu.jsx` as-is. Wire the whole flow to fixtures. By T+1:30 someone should be able to click through a complete fake session with no server logic behind it.

**SYNC 1 — T+1:30 (10 min, hard stop).** Everyone merges to `main`. Whoever merges last updates the status table in `PROGRESS.md`. Anything blocked gets raised now, not silently absorbed.

### T+1:30 → T+2:45 — Parallel block 2

**Deepthi** — Chintu agent. This is the hard one: it must stay wrong under pressure and never leak `correct_model`. Build the payload explicitly, field by field. Then adversarially test it — try to trick it into being helpful. Write down the three prompts that broke it and fix those.

**Jeswin** — Replace fixture responses with real agent calls as Deepthi lands them. Audio pipeline end to end: mic → Sarvam → Claude → Maya → speaker. Handle the three lip-sync gotchas in `ULTA-DESIGN.md` §39.

**Preethesh** — Belief meter with the 400ms reaction lag. Emotion wiring. Captions. Handwriting thumbnail. Stage rail.

**SYNC 2 — T+2:45 (10 min).** Merge. **Decision point:** is a real end-to-end session running? If yes, continue. If no, cut the Verifier and Transfer stage entirely and spend the rest polishing Diagnose → Debate → Judge. A flawless three-stage demo beats a broken four-stage one.

### T+2:45 → T+3:45 — Parallel block 3

**Deepthi** — Judge agent, then Verifier if Sync 2 said go. Judge must fail keyword-only answers — test it with "because relative motion" and make sure it says no.

**Jeswin** — Full loop wired. Then break it on purpose: kill the network mid-session, feed it a garbage transcript, upload a blurry photo. Every failure must degrade quietly, never to an error screen.

**Preethesh** — Defeat screen with sequenced Mirror Score bars, SPOT last. Then the teacher dashboard as **one static screenshot slide** — no live data, don't build it.

**SYNC 3 — T+3:45 (15 min).** Merge everything to `main`. **Feature freeze.** Nothing new after this point.

### T+3:45 → T+4:30 — Demo

- **All three:** run the full demo three times, start to finish, on the actual demo laptop, on venue wifi.
- Record a screen capture of a successful run as insurance.
- Deepthi writes the 90-second script and delivers the pitch.
- Jeswin drives the laptop.
- Preethesh watches for anything visually broken and has `USE_FIXTURES=true` ready as a one-keystroke rescue.

---

## 3. Git workflow

```bash
# once
git checkout -b feat/agents        # your branch, from main

# every 20–30 minutes
git add .
git commit -m "[agents] add M-FRIC-04 misconception file"
git push origin feat/agents

# at each sync point
git fetch origin
git rebase origin/main             # rebase, don't merge — keeps history readable
# fix conflicts, then
git push origin feat/agents --force-with-lease
# then open a PR to main and merge it
```

**Commit message format:** `[agents]`, `[core]`, or `[web]` prefix, then what changed, in plain words.

**Never:** add Claude, Claude Code, or any AI tool as a co-author, contributor, or commit trailer. No `Co-Authored-By:` lines, no "Generated with" footers. Commits are authored by the three of you. Check `git log` before each merge.

**Merge order at sync points** (avoids the same conflict three times): Jeswin first (contracts live closest to his code), then Deepthi, then Preethesh.

---

## 4. Progress logging — non-negotiable

Each person keeps their own file, so git never conflicts on it:

- `progress/deepthi.md`
- `progress/jeswin.md`
- `progress/preethesh.md`

**Append one entry every time you commit.** Same format for everyone:

```markdown
### T+1:05 · feat/agents · a3f9c21
**Did:** Diagnosis agent returns valid JSON on all 3 test photos.
**Files:** server/agents/diagnose.js, prompts/diagnose.md
**Decided:** Confidence below 0.6 now returns UNKNOWN instead of guessing.
**Blocked:** No.
**Next:** Chintu agent.
```

`PROGRESS.md` at the repo root holds only the status table, updated by whoever merges last at each sync. One writer per sync = no conflicts.

Two reasons this matters beyond tidiness: at hour 3 someone will ask "why does diagnosis reject low confidence?" and the answer is written down; and when you present, the log is your build story.

---

## 5. Kickoff prompts

Paste your own into Claude Code after cloning. All three assume `CLAUDE.md` and `CONTRACTS.md` are in the repo root.

### Deepthi

> Read CLAUDE.md and CONTRACTS.md first. I own `server/agents/`, `data/misconceptions/`, and `prompts/` only — do not create or edit files outside those paths.
>
> Task 1: write `data/misconceptions/M-FRIC-04.json` matching the schema in CONTRACTS.md §4, fully filled, no placeholders.
> Task 2: build `server/agents/diagnose.js` — takes a base64 image, calls Claude with vision, returns exactly the Diagnosis shape in CONTRACTS.md §2. Validate `misconception_id` against the files in `data/misconceptions/`; return UNKNOWN if confidence < 0.6 or no match.
>
> Show me the prompt you'll send to Claude before you write the code. After the code runs, append an entry to `progress/deepthi.md` in the format in TEAM-PLAN.md §4. Commit as `[agents] ...` with no AI co-author trailer.

### Jeswin

> Read CLAUDE.md and CONTRACTS.md first. I own `server/api/`, `server/voice/`, `server/orchestrator.js`, and `fixtures/` only — do not touch `web/` or `prompts/`.
>
> Task 1: Express server with all six routes from CONTRACTS.md, each returning its fixture when `USE_FIXTURES=true`.
> Task 2: `server/orchestrator.js` — a plain state machine over the Stage enum. No LLM decides control flow; ordinary `if`/`switch` only.
> Task 3: `server/voice/` — Sarvam STT and Maya TTS behind `/api/stt` and `/api/tts`, with the fallbacks in CONTRACTS.md §3.
>
> Write the fixtures first so the other two are unblocked. Append to `progress/jeswin.md` after each commit. Commit as `[core] ...` with no AI co-author trailer.

### Preethesh

> Read CLAUDE.md, CONTRACTS.md, and ULTA-DESIGN.md first. I own `web/` only — never edit anything under `server/` or `data/`.
>
> Task 1: React app with the session screen from ULTA-DESIGN.md §36 — role banner, misconception card, Chintu panel with belief meter, transcript with captions, hold-to-talk mic, stage rail.
> Task 2: wire it to the fixture endpoints so a full session clicks through with no real agents.
> Task 3: `Chintu.jsx` is already written — import it, don't rewrite it.
>
> Belief meter drains and changes colour red → amber → green; face and meter update 400ms after the student's turn, never instantly. Append to `progress/preethesh.md` after each commit. Commit as `[web] ...` with no AI co-author trailer.

---

## 6. Things that will go wrong, and the answer

| Problem | Answer |
|---|---|
| Maya or Sarvam is down | `USE_FIXTURES=true`, captions carry it |
| Chintu starts being helpful | Deepthi's isolation test; worst case, hardcode his first two turns |
| Venue wifi dies | Play the recorded run |
| Merge conflict hell at 4:00 | Feature freeze at 3:45 is not negotiable |
| Someone finishes early | Write more misconception files. Never start a new feature. |
| Behind at Sync 2 | Cut Verifier. Three stages done well wins. |
