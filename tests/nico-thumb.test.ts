import { describe, it, expect } from "vitest";
import { extractOgImage, upgradeThumbnails } from "../scripts/nico-thumb.ts";
import { makeVideo } from "./helpers.ts";

const HI = "https://img.cdn.nimg.jp/s/nicovideo/thumbnails/1/1.2.original/r1280x720l?key=abc";
const LOW = "https://nicovideo.cdn.nimg.jp/thumbnails/1/1.2";
const page = (og: string) =>
  `<html><head><meta property="og:image" content="${og.replace(/&/g, "&amp;")}"></head></html>`;

function fakeFetch(respond: (url: string) => Response) {
  const urls: string[] = [];
  const fetch = (async (input: string | URL) => {
    urls.push(String(input));
    return respond(String(input));
  }) as typeof globalThis.fetch;
  return { fetch, urls };
}

describe("extractOgImage", () => {
  it("reads og:image and decodes &amp;", () => {
    expect(extractOgImage(page("https://a.example/x?key=1&v=2"))).toBe("https://a.example/x?key=1&v=2");
  });
  it("reads og:image when other attributes come first, as on the real watch page", () => {
    const html = `<meta data-server="1" property="og:image" content="${HI.replace(/&/g, "&amp;")}" />`;
    expect(extractOgImage(html)).toBe(HI);
  });
  it("returns null without og:image", () => {
    expect(extractOgImage("<html></html>")).toBeNull();
  });
});

describe("upgradeThumbnails", () => {
  const noSleep = async () => {};

  it("reuses a 720p thumbnail from previous data without fetching", async () => {
    const { fetch, urls } = fakeFetch(() => new Response(page(HI)));
    const out = await upgradeThumbnails([makeVideo({ id: "sm1", thumbnail: LOW })], [makeVideo({ id: "sm1", thumbnail: HI })], { fetch, sleep: noSleep });
    expect(out[0].thumbnail).toBe(HI);
    expect(urls).toEqual([]);
  });

  it("fetches the watch page when no 720p thumbnail is known", async () => {
    const { fetch, urls } = fakeFetch(() => new Response(page(HI)));
    const out = await upgradeThumbnails([makeVideo({ id: "sm1", thumbnail: LOW })], [], { fetch, sleep: noSleep });
    expect(urls).toEqual(["https://www.nicovideo.jp/watch/sm1"]);
    expect(out[0].thumbnail).toBe(HI);
  });

  it("keeps the original thumbnail when the page fails or has no 720p image", async () => {
    const { fetch } = fakeFetch((url) =>
      url.endsWith("sm1") ? new Response("", { status: 403 }) : new Response(page(LOW)),
    );
    const out = await upgradeThumbnails(
      [makeVideo({ id: "sm1", thumbnail: LOW }), makeVideo({ id: "sm2", thumbnail: LOW })],
      [],
      { fetch, sleep: noSleep },
    );
    expect(out.map((v) => v.thumbnail)).toEqual([LOW, LOW]);
  });

  it("waits 1000ms between page requests", async () => {
    const waits: number[] = [];
    const { fetch, urls } = fakeFetch(() => new Response(page(HI)));
    await upgradeThumbnails(
      [1, 2, 3].map((n) => makeVideo({ id: `sm${n}`, thumbnail: LOW })),
      [],
      { fetch, sleep: async (ms) => void waits.push(ms) },
    );
    expect(urls).toHaveLength(3);
    expect(waits).toEqual([1000, 1000]);
  });
});
