import type { AnalyzeResponseBody } from "@/lib/types";

interface SummaryCardsProps {
  summary: AnalyzeResponseBody["summary"];
}

interface Card {
  label: string;
  value: string | number;
  hint?: string;
  accent: string;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  const cards: Card[] = [
    {
      label: "Total responses",
      value: summary.total,
      hint: summary.aiUsed ? "AI analysis applied" : "Heuristic-only",
      accent: "from-slate-100 to-slate-50 text-slate-900",
    },
    {
      label: "Genuine",
      value: summary.genuine,
      hint: `${pct(summary.genuine, summary.total)}% of total`,
      accent: "from-emerald-100 to-emerald-50 text-emerald-900",
    },
    {
      label: "Suspicious",
      value: summary.suspicious,
      hint: `${pct(summary.suspicious, summary.total)}% of total`,
      accent: "from-amber-100 to-amber-50 text-amber-900",
    },
    {
      label: "Fake",
      value: summary.fake,
      hint: `${pct(summary.fake, summary.total)}% of total`,
      accent: "from-rose-100 to-rose-50 text-rose-900",
    },
    {
      label: "Average score",
      value: summary.averageScore,
      hint: "out of 100",
      accent: "from-indigo-100 to-indigo-50 text-indigo-900",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-fade-in">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl bg-gradient-to-br ${c.accent} p-4 shadow-soft border border-white/60`}
        >
          <div className="text-xs font-medium uppercase tracking-wide opacity-70">
            {c.label}
          </div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{c.value}</div>
          {c.hint && (
            <div className="mt-0.5 text-xs opacity-70">{c.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
