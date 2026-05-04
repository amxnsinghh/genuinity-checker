import type { AnalyzeRequestBody, AnalyzeResponseBody, FormResponse } from "../types";
import { evaluateBatch } from "./heuristics";
import { analyzeWithGemini } from "./gemini";
import { buildSummary, mergeResults } from "./scorer";

/**
 * Validate the inbound request shape. We keep this defensive because the input
 * comes straight from a user-supplied JSON file in the UI.
 */
export function validateRequest(body: unknown): AnalyzeRequestBody {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  // Two accepted shapes: { responses: [...] } or just an array of responses.
  let responses: unknown = b.responses;
  if (Array.isArray(b)) responses = b;

  if (!Array.isArray(responses)) {
    throw new Error('Field "responses" must be an array of form submissions');
  }
  if (responses.length === 0) {
    throw new Error('"responses" array is empty');
  }
  if (responses.length > 1000) {
    throw new Error("Too many responses in one request (max 1000)");
  }

  for (const [i, r] of responses.entries()) {
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      throw new Error(`Response #${i} is not an object`);
    }
    if (!("answers" in r) || typeof (r as FormResponse).answers !== "object") {
      throw new Error(`Response #${i} is missing "answers" object`);
    }
  }

  const useAI = b.useAI === undefined ? true : Boolean(b.useAI);
  return { responses: responses as FormResponse[], useAI };
}

/**
 * Run the full pipeline: heuristic check (always), Gemini (optional), then
 * combine and summarize.
 *
 * Heuristics run synchronously and are awaited first so that even if AI fails
 * we still return useful data.
 */
export async function runAnalysis(
  body: AnalyzeRequestBody
): Promise<AnalyzeResponseBody> {
  const { responses, useAI = true } = body;

  const heuristics = evaluateBatch(responses);

  let ai;
  let aiError: string | undefined;
  if (useAI) {
    const out = await analyzeWithGemini(responses);
    ai = out.results;
    aiError = out.error;
  } else {
    ai = responses.map(() => ({
      score: 50,
      reasoning: "AI disabled by client",
      skipped: true,
    }));
  }

  const results = mergeResults(responses, heuristics, ai);
  const aiUsed = ai.some((a) => !a.skipped);
  const summary = { ...buildSummary(results, aiUsed), aiError };
  return { results, summary };
}
