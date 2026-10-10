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
    - An Initech query with 7 words was rejected and cost an extra model turn. The agent only learned the limit from the error.
- Company tools take a ticker or unique name; "Acme" returns both candidates
    - Profile and financials required the exact legal name, so "GLBX" and "Globex" missed. "Acme" matches two unrelated companies, and about half of the compare runs answered Acme Corp without saying so.
- `listDocuments` returns every document for one company, with a total
    - Umbrella's filings never say "risk". Every run searched "risk factors", got nothing, then spent two more turns guessing categories like goodwill, debt, and cybersecurity.
- Company search with no keyword hits returns that company's document ids and titles
    - An empty `[]` gave the agent nothing to do except invent another query. The same two Umbrella documents were fetched again and again under different wording.
- Search hits include which keywords matched, since one shared word is enough
    - A cybersecurity query matched Umbrella's 10-K only because the excerpt says "patient". The result looked like a real hit.
- Document search matches form and date as well as title and body
    - A query for "8-K" missed Initech's preliminary results, because that string is only on the form field. The Acme Robotics press release was the same: the title never says "press release".

## Todo

- Paginate `listDocuments` when a company has more documents than one response should hold
- Drop financial provenance (`pipelineVersion`, `checksum`); keep Initech's unfiled-FY2025 warnings
- Open a filing by id. The profile lists filings, but the text is only reachable if a keyword search hits it
- On tool failure, hint the next step (for example `searchCompanies`)
- Turn tool sleeps back on so logs include fake API delay, not just model time
- Keep conversation history. Each message is currently a new question
