"use client";

import { useMemo, useState } from "react";
import type { AnalyzedResponse, GenuinityStatus } from "@/lib/types";

interface ResultsTableProps {
  results: AnalyzedResponse[];
}

type Filter = "all" | GenuinityStatus;

const STATUS_STYLES: Record<GenuinityStatus, string> = {
  Genuine: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Suspicious: "bg-amber-50 text-amber-700 ring-amber-200",
  Fake: "bg-rose-50 text-rose-700 ring-rose-200",
};

/** Pick a Tailwind text color based on score band. Mirrors the chart palette. */
function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-rose-600";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        (r.email?.toLowerCase().includes(q) ?? false) ||
        r.reasons.some((reason) => reason.toLowerCase().includes(q))
      );
    });
  }, [results, filter, query]);

  return (
    <section className="rounded-2xl bg-white shadow-soft border border-slate-200/70 animate-fade-in overflow-hidden">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-slate-200/70">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Per-response results</h3>
          <p className="text-xs text-slate-500">
            Showing {filtered.length} of {results.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search id, email, reason…"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition w-56"
          />
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["all", "Genuine", "Suspicious", "Fake"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  filter === f
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">ID</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium w-44">Score</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Reasons / flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-slate-700">{r.id}</td>
                <td className="px-5 py-3 text-slate-600">
                  {r.email || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${scoreBg(r.score)}`}
                        style={{ width: `${r.score}%` }}
                      />
                    </div>
                    <span className={`tabular-nums font-semibold ${scoreColor(r.score)}`}>
                      {r.score}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  <ul className="space-y-0.5">
                    {r.reasons.slice(0, 4).map((reason, i) => (
                      <li key={i} className="text-xs leading-snug">
                        {reason}
                      </li>
                    ))}
                    {r.reasons.length > 4 && (
                      <li className="text-xs text-slate-400">
                        +{r.reasons.length - 4} more
                      </li>
                    )}
                  </ul>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-sm text-slate-400"
                >
                  No responses match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
