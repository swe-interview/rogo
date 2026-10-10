import type Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent } from "./agent.ts";
import { executeTool } from "./tools.ts";

export async function runTools(
  toolUses: Anthropic.ToolUseBlock[],
  onEvent: (event: AgentEvent) => void,
): Promise<Anthropic.ToolResultBlockParam[]> {
  return Promise.all(
    toolUses.map(async (use) => {
      onEvent({ type: "tool_start", name: use.name, input: use.input });

      let content: string;
      let isError = false;
      try {
        const output = await executeTool(use.name, use.input as Record<string, unknown>);
        content = JSON.stringify(output);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        content = message;
        isError = true;
        onEvent({ type: "tool_failed", name: use.name, message });
      }

      onEvent({ type: "tool_end", name: use.name, content });
      return {
        type: "tool_result" as const,
        tool_use_id: use.id,
        content,
        ...(isError ? { is_error: true } : {}),
      };
    }),
  );
}
