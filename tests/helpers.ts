import type { Video } from "../src/types.ts";

export function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: "sm1",
    source: "nico",
    title: "テスト",
    url: "",
    thumbnail: "",
    publishedAt: "2026-01-01T00:00:00+09:00",
    views: 0,
    likes: 0,
    duration: 0,
    tags: [],
    characters: [],
    ...overrides,
  };
}
