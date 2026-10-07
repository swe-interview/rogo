## Done

- Parallel tool calls.
    - One reply can ask for several lookups; running them together cuts wait time, and one failure does not cancel the rest.
- Haiku for the editor, Sonnet for research.
    - The editor only rewrites a finished draft and cannot call tools, so the cheaper model is enough. Research still needs Sonnet for tool choice.
- Markdown answers.
    - The model already writes lists, tables, and bold; the UI was showing that as raw text.
- Timestamped logs for model calls and tool output.
    - Makes it obvious whether time is in the model or a tool, and whether the research agent or the editor is the slow call.

## Todo

- Drop unused financial provenance (`pipelineVersion`, `checksum`). Neither changes an answer. Keep `warnings` — Initech's unfiled FY2025 should.

- Open a filing by id. The profile only lists filings. The agent can read one only if an excerpt is already in `documents` and a keyword search hits it.

- Fuzzy company search; document search past the 6-term cap. Names have to match exactly enough for `includes`, and a long query throws instead of searching.

- when tools fail add hints for the agent - like maybe try searchCompanies

- Turn the tool sleeps back on. They are commented out so logs show model time, not fake API delay.
