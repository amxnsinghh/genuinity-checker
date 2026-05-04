import type { AnalyzedResponse } from "./types";

/** Escape a single cell for CSV: wrap in quotes if it contains , " or newline. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Convert analyzed results to a CSV string ready for download. */
export function resultsToCsv(results: AnalyzedResponse[]): string {
  const headers = [
    "id",
    "email",
    "timestamp",
    "score",
    "status",
    "heuristic_score",
    "ai_score",
    "ai_skipped",
    "reasons",
  ];
  const rows = results.map((r) => [
    r.id,
    r.email ?? "",
    r.timestamp ?? "",
    r.score,
    r.status,
    r.heuristic.score,
    r.ai.score,
    r.ai.skipped ? "true" : "false",
    r.reasons.join(" | "),
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
}

/** Trigger a CSV download in the browser. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
