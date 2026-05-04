"use client";

import { useRef, useState } from "react";
import type { FormResponse } from "@/lib/types";

interface UploadPanelProps {
  onAnalyze: (responses: FormResponse[], useAI: boolean) => void;
  isAnalyzing: boolean;
}

const SAMPLE: FormResponse[] = [
  {
    id: "r1",
    email: "alice@example.com",
    startedAt: "2026-05-01T10:00:00Z",
    timestamp: "2026-05-01T10:04:30Z",
    answers: {
      "How often do you exercise?": "2-3 times a week",
      "Favorite cuisine?": "Italian",
      "Do you cook at home?": "Yes",
      "Rate our service": "4",
      "Any feedback?":
        "Loved the recommendations, especially the pasta tips you sent last week.",
    },
  },
  {
    id: "r2",
    email: "spam@bot.io",
    startedAt: "2026-05-01T10:05:00Z",
    timestamp: "2026-05-01T10:05:08Z",
    answers: {
      "How often do you exercise?": "A",
      "Favorite cuisine?": "A",
      "Do you cook at home?": "A",
      "Rate our service": "A",
      "Any feedback?": "ok",
    },
  },
  {
    id: "r3",
    email: "bob@example.com",
    startedAt: "2026-05-01T10:10:00Z",
    timestamp: "2026-05-01T10:13:12Z",
    answers: {
      "How often do you exercise?": "Never",
      "Favorite cuisine?": "Indian",
      "Do you cook at home?": "Yes",
      "Rate our service": "5",
      "Any feedback?": "I appreciated the quick checkout flow.",
    },
  },
  {
    id: "r4",
    email: "duplicate@bot.io",
    startedAt: "2026-05-01T10:15:00Z",
    timestamp: "2026-05-01T10:15:05Z",
    answers: {
      "How often do you exercise?": "A",
      "Favorite cuisine?": "A",
      "Do you cook at home?": "A",
      "Rate our service": "A",
      "Any feedback?": "ok",
    },
  },
  {
    id: "r5",
    answers: {
      "How often do you exercise?": "Daily",
      "Favorite cuisine?": "Mexican",
      "Do you cook at home?": "Never",
      "Rate our service": "Always",
      "Any feedback?": "asdf",
    },
  },
];

/**
 * Accept either:
 *   - { responses: [...] }
 *   - [...] (raw array)
 *   - a single response object (we wrap it in an array)
 */
function coerceToResponses(parsed: unknown): FormResponse[] {
  if (Array.isArray(parsed)) return parsed as FormResponse[];
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.responses)) return obj.responses as FormResponse[];
    if (obj.answers) return [parsed as FormResponse];
  }
  throw new Error('JSON must be an array, or { "responses": [...] }');
}

export default function UploadPanel({ onAnalyze, isAnalyzing }: UploadPanelProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Paste JSON or upload a file first.");
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      const responses = coerceToResponses(parsed);
      if (responses.length === 0) {
        setError("No responses found in the JSON.");
        return;
      }
      onAnalyze(responses, useAI);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not parse JSON input."
      );
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const content = await file.text();
      setText(content);
    } catch {
      setError("Could not read the selected file.");
    }
  };

  const loadSample = () => {
    setError(null);
    setText(JSON.stringify(SAMPLE, null, 2));
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-soft border border-slate-200/70 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Upload responses</h2>
          <p className="text-sm text-slate-500">
            Paste your Google Form JSON, drop a file, or load the sample.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label
            htmlFor="ai-toggle"
            className="flex items-center gap-2 cursor-pointer select-none"
            title="Toggle Gemini AI analysis. Disable for faster heuristic-only scoring."
          >
            <span className="text-sm font-medium text-slate-700">AI analysis</span>
            <span
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                useAI ? "bg-brand-600" : "bg-slate-300"
              }`}
            >
              <input
                id="ai-toggle"
                type="checkbox"
                className="sr-only"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
              />
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  useAI ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </span>
          </label>
        </div>
      </div>

      <textarea
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{ "responses": [ { "answers": { "Q1": "A", "Q2": "B" } } ] }'
        className="w-full h-56 font-mono text-sm rounded-xl border border-slate-200 bg-slate-50/60 p-3 outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
      />

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          Upload JSON file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={loadSample}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          Load sample
        </button>
        <button
          type="button"
          onClick={() => setText("")}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 transition"
        >
          Clear
        </button>
        <div className="grow" />
        <button
          type="button"
          onClick={submit}
          disabled={isAnalyzing}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {isAnalyzing ? "Analyzing…" : "Analyze responses"}
        </button>
      </div>
    </section>
  );
}
