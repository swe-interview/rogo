## Done

- Parallel tool calls.
    - One reply can ask for several lookups; running them together cuts wait time, and one failure does not cancel the rest.
- Haiku for the editor, Sonnet for research.
    - The editor only rewrites a finished draft and cannot call tools, so the cheaper model is enough. Research still needs Sonnet for tool choice.
- Markdown answers.
    - The model already writes lists, tables, and bold; the UI was showing that as raw text.
- Timestamped logs for model calls and tool output.
    - Makes it obvious whether time is in the model or a tool, and whether the research agent or the editor is the slow call.
- Document search tells the agent the query is capped at 6 keywords.
    - `searchDocuments` rejects more than 6 terms. The tool and `query` descriptions now say that, so the agent stops sending longer keyword lists.
- Company lookups accept a ticker, an exact name, or a unique part of either.
    - `getCompanyProfile`, `getFinancials`, and the document-search company filter share one resolver. Several matches come back as the candidate list, so "Acme" is not silently treated as one company. `searchCompanies` matches tickers as well as names.

## Todo

- Drop unused financial provenance (`pipelineVersion`, `checksum`). Neither changes an answer. Keep `warnings` — Initech's unfiled FY2025 should.

- Open a filing by id. The profile only lists filings. The agent can read one only if an excerpt is already in `documents` and a keyword search hits it.

- when tools fail add hints for the agent - like maybe try searchCompanies

- Turn the tool sleeps back on. They are commented out so logs show model time, not fake API delay.

- continued conversation (right now every user message is like a fresh question)