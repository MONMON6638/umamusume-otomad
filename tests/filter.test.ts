import { describe, it, expect } from "vitest";
import { DEFAULT_STATE, characterCounts, filterVideos, indexVideos } from "../src/filter.ts";
import { makeVideo } from "./helpers.ts";

const videos = [
  makeVideo({ id: "sm1", title: "ばりめん", characters: ["ウインバリアシオン"], tags: ["音MAD"], views: 10, likes: 5, publishedAt: "2026-01-01T00:00:00+09:00" }),
  makeVideo({ id: "sm2", title: "ゴルシ伝説", characters: ["ゴールドシップ"], views: 30, likes: 1, publishedAt: "2026-03-01T00:00:00+09:00" }),
  makeVideo({ id: "yt:a", source: "youtube", title: "Miler Dancer", characters: ["ゴールドシップ"], views: 20, likes: 9, publishedAt: "2026-02-01T00:00:00+09:00" }),
];
const items = indexVideos(videos);
const ids = (vs: { id: string }[]) => vs.map((v) => v.id);

describe("filterVideos", () => {
  it("ANDs space-separated terms across title, characters and tags", () => {
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, q: "ういんばり 音mad" }))).toEqual(["sm1"]);
    expect(filterVideos(items, { ...DEFAULT_STATE, q: "ういんばり 合作" })).toEqual([]);
  });
  it("treats regex characters literally", () => {
    expect(() => filterVideos(items, { ...DEFAULT_STATE, q: "(*" })).not.toThrow();
    expect(filterVideos(items, { ...DEFAULT_STATE, q: "(*" })).toEqual([]);
  });
  it("ignores whitespace-only query", () => {
    expect(filterVideos(items, { ...DEFAULT_STATE, q: "   " })).toHaveLength(3);
  });
  it("filters by source and exact character", () => {
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, src: "youtube" }))).toEqual(["yt:a"]);
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, chara: "ゴールドシップ" }))).toEqual(["sm2", "yt:a"]);
    expect(filterVideos(items, { ...DEFAULT_STATE, chara: "ゴールド" })).toEqual([]);
  });
  it("sorts by views, likes and newest", () => {
    expect(ids(filterVideos(items, DEFAULT_STATE))).toEqual(["sm2", "yt:a", "sm1"]);
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, sort: "views" }))).toEqual(["sm2", "yt:a", "sm1"]);
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, sort: "likes" }))).toEqual(["yt:a", "sm1", "sm2"]);
  });
});

describe("characterCounts", () => {
  it("counts characters", () => {
    expect(characterCounts(videos)).toEqual([
      { name: "ゴールドシップ", count: 2 },
      { name: "ウインバリアシオン", count: 1 },
    ]);
  });
});
