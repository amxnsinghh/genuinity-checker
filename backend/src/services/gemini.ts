import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIResult, FormResponse } from "../types";

/**
 * Cap how many responses we send to Gemini in a single request.
 * Keeping batches small keeps token usage predictable and parsing reliable.
 */
const BATCH_SIZE = 10;

/** Concurrency for parallel batch calls — tuned for Gemini's free tier. */
const BATCH_CONCURRENCY = 3;

let cachedClient: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!cachedClient) cachedClient = new GoogleGenerativeAI(key);
  return cachedClient;
}

function getModelName(): string {
  return process.env.GEMINI_MODEL || "gemini-3.1-flash-preview";
}

/** Trim huge response bodies before sending to the model — keeps it cheap. */
function compactResponse(r: FormResponse, idx: number) {
  return {
    idx,
    email: r.email ?? null,
    timestamp: r.timestamp ?? null,
    answers: r.answers,
  };
}

/**
 * Build a single prompt that asks Gemini to score multiple responses at once.
 * We force JSON output so parsing is deterministic.
 *
 * The prompt now also asks Gemini to make a quick guess about whether the
 * email looks fake or throwaway (e.g. `bot1@spam.io`, `qwerty@test.com`,
 * sequential bot accounts) — this is just a heuristic guess, not a check
 * against any real database.
 */
function buildPrompt(batch: FormResponse[]): string {
  const compact = batch.map((r, i) => compactResponse(r, i));
  return `You are a survey-fraud analyst. For each response in the input array, decide whether it looks like a genuine human answer or a random/bot/low-effort submission.

Score each response from 0 to 100 where:
- 100 = clearly thoughtful, consistent, human
- 50 = ambiguous
- 0  = clearly random, repetitive, or bot-generated

Also make a quick GUESS about the email address (if present):
- "looksFake" = true if the email looks throwaway, bot-generated, or obviously
  not a real person. Examples of fake-looking patterns: contains "spam", "bot",
  "test", "fake", random keyboard mashing like "qwerty"/"asdf", sequential
  numbers like "user123@", or domains like @example.com / @test.io that no
  real person would use. When unsure, set looksFake=false.
- "looksFake" = false if the email looks like a plausible real person.
- If no email was provided, set looksFake=false and leave emailReason empty.

Factor the email guess INTO the overall score (a fake-looking email should
pull the score down by 10–25 points depending on how obvious it is).

Return STRICT JSON only, with this exact shape:
{
  "scores": [
    {
      "idx": <number>,
      "score": <0-100>,
      "reasoning": "<one short sentence about the answers>",
      "emailVerdict": { "looksFake": <boolean>, "reason": "<short reason or empty string>" }
    }
  ]
}

Do not include any prose outside the JSON. Do not wrap it in markdown.

Input responses:
${JSON.stringify(compact, null, 2)}`;
}

/** Strip markdown fences if Gemini decides to add them anyway. */
function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return text.trim();
}

interface GeminiBatchScore {
  idx: number;
  score: number;
  reasoning: string;
  emailVerdict?: {
    looksFake?: boolean;
    reason?: string;
  };
}

