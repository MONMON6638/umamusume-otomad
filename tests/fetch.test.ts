import { describe, it, expect } from "vitest";
import { run, type RunDeps } from "../scripts/fetch.ts";
import { makeVideo } from "./helpers.ts";
import type { VideosFile } from "../src/types.ts";

const NOW = new Date("2026-10-24T06:00:00+09:00");
const fail = async () => { throw new Error("down"); };

function deps(overrides: Partial<RunDeps>): RunDeps {
  return {
    now: () => NOW,
    previous: null,
    exclude: [],
    fetchNico: async () => [],
    fetchYoutube: async () => [],
    ...overrides,
  };
}

function prevFile(videos: VideosFile["videos"]): VideosFile {
  return {
    generatedAt: "2026-10-01T06:00:00+09:00",
    sources: {
      nico: { fetchedAt: "2026-10-01T06:00:00+09:00", count: 1 },
      youtube: { fetchedAt: "2026-10-01T06:00:00+09:00", count: 1 },
    },
    videos,
  };
}

describe("run", () => {
  it("fills YouTube characters from the nico dictionary", async () => {
    const file = await run(deps({
      fetchNico: async () => [makeVideo({ id: "sm1", characters: ["ゴールドシップ"] })],
      fetchYoutube: async () => [makeVideo({ id: "yt:a", source: "youtube", title: "ごーるどしっぷMAD" })],
    }));
    expect(file.videos.find((v) => v.id === "yt:a")?.characters).toEqual(["ゴールドシップ"]);
  });

  it("keeps previous nico videos and fetchedAt when nico fails", async () => {
    const file = await run(deps({
      previous: prevFile([makeVideo({ id: "sm9" })]),
      fetchNico: fail,
    }));
    expect(file.videos.map((v) => v.id)).toContain("sm9");
    expect(file.sources.nico.fetchedAt).toBe("2026-10-01T06:00:00+09:00");
  });

  it("skips YouTube when no API key", async () => {
    const file = await run(deps({
      previous: prevFile([makeVideo({ id: "yt:old", source: "youtube" })]),
      fetchYoutube: null,
    }));
    expect(file.videos.map((v) => v.id)).toContain("yt:old");
  });

  it("applies exclusions and sorts by publishedAt desc", async () => {
    const file = await run(deps({
      exclude: [{ id: "sm2" }],
      fetchNico: async () => [
        makeVideo({ id: "sm1", publishedAt: "2026-01-01T00:00:00+09:00" }),
        makeVideo({ id: "sm2", publishedAt: "2026-03-01T00:00:00+09:00" }),
        makeVideo({ id: "sm3", publishedAt: "2026-02-01T00:00:00+09:00" }),
      ],
    }));
    expect(file.videos.map((v) => v.id)).toEqual(["sm3", "sm1"]);
    expect(file.sources.nico).toEqual({ fetchedAt: NOW.toISOString(), count: 2 });
  });

  it("throws when both fail and there is no previous data", async () => {
    await expect(run(deps({ fetchNico: fail, fetchYoutube: fail }))).rejects.toThrow();
  });
});
