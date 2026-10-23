import { describe, it, expect } from "vitest";
import { normalize } from "../src/normalize.ts";

describe("normalize", () => {
  it("converts hiragana to katakana", () => {
    expect(normalize("ごーるどしっぷ")).toBe("ゴールドシップ");
  });
  it("folds full-width alphanumerics and case", () => {
    expect(normalize("ＭＡＤ")).toBe("mad");
    expect(normalize("音MAD")).toBe("音mad");
  });
  it("converts half-width katakana", () => {
    expect(normalize("ｺﾞｰﾙﾄﾞｼｯﾌﾟ")).toBe("ゴールドシップ");
  });
  it("unifies full-width parentheses", () => {
    expect(normalize("（ウマ娘）")).toBe("(ウマ娘)");
  });
});
