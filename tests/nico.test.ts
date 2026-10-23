import { describe, it, expect } from "vitest";
import { fetchNico, nicoToVideo } from "../scripts/nico.ts";
import sample from "./fixtures/nico-response.json";

type Call = { url: URL; init?: RequestInit };

// 呼ばれた URL を記録し、respond が返す本文を JSON で返す偽 fetch
function fakeFetch(respond: (url: URL, n: number) => unknown, status = 200) {
  const calls: Call[] = [];
  const fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return new Response(JSON.stringify(respond(url, calls.length)), { status });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const empty = { meta: { status: 200, totalCount: 0 }, data: [] };
const noSleep = async () => {};

describe("nicoToVideo", () => {
  it("maps an item to Video", () => {
    const raw = sample.data[0];
    const v = nicoToVideo(raw);
    expect(v.id).toBe(raw.contentId);
    expect(v.source).toBe("nico");
    expect(v.url).toBe(`https://www.nicovideo.jp/watch/${raw.contentId}`);
    expect(v.tags).toEqual(raw.tags.split(" "));
    expect(v.duration).toBe(raw.lengthSeconds);
    expect(v.likes).toBe(raw.likeCounter);
    expect(v.views).toBe(raw.viewCounter);
    expect(v.publishedAt).toBe(raw.startTime);
    expect(v.thumbnail).toBe(raw.thumbnailUrl);
    expect(v.characters).toContain("ヒシミラクル");
  });
});

describe("fetchNico", () => {
  it("sends both queries with required params", async () => {
    const { fetch, calls } = fakeFetch(() => empty);
    await fetchNico({ fetch, sleep: noSleep });
    const qs = calls.map((c) => c.url.searchParams.get("q"));
    expect(qs).toEqual(["ウマ娘 音MAD", "ウマ娘プリティーダービー 音MAD"]);
    for (const { url, init } of calls) {
      expect(url.origin + url.pathname).toBe(
        "https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search",
      );
      expect(url.searchParams.get("targets")).toBe("tagsExact");
      expect(url.searchParams.get("_sort")).toBe("-startTime");
      expect(url.searchParams.get("_limit")).toBe("100");
      expect(url.searchParams.get("_context")).toBe("umamusume-otomad");
      expect(new Headers(init?.headers).get("User-Agent")).toMatch(/^umamusume-otomad\//);
    }
  });

  it("pages with _offset until a short page", async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ ...sample.data[0], contentId: `sm${i}` }));
    const { fetch, calls } = fakeFetch((url) =>
      url.searchParams.get("_offset") === "0" && url.searchParams.get("q") === "ウマ娘 音MAD"
        ? { meta: { status: 200 }, data: full }
        : empty,
    );
    const videos = await fetchNico({ fetch, sleep: noSleep });
    const first = calls.filter((c) => c.url.searchParams.get("q") === "ウマ娘 音MAD");
    expect(first.map((c) => c.url.searchParams.get("_offset"))).toEqual(["0", "100"]);
    expect(videos).toHaveLength(100);
  });

  it("dedupes videos found by both queries", async () => {
    const { fetch } = fakeFetch(() => sample);
    const videos = await fetchNico({ fetch, sleep: noSleep });
    expect(videos.map((v) => v.id)).toEqual(["sm46933170", "sm46878657"]);
  });

  it("throws when meta.status is not 200", async () => {
    const { fetch } = fakeFetch(() => ({ meta: { status: 503, errorCode: "MAINTENANCE" } }));
    await expect(fetchNico({ fetch, sleep: noSleep })).rejects.toThrow();
  });

  it("throws on HTTP error", async () => {
    const { fetch } = fakeFetch(() => ({}), 500);
    await expect(fetchNico({ fetch, sleep: noSleep })).rejects.toThrow();
  });

  it("waits between requests", async () => {
    const waits: number[] = [];
    const { fetch, calls } = fakeFetch(() => empty);
    await fetchNico({ fetch, sleep: async (ms) => void waits.push(ms) });
    expect(waits.length).toBeGreaterThanOrEqual(calls.length - 1);
    expect(waits.every((ms) => ms === 1000)).toBe(true);
  });
});
