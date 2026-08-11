const channels = [
  {
    id: "sky-news",
    name: "Sky News",
    handle: "@SkyNews",
    channelId: "UCoMdktPbSTixAyNGwb-UYkQ",
    region: "Europe",
  },
  {
    id: "dw-news",
    name: "DW News",
    handle: "@DWNews",
    channelId: "UCknLrEdhRCp1aegoMqRaCZg",
    region: "Europe",
  },
  {
    id: "france-24",
    name: "France 24",
    handle: "@France24_en",
    channelId: "UCQfwfsi5VrQ8yKZ-UWmAEFg",
    region: "Europe",
  },
  {
    id: "al-jazeera",
    name: "Al Jazeera English",
    handle: "@AlJazeeraEnglish",
    channelId: "UCNye-wNBqNL5ZzHSJj3l8Bg",
    region: "Middle East",
  },
  {
    id: "bloomberg",
    name: "Bloomberg Television",
    handle: "@markets",
    channelId: "UCIALMKvObZNtJ6AmdCLP7Lg",
    region: "Americas",
  },
  {
    id: "euronews",
    name: "Euronews",
    handle: "@euronews",
    channelId: "UCSrZ3UV4jOidv8ppoVuvW9Q",
    region: "Europe",
  },
  {
    id: "nasa",
    name: "NASA",
    handle: "@NASA",
    channelId: "UCLA_DiR1FfKNvjuUpBHmylQ",
    region: "Space",
  },
];

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

const videoResult = (channel, videoId, snippet = {}, discovery = "api") => ({
  ...channel,
  channelTitle: channel.name,
  channelUrl: `https://www.youtube.com/${channel.handle}`,
  status: "live",
  videoId,
  title: snippet.title || `${channel.name} live`,
  publishedAt: snippet.publishedAt || null,
  thumbnail:
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    snippet.thumbnails?.default?.url ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  discovery,
});

export class MediaService {
  constructor(config, fetchFn = fetch) {
    this.apiKey = config.youtubeApiKey;
    this.timeoutMs = config.fetchTimeoutMs;
    this.cacheMs = config.youtubeCacheSeconds * 1000;
    this.fetch = fetchFn;
    this.cache = null;
    this.cachedAt = 0;
  }

  async #youtube(path, parameters) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    for (const [key, value] of Object.entries(parameters)) {
      if (value != null) url.searchParams.set(key, String(value));
    }
    url.searchParams.set("key", this.apiKey);
    const response = await this.fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const error = new Error(`YouTube provider returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async #scrapeLive(channel) {
    try {
      const response = await this.fetch(
        `https://www.youtube.com/${channel.handle}/live`,
        {
          redirect: "follow",
          signal: AbortSignal.timeout(Math.max(this.timeoutMs, 10_000)),
          headers: {
            Accept: "text/html",
            "User-Agent": CHROME_USER_AGENT,
          },
        },
      );
      if (!response.ok) return null;

      const redirectedId = new URL(
        response.url || "https://www.youtube.com/",
      ).searchParams.get("v");
      const html = await response.text();
      const detailsIndex = html.indexOf('"videoDetails"');
      const block =
        detailsIndex >= 0
          ? html.slice(detailsIndex, detailsIndex + 8_000)
          : html.slice(0, 50_000);
      const isLive =
        /"isLive"\s*:\s*true/.test(block) ||
        /"isLiveContent"\s*:\s*true/.test(block);
      const idMatch = block.match(/"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/);
      const videoId = isLive ? idMatch?.[1] || redirectedId : null;
      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
      const titleMatch = block.match(
        /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
      );
      return videoResult(
        channel,
        videoId,
        { title: titleMatch?.[1] || `${channel.name} live` },
        "channel-live-page",
      );
    } catch {
      return null;
    }
  }

  async #resolve(channel) {
    let apiError = null;
    try {
      const livePayload = await this.#youtube("search", {
        part: "snippet",
        channelId: channel.channelId,
        eventType: "live",
        type: "video",
        order: "date",
        maxResults: 1,
        safeSearch: "strict",
      });
      const live = livePayload.items?.[0];
      if (live?.id?.videoId)
        return videoResult(channel, live.id.videoId, live.snippet, "data-api");
    } catch (error) {
      apiError = error;
    }

    // YouTube's channel-filtered search has intermittently omitted active
    // 24/7 broadcasts. The canonical /@handle/live page is a keyless fallback.
    const scraped = await this.#scrapeLive(channel);
    if (scraped) return scraped;

    if (apiError) {
      return {
        ...channel,
        channelUrl: `https://www.youtube.com/${channel.handle}`,
        status: apiError.status === 403 ? "quota-or-key-error" : "degraded",
        videoId: null,
      };
    }
    return {
      ...channel,
      channelTitle: channel.name,
      channelUrl: `https://www.youtube.com/${channel.handle}`,
      status: "offline",
      videoId: null,
    };
  }

  async list({ fresh = false } = {}) {
    if (!this.apiKey) {
      return {
        configured: false,
        status: "not-configured",
        availability: "unchecked",
        channels: channels.map((channel) => ({
          ...channel,
          status: "not-configured",
          videoId: null,
          channelUrl: `https://www.youtube.com/${channel.handle}`,
        })),
        checkedAt: new Date().toISOString(),
        cacheSeconds: Math.round(this.cacheMs / 1000),
      };
    }
    if (!fresh && this.cache && Date.now() - this.cachedAt < this.cacheMs)
      return this.cache;

    const resolved = await Promise.all(
      channels.map((channel) => this.#resolve(channel)),
    );
    const liveCount = resolved.filter(
      (channel) => channel.status === "live",
    ).length;
    const healthyChecks = resolved.filter((channel) =>
      ["live", "offline"].includes(channel.status),
    ).length;
    this.cache = {
      configured: true,
      // Provider health and content availability are different concepts. Zero
      // live broadcasts is not an API failure.
      status: healthyChecks ? "operational" : "degraded",
      availability: liveCount ? "live-streams" : "no-live-streams",
      channels: resolved,
      liveCount,
      checkedAt: new Date().toISOString(),
      cacheSeconds: Math.round(this.cacheMs / 1000),
    };
    this.cachedAt = Date.now();
    return this.cache;
  }
}

export const curatedVideoChannels = channels;
