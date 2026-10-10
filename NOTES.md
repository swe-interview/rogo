## Done

latency/cost
- Calling tools in parallel
- Expensive model (sonnet) for research, cheaper one for edit (haiku)

UI quality
- Render markdown in the chat instead of raw text

observability
- Log improvements - adding timestamps, tool input/output, LLM start/end

tool improvements
- Document search description says the query is capped at 6 keywords
- Company tools take a ticker or unique name; "Acme" returns both candidates
- `listDocuments` returns every document for one company, with a total
- Company search with no keyword hits returns that company's document ids and titles
- Search hits include which keywords matched, since one shared word is enough

## Todo

- Paginate `listDocuments` when a company has more documents than one response should hold
- Drop financial provenance (`pipelineVersion`, `checksum`); keep Initech's unfiled-FY2025 warnings
- Open a filing by id. The profile lists filings, but the text is only reachable if a keyword search hits it
- On tool failure, hint the next step (for example `searchCompanies`)
- Turn tool sleeps back on so logs include fake API delay, not just model time
- Keep conversation history. Each message is currently a new question
