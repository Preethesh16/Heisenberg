# ULTA — CONTRACTS

**This file is frozen at T+0:20. Nothing in it changes without all three people agreeing at a sync point.**

Every function signature, JSON shape, and fixture below is a promise. Build against these, not against each other's code. If you need a shape changed, say so at the next sync — do not change it unilaterally, and do not work around it locally.

---

## 1. Session state

Owned by the orchestrator. The frontend reads it; agents never see it whole.

```ts
type Stage = "upload" | "diagnosing" | "debate" | "judging" | "transfer" | "done";

interface Session {
  id: string;
  stage: Stage;
  diagnosis: Diagnosis | null;
  turns: Turn[];
  beliefStrength: number;     // 0–1, starts at 1.0
  scores: { solve: number; spot: number; explain: number; transfer: boolean };
  transferProblem: TransferProblem | null;
}

interface Turn {
  role: "chintu" | "student";
  text: string;
  emotion?: EmotionName;      // chintu turns only
  audioUrl?: string;
}
```

---

## 2. Agent contracts

### Agent 1 — Diagnosis

`POST /api/diagnose` — body: `{ imageBase64: string, questionText?: string }`

```json
{
  "topic": "Friction",
  "misconception_id": "M-FRIC-04",
  "misconception": "Friction always acts opposite to object velocity",
  "evidence": "Student used ground-frame velocity to determine friction direction in step 3.",
  "confidence": 0.94,
  "correct_model": "Friction opposes relative slipping or tendency of slipping between contacting surfaces."
}
```

`misconception_id` **must** be one of the IDs in `data/misconceptions/`. If Claude can't map the work to a known ID, return `"misconception_id": "UNKNOWN"` and the orchestrator falls back to the demo default. Never invent an ID.

### Agent 2 — Chintu

`POST /api/chintu` — body: `{ sessionId, studentText }`

**Chintu's prompt receives exactly four things: `misconception`, `common_argument`, the fresh problem, and conversation history. It never receives `correct_model`, `repair_criteria`, or the Judge's output.** This isolation is the product. Enforced in `server/agents/chintu.js` by constructing the payload explicitly, never by spreading the diagnosis object.

```json
{
  "reply": "But the block is already moving right. Why would friction also point right?",
  "emotion": "stubborn",
  "gesture": "point_board",
  "belief_strength": 0.81,
  "should_yield": false
}
```

`emotion` ∈ `idle | listening | thinking | confident | stubborn | confused | surprised | happy | convinced`
`gesture` ∈ `nod | point_board | null`

### Agent 3 — Judge

`POST /api/judge` — body: `{ sessionId, studentText }`

Receives everything Chintu doesn't: `correct_model`, `repair_criteria`, full history.

```json
{
  "passed": false,
  "belief_strength": 0.58,
  "tone": "neutral",
  "repair_evidence": "Student named relative motion but did not explain the contact surfaces.",
  "missing": "Has not distinguished object velocity from relative slipping.",
  "scores": { "solve": 72, "spot": 61, "explain": 44 }
}
```

`tone` ∈ `neutral | harsh` — set `harsh` when the student is blunt, dismissive, or repeating themselves. Drives Chintu's annoyed state.

Passing on a keyword alone is a bug. "Because relative motion" with no reasoning must return `passed: false`.

### Agent 4 — Verifier

`POST /api/verify` — body: `{ sessionId }`. Runs only after `passed: true`.

```json
{
  "problem_text": "A car accelerates forward. Which way does friction act on the driven wheels?",
  "context_label": "Accelerating vehicle",
  "expected_reasoning": "Contact patch tends to slip backward, so friction acts forward.",
  "misconception_id": "M-FRIC-04"
}
```

Must use a `transfer_context` from the misconception file that differs from the debate problem's context.

---

## 3. Voice contracts

`POST /api/stt` — body: `FormData { audio: Blob, lang: "en" | "hi" | "kn" }` → `{ "text": "...", "lang": "hi" }`

`POST /api/tts` — body: `{ text, emotion }` → `{ "audioUrl": "blob:..." }`

Both wrap the provider. **The frontend never calls Sarvam or Maya directly.** If a provider dies, the orchestrator swaps it behind these two routes and no other file changes.

Fallbacks, decided now so nobody improvises at hour 4:
- STT fails → the mic button reveals a text input. Session continues.
- TTS fails → captions still render, no audio. Session continues.

Neither failure is ever shown as an error screen.

---

## 4. Misconception library

`data/misconceptions/M-FRIC-04.json` — same shape for every ID.

```json
{
  "id": "M-FRIC-04",
  "topic": "Friction",
  "concept": "Direction of friction",
  "false_belief": "Friction always acts opposite object velocity.",
  "observable_evidence": "Learner determines friction direction from velocity relative to the ground.",
  "common_argument": "If it's moving right, friction has to point left.",
  "repair_criteria": "Learner distinguishes object velocity from relative slipping between contact surfaces.",
  "debate_problem": "A block sits on a conveyor belt that starts moving right. Which way does friction act on the block?",
  "transfer_contexts": ["Accelerating vehicle", "Rolling wheel", "Inclined surface"],
  "correct_model": "Friction opposes relative slipping or tendency of slipping between contacting surfaces."
}
```

**Three IDs for the demo, fully specified:** `M-FRIC-04`, `M-NEWT-03` (action/reaction cancel), `M-NEWT-07` (heavier body exerts greater force). Three real ones prove the taxonomy is bounded. Thirty shallow ones prove nothing.

---

## 5. Fixtures — build against these from T+0:20

`fixtures/diagnosis.json`, `fixtures/chintu-turn-1.json`, `fixtures/judge-fail.json`, `fixtures/judge-pass.json`, `fixtures/verify.json`, `fixtures/sample-answer.jpg`

Every route serves its fixture when `USE_FIXTURES=true`. This is not throwaway code — it's the demo safety net. If any agent breaks at T+4:00, flip the flag and the full session still runs end to end.
