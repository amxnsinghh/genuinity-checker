interface LoaderProps {
  label?: string;
}

/**
 * Animated loading state shown while the backend is crunching responses.
 * Uses the indeterminate progress bar defined in globals.css.
 */
export default function Loader({ label = "Analyzing responses…" }: LoaderProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-soft border border-slate-200/70 animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-brand-600 animate-pulse-slow" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800">{label}</div>
          <div className="text-xs text-slate-500">
            Heuristics run instantly — Gemini calls take a few seconds.
          </div>
        </div>
      </div>
      <div className="h-1.5 w-full progress-bar rounded-full" />
    </div>
  );
}
