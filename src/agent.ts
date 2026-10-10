/**
 * The research agent: a tool-use loop over the mocked research tools.
 */

import Anthropic from "@anthropic-ai/sdk";
import { companies } from "./data.ts";
import { Role } from "./role.ts";
import { runTools } from "./runTools.ts";
import { toolSchemas } from "./tools.ts";

const AGENT_MODEL = process.env.ROGO_AGENT_MODEL ?? "claude-sonnet-5";
const EDITOR_MODEL = process.env.ROGO_EDITOR_MODEL ?? "claude-haiku-4-5";
const MAX_ITERATIONS = 12;

const anthropicClient = new Anthropic();

const RESEARCH_AGENT_PROMPT = `You are Rogo Research, an assistant that answers questions about companies for financial analysts.

Use the tools to look up companies, profiles, financials and source documents. Answer the analyst's question.

Our coverage universe:
${companies
  .map(
    (c) =>
      `- ${c.name} (${c.ticker}) — ${c.sector}, HQ ${c.hq}, ${c.employees} employees. ${c.description}`,
  )
  .join("\n")}
`;

const EDITOR_PROMPT = `You are an editor. Rewrite the analyst's draft answer so that it reads clearly and is easy to follow. Keep it brief and conversational. Return only the rewritten answer.`;

export type AgentType = "research_agent" | "editor";

export type AgentEvent =
  | { type: "iteration"; n: number }
  | { type: "llm_response_start"; agent_type: AgentType }
  | { type: "llm_response_end"; agent_type: AgentType; response: Anthropic.Message; ms: number }
  | { type: "tool_start"; name: string; input: unknown }
  | { type: "tool_end"; name: string; content: string; ms: number }
  | { type: "tool_failed"; name: string; message: string };

export interface AgentResult {
  answer: string;
  iterations: number;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export async function runAgent(
  question: string,
  onEvent: (event: AgentEvent) => void,
): Promise<AgentResult> {
  const messages: Anthropic.MessageParam[] = [{ role: Role.user, content: question }];

  let draft = "";
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    onEvent({ type: "iteration", n: iterations });

    onEvent({ type: "llm_response_start", agent_type: "research_agent" });
    const researchStartedAt = Date.now();
    const llm_response = await anthropicClient.messages.create({
      model: AGENT_MODEL,
      max_tokens: 16000,
      system: RESEARCH_AGENT_PROMPT,
      tools: toolSchemas,
      messages,
    });
    onEvent({
      type: "llm_response_end",
      agent_type: "research_agent",
      response: llm_response,
      ms: Date.now() - researchStartedAt,
    });

    messages.push({ role: Role.assistant, content: llm_response.content });

    const toolUses = llm_response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUses.length === 0) {
      draft = textOf(llm_response);
      break;
    }

    const toolResults = await runTools(toolUses, onEvent);

    messages.push({ role: Role.user, content: toolResults });
  }

  if (!draft) {
    draft =
      "I looked at a number of sources but ran out of research steps before I could pull the answer together. Try asking a narrower question.";
  }

  // Polish the draft before showing it to the analyst.
  onEvent({ type: "llm_response_start", agent_type: "editor" });
  const editorStartedAt = Date.now();
  const edited = await anthropicClient.messages.create({
    model: EDITOR_MODEL,
    max_tokens: 16000,
    system: EDITOR_PROMPT,
    messages: [
      {
        role: Role.user,
        content: `Draft answer:\n${draft}\n\nRewrite the draft answer.`,
      },
    ],
  });
  onEvent({
    type: "llm_response_end",
    agent_type: "editor",
    response: edited,
    ms: Date.now() - editorStartedAt,
  });

  return { answer: textOf(edited), iterations };
}
