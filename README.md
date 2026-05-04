# google-form-genuinity-checker

Full-stack tool that scores Google Form responses for **genuinity** using a
fast deterministic heuristic engine plus optional **Google Gemini** AI
analysis. Built for speed: heuristics run locally, AI is batched and
toggle-able.

```
┌──────────────────────────┐         ┌──────────────────────────────┐
│  Next.js dashboard       │ POST ─► │  /analyze                    │
│  (Tailwind + Recharts)   │         │  Express server  OR          │
│                          │         │  Vercel serverless function  │
└──────────────────────────┘         │   • heuristics (fast)        │
                                     │   • Gemini AI (optional)     │
                                     └──────────────────────────────┘
```

## Features

- Paste JSON or upload a Google Form export
- Heuristic checks (run instantly):
  - Same-option / straight-lining detection
  - Low entropy / random answering
  - Cross-batch duplicate fingerprinting
  - Time-to-complete sanity check
  - Inconsistent answer pairs
  - Low-effort free-text detection (`ok`, `asdf`, `n/a`, …)
- Gemini AI analysis (`gemini-1.5-flash`), batched and parallelized
- Combined score → status (`Genuine` / `Suspicious` / `Fake`)
- Beautiful dashboard: summary cards, score histogram, status pie, filterable
  results table, search, AI toggle, CSV export

## Project layout

```
google-form-genuinity-checker/
├── backend/            Express + TypeScript API
│   ├── src/
│   │   ├── index.ts                 Express bootstrap
│   │   ├── routes/analyze.ts        POST /analyze handler
│   │   ├── services/
│   │   │   ├── analyze.ts           Pipeline orchestrator
│   │   │   ├── heuristics.ts        Fast deterministic checks
│   │   │   ├── gemini.ts            Batched Gemini calls
│   │   │   └── scorer.ts            Combine + bucket
│   │   └── types.ts
│   ├── api/analyze.ts               Vercel serverless wrapper
│   ├── sample-data.json
│   ├── vercel.json
│   ├── package.json / tsconfig.json
│   └── .env.example
└── frontend/           Next.js 15 (App Router) + Tailwind
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   └── globals.css
    ├── components/
    │   ├── Dashboard.tsx
    │   ├── UploadPanel.tsx
    │   ├── SummaryCards.tsx
    │   ├── Charts.tsx
    │   ├── ResultsTable.tsx
    │   └── Loader.tsx
    ├── lib/
    │   ├── api.ts                  fetch wrapper for /analyze
    │   ├── csv.ts                  CSV export
    │   └── types.ts
    ├── tailwind.config.ts / postcss.config.js
    ├── next.config.mjs / tsconfig.json
    ├── package.json
    └── .env.local.example
```

## Local development

In two terminals:

```bash
# Terminal 1 — backend
cd backend
cp .env.example .env                 # set GEMINI_API_KEY
npm install
npm run dev                          # http://localhost:4000
```

```bash
# Terminal 2 — frontend
cd frontend
cp .env.local.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:4000/analyze
npm install
npm run dev                          # http://localhost:3000
```

Open `http://localhost:3000`, click **Load sample** in the upload panel, then
**Analyze responses**.

## Try the API directly

```bash
curl -X POST http://localhost:4000/analyze \
  -H "Content-Type: application/json" \
  --data @backend/sample-data.json
```

## Deployment

### Frontend → Vercel

1. Import the `/frontend` folder as a Vercel project.
2. Set env var `NEXT_PUBLIC_API_URL` to your deployed backend URL.
3. Deploy.

### Backend — Option A: Vercel serverless (recommended)

1. Import the `/backend` folder as a separate Vercel project.
2. Vercel auto-detects `api/analyze.ts` and exposes it at `/api/analyze`.
3. Set env var `GEMINI_API_KEY`.
4. Deploy. Endpoint becomes `https://<backend>.vercel.app/api/analyze`.

### Backend — Option B: Render / Railway / Fly

Standard Node service:

- Build command: `npm run build`
- Start command: `npm start`
- Set env var `GEMINI_API_KEY`
- Expose port from `PORT` (auto-handled on Render/Railway/Fly)

## Request / response shape

**Request** — `POST /analyze`:

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

**Response**:

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

## How scoring works

1. **Heuristics** run first (always). Each response starts at 100 and is
   penalized for: straight-lining, low entropy, duplicates, suspiciously fast
   completion, contradictory answers, and low-effort free-text.
2. **Gemini** (when enabled, `gemini-2.0-flash` by default) sees each response
   and returns its own 0–100 score with a one-sentence rationale. Batches of
   10 responses per request, ≤ 3 concurrent — keeps total time low and
   free-tier quota happy. Override the model via `GEMINI_MODEL` env var.
3. **Combined score** = `heuristic * 0.6 + ai * 0.4`. If AI is skipped or
   fails, the heuristic score is used directly.
4. **Status bucket**: `≥ 70 = Genuine`, `40–69 = Suspicious`, `< 40 = Fake`.

## Tuning

- Edit weights in `backend/src/services/scorer.ts` to bias the combined score.
- Add domain-specific contradiction rules in `inconsistencyCount` inside
  `backend/src/services/heuristics.ts`.
- Adjust batch size / concurrency in `backend/src/services/gemini.ts`.
