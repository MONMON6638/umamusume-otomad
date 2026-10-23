import { normalize } from "./normalize.ts";
import type { Video } from "./types.ts";

export type State = {
  q: string;
  src: "all" | "nico" | "youtube";
  sort: "new" | "views" | "likes";
  chara: string;
};

export const DEFAULT_STATE: State = { q: "", src: "all", sort: "new", chara: "" };

export type Indexed = { video: Video; haystack: string };

// 検索のたびに正規化しないよう、検索対象の文字列を先に作っておく
export function indexVideos(videos: Video[]): Indexed[] {
  return videos.map((video) => ({
    video,
    haystack: normalize([video.title, ...video.characters, ...video.tags].join(" ")),
  }));
}

const COMPARE: Record<State["sort"], (a: Video, b: Video) => number> = {
  new: (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  views: (a, b) => b.views - a.views,
  likes: (a, b) => b.likes - a.likes,
};

export function filterVideos(items: Indexed[], state: State): Video[] {
  const terms = normalize(state.q).split(/\s+/).filter(Boolean);
  return items
    .filter(({ video, haystack }) =>
      (state.src === "all" || video.source === state.src) &&
      (!state.chara || video.characters.includes(state.chara)) &&
      terms.every((t) => haystack.includes(t)),
    )
    .map((i) => i.video)
    .sort(COMPARE[state.sort]);
}

export function characterCounts(videos: Video[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of videos) for (const c of v.characters) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}
