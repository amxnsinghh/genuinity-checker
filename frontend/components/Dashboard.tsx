"use client";

import { useState } from "react";
import type { AnalyzeResponseBody, FormResponse } from "@/lib/types";
import { analyzeResponses } from "@/lib/api";
import { downloadCsv, resultsToCsv } from "@/lib/csv";
import UploadPanel from "./UploadPanel";
import SummaryCards from "./SummaryCards";
import Charts from "./Charts";
import ResultsTable from "./ResultsTable";
import Loader from "./Loader";

export default function Dashboard() {
  const [data, setData] = useState<AnalyzeResponseBody | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (responses: FormResponse[], useAI: boolean) => {
    setIsAnalyzing(true);
    setError(null);
    setData(null);
    try {
      const result = await analyzeResponses(responses, useAI);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExport = () => {
    if (!data) return;
    const csv = resultsToCsv(data.results);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadCsv(`genuinity-results-${stamp}.csv`, csv);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/70 bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-500 shadow-soft" />
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                Genuinity Checker
              </h1>
              <p className="text-xs text-slate-500">
                Score Google Form responses with heuristics + Gemini
              </p>
            </div>
          </div>

          {data && (
            <button
              onClick={handleExport}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Export CSV
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <UploadPanel onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-fade-in">
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        )}

        {isAnalyzing && <Loader />}

        {data && !isAnalyzing && (
          <>
            {data.summary.aiError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 animate-fade-in">
                <strong className="font-semibold">AI analysis unavailable:</strong>{" "}
                {data.summary.aiError} Heuristic-only scores are shown below.
              </div>
            )}
            <SummaryCards summary={data.summary} />
            <Charts results={data.results} />
            <ResultsTable results={data.results} />
          </>
        )}

        {!data && !isAnalyzing && !error && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-10 text-center text-slate-500 animate-fade-in">
            <p className="text-sm">
              Paste your Google Form JSON above (or load the sample) and click
              <span className="mx-1 font-semibold text-brand-700">Analyze responses</span>
              to see results.
            </p>
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 text-center text-xs text-slate-400">
        Heuristics run locally on the backend; AI analysis uses Google Gemini.
      </footer>
    </div>
  );
}
