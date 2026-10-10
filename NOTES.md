## Done

latency/cost
- Calling tools in parallel
- Expensive model (sonnet) for research, cheaper one for edit (haiku)
- Editor rewrites the draft only, not the research transcript
    - The universe question sent the editor 9,947 tokens of tool output. It turned "accelerating in dollar terms" and a gross-margin range into "the growth rate is speeding up" and "profit margin".

UI quality
- Render markdown in the chat instead of raw text

observability
- Log improvements - adding timestamps, tool input/output, LLM start/end
- Each chat stores its tool trace in SQLite and links to a trace page
    - The console log is the only place the tool calls showed up, and it scrolls away. The answer now links to that same timeline.

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
- Tool failures set `is_error` and name the next call
    - A miss came back as a normal result, so the model treated "no company found" as data. The message now says to call `searchCompanies`, and a query over 6 keywords says to retry with 6 or call `listDocuments`.
- `listDocuments` is the complete text for a company, so do not keyword-search it afterward
    - Umbrella's risk question listed both filings, then searched "risk factors reimbursement regulatory integration" and got the same two documents back, matched on one word each.
- `getFinancials` returns annual rows with revenue growth and operating margin, and drops provenance and quarters
    - One company was about 2,700 characters, mostly quarters and warehouse fields. The fastest-grower question loaded all five. Quarters are a fixed split of the annual number, and the model was citing them as separate evidence. Initech's unfiled-FY2025 warnings stay.

## Todo

- Paginate `listDocuments` when a company has more documents than one response should hold
    - did not do b/c mostly useful for scale, not useful for this small fake dataset
- Open a filing by id. The profile lists filings, but the text is only reachable if a keyword search hits it
    - right not company profiles have filing IDs but there's no way to look up those filings by ID
- Keep conversation history. Each message is currently a new question
    - chose to prioritize simple answer -> response vs the more complicated long running chat case
- Add citations - drafts are structured responses with content (citation tags) and then a list of citations. And there is a guardrail that checks if the agent quoted a citation that existed or not
- Guardrails around the editor fudging or changing numbers
- Preventing hallucinating numbers - groundedness checks (or more tool calls wrapping math or data operations)

## Reminders
- Turn tool sleeps back on so logs include fake API delay, not just model time
