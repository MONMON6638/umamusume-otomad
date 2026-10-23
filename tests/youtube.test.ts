import { describe, it, expect } from "vitest";
import { fetchYoutube, parseIsoDuration } from "../scripts/youtube.ts";
import playlistItems from "./fixtures/yt-playlist-items.json";
import videosList from "./fixtures/yt-videos.json";

// playlistItems と videos の呼び出しを URL で振り分ける偽 fetch
function fakeFetch(opts: { pages?: unknown[]; videos?: unknown; status?: number } = {}) {
  const pages = opts.pages ?? [playlistItems];
  const calls: URL[] = [];
  const fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    let body: unknown = {};
    if (url.pathname.endsWith("/playlistItems")) {
      const n = calls.filter((c) => c.pathname.endsWith("/playlistItems")).length;
      body = pages[n - 1];
    } else if (url.pathname.endsWith("/videos")) {
      body = opts.videos ?? videosList;
    }
    return new Response(JSON.stringify(body), { status: opts.status ?? 200 });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("parseIsoDuration", () => {
  it("parses ISO 8601 durations", () => {
    expect(parseIsoDuration("PT1M17S")).toBe(77);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("P0D")).toBe(0);
  });
});

describe("fetchYoutube", () => {
  it("maps videos with yt: prefix and watch url", async () => {
    const { fetch, calls } = fakeFetch();
    const [v] = await fetchYoutube("KEY", { fetch });
    expect(v).toEqual({
      id: "yt:aaaaaaaaaaa",
      source: "youtube",
      title: "Miler Dancer",
      url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
      thumbnail: "https://i.ytimg.com/vi/aaaaaaaaaaa/maxresdefault.jpg",
      publishedAt: "2026-09-01T12:00:00Z",
      views: 1234,
      likes: 56,
      duration: 77,
      tags: [],
      characters: [],
    });
    const list = calls[0];
    expect(list.searchParams.get("playlistId")).toBe("PLr6e2du4c5xBxBP4WkmVZPRKVAa0qgC8h");
    expect(list.searchParams.get("maxResults")).toBe("50");
    expect(list.searchParams.get("key")).toBe("KEY");
  });

  it("drops videos missing from videos.list", async () => {
    const { fetch } = fakeFetch();
    const videos = await fetchYoutube("KEY", { fetch });
    expect(videos.map((v) => v.id)).toEqual(["yt:aaaaaaaaaaa", "yt:bbbbbbbbbbb"]);
  });

  it("treats hidden like count as 0", async () => {
    const { fetch } = fakeFetch();
    const videos = await fetchYoutube("KEY", { fetch });
    expect(videos[1].likes).toBe(0);
    expect(videos[1].thumbnail).toBe("https://i.ytimg.com/vi/bbbbbbbbbbb/mqdefault.jpg");
  });

  it("follows nextPageToken", async () => {
    const { fetch, calls } = fakeFetch({
      pages: [{ ...playlistItems, nextPageToken: "p2" }, { items: [] }],
    });
    await fetchYoutube("KEY", { fetch });
    const lists = calls.filter((c) => c.pathname.endsWith("/playlistItems"));
    expect(lists).toHaveLength(2);
    expect(lists[1].searchParams.get("pageToken")).toBe("p2");
  });

  it("throws on HTTP error", async () => {
    const { fetch } = fakeFetch({ status: 403 });
    await expect(fetchYoutube("KEY", { fetch })).rejects.toThrow();
  });
});
