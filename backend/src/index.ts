import "dotenv/config";
import express from "express";
import cors from "cors";
import analyzeRouter from "./routes/analyze";

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin.split(",").map((s) => s.trim()),
  })
);

app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.use("/analyze", analyzeRouter);

const port = Number(process.env.PORT) || 4000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`[backend] listening on http://localhost:${port}`);
  });
}

export default app;
