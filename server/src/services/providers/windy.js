import { ProviderBase } from "./base.js";

/**
 * Windy Webcams API v3 — global webcam locations, preview images, and player
 * embeds. Image URLs are signed and expire quickly (10 minutes on the free
 * tier), so this adapter uses a short cache and always returns fresh tokens
 * on page load.
 *
 * Docs: https://api.windy.com/webcams/docs
 * Auth: header `x-windy-api-key`
 */
export class WindyService extends ProviderBase {
  constructor(config, options = {}) {
    super(config, {
      name: "Windy Webcams",
      group: "Webcams",
      cacheSeconds: 60,
      ...options,
    });
  }

  get configured() {
    return Boolean(this.config.windyApiKey);
  }

  async collect() {
    const url = new URL("https://api.windy.com/webcams/api/v3/webcams");
    url.searchParams.set("limit", "16");
    url.searchParams.set("offset", "0");
    url.searchParams.set("include", "images,location,player,status");
    url.searchParams.set("sortKey", "popularity");
    url.searchParams.set("sortDirection", "desc");

    const payload = await this.fetchJson(url, {
      headers: { "x-windy-api-key": this.config.windyApiKey },
    });

    const webcams = (payload.webcams || [])
      .filter((webcam) => webcam.status === "active")
      .slice(0, 12)
      .map((webcam) => ({
        id: String(webcam.id),
        title: webcam.title || "Untitled webcam",
        status: webcam.status || "offline",
        latitude: webcam.location?.latitude ?? null,
        longitude: webcam.location?.longitude ?? null,
        city: webcam.location?.city || null,
        region: webcam.location?.region || null,
        country: webcam.location?.country || null,
        thumbnail: webcam.images?.current?.thumbnail || null,
        preview: webcam.images?.current?.preview || null,
        playerUrl:
          webcam.player?.embed ||
          `https://webcams.windy.com/webcams/embed/${webcam.id}`,
        windyUrl: `https://www.windy.com/-Webcams/webcams/${webcam.id}`,
        isStreaming: Boolean(webcam.properties?.is_streaming),
      }));

    return {
      webcams,
      total: payload.total ?? webcams.length,
      attribution: "Powered by Windy.com",
      note: "Preview image URLs expire; refresh to renew.",
    };
  }
}
