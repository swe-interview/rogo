import type { AgentEvent } from "./agent.ts";

function timestamp(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function formatToolContent(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

export function logChat(message: string): void {
  console.log(`\n${timestamp()} [chat] ${message}`);
}

export function logAgentDone(ms: number): void {
  console.log(`${timestamp()} [agent] done ${ms}ms`);
}

export function logAgentEvent(event: AgentEvent): void {
  const time = timestamp();
  switch (event.type) {
    case "iteration":
      console.log(`${time} [agent] iteration ${event.n}`);
      break;
    case "llm_response_start":
      console.log(`${time} [llm] ${event.agent_type} response start`);
      break;
    case "llm_response_end":
      console.log(
        `${time} [llm] ${event.agent_type} response end ${event.ms}ms\n${JSON.stringify(event.response, null, 2)}`,
      );
      break;
    case "tool_start":
      console.log(`${time} [tool]  → ${event.name} ${JSON.stringify(event.input)}`);
      break;
    case "tool_end":
      console.log(`${time} [tool]  ← ${event.name} ${event.ms}ms\n${formatToolContent(event.content)}`);
      break;
    case "tool_failed":
      console.log(`${time} [tool]  ! ${event.name}: ${event.message}`);
      break;
  }
}
