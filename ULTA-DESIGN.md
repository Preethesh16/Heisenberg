# ULTA — DESIGN SYSTEM

*Sections 33–39. Appends to the ULTA master project context.*

**Reference inspiration:** [my AI Tutor](https://myaitutor.framer.website/) — use its warm, approachable, rounded, spacious learning-product qualities as a visual influence for the shell and entry flow. ULTA keeps its own exam-hall restraint, semantic belief colours, debate-first hierarchy, and original Chintu character; do not reproduce the reference site's layout or branding.

---

# 33. DESIGN THESIS

The whole product rests on one inversion: the AI is the student, the human is the teacher. Every design decision is judged against a single test.

**A stranger looking at the screen for five seconds must be able to tell who is teaching whom.**

If a screen doesn't make that legible, it's the wrong screen — however polished it is.

This rules out the default edtech visual language. Pastel gamification with a mascot congratulating you reads as *AI rewards human*, which is the exact relationship ULTA reverses. The interface should feel closer to exam-hall austerity than to a language app: restrained surfaces, one accent that means something, and a single character who is clearly a peer rather than an authority.

Two consequences worth stating outright:

- **The character is never a teacher figure.** No podium, no pointer, no glasses-and-tie authority signalling. Chintu wears what a student wears.
- **Praise is not the reward.** The reward is a belief collapsing. Section 37 covers this.

---

# 34. CHINTU — VISUAL SPEC

Chintu is a cat in a hoodie with headphones. Cat because animals carry personality without implying an ethnicity or gender the learner has to identify with; hoodie and headphones because that's what a self-studying aspirant looks like at 11pm.

## Construction

Flat vector, built from stacked opacity layers rather than gradients — cheap to render, no flashing during state changes, and it survives being scaled from 90px to 400px.

The dimensional look comes from four moves, in order:

1. Base head fill, then a lighter ellipse offset up-left, then a soft highlight patch. The head reads as a sphere from three shapes.
2. A dark crescent down the right side at low opacity for form shadow.
3. Two muzzle patches under the nose, lighter than the base.
4. **Two highlights per eye** — a large one at eleven o'clock, a small one at five o'clock. This single detail does more for aliveness than any animation.

## Palette

| Token | Hex | Use |
|---|---|---|
| `chintu-base` | `#F0997B` | Head, ears |
| `chintu-light` | `#F5C4B3` | Upper-left volume |
| `chintu-highlight` | `#FAECE7` | Highlight patch, muzzle |
| `chintu-shadow` | `#993C1D` | Form shadow, brows |
| `chintu-line` | `#4A1B0C` | Mouth, pupils |
| `hoodie` | `#534AB7` | Hoodie body |
| `hoodie-dark` | `#3C3489` | Hood fold |
| `blush` | `#D85A30` | Cheeks, at 35–50% opacity |

Belief-state colours are separate and semantic — they belong to the meter, not the character:

| State | Hex |
|---|---|
| Belief held | `#E24B4A` |
| Belief slipping | `#BA7517` |
| Belief repaired | `#639922` |

## Originality note

Chintu was designed from scratch for ULTA and must stay that way. The category — rounded chibi animal mascot, big glossy eyes, flat shading — is a genre nobody owns, but specific characters are owned. Anything that would let a viewer name another product is a defect: not blue, no backwards cap, no red tee, no borrowed name or wordmark. The rule of thumb is that colour, silhouette, and outfit must all differ from any reference. The uniform-and-headphones read isn't decoration either — it's the character telling you he's a peer sitting the same exam.

---

# 35. EMOTION STATES ↔ AGENT CONTRACT

Section 12 lists nine states. They map one-to-one onto Agent 2's `emotion` field, so the frontend never infers emotion — it renders what the Mirror agent reports.

| `emotion` | Visual | Fires when |
|---|---|---|
| `idle` | Neutral, small smile | Between turns |
| `listening` | Pupils shifted toward transcript, head tilted in | Student is speaking |
| `thinking` | One brow raised, eyes up-left, mouth off-centre | Processing an argument |
| `confident` | Narrowed eyes, smirk | Opening turns, `belief_strength` high |
| `stubborn` | Brows angled in, frown | Student is pushing and he's resisting |
| `confused` | Uneven brows, small open mouth, head tilt | Argument landed but isn't resolved |
| `surprised` | Wide eyes, open mouth, brows high | The aha moment — see below |
| `happy` | Smile, blush | Post-repair, transfer stage |
| `convinced` | Arc eyes, big smile, blush | `should_yield: true` |

## The two rules that make it feel like a person

**Surprised is a flash, not a state.** It fires once, on the turn `belief_strength` crosses below 0.5, holds ~800ms, then settles. A face that briefly startles is far more convincing than one that slides smoothly from red to green. The component handles this internally.

**Emotion is not a pure function of belief.** `stubborn` and `confused` are both mid-belief but mean different things, and Agent 2 knows which. Add a `tone` signal from the Judge so Chintu can get short with a student who's being blunt or repetitive — the detail that makes people say "it feels like a real classmate," and one that quietly teaches that explaining well beats explaining loudly.

**Reaction lag.** The face and meter update ~400ms *after* the student's turn lands, never simultaneously. Instant updates read as a form field; delayed ones read as consideration.

---

# 36. SESSION SCREEN ANATOMY

The teaching screen is the product. Everything else is scaffolding.

```
┌──────────────────────────────────────────────┐
│  ULTA        [ YOU ARE THE TEACHER ]    2:14 │  role banner, never absent
├──────────────────────────────────────────────┤
│  M-FRIC-04                                   │  misconception card
│  Friction always opposes velocity            │
├───────────────┬──────────────────────────────┤
│               │  Chintu: "Block is moving    │
│    CHINTU     │  right, so friction points   │
│   (avatar)    │  left, na?"                  │  live transcript,
│               │                              │  captions always on
│  stubborn     │  You: "Relative motion..."   │
│               │                              │
│  BELIEF ▓▓▓▓░ │                              │
│  72%          │  [ ⏺ HOLD TO TEACH ]  हिं ▾  │
└───────────────┴──────────────────────────────┘
   ✓ Diagnosed → ● Teaching → ○ Judge → ○ Transfer
```

## Load-bearing elements

**The belief meter is the signature.** Every other product has a progress bar that fills as you complete things. ULTA's *drains* — it's `belief_strength` from Agent 2, and it only moves when the Judge confirms the model shifted, never when the student merely talks. This is the one number a viewer will remember, and it's the visual form of the whole thesis. Colour shifts red → amber → green as it falls, so the state is readable across a room.

**The role banner.** "You are the teacher" sits in the header for the entire session. It's the five-second test made literal.

**Captions are non-negotiable.** Every word Maya speaks appears as text simultaneously. Demo rooms are loud, laptop speakers are bad, and screens get shared. Build the transcript first and treat audio as enhancement — if Maya times out, the session still works. This is an accessibility requirement in production and a survival requirement in a demo.

**The learner's own handwriting stays on screen.** A pinned thumbnail of the uploaded page, ideally with a highlight box over the line where the error occurred. Without it, a viewer assumes the misconception was hardcoded. It's the cheapest possible proof that diagnosis is real.

**The stage rail.** Diagnose → Teach → Judge → Transfer, always visible. It tells the viewer the loop has a defined end and that convincing Chintu isn't the finish line.

## Copy rules

Sentence case. Active voice. Never "Correct!" or "Great job!" — praise language restores the AI-as-authority relationship the product exists to break. The interface reports what happened to the belief, not how the student did.

---

# 37. THE DEFEAT SCREEN

Section 19's payoff, designed.

The unit of achievement is a **belief corrected**, not a question completed, so the headline is the misconception ID going down:

```
        M-FRIC-04  DEFEATED

  ✗  Friction always opposes velocity
  ✓  Friction opposes relative slipping at the contact surface

     SOLVE      72 → 86
     SPOT       24 → 91
     EXPLAIN    31 → 88
     TRANSFER   VERIFIED ✓
```

The Mirror Score bars animate from their old to new values in sequence, not at once — SPOT last, because the SPOT jump is the number no other product can produce and it deserves its own beat.

**Chintu names his own error.** He shifts to `convinced`, and Maya delivers the yield line in a softer, slower register:

> "Ohhh. I was looking at the object's motion instead of what the surfaces were doing relative to each other."

That's the emotional close, and it's also a check: an AI that can articulate *what it had wrong* is evidence the repair was conceptual, not verbal. Save the tone shift for this moment only — used anywhere else it stops meaning anything.

---

# 38. VOICE AND LANGUAGE SURFACE

Claude is the mind, Maya is the voice, the avatar is the body. The UI should make that division invisible to the learner and obvious to no one.

- **Language picker sits next to the mic**, not buried in settings, and is labelled by what the learner thinks in: English, Hinglish, ಕನ್ನಡ + English, தமிழ் + English.
- **Show only the language paths that actually work.** Per section 14, don't render a picker option the demo can't honour.
- **The mic is hold-to-talk, not toggle.** It gives a clear turn boundary, matches how people argue, and avoids the dead air that kills a live demo.
- **Transcription errors are not failures.** The Judge reasons over meaning, so a mangled transcript should never surface as an error state. Show the transcript quietly and let Claude interpret it.

---

# 39. FRONTEND COMPONENT API

`Chintu.jsx` — no dependencies, drop into `src/components/`.

```jsx
import Chintu from "./components/Chintu";

const { reply, emotion, gesture, belief_strength, should_yield } = chintuResponse;

<Chintu
  emotion={emotion}              // one of the nine states
  beliefStrength={belief_strength}  // 0–1, from Agent 2
  gesture={gesture}              // "nod" | "point_board" | null
  speaking={isMayaPlaying}
  audioRef={mayaAudioRef}
/>
<audio
  ref={mayaAudioRef}
  onPlay={() => setPlaying(true)}
  onEnded={() => setPlaying(false)}
/>
```

The component owns the surprised-flash, blinking, pupil direction, gesture playback, and lip sync. It decides nothing about the conversation.

## Lip sync

If `audioRef` is supplied, the mouth opens with real amplitude from a Web Audio analyser — wide on an emphatic "Nahi!", barely moving on a mumble. Three failure modes to know:

- **AudioContext needs a user gesture.** Create it inside the click that starts the session, or it stays suspended and the mouth never moves.
- **`createMediaElementSource` runs once per element.** Keep one `<audio>` for the whole session and swap `src` per turn.
- **CORS.** A cross-origin audio URL without headers gives an analyser that reads all zeros — audio plays, mouth doesn't. Fetch as a blob and use `createObjectURL`, or set `crossOrigin="anonymous"`.

Drop the `audioRef` prop and the component falls back to a timed mouth flap automatically. The demo still reads correctly.

## Accessibility floor

`prefers-reduced-motion` disables blinking, lip sync, and gestures. The avatar carries an `aria-label` naming the current state. Captions cover everything Maya says. None of this is optional — a meaningful share of aspirants use these.