async function callGeminiBatch(batch: FormResponse[]): Promise<GeminiBatchScore[]> {
  const client = getClient();
  if (!client) throw new Error("GEMINI_API_KEY is not set");

  const model = client.getGenerativeModel({
    model: getModelName(),
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(buildPrompt(batch));
  const text = result.response.text();
  const json = extractJson(text);

  const parsed = JSON.parse(json) as { scores?: GeminiBatchScore[] };
  if (!parsed.scores || !Array.isArray(parsed.scores)) {
    throw new Error("Malformed Gemini response: missing 'scores' array");
  }
  return parsed.scores;
}

/** Split an array into chunks of `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Run a small async pool — keeps us from thundering Gemini with N parallel
 * requests on large batches.
 */
async function pool<T, R>(items: T[], limit: number, worker: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/**
 * Distill a long Gemini error into a single readable line.
 * The library throws strings that bundle URL + status + a long quota JSON; we
 * only want the bit a human cares about.
 */
function shortenGeminiError(message: string): string {
  // Quota / rate limit (HTTP 429) — surface a clean message.
  if (/429|quota|rate/i.test(message)) {
    const retry = message.match(/retry in (\d+(?:\.\d+)?)s/i);
    return `Gemini quota exceeded${retry ? ` (retry in ~${Math.ceil(Number(retry[1]))}s)` : ""}. Check billing or try a different GEMINI_MODEL.`;
  }
  // Model not found (HTTP 404).
  if (/404|not found|not supported/i.test(message)) {
    return "Configured GEMINI_MODEL is not available for this API key. Try gemini-2.0-flash, gemini-2.5-flash, or gemini-flash-latest.";
  }
  // Auth (HTTP 401/403).
  if (/401|403|api key|permission/i.test(message)) {
    return "Gemini rejected the API key. Verify GEMINI_API_KEY in your .env.";
  }
  // Otherwise return the first line, trimmed.
  return message.split("\n")[0].slice(0, 240);
}

/**
 * Outcome of a Gemini batch call: either parsed scores, or a short error
 * message we can surface back to the client.
 */
interface BatchOutcome {
  scores: GeminiBatchScore[];
  error?: string;
}

/**
 * Score a list of responses with Gemini. If the API key is missing or the call
 * fails, we return a "skipped" result so the rest of the pipeline keeps
 * working — but we attach a meaningful reason so the UI can explain why.
 *
 * The second return value is a short top-level error string (or undefined),
 * suitable for surfacing in the response summary.
 */
export async function analyzeWithGemini(
  responses: FormResponse[]
): Promise<{ results: AIResult[]; error?: string }> {
  if (responses.length === 0) return { results: [] };

  if (!getClient()) {
    return {
      results: responses.map(() => ({
        score: 50,
        reasoning: "AI analysis skipped — GEMINI_API_KEY not configured.",
        skipped: true,
      })),
      error: "GEMINI_API_KEY not configured",
    };
  }

  const batches = chunk(responses, BATCH_SIZE);
  const results: AIResult[] = new Array(responses.length).fill(null).map(() => ({
    score: 50,
    reasoning: "",
    skipped: true,
  }));

  let firstError: string | undefined;

  const outcomes: BatchOutcome[] = await pool(batches, BATCH_CONCURRENCY, async (batch) => {
    try {
      const scores = await callGeminiBatch(batch);
      return { scores };
    } catch (err) {
      const raw = (err as Error).message;
      const short = shortenGeminiError(raw);
      console.warn("[gemini] batch failed:", short);
      return { scores: [] as GeminiBatchScore[], error: short };
    }
  });

  batches.forEach((batch, batchIdx) => {
    const offset = batchIdx * BATCH_SIZE;
    const outcome = outcomes[batchIdx];
    if (outcome.error && !firstError) firstError = outcome.error;

    const byIdx = new Map(outcome.scores.map((s) => [s.idx, s]));
    batch.forEach((_, localIdx) => {
      const globalIdx = offset + localIdx;
      const s = byIdx.get(localIdx);
      if (s && typeof s.score === "number") {
        // Only forward an emailVerdict when the response actually had an email
        // and the model gave us a usable verdict. Avoids fabricated flags.
        const hasEmail = Boolean(batch[localIdx].email?.trim());
        const v = s.emailVerdict;
        const emailVerdict =
          hasEmail && v && typeof v.looksFake === "boolean"
            ? { looksFake: v.looksFake, reason: (v.reason || "").slice(0, 160) }
            : undefined;

        results[globalIdx] = {
          score: Math.max(0, Math.min(100, Math.round(s.score))),
          reasoning: s.reasoning?.slice(0, 240) || "",
          skipped: false,
          emailVerdict,
        };
      } else {
        results[globalIdx] = {
          score: 50,
          reasoning: outcome.error
            ? `AI skipped: ${outcome.error}`
            : "Gemini did not return a score for this row.",
          skipped: true,
        };
      }
    });
  });

  return { results, error: firstError };
}
