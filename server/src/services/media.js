const channels = [
  { id: "sky-news", name: "Sky News", handle: "@SkyNews", region: "Europe" },
  { id: "dw-news", name: "DW News", handle: "@DWNews", region: "Europe" },
  {
    id: "france-24",
    name: "France 24",
    handle: "@France24_en",
    region: "Europe",
  },
  {
    id: "al-jazeera",
    name: "Al Jazeera English",
    handle: "@AlJazeeraEnglish",
    region: "Middle East",
  },
  {
    id: "bloomberg",
    name: "Bloomberg Television",
    handle: "@markets",
    region: "Americas",
  },
  { id: "euronews", name: "Euronews", handle: "@euronews", region: "Europe" },
  { id: "nasa", name: "NASA", handle: "@NASA", region: "Space" },
];

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

  async #resolve(channel) {
    try {
      const channelPayload = await this.#youtube("channels", {
        part: "id,snippet",
        forHandle: channel.handle.replace(/^@/, ""),
        maxResults: 1,
      });
      const resolved = channelPayload.items?.[0];
      if (!resolved?.id)
        return { ...channel, status: "not-found", videoId: null };

      const livePayload = await this.#youtube("search", {
        part: "snippet",
        channelId: resolved.id,
        eventType: "live",
        type: "video",
        order: "date",
        maxResults: 1,
        safeSearch: "strict",
      });
      const live = livePayload.items?.[0];
      if (!live?.id?.videoId) {
        return {
          ...channel,
          channelId: resolved.id,
          channelTitle: resolved.snippet?.title || channel.name,
          channelUrl: `https://www.youtube.com/${channel.handle}`,
          status: "offline",
          videoId: null,
        };
      }
      return {
        ...channel,
        channelId: resolved.id,
        channelTitle: resolved.snippet?.title || channel.name,
        channelUrl: `https://www.youtube.com/${channel.handle}`,
        status: "live",
        videoId: live.id.videoId,
        title: live.snippet?.title || `${channel.name} live`,
        publishedAt: live.snippet?.publishedAt || null,
        thumbnail:
          live.snippet?.thumbnails?.high?.url ||
          live.snippet?.thumbnails?.medium?.url ||
          live.snippet?.thumbnails?.default?.url ||
          null,
        watchUrl: `https://www.youtube.com/watch?v=${live.id.videoId}`,
      };
    } catch (error) {
      return {
        ...channel,
        status: error.status === 403 ? "quota-or-key-error" : "degraded",
        videoId: null,
      };
    }
  }

  async list({ fresh = false } = {}) {
    if (!this.apiKey) {
      return {
        configured: false,
        status: "not-configured",
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
    this.cache = {
      configured: true,
      status: liveCount
        ? "operational"
        : resolved.some((channel) => channel.status === "offline")
          ? "no-live-streams"
          : "degraded",
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
