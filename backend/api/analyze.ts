/**
 * Vercel serverless entry for POST /api/analyze.
 *
 * This file is a thin wrapper around the same `runAnalysis` pipeline used by
 * the Express server, so deploying to Vercel doesn't require maintaining two
 * implementations.
 *
 * To deploy: place the entire /backend folder in a Vercel project. Vercel
 * auto-discovers `api/*.ts` files and exposes them at `/api/<filename>`.
 */

import type { IncomingMessage, ServerResponse } from "http";
import { runAnalysis, validateRequest } from "../src/services/analyze";

interface VercelRequest extends IncomingMessage {
  body?: unknown;
  method?: string;
}
interface VercelResponse extends ServerResponse {
  json: (data: unknown) => void;
  status: (code: number) => VercelResponse;
}

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body && typeof req.body !== "string") return req.body;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("Body is not valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const validated = validateRequest(body);
    const result = await runAnalysis(validated);
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = /must|missing|empty|too many|valid JSON/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
}
