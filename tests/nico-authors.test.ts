import { describe, it, expect } from "vitest";
import { resolveNicoAuthors } from "../scripts/nico-authors.ts";
import { makeVideo } from "./helpers.ts";

const user = (id: number, nickname: string) =>
  new Response(JSON.stringify({ meta: { status: 200 }, data: { user: { id, nickname } } }));

function fakeFetch(respond: (url: string) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = (async (input: string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return respond(String(input));
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}
const pending = (id: string, userId: string) => makeVideo({ id, author: { id: `nico:${userId}`, name: "" } });
const noSleep = async () => {};

describe("resolveNicoAuthors", () => {
  it("reuses names from previous data without fetching", async () => {
    const { fetch, calls } = fakeFetch(() => user(1, "x"));
    const out = await resolveNicoAuthors([pending("sm1", "1")], [makeVideo({ id: "sm9", author: { id: "nico:1", name: "のーめ" } })], { fetch, sleep: noSleep });
    expect(out[0].author).toEqual({ id: "nico:1", name: "のーめ" });
    expect(calls).toEqual([]);
  });

  it("fetches each unknown user once from nvapi with the frontend headers", async () => {
    const { fetch, calls } = fakeFetch(() => user(1, "のーめ"));
    const out = await resolveNicoAuthors([pending("sm1", "1"), pending("sm2", "1")], [], { fetch, sleep: noSleep });
    expect(calls.map((c) => c.url)).toEqual(["https://nvapi.nicovideo.jp/v1/users/1"]);
    expect(new Headers(calls[0].init?.headers).get("X-Frontend-Id")).toBe("6");
    expect(out.map((v) => v.author?.name)).toEqual(["のーめ", "のーめ"]);
  });

  it("drops the author when the name cannot be fetched", async () => {
    const { fetch } = fakeFetch(() => new Response("", { status: 404 }));
    const out = await resolveNicoAuthors([pending("sm1", "1")], [], { fetch, sleep: noSleep });
    expect(out[0].author).toBeNull();
  });

  it("waits 1000ms between users", async () => {
    const waits: number[] = [];
    const { fetch } = fakeFetch((url) => user(Number(url.split("/").pop()), "n"));
    await resolveNicoAuthors([pending("sm1", "1"), pending("sm2", "2"), pending("sm3", "3")], [], {
      fetch,
      sleep: async (ms) => void waits.push(ms),
    });
    expect(waits).toEqual([1000, 1000]);
  });
});
