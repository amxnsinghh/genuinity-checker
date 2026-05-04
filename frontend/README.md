# Frontend — Genuinity Checker Dashboard

Next.js 15 (App Router) + Tailwind + Recharts. Talks to the `/analyze`
endpoint exposed by the backend.

## Quick start

```bash
cd frontend
cp .env.local.example .env.local      # set NEXT_PUBLIC_API_URL
npm install
npm run dev                           # http://localhost:3000
```

## Configuration

`NEXT_PUBLIC_API_URL` controls where the dashboard sends responses.

- Local dev (Express on port 4000): `http://localhost:4000/analyze`
- Vercel serverless backend: `https://<backend>.vercel.app/api/analyze`

## Deploy to Vercel

1. Import this `/frontend` folder into a new Vercel project.
2. Add env var `NEXT_PUBLIC_API_URL` pointing at your deployed backend.
3. Deploy. That's it.

## Project layout

```
app/
  layout.tsx        Root layout + global CSS
  page.tsx          Renders <Dashboard />
  globals.css       Tailwind + small custom styles (loader, scrollbar)
components/
  Dashboard.tsx     State + composition root
  UploadPanel.tsx   JSON paste + file upload + AI toggle
  SummaryCards.tsx  Top-of-page count cards
  Charts.tsx        Recharts: histogram + status pie
  ResultsTable.tsx  Per-response table with filter/search
  Loader.tsx        Indeterminate progress bar
lib/
  api.ts            fetch() wrapper for /analyze
  csv.ts            CSV serialization + download
  types.ts          Type mirrors of backend payloads
```

## Notes

- The AI toggle in `UploadPanel` flips `useAI` in the API request body. With it
  off, the backend skips Gemini entirely and just returns heuristic scores —
  much faster for large batches.
- The CSV export uses the dataset already loaded in memory; no extra API call.
- The dashboard is fully responsive (down to ~320px width).
