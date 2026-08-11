export class IntelligenceService {
  constructor(config) {
    this.config = config;
    this.lastSuccessAt = null;
    this.lastCheckedAt = null;
    this.lastError = null;
    this.lastErrorCode = null;
  }

  #fallback(events, liveSnapshot) {
    const critical = events.filter((item) => item.severity === "critical");
    const high = events.filter((item) => item.severity === "high");
    const strongestQuake = [...liveSnapshot.earthquakes].sort(
      (a, b) => (b.magnitude || 0) - (a.magnitude || 0),
    )[0];
    const degraded = liveSnapshot.sourceStatus.filter(
      (item) => item.status === "degraded",
    );
    const bullets = [
      `${critical.length} critical and ${high.length} high-priority curated signals are currently in view.`,
      strongestQuake
        ? `The strongest seismic signal in the current USGS window is magnitude ${strongestQuake.magnitude?.toFixed(1)}.`
        : "No magnitude 4.5+ USGS seismic events were available in the latest source window.",
      degraded.length
        ? `${degraded.length} external source${degraded.length === 1 ? " is" : "s are"} degraded; treat coverage as incomplete.`
        : "All configured public sources responded during the latest collection window.",
    ];
    return {
      headline: critical.length
        ? "Elevated global watch posture"
        : "Routine global watch posture",
      assessment: bullets,
      watchlist: events.slice(0, 3).map((event) => event.region),
      confidence: this.config.ai.apiKey ? "medium" : "rules-based",
      generatedBy: "WORLDGPZ rules engine",
      disclaimer:
        "Decision-support summary only. Verify against the linked primary sources.",
    };
  }

  async generate(events, liveSnapshot) {
    const fallback = this.#fallback(events, liveSnapshot);
    if (!this.config.ai.apiKey) return fallback;

    const compactEvents = events
      .slice(0, 12)
      .map(({ title, category, severity, region, publishedAt }) => ({
        title,
        category,
        severity,
        region,
        publishedAt,
      }));
    try {
      this.lastCheckedAt = new Date().toISOString();
      const response = await fetch(
        `${this.config.ai.baseUrl}/chat/completions`,
        {
          method: "POST",
          signal: AbortSignal.timeout(this.config.fetchTimeoutMs),
          headers: {
            Authorization: `Bearer ${this.config.ai.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.ai.model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are an OSINT briefing assistant. Return JSON with headline (string), assessment (array of 3 concise strings), watchlist (array of up to 3 regions), confidence (low|medium|high), and disclaimer. Never invent facts, casualties, or predictions. Explicitly describe uncertainty.",
              },
              { role: "user", content: JSON.stringify(compactEvents) },
            ],
          }),
        },
      );
      if (!response.ok)
        throw new Error(`AI provider returned ${response.status}`);
      const payload = await response.json();
      const parsed = JSON.parse(payload.choices?.[0]?.message?.content || "{}");
      if (!parsed.headline || !Array.isArray(parsed.assessment))
        throw new Error("AI response did not match the required shape");
      this.lastSuccessAt = new Date().toISOString();
      this.lastError = null;
      this.lastErrorCode = null;
      return {
        ...parsed,
        generatedBy: `${this.config.ai.model} via configured provider`,
        disclaimer: parsed.disclaimer || fallback.disclaimer,
      };
    } catch (error) {
      this.lastErrorCode =
        error?.name === "TimeoutError" || error?.name === "AbortError"
          ? "timeout"
          : /returned 401|returned 403/.test(String(error?.message || ""))
            ? "credential-rejected"
            : /returned 429/.test(String(error?.message || ""))
              ? "quota-exceeded"
              : "provider-error";
      this.lastError =
        this.lastErrorCode === "credential-rejected"
          ? "AI provider rejected the configured key or project access"
          : this.lastErrorCode === "quota-exceeded"
            ? "AI provider quota or billing limit was reached"
            : this.lastErrorCode === "timeout"
              ? "AI provider timed out"
              : "AI provider was unavailable; rules engine used";
      return { ...fallback, providerFallback: true };
    }
  }
}
