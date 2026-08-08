# ULTA Web

The React/Vite frontend for ULTA. It provides the Chintu intake chat sidebar, optional page attachment, one-click voice recording, debate transcript, belief meter, transfer check and completion screen.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). During development, Vite proxies `/api/*` to `http://localhost:3001`.

## Environment

```text
VITE_USE_MOCKS=false
```

- `false`: call the real Express API.
- `true`: use deterministic browser fixtures for UI development and Playwright.

Vite environment variables are compiled into the browser bundle. Never place Anthropic, Sarvam, Maya, or other secret keys in this directory.

## Scripts

```bash
npm run dev       # development server
npm run build     # production bundle in dist/
npm run preview   # preview the production bundle
npm run test:e2e  # Playwright desktop and mobile workflow tests
```

## Workflow

1. Chintu opens the intake sidebar.
2. The learner speaks or types their question, answer and reasoning, or attaches a page.
3. The frontend sends available evidence to `POST /api/diagnose`.
4. A validated diagnosis opens the teaching session.
5. Voice/text turns are judged and answered sequentially.
6. A passing explanation opens the transfer problem.
7. A passing transfer answer completes the session.

`useUltaSession.js` owns browser state. Backend `sessionId` values are authoritative; the UI never silently substitutes fixture content after a live diagnosis failure.

## Production routing

The client deliberately uses relative `/api/*` URLs. Configure the static host with a rewrite such as:

```text
/api/* → https://YOUR-BACKEND.example/api/*
```

This keeps browser requests same-origin and avoids embedding a provider URL throughout components.

