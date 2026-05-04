// Mirrors backend/src/types.ts. Kept duplicated rather than imported across
// projects so the frontend can deploy independently without monorepo tooling.

export interface FormResponse {
  id?: string;
  answers: Record<string, string | string[]>;
  timestamp?: string;
  startedAt?: string;
  email?: string;
  durationSeconds?: number;
}

export type GenuinityStatus = "Genuine" | "Suspicious" | "Fake";

export interface AnalyzedResponse {
  id: string;
  email?: string;
  timestamp?: string;
  score: number;
  status: GenuinityStatus;
  reasons: string[];
  heuristic: {
    score: number;
    flags: string[];
    signals: {
      sameOptionRatio: number;
      entropy: number;
      isDuplicate: boolean;
      duplicateOfId?: string;
      completionSeconds?: number;
      lowEffortTextRatio: number;
      inconsistencyCount: number;
    };
  };
  ai: {
    score: number;
    reasoning: string;
    skipped: boolean;
    emailVerdict?: {
      looksFake: boolean;
      reason: string;
    };
  };
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
