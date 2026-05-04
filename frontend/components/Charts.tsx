"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyzedResponse } from "@/lib/types";

interface ChartsProps {
  results: AnalyzedResponse[];
}

const STATUS_COLORS = {
  Genuine: "#16a34a",
  Suspicious: "#f59e0b",
  Fake: "#dc2626",
} as const;

/**
 * Compute a histogram of scores in 10-point buckets (0-9, 10-19, ..., 90-100).
 * Returns 10 buckets ready for Recharts.
 */
function scoreHistogram(results: AnalyzedResponse[]) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${i * 10 + 9}`,
    count: 0,
  }));
  // Last bucket is inclusive of 100.
  buckets[9].range = "90-100";

  for (const r of results) {
    const idx = Math.min(9, Math.floor(r.score / 10));
    buckets[idx].count++;
  }
  return buckets;
}

function statusCounts(results: AnalyzedResponse[]) {
  const acc: Record<string, number> = { Genuine: 0, Suspicious: 0, Fake: 0 };
  for (const r of results) acc[r.status]++;
  return Object.entries(acc).map(([name, value]) => ({ name, value }));
}

export default function Charts({ results }: ChartsProps) {
  const histogram = scoreHistogram(results);
  const breakdown = statusCounts(results);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
      <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-soft border border-slate-200/70">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">
            Score distribution
          </h3>
          <span className="text-xs text-slate-400">
            buckets of 10, 0 → 100
          </span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogram} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="range" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {histogram.map((entry, i) => {
                  // Color by genuinity bucket: red < 40, amber < 70, green >= 70.
                  const mid = i * 10 + 5;
                  const color =
                    mid >= 70 ? STATUS_COLORS.Genuine : mid >= 40 ? STATUS_COLORS.Suspicious : STATUS_COLORS.Fake;
                  return <Cell key={entry.range} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-soft border border-slate-200/70">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          Genuine vs Fake
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={breakdown}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {breakdown.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 12, color: "#475569" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
