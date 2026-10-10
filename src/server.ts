import "dotenv/config";
import express from "express";
import { runAgent } from "./agent.ts";
import { logAgentDone, logAgentEvent, logChat } from "./logging.ts";
import { appendTraceEvent, createTrace, finishTrace, getTrace, listTraces } from "./traces.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\nANTHROPIC_API_KEY is not set.\nCopy .env.example to .env and add your key, then run `npm run dev` again.\n",
  );
  process.exit(1);
}

const app = express();
app.use(express.json());

app.get("/api/traces", (_req, res) => {
  res.json({ traces: listTraces() });
});

app.get("/api/traces/:id", (req, res) => {
  const found = getTrace(String(req.params.id));
  if (!found) {
    res.status(404).json({ error: "trace not found" });
    return;
  }
  res.json(found);
});

app.post("/api/chat", async (req, res) => {
  const userMessage = String(req.body.message ?? "");
  logChat(userMessage);
  const startedAt = Date.now();
  const traceId = createTrace(userMessage);

  try {
    const result = await runAgent(userMessage, (event) => {
      logAgentEvent(event);
      appendTraceEvent(traceId, event);
    });
    const durationMs = Date.now() - startedAt;
    logAgentDone(durationMs);
    finishTrace(traceId, { answer: result.answer, durationMs });

    res.json({ answer: result.answer, traceId });
  } catch (err) {
    console.error(err);
    finishTrace(traceId, { error: String(err), durationMs: Date.now() - startedAt });
    res.status(500).json({ error: String(err), traceId });
  }
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Agent server listening on http://localhost:${port}`);
});
