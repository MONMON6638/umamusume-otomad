export type Video = {
  id: string; // ニコ動は "sm123"、YouTube は "yt:<videoId>"
  source: "nico" | "youtube";
  title: string;
  url: string;
  thumbnail: string;
  publishedAt: string; // ISO 8601
  views: number;
  likes: number;
  duration: number; // 秒
  tags: string[];
  characters: string[];
  author: Author | null; // 投稿者。公式チャンネルなど取れないときは null
};

export type Author = { id: string; name: string }; // id はニコ動 "nico:<userId>"、YouTube "yt:<channelId>"

export type SourceStatus = { fetchedAt: string; count: number };

export type VideosFile = {
  generatedAt: string;
  sources: { nico: SourceStatus; youtube: SourceStatus };
  videos: Video[];
};

export type ExcludeEntry = { id: string; reason?: string };
