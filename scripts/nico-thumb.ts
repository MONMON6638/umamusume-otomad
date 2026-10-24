import type { Video } from "../src/types.ts";

const WAIT_MS = 1000;
const RETRY_WAIT_MS = 5000;

export type ThumbDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void> };

// 検索 API のサムネイルは最大 360x270 なので、動画ページの埋め込みデータにある大きい画像を使う。
// ogp は新しい動画なら再生ボタン無しの 1280x720、古い動画は再生ボタン入り（goptim）になる
const HI_RES = "/r1280x720l";
const PLAYER = "/a960x540l";

export function isUpgraded(url: string): boolean {
  return url.includes(HI_RES) || url.includes(PLAYER);
}

function field(text: string, name: string): string | null {
  const m = new RegExp(`"${name}":("(?:[^"\\\\]|\\\\.)*")`).exec(text);
  return m ? (JSON.parse(m[1]) as string) : null;
}

// ボタン無しの 1280x720 があればそれを、無ければ 960x540 を返す
export function pickThumbnail(html: string): string | null {
  const text = html.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const start = text.indexOf('"thumbnail":{');
  if (start < 0) return null;
  const thumb = text.slice(start, text.indexOf("}", start) + 1);
  const ogp = field(thumb, "ogp");
  if (ogp?.includes(HI_RES)) return ogp;
  const player = field(thumb, "player");
  return player?.includes(PLAYER) ? player : null;
}

async function fetchPage(id: string, deps: ThumbDeps): Promise<string | null> {
  const get = () =>
    deps.fetch(`https://www.nicovideo.jp/watch/${id}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; umamusume-otomad/1.0)" },
    });
  let res = await get();
  // 一時的なアクセス制限のことがあるので、少し待って一度だけ取り直す
  if (res.status === 403 || res.status === 429) {
    await deps.sleep(RETRY_WAIT_MS);
    res = await get();
  }
  return res.ok ? res.text() : null;
}

// 前回のデータに大きい画像があればそれを使い、無い動画だけ動画ページを読む。
// 読めなかった動画は元のサムネイルのまま
export async function upgradeThumbnails(videos: Video[], previous: Video[], deps: ThumbDeps): Promise<Video[]> {
  const known = new Map(previous.filter((v) => isUpgraded(v.thumbnail)).map((v) => [v.id, v.thumbnail]));
  const out: Video[] = [];
  let requests = 0;
  for (const v of videos) {
    const cached = known.get(v.id);
    if (cached) {
      out.push({ ...v, thumbnail: cached });
      continue;
    }
    if (requests++ > 0) await deps.sleep(WAIT_MS);
    if (requests % 100 === 0) console.log(`サムネイル取得中… ${requests}件目`);
    let thumbnail = v.thumbnail;
    try {
      const html = await fetchPage(v.id, deps);
      thumbnail = (html && pickThumbnail(html)) || thumbnail;
    } catch {
      // 1本読めなくても全体は止めない
    }
    out.push({ ...v, thumbnail });
  }
  return out;
}
