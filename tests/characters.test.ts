import { describe, it, expect } from "vitest";
import { extractCharacters, buildDictionary, matchCharacters } from "../scripts/characters.ts";
import { makeVideo } from "./helpers.ts";

describe("extractCharacters", () => {
  it("takes names from (ウマ娘) tags in both paren widths", () => {
    expect(extractCharacters(["音MAD", "ヒシミラクル(ウマ娘)", "ゴールドシップ（ウマ娘）", "ウマ娘"]))
      .toEqual(["ヒシミラクル", "ゴールドシップ"]);
  });
  it("ignores tags that are only the suffix", () => {
    expect(extractCharacters(["(ウマ娘)"])).toEqual([]);
  });
});

describe("buildDictionary", () => {
  it("collects unique names", () => {
    const videos = [
      makeVideo({ characters: ["ゴールドシップ"] }),
      makeVideo({ characters: ["ゴールドシップ", "キタサンブラック"] }),
    ];
    expect(buildDictionary(videos).sort()).toEqual(["キタサンブラック", "ゴールドシップ"]);
  });
});

describe("matchCharacters", () => {
  const dict = ["ゴールドシップ", "キタサンブラック", "ネオ"];
  it("matches across hiragana/katakana", () => {
    expect(matchCharacters("【音MAD】ごーるどしっぷ伝説", dict)).toEqual(["ゴールドシップ"]);
  });
  it("skips names shorter than 3 characters", () => {
    expect(matchCharacters("ネオ東京", dict)).toEqual([]);
  });
  it("returns empty when nothing matches", () => {
    expect(matchCharacters("Miler Dancer", dict)).toEqual([]);
  });
});
