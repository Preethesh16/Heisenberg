# CLAUDE.md — ULTA

Repo context for Claude Code. Read this and `CONTRACTS.md` before doing anything.

---

## What ULTA is

**Don't ask AI. Teach it.**

A teach-the-AI learning platform for Indian competitive-exam aspirants. Every other education AI puts the machine in the teacher's chair. ULTA puts it in the student's chair.

A learner starts by speaking, typing, uploading educational work, or combining them. Claude diagnoses the specific false belief evidenced by that reasoning and builds the session's concept package. That belief is then instantiated inside a second agent — **Chintu**, a cat-avatar AI study buddy — who confidently solves a *fresh* problem and makes the same class of mistake. The learner has to catch it and teach him why he's wrong. Chintu argues back using the misconception's own logic. A separate Judge decides whether the belief actually moved, not whether the right keyword appeared. A Verifier then re-tests the concept in a different disguise.

The loop: **DIAGNOSE → MIRROR → TEACH → CHALLENGE → JUDGE → TRANSFER**

The three JEE Physics files remain an offline fixture story. Live sessions are not bounded to them: the knowledge, misconception, debate problem, repair criteria, and transfer contexts come from the learner's page and/or spoken or typed reasoning through Claude.

---

## Architecture

Four isolated Claude roles behind a **code** orchestrator. There is no LLM orchestrator — control flow is an ordinary state machine in `server/orchestrator.js`.

```
handwritten answer
   → [Agent 1: Diagnosis]  Claude Vision → misconception_id
   → [Agent 2: Chintu]     holds the belief, argues back
        ↕ student, by voice
   → [Agent 3: Judge]      has the correct model, decides
        fail → back to Chintu
        pass → [Agent 4: Verifier] → transfer problem
```

**Claude is the mind. Maya is the voice. Sarvam is the ear. The React avatar is the body.**
Maya does text-to-speech only — it decides *how Chintu sounds*, never *what he says*. Sarvam does speech-to-text only. Neither reasons about anything.

### The rule the whole product rests on

**Chintu never receives `correct_model`, `repair_criteria`, or Judge output.** His prompt gets exactly four things: the misconception, its common argument, the current problem, and conversation history. Build that payload field by field. Never spread the diagnosis object into his context. If you find yourself passing an object whose shape you haven't checked, stop.

This isolation is the innovation, not an implementation detail. A single prompt cannot be confidently wrong, honestly evaluative, and pedagogically adaptive at the same time. That's why there are agents.

---

## Repo layout and ownership

```
server/
  agents/          Deepthi   diagnose.js chintu.js judge.js verify.js
  api/             Jeswin    route handlers
  voice/           Jeswin    sarvam.js maya.js
  orchestrator.js  Jeswin    state machine
data/
  misconceptions/  Deepthi   M-FRIC-04.json, M-NEWT-03.json, M-NEWT-07.json
prompts/           Deepthi   one .md per agent
fixtures/          Jeswin    canned responses, USE_FIXTURES=true
web/               Preethesh React app, Chintu.jsx
progress/                    one .md per person
CONTRACTS.md                 frozen — shared seam
TEAM-PLAN.md                 schedule, git workflow
ULTA-DESIGN.md               visual spec
```

**Stay inside the folder you own.** If a task needs a file outside it, say so and stop — don't edit it.

---

## Rules for every session

### Commits

- Format: `[agents] what changed` / `[core] ...` / `[web] ...`
- **Never add Claude, Claude Code, or any AI tool as co-author, contributor, or commit trailer.** No `Co-Authored-By:` lines, no "Generated with" footers, no AI mention in commit bodies. These commits are authored by Deepthi, Jeswin, and Preethesh.
- Commit every 20–30 minutes. Small commits, working tree green.

### Progress logging — do this without being asked

After every commit, append to your own `progress/<name>.md`:

```markdown
### T+1:05 · feat/agents · a3f9c21
**Did:** Diagnosis agent returns valid JSON on all 3 test photos.
**Files:** server/agents/diagnose.js, prompts/diagnose.md
**Decided:** Confidence below 0.6 returns UNKNOWN instead of guessing.
**Blocked:** No.
**Next:** Chintu agent.
```

Record **decisions and their reasons**, not just file lists. A decision without a reason is a decision you'll relitigate at hour three.

If you changed a contract, say so in capitals and flag it for the next sync — do not quietly change `CONTRACTS.md`.

### Working method

1. **State the plan before writing code.** One paragraph: what you'll build, which files, what could break.
2. **Build the smallest version that runs end to end**, then improve it. A working ugly path beats a beautiful half-path at every point in a 4.5-hour build.
3. **Test before declaring done.** For agents that means real inputs, not a happy-path sample. For the Judge specifically: feed it `"because relative motion"` with no reasoning and confirm it returns `passed: false`. A judge that passes keywords is broken even if it never crashes.
4. **Log the decision.** Then commit.

Never leave the repo in a state where `main` doesn't run.

---

## Anti-goals — do not build these

- An LLM orchestrator, agent-to-agent autonomous messaging, or a framework
- A live teacher dashboard (one static screenshot slide only)
- Video generation, avatar-video services, or 3D
- Auth, database, deploy pipeline, or tests beyond manual verification
- Any "just in case" abstraction layer

Do not expand the authored fixture taxonomy to simulate dynamic support. Improve the Vision-derived live path instead.

---

## Failure behaviour

Every provider failure degrades quietly. The learner never sees an error screen.

| Fails | Behaviour |
|---|---|
| Sarvam STT | Mic reveals a text input, session continues |
| Maya TTS | Captions render, no audio, session continues |
| Diagnosis low confidence, correct work, or unrelated image | No session is created; ask for a clearer page/full question |
| Anything at all | `USE_FIXTURES=true` runs the full session on canned data |

Fixtures are the demo safety net, not throwaway code. Keep them working all the way to the end.

---

## Voice and copy

Sentence case everywhere. Active voice. Plain words.

**Never write praise copy** — no "Correct!", no "Great job!", no "Well done!". Praise restores the AI-as-authority relationship the product exists to break. The interface reports what happened to the belief, not how the student performed. The success state is `M-FRIC-04 DEFEATED`, and the achievement unit is a belief corrected, not a question completed.

Chintu talks like a real Indian classmate — "Nahi yaar", "but sir also taught this", "are you sure?" — not like an assistant. He is never sycophantic, never apologises for arguing, and never breaks character to be helpful.

### UI direction and reference

Use [my AI Tutor](https://myaitutor.framer.website/) as inspiration for a warm, approachable learning-product feel: generous spacing, rounded surfaces, clear hierarchy, friendly colour, and one focused primary action. Treat it as inspiration, not a layout to clone. ULTA's visual centre remains the live misconception debate, belief meter, captions, and Chintu.

`Chintu.jsx` is the original full-body avatar implementation. Preserve its nine emotion states, belief-based fallback, one-time surprise flash, `nod`/`point_board` gestures, Maya amplitude lip-sync, and reduced-motion behaviour when refining it. The UI exposes agent state; it does not add frontend reasoning.

Voice uses one-click turns: tap once to start listening and tap again to submit. Typed input stays available. Recording, transcription, Chintu thinking, and Chintu speaking are distinct states, and all media tracks are released on cancellation, stage change, or unmount.
