import { createHash } from "crypto";
import type { FormResponse, HeuristicResult } from "../types";

/**
 * Low-effort phrases that strongly suggest a respondent didn't bother.
 * Kept short on purpose — substring match is enough for our use case.
 */
const LOW_EFFORT_TEXTS = new Set([
  "ok",
  "okay",
  "yes",
  "no",
  "na",
  "n/a",
  "none",
  "good",
  "fine",
  "nice",
  "idk",
  "asd",
  "asdf",
  "abc",
  "xyz",
  "test",
  "-",
  ".",
  "..",
  "...",
]);

/**
 * Plausible minimum seconds-per-question. We use two thresholds:
 *  - HARD: below this is almost certainly click-through behavior.
 *  - SOFT: below this is suspiciously fast but plausible for confident users.
 */
const HARD_MIN_SECONDS_PER_QUESTION = 1;
const SOFT_MIN_SECONDS_PER_QUESTION = 2;

/**
 * Cache of canonical-answer hashes seen across the batch — used to detect
 * exact duplicate responses (a common bot/spam pattern).
 */
type DuplicateIndex = Map<string, string>;

/** Build a stable hash of a response's answers, ignoring order of MCQ keys. */
function hashAnswers(answers: FormResponse["answers"]): string {
  const sortedKeys = Object.keys(answers).sort();
  const normalized = sortedKeys.map((k) => {
    const v = answers[k];
    const flat = Array.isArray(v) ? [...v].sort().join("|") : String(v ?? "");
    return `${k}=${flat.trim().toLowerCase()}`;
  });
  return createHash("sha1").update(normalized.join("&&")).digest("hex");
}

/**
 * Shannon entropy of the chosen MCQ option distribution.
 * Higher = more variety in answers, lower = repetitive (e.g. "all A").
 * Returned in bits, normalized later when scoring.
 */
