# WORLDGPZ fresh feature-coverage audit

**Audit date:** 2026-09-30<br>
**Product:** WORLDGPZ God’s Eye by ThaddeusTechz<br>
**Scope:** A fresh comparison of the publicly documented surfaces at [worldmonitor.app](https://www.worldmonitor.app/docs/features) and [world-monitor.com](https://world-monitor.com/llms-full.txt) against the current WORLDGPZ source tree. This is an internal engineering comparison, not product copy. No one-to-one parity is claimed.

## Direct answer

**No: WORLDGPZ does not currently implement every feature on both reference platforms.** It now has stronger surface-level coverage—MAP / WIRE / GLOBE views, map filters, a command palette, local market and event watchlists, exports, and source filtering—but significant data, analytical, workflow, history, and platform gaps remain. The two reference products themselves describe different, very large feature sets; matching their buttons without matching their data sources and underlying behavior would be misleading.

The current service registers 21 providers. The `.app` reference advertises 56 map layers, 500+ curated feeds, multiple dashboard variants, professional analytics, REST/MCP tooling and supply-chain workflows. The separate `.com` product describes a map, chronological wire and globe plus stock/crypto, prediction, broadcast, webcam, outbreak, unofficial DEFCON and chat programs. WORLDGPZ has selected equivalents, not full equivalents.

## Feature-by-feature comparison

| Capability | WORLDGPZ coverage | Current implementation and exact gap |
|---|---|---|
| 2D map / 3D globe | **Implemented with limits** | Leaflet map and Three.js globe are available as separate MAP and GLOBE views. This is not the second reference’s dual WebGL map engine or 56-layer catalog. |
| Chronological live wire | **Partial** | A headline ticker, event stream and source-linked news list exist. They are not a 500-feed corpus, a full OSINT signal timeline, or a complete historical archive. |
| Region search, time range and clustering | **Implemented with limits** | Regional presets, event time/severity/keyword filters, adaptive marker clustering, URL-shareable map state, and a command palette are available. Search covers a small bundled city list and map text filter; it is not global country/city geocoding or universal deep-link coverage. |
| Map layers | **Partial** | Current signal layers: seismic, natural events, conflict, protests, fires, weather, aircraft, vessels, ISS, editorial context watchpoints and chokepoints. Missing: authoritative military bases, nuclear/radiation sites, spaceports, satellite passes, undersea cable routes/landing stations, pipelines, internet-exchange points, data centers, outages, GPS jamming, minerals, trade-route geometry, sanctions overlays, and many other documented layers. |
| Map markers and provenance | **Partial** | Available records have source labels, popups, timestamps where supplied, and explicit heuristic/context warnings. There is no global source-tier/propaganda-risk registry or layer-by-layer freshness/confidence card system. |
| MAP / WIRE / GLOBE navigation | **Implemented with limits** | The three primary views are now separate. Floating, draggable, resizable, pinnable program windows and the second reference’s full program workspace are not implemented. |
| News sources and topical views | **Partial** | NewsAPI is optional and GDELT is a public fallback. Headline region and individual source filters were added. There is no 500-feed curated catalog, source-quality registry, broad topic catalogue, Telegram/X monitoring, or full set of dedicated regional/thematic panels. |
| Conflicts and protests | **Partial** | ACLED is optional; event/news feeds can be filtered into conflict and protest layers. Independent corroboration, UCDP coverage, hotspot escalation, authoritative current conflict-zone status and complete global geocoding are missing. |
| Natural hazards, weather and health | **Partial** | USGS, EONET, FIRMS, weather and WHO Disease Outbreak News adapters exist. WHO notices are linked and filtered but are **not geocoded or plotted**; this is not a mapped outbreak case-surveillance system. Climate anomalies, radiation, thermal escalation and broad official alert coverage are missing. |
| Flights and maritime | **Partial** | OpenSky positions and optional AISStream data are available, with entitlement/geographic limitations. Airport delays, NOTAM/closure detection, airline operations, satellite AIS, broad global vessel coverage and transit-baseline anomaly detection are not implemented. |
| Stocks, crypto and commodities | **Partial** | Finnhub quote/FX integration is optional; a browser-local custom stock/crypto list now supports up to 50 symbols through a server-side same-origin quote route. There is no full market terminal, sector heatmap, charts/history, movers, metals/divergence, commodities suite, stock research/backtesting, ticker scanner, or complete exchange coverage. |
| Prediction markets | **Partial** | Polymarket probabilities are ranked by reported volume; Manifold is a clearly labelled community play-money fallback. Search, historical probability charts, broad market filtering and correlation analysis are missing. No live market source was verified in this workspace. |
| Streams and webcams | **Partial** | YouTube live search and Windy webcam metadata can be configured; stream selection and regional filtering exist. There is no registry-backed multi-broadcaster HLS player with continuous live verification/fallback or complete camera catalog. |
| Space | **Partial** | ISS position and an upcoming launch schedule exist. Satellite tracking, satellite passes, space-weather interpretation and full launch-facility data are absent. |
| DEFCON indicator | **Not implemented** | The second reference describes a third-party unofficial estimate and history. WORLDGPZ has no corresponding source adapter. Any future display must be explicitly labelled unofficial—not as a government or military status. |
| Country instability / resilience | **Partial** | WORLDGPZ ranks 31 selected countries using editorial baselines and available signal counts, and the OpenAI country-brief route can summarize linked current records for those supported countries. These remain heuristics/source summaries, not validated country profiles or a CII. The 196-country, multi-indicator resilience dataset and signed score deltas are not implemented. |
| Strategic risk and infrastructure cascade | **Partial** | A heuristic country/chokepoint score exists. There is no cross-domain convergence alert pipeline, dependency graph, cable/pipeline cascade analysis, calibrated historical baseline or verified disruption score. |
| AI briefings and analyst | **Partial** | Briefings, source-grounded analyst Q&A and supported-country briefs use the OpenAI Responses API with **server-side `OPENAI_API_KEY` only**. Analyst answers use linked current news/event records. With no key, the app labels a local keyword digest; that fallback is not represented as AI. Rich verified country profiles, forecasts, market implications, strategic posture, threat timelines and model-validated event classification are not present. Model claims still require human/source verification. |
| Community chat | **Not implemented** | WORLDGPZ’s OpenAI analyst is a private source-grounded Q&A feature, not a persistent, moderated, account-based public chat room. |
| Alerts and monitors | **Partial** | Up to ten browser-local keyword/place rules match loaded records; optional desktop notifications work only with an open tab and permission. The second reference’s local topic monitors are only partly covered. There is no cross-device sync, background scheduler, corroborated breaking-alert pipeline, email/Slack/Telegram delivery, or composite multi-condition rules. |
| Panel management and preferences | **Partial** | A browser-local layout dialog now provides World, Finance, Crisis, Infrastructure, and Space & Environment presets, per-panel visibility, reordering by drag handle or accessible up/down controls, and side-rail panel height controls. Order, visibility and selected heights persist locally. It does not provide floating/cross-column placement, analytics-strip resizing, minimizing/collapsing, cross-device/account sync, text-size controls, map pin/divider, locale/theme/timezone settings, or a free-form widget builder. |
| Activity tracking and history | **Partial** | A compact browser-local snapshot history now captures summaries every 15 minutes, retains up to seven days, and lets users browse historical event/headline samples and return an event to the map. It is not full-dashboard restoration or a server-backed archive. Per-panel seen/new indicators, 7/30-day statistical baselines, durable event history, and historical anomaly calculations remain missing. |
| Route Explorer and Scenario Engine | **Not implemented** | Chokepoint watchpoints do not plan origin-to-destination routes, compare maritime/land alternatives, estimate commodity exposure, or simulate tariff/conflict/weather scenarios. Building those without validated route and trade-exposure data would create false precision. |
| REST, MCP, SDK and exports | **Partial** | Same-origin REST routes and SSE exist; JSON dashboard and CSV event downloads were added. A stateless, read-only MCP HTTP endpoint now exposes seven bounded tools for events, headlines, provider health, heuristic country/chokepoint signals, quotes, and predictions. It is not the reference's broad hosted API: OAuth/API-plan system, account-scoped access, SDKs, versioned OpenAPI contract, batch API and JMESPath projection are missing. |
| Dashboard variants | **Partial / layout-only** | Browser layout presets cover World, Finance, Crisis, Infrastructure, and Space & Environment panel selections. They all use the same WORLDGPZ data stack; there are no separately configured technology, commodity, finance, energy or positive-news data products. |
| Mobile/native apps and localization | **Partial** | The web UI has responsive CSS. There is no native desktop/mobile application, offline PWA/ML bundle, 24-language interface, or full RTL localization. |
| Deployment and real data | **Configured, not production-verified** | Render blueprint, PostgreSQL attachment, health route and secret placeholders exist. No Render deploy, production credentials, custom domain/TLS, or real upstream connectivity was verified. The local sandbox’s provider calls returned `fetch failed`. |

## OpenAI configuration audit

The current implementation was checked again in source, environment examples and deployment configuration:

- Briefings and analyst answers call the fixed OpenAI Responses API endpoint from the server.
- The only model credential is `OPENAI_API_KEY`; `OPENAI_MODEL` is a non-secret optional model selector.
- The admin key registry identifies the OpenAI key for encrypted server-side management; deployment environment values take precedence.
- No browser code calls OpenAI directly, and no generic AI-provider key/base URL is used.
- Analyst access fails closed when the OpenAI key is absent; the non-AI local digest is explicitly labelled.

## Recheck implementation in this pass

- Added explicit MAP / WIRE / GLOBE primary navigation.
- Added a searchable Ctrl/⌘+K palette for views, panels, map layers, regional presets, time filters, refresh, and export actions.
- Added map keyword/severity filters, a 48-hour time option, and shareable URL state for position/layers/time/region.
- Added per-source headline filtering, JSON dashboard export and CSV event export.
- Added browser-local workspace presets, panel visibility controls, drag/keyboard-accessible rail reordering, and resizable side-rail cards; layout preferences persist locally.
- Added compact local dashboard snapshots on a 15-minute schedule, a seven-day retention window, and a snapshot history browser.
- Added a browser-local stock/crypto watchlist capped at 50 symbols; Finnhub requests stay server-side, use bounded concurrency and per-symbol caching, and report unconfigured/stale states.
- Added source-linked country brief generation for the supported country index, using only server-side OpenAI `OPENAI_API_KEY` and linked current records.
- Added a stateless, read-only MCP HTTP endpoint exposing seven bounded public-data tools; it has no OAuth, account scoping or private tools.
- Kept AI configuration on server-side OpenAI `OPENAI_API_KEY`; no alternate AI vendor is introduced.

## Verification boundaries and next work

- Automated tests use mocked upstream responses. They test parsing/contracts/fallbacks/key handling, not live coverage or source quality.
- The local dashboard and its new feed routes returned HTTP 200 during smoke tests, but calls to WHO, Polymarket, Manifold and Launch Library returned `fetch failed` in this workspace. The UI must be checked against real provider responses from Render before production reliance.
- To move toward full feature coverage, prioritize reliable licensed/official feeds and history first: geocoded news/outbreaks; cyber/outage, cables/pipelines and infrastructure registries; better aviation, maritime and protest sources; country resilience data; then route/scenario analysis. After that, add panel layout/persistence, snapshots, broader topical sources, account-based/background alerts, and an authenticated MCP/API surface.
- The reference platforms’ source catalogs and subscription-gated capabilities change over time. Re-audit the official pages and data terms before claiming equivalence or copying behavior. Build compatible capabilities in WORLDGPZ’s own ThaddeusTechz-branded interface; do not copy their names or imply affiliation.

## Public pages reviewed

- [worldmonitor.app feature inventory](https://www.worldmonitor.app/docs/features)
- [worldmonitor.app platform introduction](https://www.worldmonitor.app/docs/documentation)
- [worldmonitor.app platform overview](https://www.worldmonitor.app/docs/overview)
- [worldmonitor.app data-source catalog](https://www.worldmonitor.app/docs/data-sources)
- [worldmonitor.app route workflow](https://www.worldmonitor.app/docs/route-explorer)
- [worldmonitor.app scenario workflow](https://www.worldmonitor.app/docs/scenario-engine)
- [worldmonitor.app API catalog](https://www.worldmonitor.app/docs/api-reference)
- [worldmonitor.app agent/MCP overview](https://www.worldmonitor.app/docs/mcp-overview)
- [world-monitor.com live dashboard](https://world-monitor.com/)
- [world-monitor.com product and data-source reference](https://world-monitor.com/llms-full.txt)
