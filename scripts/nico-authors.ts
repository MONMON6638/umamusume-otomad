import type { Video } from "../src/types.ts";

const WAIT_MS = 1000;

export type AuthorDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void> };

async function fetchNickname(userId: string, deps: AuthorDeps): Promise<string | null> {
  const res = await deps.fetch(`https://nvapi.nicovideo.jp/v1/users/${userId}`, {
    headers: { "X-Frontend-Id": "6", "X-Frontend-Version": "0", "User-Agent": "Mozilla/5.0 (compatible; umamusume-otomad/1.0)" },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { user?: { nickname?: string } } };
  return body.data?.user?.nickname || null;
}

// ニコ動の投稿者名を埋める。前回のデータにある名前はそのまま使い、新しい投稿者だけ1人1回問い合わせる。
// 名前が取れなかった動画は author を null にする（次回また取りに行く）
export async function resolveNicoAuthors(videos: Video[], previous: Video[], deps: AuthorDeps): Promise<Video[]> {
  const names = new Map<string, string>();
  for (const v of previous) if (v.author?.name) names.set(v.author.id, v.author.name);

  const unknown = [...new Set(videos.flatMap((v) => (v.author && !names.has(v.author.id) ? [v.author.id] : [])))];
  for (const [i, id] of unknown.entries()) {
    if (i > 0) await deps.sleep(WAIT_MS);
    if ((i + 1) % 100 === 0) console.log(`投稿者名を取得中… ${i + 1}/${unknown.length}人`);
    try {
      const name = await fetchNickname(id.replace(/^nico:/, ""), deps);
      if (name) names.set(id, name);
    } catch {
      // 1人取れなくても全体は止めない
    }
  }

  return videos.map((v) => {
    if (!v.author) return v;
    const name = names.get(v.author.id);
    return { ...v, author: name ? { id: v.author.id, name } : null };
  });
}
