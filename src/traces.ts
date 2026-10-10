import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type { AgentEvent } from "./agent.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(root, "data", "traces.sqlite");

mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS traces (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    at TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_by_trace ON events (trace_id, seq);
`);

const traceColumns = db.prepare(`PRAGMA table_info(traces)`).all();
if (!traceColumns.some((column) => column.name === "duration_ms")) {
  db.exec(`ALTER TABLE traces ADD COLUMN duration_ms INTEGER`);
}

const insertTrace = db.prepare(
  `INSERT INTO traces (id, question, created_at) VALUES (?, ?, ?)`,
);
const finishTraceStmt = db.prepare(
  `UPDATE traces SET answer = ?, error = ?, finished_at = ?, duration_ms = ? WHERE id = ?`,
);
const nextSeq = db.prepare(
  `SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM events WHERE trace_id = ?`,
);
const insertEvent = db.prepare(
  `INSERT INTO events (trace_id, seq, at, type, payload) VALUES (?, ?, ?, ?, ?)`,
);
const listTracesStmt = db.prepare(
  `SELECT id, question, answer, error, created_at, finished_at, duration_ms
   FROM traces ORDER BY created_at DESC LIMIT 100`,
);
const getTraceStmt = db.prepare(
  `SELECT id, question, answer, error, created_at, finished_at, duration_ms FROM traces WHERE id = ?`,
);
const listEventsStmt = db.prepare(
  `SELECT seq, at, type, payload FROM events WHERE trace_id = ? ORDER BY seq`,
);

export interface TraceSummary {
  id: string;
  question: string;
  answer: string | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface TraceEvent {
  seq: number;
  at: string;
  type: string;
  payload: unknown;
}

function summary(row: Record<string, unknown>): TraceSummary {
  return {
    id: String(row.id),
    question: String(row.question),
    answer: row.answer == null ? null : String(row.answer),
    error: row.error == null ? null : String(row.error),
    createdAt: String(row.created_at),
    finishedAt: row.finished_at == null ? null : String(row.finished_at),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
  };
}

/** Drop the raw model payload. Tool results are already stored on tool_end. */
function payloadOf(event: AgentEvent): unknown {
  if (event.type === "llm_response_end") {
    const text = event.response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const toolUses = event.response.content
      .filter((block) => block.type === "tool_use")
      .map((block) => ({ name: block.name, input: block.input }));
    return {
      agent_type: event.agent_type,
      ms: event.ms,
      stop_reason: event.response.stop_reason,
      usage: event.response.usage,
      text,
      toolUses,
    };
  }
  return event;
}

export function createTrace(question: string): string {
  const id = crypto.randomUUID();
  insertTrace.run(id, question, new Date().toISOString());
  return id;
}

export function appendTraceEvent(traceId: string, event: AgentEvent): void {
  const seq = Number(nextSeq.get(traceId)?.n ?? 1);
  insertEvent.run(
    traceId,
    seq,
    new Date().toISOString(),
    event.type,
    JSON.stringify(payloadOf(event)),
  );
}

export function finishTrace(
  traceId: string,
  result: { answer?: string; error?: string; durationMs: number },
): void {
  finishTraceStmt.run(
    result.answer ?? null,
    result.error ?? null,
    new Date().toISOString(),
    result.durationMs,
    traceId,
  );
}

export function listTraces(): TraceSummary[] {
  return listTracesStmt.all().map(summary);
}

export function getTrace(id: string): { trace: TraceSummary; events: TraceEvent[] } | null {
  const row = getTraceStmt.get(id);
  if (!row) return null;
  const events = listEventsStmt.all(id).map((event) => ({
    seq: Number(event.seq),
    at: String(event.at),
    type: String(event.type),
    payload: JSON.parse(String(event.payload)) as unknown,
  }));
  return { trace: summary(row), events };
}
