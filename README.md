# ULTA

> **Don't ask AI. Teach it.**

ULTA is a multimodal teach-the-AI learning platform. A learner starts by speaking, typing, uploading a page of academic work, or combining those inputs. Claude identifies the conceptual belief behind the learner's mistake and gives that belief to **Chintu**, an animated AI classmate who argues from it. The learner must teach Chintu until a separate Judge confirms genuine understanding, then solve a transfer problem in a different context.

## The learning loop

```text
voice / text / page
        ↓
Diagnosis → Chintu debate → Judge → Transfer check
                ↑             │
                └── retry ────┘
```

The page is optional. Text- or voice-only entry must include an attempted answer, rule, or reasoning step; naming only a topic is not enough to create a diagnosis.

## Why ULTA is different

- **The learner teaches.** ULTA does not begin by revealing the answer.
- **Four isolated Claude roles.** Diagnosis, Chintu, Judge, and Verifier have separate responsibilities.
- **Chintu cannot leak the solution.** He never receives the correct model, repair criteria, or Judge output.
- **Understanding beats keywords.** The Judge requires grounded reasoning, not vocabulary matching.
- **Learning must transfer.** A fresh problem verifies that the repaired concept works in a new setting.
- **Voice is a first-class input.** The entry sidebar and teaching session both support one-click recording, transcription, and typed fallback.

## Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React, Vite, CSS | Chintu UI, intake chat, voice controls, debate and transfer flow |
| API | Node.js, Express | Validation, sessions, state transitions, provider boundaries |
| Reasoning | Claude Sonnet + Vision | Dynamic diagnosis, debate, judging and transfer generation |
| Speech-to-text | Sarvam AI | Multilingual voice transcription |
| Text-to-speech | Maya | Chintu's emotional voice |
| Testing | Node assertions, Playwright | Core, agent isolation, desktop and mobile workflow coverage |

The orchestrator is ordinary code, not another LLM. It owns the legal sequence of stages and prevents agents from changing control flow.

## Repository

```text
web/                    React application
server/                 Express API and orchestrator
server/agents/          Claude agent implementations
server/voice/           Sarvam and Maya integrations
prompts/                Agent system prompts
data/misconceptions/    Deterministic offline fixtures
fixtures/               Demo/test responses
progress/               Team engineering log
```

## Run locally

Requirements: Node.js 20 or newer and npm.

1. Configure the backend:

   ```bash
   cp server/.env.example server/.env
   ```

   Add your provider keys to `server/.env`. Never commit that file.

2. Start the API:

   ```bash
   cd server
   npm install
   npm start
   ```

3. Start the frontend in another terminal:

   ```bash
   cd web
   npm install
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173). The API health endpoint is [http://localhost:3001/api/health](http://localhost:3001/api/health).

For an offline demo, set `USE_FIXTURES=true` in `server/.env`. The committed frontend default uses the real API path.

## Test

```bash
cd server && npm test
cd web && npm run build
cd web && npm run test:e2e
```

Current coverage includes exact-session isolation, legal stage transitions, image/text diagnosis gates, dynamic concept isolation, one-click microphone cleanup, text-only and voice-only entry, desktop/mobile layouts, and the complete debate-to-transfer flow.

## Deploy

Deploy the monorepo as two services:

### Frontend static site

```text
Root directory: web
Build command: npm install && npm run build
Publish directory: dist
```

### Backend web service

```text
Root directory: server
Build command: npm install
Start command: npm start
Health check: /api/health
```

The browser calls relative `/api/*` routes. Configure the frontend host to rewrite `/api/*` to the backend service, or place both behind one reverse proxy. Store all provider keys only on the backend.

## Team

- Deepthi C J — Claude agents and misconception model
- Jeswin Jacob — backend, orchestration and voice providers
- Preethesh Carvalho — frontend, interaction and Chintu

## Project documentation

- [Contracts](CONTRACTS.md)
- [Design system](ULTA-DESIGN.md)
- [Team plan](TEAM-PLAN.md)
- [Verification and progress](PROGRESS.md)

