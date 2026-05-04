/**
 * Shared types for the genuinity checker.
 *
 * The input shape mirrors what you typically get when exporting Google Form
 * responses to JSON: each row is one respondent, with a free-form `answers`
 * map (question -> chosen option / text) plus optional metadata.
 */

export interface FormResponse {
  /** Stable identifier. If absent we synthesize one from the index. */
  id?: string;

  /** Question -> answer map. Values are usually strings, sometimes string[] (checkbox). */
  answers: Record<string, string | string[]>;

  /** ISO timestamp when the response was submitted. */
  timestamp?: string;

  /** ISO timestamp when the form was opened (used for time-taken heuristic). */
  startedAt?: string;

  /** Respondent email if the form collected one. */
  email?: string;

  /** Time-to-complete in seconds (overrides timestamp math if provided). */
  durationSeconds?: number;
}

export interface AnalyzeRequestBody {
  responses: FormResponse[];
  /** When false, AI step is skipped (faster, deterministic). */
  useAI?: boolean;
}

export interface HeuristicResult {
  /** 0-100 — higher means more genuine. */
  score: number;
  flags: string[];
  /** Internal signals used for downstream scoring/debug. */
  signals: {
    sameOptionRatio: number;
    entropy: number;
    isDuplicate: boolean;
    duplicateOfId?: string;
    completionSeconds?: number;
    lowEffortTextRatio: number;
    inconsistencyCount: number;
  };
}

export interface AIResult {
  score: number;
  reasoning: string;
  /** True when Gemini call was skipped or failed; score will be neutral. */
  skipped: boolean;
  /**
   * Gemini's quick guess at email plausibility. Only present when AI ran AND
   * a non-empty email was supplied with the response. This is intentionally
   * just a heuristic guess from the model, not a real-world deliverability or
   * disposable-domain check.
   */
  emailVerdict?: {
    looksFake: boolean;
    reason: string;
  };
}

export type GenuinityStatus = "Genuine" | "Suspicious" | "Fake";

export interface AnalyzedResponse {
  id: string;
  email?: string;
  timestamp?: string;
  score: number;
  status: GenuinityStatus;
  reasons: string[];
  heuristic: HeuristicResult;
  ai: AIResult;
}

export interface AnalyzeResponseBody {
  results: AnalyzedResponse[];
  summary: {
    total: number;
    genuine: number;
    suspicious: number;
    fake: number;
    averageScore: number;
    aiUsed: boolean;
    /** Populated when AI was requested but failed (quota, bad key, etc.). */
    aiError?: string;
  };
}
