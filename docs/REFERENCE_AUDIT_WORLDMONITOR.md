# Public product audit: worldmonitor.app

Audit date: 2026-08-10

## Scope and ethics

This was a non-intrusive analysis of publicly available pages, screenshots, documentation, metadata, and the project's public GitHub repository. It did not attempt authentication bypass, exploit testing, vulnerability probing, rate-limit evasion, private endpoint discovery, or access to non-public data.

WORLDGPZ does not copy World Monitor source code, brand assets, copywriting, or datasets. The reference implementation is licensed AGPL-3.0-only, so incorporating its code could impose source-availability obligations. WORLDGPZ instead implements original components based on general product and interaction patterns.

## Evidence reviewed

- Public homepage and dashboard at `https://www.worldmonitor.app/`
- Public documentation index and getting-started guide
- Public GitHub repository metadata and file tree (`koala73/worldmonitor`)
- Public dashboard screenshots indexed by search engines
- Public feature, architecture, methodology, and data-source descriptions

Direct `curl` TLS access was unavailable from the sandbox network, but the page retrieval service and GitHub API returned the public content successfully.

## Product anatomy

### Desktop layout

The desktop interface is optimized as a dense operations room rather than a conventional marketing dashboard:

1. A compact global header carries product identity, version, network state, region, threat/watch posture, UTC clock, search, and utilities.
2. A large map dominates the first viewport.
3. Time-window controls sit directly on the map.
4. A collapsible left layer rail exposes many independent geospatial datasets.
5. A persistent severity legend establishes an immediate visual language.
6. Lower panels present live news/video, correlated intelligence, strategic posture, markets, and provider-specific views.
7. Thin borders, minimal spacing, monospaced labels, and restrained status colors maximize information density.

### Mobile layout

The mobile screenshot uses a map-first interaction model:

- nearly full-screen map/globe;
- large touch targets and clustered markers;
- floating layer and setting controls;
- compact mode chips above the bottom edge;
- fixed bottom navigation for Map, Feed, Channels, and Overview;
- detailed panels move out of the primary map surface.

### Core interaction patterns

- Layer toggles with counts and status.
- Region presets.
- 2D/3D map modes.
- Time-range filtering.
- Universal command palette (`Cmd/Ctrl+K`).
- Country dossiers and timelines.
- Source-linked AI briefs.
- Multi-source correlation rather than a simple feed.
- Visible freshness and provider health.
- Specialized lenses for geopolitics, finance, technology, commodities, energy, and positive news.

## Publicly documented architecture

World Monitor describes a TypeScript/Vite client with MapLibre, deck.gl, D3, Web Workers, IndexedDB, WebSocket/REST adapters, and optional browser-side ONNX inference. Its public repository currently contains thousands of files and a large collection of specialized panels and edge endpoints.

The scale of that project is not a sensible one-commit target for WORLDGPZ. Reproducing hundreds of feeds without editorial, licensing, infrastructure, and source-reliability controls would create false confidence. The correct approach is to preserve its strongest product principles while keeping claims and operations auditable.

## Principles adopted in WORLDGPZ

- **Map first, not chart first.** A dedicated `/operations` workspace now uses the map as the primary surface.
- **Dense but navigable.** Operations mode adds compact header chrome, time controls, a data-layer rail, map status, lower intelligence panels, and a mobile bottom nav.
- **Keyboard first.** `Cmd/Ctrl+K` opens an original command interface for navigation, regions, layer changes, and refresh.
- **Correlation over volume.** The backend derives regional convergence only when more than one signal category is present.
- **Source state is data.** Provider health, freshness, source links, and degraded states are visible.
- **No fabricated live coverage.** Missing providers remain visibly unavailable rather than being replaced with invented values.
- **Mobile parity.** The mobile operations screen prioritizes the map and moves feeds/intelligence into vertically accessible surfaces.
- **Graceful complexity.** The executive dashboard remains available at `/`, while advanced users can enter `/operations`.

## New capabilities added after this audit

- Dedicated map-first operations workspace.
- Layer catalog with per-layer record counts and independent toggles.
- 1-hour through all-time temporal filters.
- Global and regional map focus presets.
- Rules-based regional watch board.
- Multi-category convergence detector.
- Command palette for commands, layers, regions, and navigation.
- Responsive map/feed/intelligence mobile navigation.
- NASA EONET open natural-event adapter.
- Combined live reports and curated signal panel.
- Full-screen selected-signal source card.

## Deliberate exclusions

- **Military aircraft and vessel locations:** these require provider agreements, relay infrastructure, responsible-use policies, and careful operational-security controls.
- **Live video rebroadcasting:** third-party streams require availability and licensing review.
- **Unsupported instability scores:** WORLDGPZ reports a transparent composite watch value based on records in view, not a geopolitical prediction.
- **Copied 3D globe:** the current Leaflet renderer is smaller and more reliable on Render. A future MapLibre/deck.gl renderer should be introduced with performance budgets and browser fallbacks.
- **Hundreds of unverified feeds:** source admission, deduplication, licensing, and correction workflows must come before feed count.
- **Code from the reference repository:** excluded to prevent accidental AGPL/license contamination and preserve WORLDGPZ's independent implementation.

## Recommended next production phases

1. Add Playwright visual regression tests once browser binaries are available in CI.
2. Introduce PostgreSQL-backed provider snapshots and job queues.
3. Add a documented source-admission and corrections workflow.
4. Add a MapLibre/deck.gl renderer only after profiling marker volume.
5. Add monitored webhooks and scheduled briefs with explicit user consent.
6. Add licensed data providers individually, with per-source circuit breakers and contractual review.
7. Add WebSocket/SSE delivery after multi-instance fan-out and backpressure are designed.
