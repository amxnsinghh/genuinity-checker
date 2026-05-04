# Backend — Genuinity Checker API

Express + TypeScript service that analyzes Google Form responses and returns
genuinity scores. Same code base also deploys as Vercel serverless functions
(`api/analyze.ts`).

## Quick start (local dev)

```bash
cd backend
cp .env.example .env       # add your GEMINI_API_KEY
npm install
npm run dev                # http://localhost:4000
```

Endpoints:

- `GET  /health` — basic status + reports whether Gemini key is set
- `POST /analyze` — body: `{ "responses": [...], "useAI": true }`

Try it:

```bash
curl -X POST http://localhost:4000/analyze \
  -H "Content-Type: application/json" \
  --data @sample-data.json
```

## Build & start (production)

```bash
npm run build
npm start
```

## Architecture

```
src/
  index.ts                    Express bootstrap
  routes/analyze.ts           POST /analyze handler
  services/
    analyze.ts                Pipeline: validate -> heuristics -> AI -> merge
    heuristics.ts             Fast deterministic checks
    gemini.ts                 Batched Gemini calls (skipped if no key)
    scorer.ts                 Combine + bucket into Genuine/Suspicious/Fake
api/
  analyze.ts                  Vercel serverless wrapper (same pipeline)
```

The `services/` modules are framework-agnostic so the same logic powers both
Express and Vercel.

## Deploy options

### Option A — Vercel serverless (recommended, zero infra)

1. Push the `/backend` folder to its own Git repo (or import the monorepo and
   set "Root Directory" to `backend` in the Vercel dashboard).
2. Vercel auto-detects `api/analyze.ts` and exposes it at `/api/analyze`.
3. Add env var `GEMINI_API_KEY` in the Vercel project settings.
4. Deploy. Your endpoint is `https://<project>.vercel.app/api/analyze`.

### Option B — Render / Railway / Fly

Standard Node service. Build command `npm run build`, start command `npm start`,
expose port from `PORT` env var, set `GEMINI_API_KEY`.

## Request shape

```json
{
  "useAI": true,
  "responses": [
    {
      "id": "r1",
      "email": "user@example.com",
      "startedAt": "2026-05-01T10:00:00Z",
      "timestamp": "2026-05-01T10:04:30Z",
      "answers": {
        "Question 1": "Option A",
        "Free text question": "Some answer text"
      }
    }
  ]
}
```

## Response shape

```json
{
  "results": [
    {
      "id": "r1",
      "email": "user@example.com",
      "score": 87,
      "status": "Genuine",
      "reasons": ["No suspicious patterns detected", "AI: Coherent answers."],
      "heuristic": { "score": 92, "flags": [], "signals": { "...": "..." } },
      "ai": { "score": 80, "reasoning": "Coherent answers.", "skipped": false }
    }
  ],
  "summary": {
    "total": 5,
    "genuine": 3,
    "suspicious": 1,
    "fake": 1,
    "averageScore": 64,
    "aiUsed": true
  }
}
```
