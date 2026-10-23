import type { ExcludeEntry, Video } from "../src/types.ts";

// 取得結果を採用するか、前回のデータを残すかを決める。fetched が null なら取得失敗
export function resolveSource(fetched: Video[] | null, previous: Video[]): { videos: Video[]; ok: boolean } {
  if (fetched === null) return { videos: previous, ok: false };
  // API が一部しか返さなかったときに一覧が欠けるのを防ぐ
  if (previous.length > 0 && fetched.length < previous.length / 2) return { videos: previous, ok: false };
  return { videos: fetched, ok: true };
}

export function applyExclusions(videos: Video[], exclude: ExcludeEntry[]): Video[] {
  const ids = new Set(exclude.map((e) => e.id));
  return videos.filter((v) => !ids.has(v.id));
}
