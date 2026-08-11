import { ProviderBase } from "./base.js";

/**
 * Windy Webcams API v3 — global webcam locations, signed preview images, and
 * timelapse/live players. Image tokens expire after 10 minutes on the free
 * tier, so successful responses use a deliberately short cache.
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
    // `status` and v2 `properties` are not valid v3 include parts. Including
    // either makes Windy reject the entire request with HTTP 400.
    url.searchParams.set("include", "images,location,player,urls");
    url.searchParams.set("sortKey", "popularity");
    url.searchParams.set("sortDirection", "desc");
    url.searchParams.set("lang", "en");

    const payload = await this.fetchJson(url, {
      headers: { "x-windy-api-key": this.config.windyApiKey },
    });
    const rows =
      payload.webcams ||
      payload.data?.webcams ||
      (Array.isArray(payload.data) ? payload.data : []);

    const webcams = rows
      .filter((webcam) => !webcam.status || webcam.status === "active")
      .slice(0, 12)
      .map((webcam) => {
        const id = webcam.webcamId ?? webcam.id;
        const images = webcam.images?.current || {};
        const player = webcam.player || {};
        const detailUrl =
          webcam.urls?.detail || `https://www.windy.com/webcams/${id}`;
        return {
          id: String(id),
          title: webcam.title || "Untitled webcam",
          status: webcam.status || "active",
          latitude: webcam.location?.latitude ?? null,
          longitude: webcam.location?.longitude ?? null,
          city: webcam.location?.city || null,
          region: webcam.location?.region || null,
          country: webcam.location?.country || null,
          thumbnail:
            images.thumbnail ||
            images.small ||
            images.preview ||
            images.icon ||
            null,
          preview:
            images.preview ||
            images.small ||
            images.thumbnail ||
            images.icon ||
            null,
          playerUrl:
            player.live || player.day || player.month || player.year || null,
          windyUrl: detailUrl,
          isStreaming: Boolean(player.live),
          lastUpdatedAt: webcam.lastUpdatedOn || null,
        };
      })
      .filter((webcam) => webcam.id && webcam.id !== "undefined");

    return {
      webcams,
      total: payload.total ?? payload.data?.total ?? webcams.length,
      attribution: "Powered by Windy.com",
      note: "Preview image URLs expire; refresh to renew.",
    };
  }
}
