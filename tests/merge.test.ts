import { describe, it, expect } from "vitest";
import { resolveSource, applyExclusions } from "../scripts/merge.ts";
import { makeVideo } from "./helpers.ts";

describe("resolveSource", () => {
  it("uses fetched videos on success", () => {
    const r = resolveSource([makeVideo({ id: "sm2" })], [makeVideo({ id: "sm1" })]);
    expect(r).toEqual({ ok: true, videos: [makeVideo({ id: "sm2" })] });
  });
  it("keeps previous on failure", () => {
    const prev = [makeVideo({ id: "sm1" })];
    expect(resolveSource(null, prev)).toEqual({ ok: false, videos: prev, reason: "failed" });
  });
  it("treats a drop below half as failure", () => {
    const prev = [1, 2, 3, 4, 5].map((n) => makeVideo({ id: `sm${n}` }));
    expect(resolveSource(prev.slice(0, 2), prev)).toEqual({ ok: false, videos: prev, reason: "dropped" });
  });
  it("skips the half check on first run", () => {
    expect(resolveSource([makeVideo()], []).ok).toBe(true);
  });
});

describe("applyExclusions", () => {
  it("removes excluded ids", () => {
    const vs = [makeVideo({ id: "sm1" }), makeVideo({ id: "yt:abc" })];
    expect(applyExclusions(vs, [{ id: "yt:abc", reason: "x" }]).map((v) => v.id)).toEqual(["sm1"]);
  });
});
