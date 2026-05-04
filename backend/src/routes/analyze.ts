import { Router } from "express";
import { runAnalysis, validateRequest } from "../services/analyze";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const body = validateRequest(req.body);
    const result = await runAnalysis(body);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = /must|missing|empty|too many/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
