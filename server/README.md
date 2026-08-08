# ULTA Server

The Express backend for ULTA. It validates multimodal learning evidence, creates isolated sessions, coordinates the four Claude roles, and wraps Sarvam speech-to-text and Maya text-to-speech.

## Run

```bash
cp .env.example .env
npm install
npm start
```

Development mode:

```bash
npm run dev
```

The default local port is `3001`. The server reads the platform-provided `PORT` value in production.

## Required environment variables

```text
USE_FIXTURES=false
ANTHROPIC_API_KEY=...
SARVAM_API_KEY=...
MAYA_API_KEY=...
ULTA_MODEL=claude-sonnet-4-5
MAYA_VOICE=Arjun
SARVAM_STT_MODEL=saaras:v3
SARVAM_STT_MODE=transcribe
CORS_ORIGIN=http://localhost:5173
```

See [.env.example](.env.example) for provider URLs, deadlines and session TTL configuration. Keep `.env` private.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health and fixture-mode status |
| POST | `/api/diagnose` | Diagnose image evidence, spoken/typed reasoning, or both |
| POST | `/api/chintu` | Generate Chintu's next in-character turn |
| POST | `/api/judge` | Evaluate debate or transfer reasoning |
| POST | `/api/verify` | Generate an idempotent transfer problem |
| POST | `/api/stt` | Transcribe uploaded audio |
| POST | `/api/tts` | Render a Chintu line as browser-playable WAV audio |

`POST /api/diagnose` accepts:

```json
{
  "imageBase64": "optional base64 image",
  "questionText": "optional spoken or typed reasoning"
}
```

At least one non-empty evidence source is required. Text-only input must provide enough reasoning to identify a misconception safely.

Every route after diagnosis requires the exact returned `sessionId`. Sessions are stored in memory and expire after inactivity; restarting the service clears active sessions.

## Agent isolation

Chintu receives only:

```text
misconception
common_argument
debate problem
conversation history
```

He never receives `correct_model`, `repair_criteria`, or Judge output. The isolation suite verifies the production request builder rather than a test-only duplicate.

## Test

```bash
npm test             # core + agent + isolation suites
npm run test:agents  # deterministic agent and isolation checks
npm run test:adversarial  # live Chintu adversarial run; requires .env
```

Live provider failures degrade to explicit, bounded fallbacks. Judge failures remain fail-closed and cannot advance a learner's stage.

