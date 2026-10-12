# Opus review: Evidence Analyst retrieval precision

## Finding

The public Evidence Analyst ranked reports by raw substring overlap between question words and `title + type + source`. Short words therefore matched unrelated records: `us` matched every record whose source label is `USGS` (and words like "focus"), and `war` matched "warning". Because each match becomes a citation, a public answer could present irrelevant sources as evidence. Separately, a question such as "earthquakes in Atlantis" returned every earthquake without saying that nothing mentioned Atlantis.

## Change

- Question terms now match whole words, with simple plural, `-ing`/`-ed` and four-or-more-letter prefix forms (`flood` ↔ `flooding`, `iran` → `iranian`). Two- and three-letter terms match only exactly or as plurals.
- When results are returned but some specific question terms matched no loaded report in the window, the answer says so explicitly ("No loaded report in this window mentions: …").
- Responses gain additive `matchedTerms` and `unmatchedTerms` fields. Existing fields, citations, the method label and the no-model/no-paid-request behavior are unchanged in shape.
- A few conversational words (`any`, `happened`, `recent`, `near`, …) were added to the stopword list so they are not reported as unmatched terms.

## Verification

- `npm test`: 63/63 pass (62 existing + 1 new analyst precision/disclosure test).
- `npm run build` and `npm run smoke`: PASS.
- `npm run test:browser`: 10/10 fixture-based Playwright tests PASS.

## Limitations

This remains deterministic keyword retrieval, not semantic search or language understanding. There is no general stemming, synonym expansion beyond the existing category map, or multilingual handling; prefix matching can still produce occasional loose matches (e.g. `fire` → "fireworks"). No live-provider or paid API calls were made for this review, and no Render deployment was performed.
