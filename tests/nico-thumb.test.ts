import { describe, it, expect } from "vitest";
import { pickThumbnail, upgradeThumbnails } from "../scripts/nico-thumb.ts";
import { makeVideo } from "./helpers.ts";

const HI = "https://img.cdn.nimg.jp/s/nicovideo/thumbnails/1/1.2.original/r1280x720l?key=abc";
const MID = "https://img.cdn.nimg.jp/s/nicovideo/thumbnails/1/1.2.original/a960x540l?key=def";
const BUTTON = "https://goptim.video.nimg.jp/thumbnail/1280x720?b=p&bs=54&i=1.2&s=blur&key=ghi";
const LOW = "https://nicovideo.cdn.nimg.jp/thumbnails/1/1.2";

// 実際の動画ページと同じく、埋め込みデータは HTML エスケープされ、/ は \/ になっている
function page(thumb: { player?: string; ogp?: string }) {
  const esc = (u: string) => JSON.stringify(u).slice(1, -1).replace(/\//g, "\\/");
  const json = `{"thumbnail":{"normal":"${esc(LOW)}","large":"${esc(LOW + ".L")}"${
    thumb.player ? `,"player":"${esc(thumb.player)}"` : ""
  }${thumb.ogp ? `,"ogp":"${esc(thumb.ogp)}"` : ""},"short":null}}`;
  const attr = json.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<html><head><meta name="server-response" content="${attr}" /></head></html>`;
}

function fakeFetch(respond: (url: string, n: number) => Response) {
  const urls: string[] = [];
  const fetch = (async (input: string | URL) => {
    urls.push(String(input));
    return respond(String(input), urls.length);
  }) as typeof globalThis.fetch;
  return { fetch, urls };
}

describe("pickThumbnail", () => {
  it("prefers the 1280x720 ogp image without a play button", () => {
    expect(pickThumbnail(page({ player: MID, ogp: HI }))).toBe(HI);
  });
  it("falls back to the 960x540 player image when ogp has a play button", () => {
    expect(pickThumbnail(page({ player: MID, ogp: BUTTON }))).toBe(MID);
  });
  it("returns null when neither is available", () => {
    expect(pickThumbnail(page({}))).toBeNull();
    expect(pickThumbnail("<html></html>")).toBeNull();
  });
});

describe("upgradeThumbnails", () => {
  const noSleep = async () => {};

  it("reuses an upgraded thumbnail from previous data without fetching", async () => {
    const { fetch, urls } = fakeFetch(() => new Response(page({ ogp: HI })));
    const out = await upgradeThumbnails(
      [makeVideo({ id: "sm1", thumbnail: LOW }), makeVideo({ id: "sm2", thumbnail: LOW })],
      [makeVideo({ id: "sm1", thumbnail: HI }), makeVideo({ id: "sm2", thumbnail: MID })],
      { fetch, sleep: noSleep },
    );
    expect(out.map((v) => v.thumbnail)).toEqual([HI, MID]);
    expect(urls).toEqual([]);
  });

  it("fetches the watch page when no upgraded thumbnail is known", async () => {
    const { fetch, urls } = fakeFetch(() => new Response(page({ player: MID, ogp: HI })));
    const out = await upgradeThumbnails([makeVideo({ id: "sm1", thumbnail: LOW })], [], { fetch, sleep: noSleep });
    expect(urls).toEqual(["https://www.nicovideo.jp/watch/sm1"]);
    expect(out[0].thumbnail).toBe(HI);
  });

  it("retries once after 5000ms when the page returns 403", async () => {
    const waits: number[] = [];
    const { fetch, urls } = fakeFetch((_, n) =>
      n === 1 ? new Response("", { status: 403 }) : new Response(page({ ogp: HI })),
    );
    const out = await upgradeThumbnails([makeVideo({ id: "sm1", thumbnail: LOW })], [], {
      fetch,
      sleep: async (ms) => void waits.push(ms),
    });
    expect(urls).toHaveLength(2);
    expect(waits).toContain(5000);
    expect(out[0].thumbnail).toBe(HI);
  });

  it("keeps the original thumbnail when the page keeps failing", async () => {
    const { fetch } = fakeFetch(() => new Response("", { status: 403 }));
    const out = await upgradeThumbnails([makeVideo({ id: "sm1", thumbnail: LOW })], [], { fetch, sleep: noSleep });
    expect(out[0].thumbnail).toBe(LOW);
  });

  it("waits 1000ms between page requests", async () => {
    const waits: number[] = [];
    const { fetch, urls } = fakeFetch(() => new Response(page({ ogp: HI })));
    await upgradeThumbnails(
      [1, 2, 3].map((n) => makeVideo({ id: `sm${n}`, thumbnail: LOW })),
      [],
      { fetch, sleep: async (ms) => void waits.push(ms) },
    );
    expect(urls).toHaveLength(3);
    expect(waits).toEqual([1000, 1000]);
  });
});
