import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildDictionary, matchCharacters } from "./characters.ts";
import { applyExclusions, resolveSource } from "./merge.ts";
import { fetchNico } from "./nico.ts";
import { fetchYoutube } from "./youtube.ts";
import type { ExcludeEntry, Video, VideosFile } from "../src/types.ts";

export type RunDeps = {
  now: () => Date;
  previous: VideosFile | null;
  exclude: ExcludeEntry[];
  fetchNico: () => Promise<Video[]>;
  fetchYoutube: (() => Promise<Video[]>) | null; // API キーが無ければ null
};

async function tryFetch(f: (() => Promise<Video[]>) | null): Promise<Video[] | null> {
  if (!f) return null;
  try {
    return await f();
  } catch {
    return null;
  }
}

export async function run(deps: RunDeps): Promise<VideosFile> {
  const prevVideos = deps.previous?.videos ?? [];
  const nico = resolveSource(await tryFetch(deps.fetchNico), prevVideos.filter((v) => v.source === "nico"));
  const youtube = resolveSource(await tryFetch(deps.fetchYoutube), prevVideos.filter((v) => v.source === "youtube"));
  if (!nico.ok && !youtube.ok && !deps.previous) throw new Error("ニコ動と YouTube の両方の取得に失敗し、前回のデータもありません");

  const dictionary = buildDictionary(nico.videos);
  const ytVideos = youtube.ok
    ? youtube.videos.map((v) => ({ ...v, characters: matchCharacters(v.title, dictionary) }))
    : youtube.videos;

  const nicoKept = applyExclusions(nico.videos, deps.exclude);
  const ytKept = applyExclusions(ytVideos, deps.exclude);
  const now = deps.now().toISOString();
  const status = (ok: boolean, key: "nico" | "youtube", count: number) => ({
    fetchedAt: ok ? now : (deps.previous?.sources[key].fetchedAt ?? ""),
    count,
  });

  return {
    generatedAt: now,
    sources: {
      nico: status(nico.ok, "nico", nicoKept.length),
      youtube: status(youtube.ok, "youtube", ytKept.length),
    },
    videos: [...nicoKept, ...ytKept].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)),
  };
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    // .env が無いのは普通のこと（Actions では Secrets から渡る）
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  const errors: string[] = [];
  // 失敗内容を記録してから run に失敗として伝える
  const logged = (name: string, f: () => Promise<Video[]>) => async () => {
    try {
      return await f();
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
      throw e;
    }
  };

  const file = await run({
    now: () => new Date(),
    previous: await readJson<VideosFile | null>("data/videos.json", null),
    exclude: await readJson<ExcludeEntry[]>("exclude.json", []),
    fetchNico: logged("nico", () => fetchNico({ fetch, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) })),
    fetchYoutube: apiKey ? logged("youtube", () => fetchYoutube(apiKey, { fetch })) : null,
  });
  await writeFile("data/videos.json", JSON.stringify(file, null, 2) + "\n");

  if (!apiKey) console.log("youtube: API キーが無いので飛ばしました（前回のデータを残します）");
  for (const e of errors) console.error(`取得失敗 ${e}`);
  console.log(`nico: ${file.sources.nico.count}件 / youtube: ${file.sources.youtube.count}件`);
  if (errors.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
