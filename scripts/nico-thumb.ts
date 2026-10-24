import type { Video } from "../src/types.ts";

const WAIT_MS = 1000;
// 実際のページは <meta data-server="1" property="og:image" ...> のように他の属性が先に来る
const OG_IMAGE = /<meta\b[^>]*\bproperty="og:image"[^>]*\bcontent="([^"]+)"/;

export type ThumbDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void> };

// 検索 API のサムネイルは最大 360x270 なので、動画ページの OGP 画像（1280x720）を使う
export function isHiRes(url: string): boolean {
  return url.includes("/r1280x720l");
}

export function extractOgImage(html: string): string | null {
  const m = OG_IMAGE.exec(html);
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

// 前回のデータに 720p の URL があればそれを使い、無い動画だけ動画ページを読む。
// 読めなかった動画は元のサムネイルのまま
export async function upgradeThumbnails(videos: Video[], previous: Video[], deps: ThumbDeps): Promise<Video[]> {
  const known = new Map(previous.filter((v) => isHiRes(v.thumbnail)).map((v) => [v.id, v.thumbnail]));
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
      const res = await deps.fetch(`https://www.nicovideo.jp/watch/${v.id}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; umamusume-otomad/1.0)" },
      });
      const og = res.ok ? extractOgImage(await res.text()) : null;
      if (og && isHiRes(og)) thumbnail = og;
    } catch {
      // 1本読めなくても全体は止めない
    }
    out.push({ ...v, thumbnail });
  }
  return out;
}