function answerEntropy(values: string[]): number {
  if (values.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const total = values.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

/** True when the value looks like a free-text answer rather than an MCQ pick. */
function isLikelyFreeText(value: string): boolean {
  // MCQ options are usually short, single-line, no punctuation.
  // Anything with whitespace or > 30 chars we treat as text.
  return /\s/.test(value) || value.length > 30;
}

/**
 * True when a question key looks like it expects a free-text answer.
 * Used to penalize "ok"/"yes"/"asdf" answers regardless of whether the value
 * itself looks short enough to be MCQ.
 */
function isFreeTextQuestion(question: string): boolean {
  return /(comment|feedback|explain|describe|why|reason|other|specify|elaborate|detail|tell us|thoughts?|opinion)/i.test(
    question
  );
}

/** Normalize a value into one or more flat strings for analysis. */
function flatten(value: string | string[]): string[] {
  return Array.isArray(value) ? value.map(String) : [String(value ?? "")];
}

/** Compute completion time (seconds) from whichever fields are present. */
function completionSeconds(r: FormResponse): number | undefined {
  if (typeof r.durationSeconds === "number" && r.durationSeconds >= 0) {
    return r.durationSeconds;
  }
  if (r.startedAt && r.timestamp) {
    const start = Date.parse(r.startedAt);
    const end = Date.parse(r.timestamp);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      return (end - start) / 1000;
    }
  }
  return undefined;
}

/**
 * Very lightweight inconsistency detection.
 *
 * Survey-specific contradictions are impossible to enumerate generically, so
 * we keep this conservative — only flag pairs that are *almost always* wrong:
 * Strongly Agree + Strongly Disagree on the same form is a classic bot tell.
 *
 * Real production code would plug in form-aware rules here; we keep it simple
 * and deterministic so it's still useful out of the box.
 */
function inconsistencyCount(answers: FormResponse["answers"]): number {
  const values = Object.values(answers).flatMap(flatten).map((v) => v.toLowerCase().trim());
  const set = new Set(values);

  let count = 0;
  // Likert opposites in the same response — strong bot signal.
  if (set.has("strongly agree") && set.has("strongly disagree")) count++;
  if (set.has("very satisfied") && set.has("very dissatisfied")) count++;
  return count;
}

/**
 * Run all heuristic checks on a single response.
 *
 * Designed to be cheap — pure JS, no I/O, ~O(answers) per response.
 */
export function evaluateHeuristics(
  response: FormResponse,
  duplicateIndex: DuplicateIndex,
  responseId: string
): HeuristicResult {
  const flags: string[] = [];
  const allValues = Object.values(response.answers).flatMap(flatten);
  const trimmedValues = allValues.map((v) => v.trim()).filter((v) => v.length > 0);

  // --- 1. Same-option pattern: how dominant is the most common pick? ---------
  const counts = new Map<string, number>();
  for (const v of trimmedValues) counts.set(v, (counts.get(v) ?? 0) + 1);
  const maxCount = trimmedValues.length === 0 ? 0 : Math.max(...counts.values());
  const sameOptionRatio = trimmedValues.length === 0 ? 0 : maxCount / trimmedValues.length;
  if (trimmedValues.length >= 4 && sameOptionRatio >= 0.9) {
    flags.push("Almost all answers are identical (straight-lining)");
  } else if (trimmedValues.length >= 5 && sameOptionRatio >= 0.7) {
    flags.push("High repetition in answer choices");
  }

  // --- 2. Random / low entropy ----------------------------------------------
  const entropy = answerEntropy(trimmedValues);
  // For N options the maximum entropy is log2(N). We treat <0.5 bits as
  // essentially flat (basically same answer everywhere).
  if (trimmedValues.length >= 5 && entropy < 0.5) {
    flags.push("Very low answer variety (possible bot)");
  }

  // --- 3. Duplicate detection (across batch) ---------------------------------
  const fingerprint = hashAnswers(response.answers);
  const duplicateOfId = duplicateIndex.get(fingerprint);
  const isDuplicate = Boolean(duplicateOfId);
  if (isDuplicate) {
    flags.push(`Exact duplicate of response ${duplicateOfId}`);
  } else {
    duplicateIndex.set(fingerprint, responseId);
  }

  // --- 4. Time taken ---------------------------------------------------------
  const seconds = completionSeconds(response);
  const questionCount = Object.keys(response.answers).length;
  let timePenalty = 0;
  if (typeof seconds === "number" && questionCount > 0) {
    const perQ = seconds / questionCount;
    if (perQ < HARD_MIN_SECONDS_PER_QUESTION) {
      flags.push(`Suspiciously fast: ${perQ.toFixed(2)}s per question`);
      timePenalty = 30;
    } else if (perQ < SOFT_MIN_SECONDS_PER_QUESTION) {
      flags.push(`Fast completion: ${perQ.toFixed(2)}s per question`);
      timePenalty = 12;
    }
  }

  // --- 5. Inconsistency rules ------------------------------------------------
  const inconsistencies = inconsistencyCount(response.answers);
  if (inconsistencies > 0) {
    flags.push(`Detected ${inconsistencies} contradictory answer pair(s)`);
  }

  // --- 6. Low-effort answers -------------------------------------------------
  // We look at two things:
  //  (a) Free-text answers (whitespace or long) — penalize empties / "ok"-style.
  //  (b) Any answer to a question whose key looks like a free-text prompt
  //      (e.g. "Any feedback?") — catches bots filling MCQ-shaped "ok" replies.
  const textValues = allValues.filter(isLikelyFreeText);
  let lowEffortText = 0;
  for (const t of textValues) {
    const norm = t.trim().toLowerCase();
    if (norm.length === 0 || norm.length < 3 || LOW_EFFORT_TEXTS.has(norm)) {
      lowEffortText++;
    }
  }

  let lowEffortPromptHits = 0;
  let freeTextPromptCount = 0;
  for (const [q, v] of Object.entries(response.answers)) {
    if (!isFreeTextQuestion(q)) continue;
    freeTextPromptCount++;
    const flat = flatten(v).map((s) => s.trim().toLowerCase());
    const allLowEffort = flat.every(
      (s) => s.length === 0 || s.length < 3 || LOW_EFFORT_TEXTS.has(s)
    );
    if (allLowEffort) lowEffortPromptHits++;
  }

  const lowEffortTextRatio = textValues.length === 0 ? 0 : lowEffortText / textValues.length;
  if (textValues.length >= 2 && lowEffortTextRatio >= 0.5) {
    flags.push("Most free-text answers look low-effort");
  }
  if (freeTextPromptCount > 0 && lowEffortPromptHits === freeTextPromptCount) {
    flags.push("All open-ended answers are low-effort");
  }

  // --- Final heuristic score (0-100) ----------------------------------------
  // We start from 100 and subtract penalties. Each check has a tunable weight.
  let score = 100;
  // Same-option ratio: stronger penalty since straight-lining is the #1 fraud
  // pattern. Threshold lowered to 0.4 so 80% repetition gets a meaningful hit.
  score -= Math.max(0, sameOptionRatio - 0.4) * 100;            // up to -60 at 100% same
  if (entropy < 1 && trimmedValues.length >= 4) {
    score -= (1 - entropy) * 30;                                // up to -30
  }
  if (isDuplicate) score -= 50;
  score -= timePenalty;
  score -= inconsistencies * 12;
  score -= lowEffortTextRatio * 25;
  score -= lowEffortPromptHits * 15;

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    flags,
    signals: {
      sameOptionRatio,
      entropy,
      isDuplicate,
      duplicateOfId,
      completionSeconds: seconds,
      lowEffortTextRatio,
      inconsistencyCount: inconsistencies,
    },
  };
}

/**
 * Convenience wrapper: run heuristics across a whole batch, sharing the
 * duplicate index so cross-response duplicates can be detected.
 */
export function evaluateBatch(responses: FormResponse[]): HeuristicResult[] {
  const dupIdx: DuplicateIndex = new Map();
  return responses.map((r, i) => evaluateHeuristics(r, dupIdx, r.id ?? `r${i + 1}`));
}
