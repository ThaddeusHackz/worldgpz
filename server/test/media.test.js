import { describe, expect, it } from "vitest";
import { MediaService } from "../src/services/media.js";

describe("MediaService", () => {
  it("discovers live channels server-side and reuses the shared cache", async () => {
    const requests = [];
    const fakeFetch = async (input) => {
      const url = new URL(input);
      requests.push(url);
      if (url.pathname.endsWith("/channels")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: `channel-${url.searchParams.get("forHandle")}`,
                snippet: { title: url.searchParams.get("forHandle") },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          items: [
            {
              id: { videoId: "livevideo01" },
              snippet: {
                title: "Verified live fixture",
                publishedAt: "2026-08-10T12:00:00Z",
                thumbnails: { high: { url: "https://i.ytimg.com/test.jpg" } },
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const service = new MediaService(
      {
        youtubeApiKey: "private-test-key",
        youtubeCacheSeconds: 10_800,
        fetchTimeoutMs: 1_000,
      },
      fakeFetch,
    );

    const first = await service.list();
    const requestCount = requests.length;
    const second = await service.list();

    expect(first.configured).toBe(true);
    expect(first.status).toBe("operational");
    expect(first.liveCount).toBe(first.channels.length);
    expect(first.channels[0]).toMatchObject({
      status: "live",
      videoId: "livevideo01",
    });
    expect(second).toBe(first);
    expect(requests.length).toBe(requestCount);
    expect(JSON.stringify(first)).not.toContain("private-test-key");
    expect(
      requests.filter((url) => url.pathname.endsWith("/search")),
    ).toHaveLength(first.channels.length);
  });

  it("falls back to the canonical channel live page when search omits a stream", async () => {
    const requests = [];
    const fakeFetch = async (input) => {
      const url = new URL(input);
      requests.push(url);
      if (url.pathname.endsWith("/search")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        '<html><script>{"videoDetails":{"videoId":"livevideo01","isLive":true,"title":"Verified 24/7 live stream"}}</script></html>',
        { status: 200, headers: { "content-type": "text/html" } },
      );
    };
    const service = new MediaService(
      {
        youtubeApiKey: "private-test-key",
        youtubeCacheSeconds: 10_800,
        fetchTimeoutMs: 1_000,
      },
      fakeFetch,
    );
    const result = await service.list();
    expect(result.status).toBe("operational");
    expect(result.availability).toBe("live-streams");
    expect(result.channels[0]).toMatchObject({
      status: "live",
      videoId: "livevideo01",
      discovery: "channel-live-page",
    });
    expect(JSON.stringify(result)).not.toContain("private-test-key");
  });
});
