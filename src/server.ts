import "dotenv/config";
import express from "express";
import { runAgent } from "./agent.ts";
import { logAgentDone, logAgentEvent, logChat } from "./logging.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\nANTHROPIC_API_KEY is not set.\nCopy .env.example to .env and add your key, then run `npm run dev` again.\n",
  );
  process.exit(1);
}

const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const userMessage = String(req.body.message ?? "");
  logChat(userMessage);

  try {
    const result = await runAgent(userMessage, logAgentEvent);
    logAgentDone();

    res.json({ answer: result.answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Agent server listening on http://localhost:${port}`);
});
