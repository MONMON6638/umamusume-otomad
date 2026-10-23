import { extractCharacters } from "./characters.ts";
import type { Video } from "../src/types.ts";

const ENDPOINT = "https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search";
const QUERIES = ["ウマ娘 音MAD", "ウマ娘プリティーダービー 音MAD"];
const FIELDS = "contentId,title,viewCounter,likeCounter,commentCounter,startTime,tags,thumbnailUrl,lengthSeconds";
const PAGE_SIZE = 100;
const WAIT_MS = 1000;

export type NicoItem = {
  contentId: string;
  title: string;
  viewCounter: number;
  likeCounter: number;
  commentCounter: number;
  startTime: string;
  tags: string;
  thumbnailUrl: string;
  lengthSeconds: number;
};

type NicoResponse = { meta: { status: number; errorCode?: string }; data?: NicoItem[] };

export type NicoDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void> };

function userAgent(): string {
  const repo = process.env.GITHUB_REPOSITORY;
  return repo ? `umamusume-otomad/1.0 (+https://github.com/${repo})` : "umamusume-otomad/1.0 (local)";
}

export function nicoToVideo(raw: NicoItem): Video {
  const tags = raw.tags ? raw.tags.split(" ") : [];
  return {
    id: raw.contentId,
    source: "nico",
    title: raw.title,
    url: `https://www.nicovideo.jp/watch/${raw.contentId}`,
    thumbnail: raw.thumbnailUrl,
    publishedAt: raw.startTime,
    views: raw.viewCounter,
    likes: raw.likeCounter,
    duration: raw.lengthSeconds,
    tags,
    characters: extractCharacters(tags),
  };
}

export async function fetchNico(deps: NicoDeps): Promise<Video[]> {
  const byId = new Map<string, Video>();
  let requests = 0;
  for (const q of QUERIES) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      if (requests++ > 0) await deps.sleep(WAIT_MS);
      const url = new URL(ENDPOINT);
      url.search = new URLSearchParams({
        q,
        targets: "tagsExact",
        fields: FIELDS,
        _sort: "-startTime",
        _limit: String(PAGE_SIZE),
        _offset: String(offset),
        _context: "umamusume-otomad",
      }).toString();
      const res = await deps.fetch(url, { headers: { "User-Agent": userAgent() } });
      if (!res.ok) throw new Error(`nico: HTTP ${res.status}`);
      const body = (await res.json()) as NicoResponse;
      // メンテナンス中は HTTP 200 のまま meta.status にエラーが入る
      if (body.meta?.status !== 200) throw new Error(`nico: meta.status ${body.meta?.status} ${body.meta?.errorCode ?? ""}`);
      const items = body.data ?? [];
      for (const item of items) if (!byId.has(item.contentId)) byId.set(item.contentId, nicoToVideo(item));
      if (items.length < PAGE_SIZE) break;
    }
  }
  return [...byId.values()];
}
