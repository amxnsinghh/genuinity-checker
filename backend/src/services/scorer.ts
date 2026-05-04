import type {
  AIResult,
  AnalyzedResponse,
  FormResponse,
  GenuinityStatus,
  HeuristicResult,
} from "../types";

/**
 * Translate a numeric score into a human label.
 *
 *  >= 70  -> Genuine
 *  40-69  -> Suspicious
 *  < 40   -> Fake
 *
 * Tuned to be mildly conservative — most legit responses easily clear 70.
 */
export function statusFromScore(score: number): GenuinityStatus {
  if (score >= 70) return "Genuine";
  if (score >= 40) return "Suspicious";
  return "Fake";
}

/**
 * Combine heuristic and AI scores.
 *
 * Heuristic is fast, deterministic, and very confident on obvious cases (e.g.
 * straight-lining, duplicates). AI is better at nuance (e.g. plausible-sounding
 * text answers). When AI is skipped, heuristic carries the full weight.
 *
 * Weights: 60% heuristic, 40% AI when both available.
 */
export function combineScores(heur: HeuristicResult, ai: AIResult): number {
  if (ai.skipped) return heur.score;
  const combined = heur.score * 0.6 + ai.score * 0.4;
  return Math.round(combined);
}

/** Build the user-facing reasons array (heuristic flags + short AI rationale). */
function buildReasons(heur: HeuristicResult, ai: AIResult): string[] {
  const reasons = [...heur.flags];
  if (!ai.skipped) {
    if (ai.emailVerdict?.looksFake) {
      const why = ai.emailVerdict.reason ? ` — ${ai.emailVerdict.reason}` : "";
      reasons.push(`AI: email looks fake${why}`);
    }
    if (ai.reasoning) reasons.push(`AI: ${ai.reasoning}`);
  }
  if (reasons.length === 0) {
    reasons.push("No suspicious patterns detected");
  }
  return reasons;
}

/**
 * Merge per-response heuristic + AI results into the final shape served by the
 * API. `responses` and the two arrays must be the same length.
 */
export function mergeResults(
  responses: FormResponse[],
  heuristics: HeuristicResult[],
  ai: AIResult[]
): AnalyzedResponse[] {
  return responses.map((r, i) => {
    const id = r.id ?? `r${i + 1}`;
    const heur = heuristics[i];
    const aiResult = ai[i];
    const score = combineScores(heur, aiResult);
    return {
      id,
      email: r.email,
      timestamp: r.timestamp,
      score,
      status: statusFromScore(score),
      reasons: buildReasons(heur, aiResult),
      heuristic: heur,
      ai: aiResult,
    };
  });
}

/** Build the summary block sent alongside the per-row results. */
export function buildSummary(results: AnalyzedResponse[], aiUsed: boolean) {
  const total = results.length;
  let genuine = 0;
  let suspicious = 0;
  let fake = 0;
  let sum = 0;
  for (const r of results) {
    sum += r.score;
    if (r.status === "Genuine") genuine++;
    else if (r.status === "Suspicious") suspicious++;
    else fake++;
  }
  return {
    total,
    genuine,
    suspicious,
    fake,
    averageScore: total === 0 ? 0 : Math.round(sum / total),
    aiUsed,
  };
}
