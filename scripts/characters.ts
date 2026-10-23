import { normalize } from "../src/normalize.ts";
import type { Video } from "../src/types.ts";

const CHARACTER_TAG = /^(.+)[(（]ウマ娘[)）]$/;
// これより短い名前はタイトルの別の語と重なりやすいので、タイトル判定には使わない
const MIN_TITLE_MATCH_LENGTH = 3;

// "ヒシミラクル(ウマ娘)" のようなタグからキャラ名を取り出す
export function extractCharacters(tags: string[]): string[] {
  const names = new Set<string>();
  for (const tag of tags) {
    const m = CHARACTER_TAG.exec(tag);
    if (m) names.add(m[1]);
  }
  return [...names];
}

export function buildDictionary(videos: Video[]): string[] {
  return [...new Set(videos.flatMap((v) => v.characters))];
}

// タグの無い YouTube 動画向けに、タイトルに含まれるキャラ名を辞書から探す
export function matchCharacters(title: string, dictionary: string[]): string[] {
  const t = normalize(title);
  return dictionary.filter((name) => {
    const n = normalize(name);
    return n.length >= MIN_TITLE_MATCH_LENGTH && t.includes(n);
  });
}
