import type { Video } from "../src/types.ts";

const API = "https://www.googleapis.com/youtube/v3";
const PLAYLIST_ID = "PLr6e2du4c5xBxBP4WkmVZPRKVAa0qgC8h";
const BATCH = 50;

type Thumb = { url: string };
type YtVideo = {
  id: string;
  snippet: { title: string; publishedAt: string; thumbnails?: { high?: Thumb; medium?: Thumb; default?: Thumb } };
  statistics?: { viewCount?: string; likeCount?: string };
  contentDetails: { duration: string };
};

export function parseIsoDuration(s: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s);
  if (!m) return 0;
  const [, d, h, min, sec] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + sec;
}

async function getJson(deps: { fetch: typeof fetch }, path: string, params: Record<string, string>) {
  const url = new URL(`${API}/${path}`);
  url.search = new URLSearchParams(params).toString();
  const res = await deps.fetch(url);
  if (!res.ok) throw new Error(`youtube: ${path} HTTP ${res.status}`);
  return res.json();
}

function toVideo(v: YtVideo): Video {
  const t = v.snippet.thumbnails;
  return {
    id: `yt:${v.id}`,
    source: "youtube",
    title: v.snippet.title,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    thumbnail: (t?.high ?? t?.medium ?? t?.default)?.url ?? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    publishedAt: v.snippet.publishedAt,
    views: Number(v.statistics?.viewCount ?? 0),
    likes: Number(v.statistics?.likeCount ?? 0),
    duration: parseIsoDuration(v.contentDetails.duration),
    tags: [],
    characters: [],
  };
}

export async function fetchYoutube(apiKey: string, deps: { fetch: typeof fetch }): Promise<Video[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = { part: "contentDetails", maxResults: String(BATCH), playlistId: PLAYLIST_ID, key: apiKey };
    if (pageToken) params.pageToken = pageToken;
    const page = await getJson(deps, "playlistItems", params);
    for (const item of page.items ?? []) ids.push(item.contentDetails.videoId);
    pageToken = page.nextPageToken;
  } while (pageToken);

  const videos: Video[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const body = await getJson(deps, "videos", {
      part: "snippet,statistics,contentDetails",
      id: ids.slice(i, i + BATCH).join(","),
      key: apiKey,
    });
    // 削除済み・非公開の動画は videos.list で返ってこないので、ここで自然に落ちる
    for (const v of (body.items ?? []) as YtVideo[]) videos.push(toVideo(v));
  }
  return videos;
}
