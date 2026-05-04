import type { AnalyzeResponseBody, FormResponse } from "./types";

/**
 * Resolve the analyze endpoint at runtime.
 *
 * Falls back to the local Express dev server, which is the most common setup.
 */
function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/analyze";
}

/** Thrown for non-2xx responses; carries the server's error message if any. */
export class AnalyzeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function analyzeResponses(
  responses: FormResponse[],
  useAI: boolean
): Promise<AnalyzeResponseBody> {
  const res = await fetch(getApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responses, useAI }),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore JSON parse errors — keep generic message
    }
    throw new AnalyzeError(message, res.status);
  }

  return (await res.json()) as AnalyzeResponseBody;
}
