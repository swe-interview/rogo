import { useEffect, useState } from "react";

interface TraceSummary {
  id: string;
  question: string;
  answer: string | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

interface TraceEvent {
  seq: number;
  at: string;
  type: string;
  payload: unknown;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function pretty(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function eventTitle(event: TraceEvent): string {
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "iteration":
      return `Research turn ${payload.n}`;
    case "llm_response_start":
      return payload.agent_type === "editor" ? "Editor started" : "Research model started";
    case "llm_response_end":
      return payload.agent_type === "editor" ? "Editor finished" : "Research model finished";
    case "tool_start":
      return `Tool call · ${payload.name}`;
    case "tool_end":
      return `Tool result · ${payload.name}${typeof payload.ms === "number" ? ` · ${formatMs(payload.ms)}` : ""}`;
    case "tool_failed":
      return `Tool failed · ${payload.name}`;
    default:
      return event.type;
  }
}

function EventBody({ event }: { event: TraceEvent }) {
  const payload = event.payload as Record<string, unknown>;

  if (event.type === "tool_start") {
    return <pre>{pretty(payload.input)}</pre>;
  }

  if (event.type === "tool_end") {
    return (
      <details>
        <summary>Output</summary>
        <pre>{pretty(payload.content)}</pre>
      </details>
    );
  }

  if (event.type === "tool_failed") {
    return <p className="trace-error">{String(payload.message)}</p>;
  }

  if (event.type === "llm_response_end") {
    const usage = payload.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    const toolUses = Array.isArray(payload.toolUses) ? payload.toolUses : [];
    return (
      <div className="trace-meta">
        <p>
          {typeof payload.ms === "number" ? `${formatMs(payload.ms)} · ` : ""}
          {String(payload.stop_reason ?? "done")}
          {usage
            ? ` · ${usage.input_tokens ?? 0} in / ${usage.output_tokens ?? 0} out`
            : ""}
        </p>
        {toolUses.length > 0 && (
          <p>Asked for {toolUses.map((use) => (use as { name: string }).name).join(", ")}</p>
        )}
        {typeof payload.text === "string" && payload.text && (
          <details>
            <summary>Text</summary>
            <pre>{payload.text}</pre>
          </details>
        )}
      </div>
    );
  }

  return null;
}

function TraceDetail({ id }: { id: string }) {
  const [data, setData] = useState<{ trace: TraceSummary; events: TraceEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/traces/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then(setData)
      .catch((err: unknown) => setError(String(err)));
  }, [id]);

  return (
    <div className="app trace-page">
      <header>
        <p>
          <a href="/traces">All traces</a>
          {" · "}
          <a href="/">Chat</a>
        </p>
        <h1>Agent trace</h1>
      </header>

      {error && <p className="trace-error">{error}</p>}
      {data && (
        <>
          <p className="trace-question">{data.trace.question}</p>
          {data.trace.durationMs != null && (
            <p className="trace-total">Full turn {formatMs(data.trace.durationMs)}</p>
          )}
          {data.trace.error && <p className="trace-error">{data.trace.error}</p>}
          <div className="trace-events">
            {data.events.map((event) => (
              <article
                key={event.seq}
                className={`trace-event${event.type === "tool_failed" ? " failed" : ""}`}
              >
                <div className="trace-event-head">
                  <strong>{eventTitle(event)}</strong>
                  <time>{clock(event.at)}</time>
                </div>
                <EventBody event={event} />
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TraceList() {
  const [traces, setTraces] = useState<TraceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/traces")
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data: { traces: TraceSummary[] }) => setTraces(data.traces))
      .catch((err: unknown) => setError(String(err)));
  }, []);

  return (
    <div className="app trace-page">
      <header>
        <p>
          <a href="/">Chat</a>
        </p>
        <h1>Agent traces</h1>
        <p>Each question the agent answered, and the tool calls it made.</p>
      </header>

      {error && <p className="trace-error">{error}</p>}
      {traces && traces.length === 0 && <p>No traces yet. Ask a question in the chat.</p>}
      <div className="trace-list">
        {traces?.map((trace) => (
          <a key={trace.id} className="trace-row" href={`/traces/${trace.id}`}>
            <time>{clock(trace.createdAt)}</time>
            {trace.durationMs != null && <span className="trace-duration">{formatMs(trace.durationMs)}</span>}
            <span>{trace.question}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function TracePage() {
  const match = window.location.pathname.match(/^\/traces\/([^/]+)$/);
  if (match) return <TraceDetail id={decodeURIComponent(match[1])} />;
  return <TraceList />;
}
