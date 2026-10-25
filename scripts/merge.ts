import { matchCharacters } from "./characters.ts";
import type { ExcludeEntry, NgRule, Video } from "../src/types.ts";

export type Resolved = { videos: Video[]; ok: boolean; reason?: "failed" | "dropped" };

// 取得結果を採用するか、前回のデータを残すかを決める。fetched が null なら取得失敗
export function resolveSource(fetched: Video[] | null, previous: Video[]): Resolved {
  if (fetched === null) return { videos: previous, ok: false, reason: "failed" };
  // API が一部しか返さなかったときに一覧が欠けるのを防ぐ
  if (previous.length > 0 && fetched.length < previous.length / 2) return { videos: previous, ok: false, reason: "dropped" };
  return { videos: fetched, ok: true };
}

export function applyExclusions(videos: Video[], exclude: ExcludeEntry[]): Video[] {
  const ids = new Set(exclude.map((e) => e.id));
  return videos.filter((v) => !ids.has(v.id));
}

// ウマ娘の曲だけ使ってキャラは出てこない淫夢系の動画などを外す。
// キャラのタグがあるか、タイトルにキャラ名があれば、ウマ娘のキャラが出ているとみなして残す
export function applyNgTags(videos: Video[], rule: NgRule, dictionary: string[]): Video[] {
  const ng = new Set(rule.tags);
  const keep = new Set(rule.keep);
  return videos.filter(
    (v) =>
      keep.has(v.id) ||
      !v.tags.some((t) => ng.has(t)) ||
      v.characters.length > 0 ||
      matchCharacters(v.title, dictionary).length > 0,
  );
}
