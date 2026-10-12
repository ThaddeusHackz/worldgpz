# Intelligence workspace: what WORLDGPZ does

WORLDGPZ is an observation and analysis workspace, not an omniscient sensor network. Its strongest useful behavior is connecting a visible observation to its source, time, geographic context and limitations.

## Three workspaces

**Monitor** combines the map, live provider snapshots, news, weather, aviation/maritime adapters, markets and provider health. A source can be unavailable independently of the website. Static context markers are not live incidents.

**Watchroom** provides a larger orbital/surface canvas, geographic concentrations, readable source threads and a source-time lens. A timeline controls which currently loaded observations are shown. It does not reconstruct a historical world state, and there is no undisclosed historical warehouse behind it.

**Evidence Analyst** retrieves observations and publisher reports relevant to your question and returns source cards. Public answers are deterministic retrieval, not generative AI. Question words match whole words (with simple plural, -ing/-ed and four-letter-prefix forms), not raw substrings, and the answer names any question term that no loaded report mentions. The separate automated briefing can use a configured model, with citations and a local fallback. These modes are deliberately distinguished.

## Monitoring missions and alerts

Save a query, category, minimum severity, region and time window as a named mission. Missions and their captured observation inbox live in your browser. Initially matching loaded records are captured as initial observations; subsequent new-to-this-device matches can be captured while the Watchroom is open.

There is no push notification service, unattended background monitoring, cross-device sync or delivery guarantee. Clearing browser storage removes these records. A production alerting service would need persistent server rules, durable delivery, authentication and notification permissions; this release does not pretend to implement those by displaying an alert badge.

## Geographic and temporal methods

The server groups dated, observed records into bounded five-degree coordinate cells. Cluster centers are averages of reported coordinates. Their density measures source-record concentration, not probability, causality, an incident boundary or a validated risk score. Unequal geographic reporting can create apparent hotspots.

Hourly buckets describe available observation times. Baseline, stale, undated, future and out-of-window records are excluded from fresh watchroom priorities. Regional lenses use approximate bounds rather than political borders. Original publisher dates remain original dates; fetch time is not substituted for publication time.

## News and automated synthesis

NewsAPI is optional. GDELT and bounded BBC World/Al Jazeera RSS feeds provide public fallback paths, with publisher attribution, deduplication and source dates. Upstream outages and rate limits still occur.

The automated briefing combines available publisher reports and observed incidents. Server-side configuration selects an OpenAI-compatible provider. Model prose must cite supplied source IDs; invalid, oversized, blocked or timed-out responses fall back to an explicitly local digest. Citations constrain the input, but they do not independently establish the truth of generated prose.

AI requests have a process-local 30-minute allowance and no automatic paid retry. Do not infer that a key accepted for account metadata can perform generation: model access, rate limits and funding are separate. Health exposes generative availability and safe fallback codes without leaking provider bodies.

## Authenticated web research

Administrators can run a Tavily basic search from the research panel. Results are external source material, not an automatically verified intelligence conclusion. The public analyst cannot trigger paid web searches.

Each search is bounded to five results and a 12-second deadline, with 30-minute caching, same-query singleflight and a ten-minute cross-query cooldown. These controls are process-local. Multiple service replicas have independent allowances; persistent shared quotas would be needed before scaling this model.

## Release verification

Unit/API tests validate contracts, parsing, timing, grounding, failure handling and cost gates. Reproducible Chromium tests use explicitly marked fixtures to validate interface behavior, mission persistence, focus restoration, analyst citations and responsive layouts. Separately, bounded live checks exercise real public feeds and selected credentialed workflows. Fixture tests are never presented as live-provider validation.

Render deployment remains a separate step requiring your account, service configuration, secrets and deployment logs. See [DEPLOYMENT.md](DEPLOYMENT.md).
