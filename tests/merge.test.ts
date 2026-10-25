import { describe, it, expect } from "vitest";
import { resolveSource, applyExclusions, applyNgTags } from "../scripts/merge.ts";
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

describe("applyNgTags", () => {
  const rule = { tags: ["真夏の夜の淫夢", "例のアレ"], keep: ["sm9"] };
  const dict = ["ゴールドシップ", "サクラチヨノオー"];
  const ids = (vs: { id: string }[]) => vs.map((v) => v.id);

  it("removes a video with an NG tag and no character", () => {
    expect(applyNgTags([makeVideo({ id: "sm1", tags: ["音MAD", "例のアレ"] })], rule, dict)).toEqual([]);
  });
  it("keeps it when it has a character tag", () => {
    const v = makeVideo({ id: "sm2", tags: ["例のアレ"], characters: ["ゴールドシップ"] });
    expect(ids(applyNgTags([v], rule, dict))).toEqual(["sm2"]);
  });
  it("keeps it when the title names a character", () => {
    const v = makeVideo({ id: "sm3", title: "【ウマ娘】サクラチヨノオーのバグ", tags: ["例のアレ"] });
    expect(ids(applyNgTags([v], rule, dict))).toEqual(["sm3"]);
  });
  it("keeps ids listed in keep", () => {
    expect(ids(applyNgTags([makeVideo({ id: "sm9", tags: ["真夏の夜の淫夢"] })], rule, dict))).toEqual(["sm9"]);
  });
  it("keeps videos without NG tags", () => {
    expect(ids(applyNgTags([makeVideo({ id: "sm4", tags: ["東方競馬娘"] })], rule, dict))).toEqual(["sm4"]);
  });
});
