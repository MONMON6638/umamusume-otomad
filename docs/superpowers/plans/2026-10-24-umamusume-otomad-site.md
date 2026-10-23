# ウマ娘音MADまとめサイト 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ニコ動と YouTube からウマ娘の音MADを毎日自動で集め、検索・絞り込み・サイト内再生ができる静的サイトを GitHub Pages で公開する。

**Architecture:** Node の取得スクリプト（`scripts/`）が両サイトの API から動画を集め、`data/videos.json` に書き出す。Vite でビルドする1ページのサイト（`src/`）がその JSON を読み込み、ブラウザ内で検索・並べ替えをする。GitHub Actions が毎日、取得→コミット→ビルド→公開を回す。

**Tech Stack:** TypeScript（型除去で動く書き方のみ）、Node 22.16（手元）／24（Actions）、Vite、Vitest、GitHub Actions、GitHub Pages

**Spec:** `docs/superpowers/specs/2026-10-24-umamusume-otomad-site-design.md`

## Global Constraints

- 実行時の外部ライブラリは使わない。devDependencies は `vite`、`typescript`（5.8 以上）、`vitest` のみ
- enum・namespace・コンストラクタ引数のプロパティ宣言など、型除去で動かない構文は使わない（`tsconfig` の `erasableSyntaxOnly: true` で強制する）
- import は拡張子 `.ts` まで書く（Node の型除去実行が必要とするため）
- 取得スクリプトの実行: `node --experimental-strip-types scripts/fetch.ts`
- ニコ動 API: `https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search`、`targets=tagsExact`、`_sort=-startTime`（必須）、`_limit=100`、`_context=umamusume-otomad`、問い合わせの間は 1000ms 空ける
- ニコ動の問い合わせは `ウマ娘 音MAD` と `ウマ娘プリティーダービー 音MAD` の2本
- YouTube 再生リスト ID: `PLr6e2du4c5xBxBP4WkmVZPRKVAa0qgC8h`、API キーは環境変数 `YOUTUBE_API_KEY`
- 動画 ID: ニコ動は `sm…` のまま、YouTube は `yt:<videoId>`
- 一覧は 60件ずつ表示する
- 埋め込み: `https://embed.nicovideo.jp/watch/<id>`、`https://www.youtube-nocookie.com/embed/<videoId>`
- URL のクエリ: `q`、`src`（`nico`／`youtube`）、`sort`（`new`／`views`／`likes`）、`chara`。既定値は書かない
- 動画データ（タイトルなど）を DOM に入れるときは必ず `textContent` か属性で入れる。`innerHTML` に動画データを渡さない
- 公式のロゴやキャラ画像は使わない
- Actions の定期実行: cron `0 21 * * *`（日本時間 6時）

## Review Focus

1. **ニコ動 API が HTTP 200 なのに `meta.status` がエラー（メンテナンス中の 503 など）を返す** → 取得失敗として扱い、前回のデータを残す（Task 3 のテスト `throws when meta.status is not 200`）
2. **再生リストに削除済み・非公開の動画が混ざっている** → `videos.list` で返ってこない ID は一覧から外す（Task 4 のテスト `drops videos missing from videos.list`）
3. **タイトルに `<img onerror=…>` のような HTML が入っている** → 文字としてそのまま表示し、実行されない（Task 8 の確認手順と `innerHTML` 検査）
4. **検索語が `(` や `*` などの記号だけ、または空白だけ** → エラーにならず、空白だけなら全件を出す（Task 6 のテスト `treats regex characters literally`、`ignores whitespace-only query`）
5. **URL の `chara` や `sort` に存在しない値が入っている** → `sort` は既定値に戻し、`chara` は0件表示と「見つかりませんでした」の文言を出す（Task 6 のテスト `falls back to default sort`、Task 8 の確認手順）

---

## ファイル構成

設計書 6章の構成に、次の2ファイルを足す。

- `src/types.ts` … `Video`・`VideosFile`・`ExcludeEntry` の型。取得スクリプトとサイトで共用する
- `src/format.ts` … 数値・長さ・日付の表示用文字列と埋め込み URL。DOM を使わない純粋な関数なのでテストしやすい

テストは `tests/<対象ファイル名>.test.ts` に置き、テスト用の動画を作る `tests/helpers.ts` を共用する。

---

### Task 1: プロジェクトの土台と表記ゆれの吸収

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.gitattributes`, `src/types.ts`, `src/normalize.ts`, `tests/helpers.ts`
- Test: `tests/normalize.test.ts`

**Interfaces:**
- Produces:
  - `src/types.ts`: `Video`、`VideosFile`、`ExcludeEntry = { id: string; reason?: string }`（`Video` と `VideosFile` は設計書 3.1・3.2 の形のまま）
  - `normalize(s: string): string`
  - `tests/helpers.ts`: `makeVideo(overrides?: Partial<Video>): Video`（既定値は `id: "sm1"`, `source: "nico"`, `title: "テスト"`, `publishedAt: "2026-01-01T00:00:00+09:00"`, 数値は 0、配列は空）

- [ ] **Step 1: 設定ファイルを作る**
  - `package.json`: `"type": "module"`、`"private": true`。scripts は `dev: "vite"`、`build: "tsc --noEmit && vite build"`、`test: "vitest run"`、`fetch: "node --experimental-strip-types scripts/fetch.ts"`
  - `npm install -D vite typescript vitest`
  - `tsconfig.json`: `target: "ES2022"`、`module: "ESNext"`、`moduleResolution: "bundler"`、`strict: true`、`noEmit: true`、`allowImportingTsExtensions: true`、`erasableSyntaxOnly: true`、`verbatimModuleSyntax: true`、`resolveJsonModule: true`、`types: ["node", "vite/client"]`、`include: ["src", "scripts", "tests"]`（`@types/node` が必要なら devDependencies に足してよい）
  - `vite.config.ts`: `base: "./"`（どの Pages のパスでも動くようにする）
  - `.gitignore`: `node_modules/`、`dist/`、`.env`
  - `.gitattributes`: `* text=auto eol=lf`

- [ ] **Step 2: 失敗するテストを書く**

```ts
// tests/normalize.test.ts
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
```

- [ ] **Step 3: 失敗を確認する**

Run: `npx vitest run tests/normalize.test.ts`
Expected: FAIL（`normalize` が無い）

- [ ] **Step 4: `normalize(s: string): string` を `src/normalize.ts` に実装する**

NFKC 正規化 → `toLowerCase()` → ひらがな（U+3041〜U+3096）に 0x60 を足してカタカナにする。

- [ ] **Step 5: 成功を確認する**

Run: `npx vitest run tests/normalize.test.ts`
Expected: PASS（4件）

- [ ] **Step 6: コミットする**

```bash
git add -A
git commit -m "chore: プロジェクトの土台と表記ゆれの吸収を追加"
```

---

### Task 2: キャラの判定

**Files:**
- Create: `scripts/characters.ts`
- Test: `tests/characters.test.ts`

**Interfaces:**
- Consumes: `normalize`（Task 1）、`Video`
- Produces:
  - `extractCharacters(tags: string[]): string[]` … `〇〇(ウマ娘)`／`〇〇（ウマ娘）` から `〇〇` を取り出す。重複なし
  - `buildDictionary(videos: Video[]): string[]` … 全動画の `characters` を重複なしで集める
  - `matchCharacters(title: string, dictionary: string[]): string[]` … 正規化したタイトルに正規化した名前が含まれるものを返す。正規化後 3文字未満の名前は使わない。返すのは辞書に載っている元の表記

- [ ] **Step 1: 失敗するテストを書く**

```ts
// tests/characters.test.ts
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
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run tests/characters.test.ts`
Expected: FAIL（モジュールが無い）

- [ ] **Step 3: 3つの関数を `scripts/characters.ts` に実装する**

`extractCharacters` は正規表現 `/^(.+)[(（]ウマ娘[)）]$/` で取り出す。

- [ ] **Step 4: 成功を確認する**

Run: `npx vitest run tests/characters.test.ts`
Expected: PASS（6件）

- [ ] **Step 5: コミットする**

```bash
git add scripts/characters.ts tests/characters.test.ts
git commit -m "feat: タグとタイトルからキャラを判定する"
```

---

### Task 3: ニコ動の取得

**Files:**
- Create: `scripts/nico.ts`, `tests/fixtures/nico-response.json`
- Test: `tests/nico.test.ts`

**Interfaces:**
- Consumes: `extractCharacters`（Task 2）、`Video`
- Produces:
  - `type NicoDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void> }`
  - `fetchNico(deps: NicoDeps): Promise<Video[]>` … 2本の問い合わせを全ページ取り、`id` で重複を除いて返す。`meta.status !== 200` か HTTP エラーなら throw する
  - `nicoToVideo(raw: NicoItem): Video`（`NicoItem` は API の1件ぶんの型）

- [ ] **Step 1: API の返答サンプルを保存する**

Run:
```bash
curl -s -A "umamusume-otomad/dev" "https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search?q=%E3%82%A6%E3%83%9E%E5%A8%98%20%E9%9F%B3MAD&targets=tagsExact&fields=contentId,title,viewCounter,likeCounter,commentCounter,startTime,tags,thumbnailUrl,lengthSeconds&_sort=-startTime&_limit=2&_context=umamusume-otomad" > tests/fixtures/nico-response.json
```
Expected: `meta.status` が 200 で、`data` に2件入った JSON（Windows の Git Bash では日本語をそのまま渡すと文字化けで 0件になるので、上のように URL エンコード済みで渡す）

- [ ] **Step 2: 失敗するテストを書く**

偽の `fetch` を使う。呼ばれた URL を記録し、1回目は保存したサンプル、それ以降は `data: []` を返す。`sleep` は何もしない。

```ts
// tests/nico.test.ts の主なテスト
it("maps an item to Video", () => {
  const v = nicoToVideo(sample.data[0]);
  expect(v.id).toBe(sample.data[0].contentId);
  expect(v.source).toBe("nico");
  expect(v.url).toBe(`https://www.nicovideo.jp/watch/${sample.data[0].contentId}`);
  expect(v.tags).toEqual(sample.data[0].tags.split(" "));
  expect(v.duration).toBe(sample.data[0].lengthSeconds);
  expect(v.likes).toBe(sample.data[0].likeCounter);
});
it("sends both queries with required params", async () => {
  // 記録した URL を URLSearchParams で読み、次を確認する
  // q が "ウマ娘 音MAD" と "ウマ娘プリティーダービー 音MAD" の2種類
  // targets=tagsExact、_sort=-startTime、_limit=100、_context=umamusume-otomad
  // headers に User-Agent がある
});
it("pages with _offset until a short page", async () => {
  // 1回目に100件（サンプルを id を変えて複製）、2回目に0件を返す偽 fetch
  // → 1本目の問い合わせで _offset=0 と _offset=100 が呼ばれる
});
it("dedupes videos found by both queries", async () => {
  // 両方の問い合わせに同じサンプルを返す → 結果は2件
});
it("throws when meta.status is not 200", async () => {
  // { meta: { status: 503 } } を返す偽 fetch → rejects.toThrow()
});
it("waits between requests", async () => {
  // sleep が 1000 で、リクエスト数 - 1 回以上呼ばれる
});
```

- [ ] **Step 3: 失敗を確認する**

Run: `npx vitest run tests/nico.test.ts`
Expected: FAIL（モジュールが無い）

- [ ] **Step 4: `nicoToVideo` と `fetchNico` を `scripts/nico.ts` に実装する**

- `characters` は `extractCharacters(tags)`
- `User-Agent` は `umamusume-otomad/1.0 (+https://github.com/${process.env.GITHUB_REPOSITORY})`。`GITHUB_REPOSITORY` が無い手元では `umamusume-otomad/1.0 (local)`

- [ ] **Step 5: 成功を確認する**

Run: `npx vitest run tests/nico.test.ts`
Expected: PASS（6件）

- [ ] **Step 6: コミットする**

```bash
git add scripts/nico.ts tests/nico.test.ts tests/fixtures/nico-response.json
git commit -m "feat: ニコ動から動画を取得する"
```

---

### Task 4: YouTube の取得

**Files:**
- Create: `scripts/youtube.ts`, `tests/fixtures/yt-playlist-items.json`, `tests/fixtures/yt-videos.json`
- Test: `tests/youtube.test.ts`

**Interfaces:**
- Consumes: `Video`
- Produces:
  - `parseIsoDuration(s: string): number` … `"PT1M17S"` → 77、`"PT1H2M3S"` → 3723、`"P0D"` → 0
  - `fetchYoutube(apiKey: string, deps: { fetch: typeof fetch }): Promise<Video[]>` … `characters` は空配列で返す（Task 5 で埋める）

- [ ] **Step 1: 返答サンプルを手で作る**

API キーがまだ無いので、公式の返答の形に合わせて作る。
- `yt-playlist-items.json`: `items` 3件（うち1件はタイトル `"Deleted video"`）、`nextPageToken` なし
- `yt-videos.json`: 2件だけ（削除済みの1件は返さない）。1件は `statistics.likeCount` を省く（いいね数を非表示にしている動画）

- [ ] **Step 2: 失敗するテストを書く**

```ts
// tests/youtube.test.ts の主なテスト
it("parses ISO 8601 durations", () => {
  expect(parseIsoDuration("PT1M17S")).toBe(77);
  expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
  expect(parseIsoDuration("P0D")).toBe(0);
});
it("maps videos with yt: prefix and watch url", async () => {
  // id === "yt:<videoId>"、url === "https://www.youtube.com/watch?v=<videoId>"
  // source === "youtube"、tags と characters は []
});
it("drops videos missing from videos.list", async () => {
  // 結果は2件
});
it("treats hidden like count as 0", async () => { /* likes === 0 */ });
it("follows nextPageToken", async () => {
  // 1ページ目に nextPageToken: "p2" → 2回目の playlistItems 呼び出しに pageToken=p2
});
it("throws on HTTP error", async () => { /* 403 を返す偽 fetch → rejects.toThrow() */ });
```

- [ ] **Step 3: 失敗を確認する**

Run: `npx vitest run tests/youtube.test.ts`
Expected: FAIL

- [ ] **Step 4: `parseIsoDuration` と `fetchYoutube` を `scripts/youtube.ts` に実装する**

- `playlistItems.list`: `part=contentDetails`、`maxResults=50`、`playlistId`、`key`
- `videos.list`: `part=snippet,statistics,contentDetails`、`id` は50件ずつカンマ区切り
- サムネイルは `thumbnails.high` → `medium` → `default` の順で最初にあるもの。どれも無ければ `https://i.ytimg.com/vi/<videoId>/hqdefault.jpg`

- [ ] **Step 5: 成功を確認する**

Run: `npx vitest run tests/youtube.test.ts`
Expected: PASS（6件）

- [ ] **Step 6: コミットする**

```bash
git add scripts/youtube.ts tests/youtube.test.ts tests/fixtures/yt-*.json
git commit -m "feat: YouTube 再生リストから動画を取得する"
```

---

### Task 5: まとめと書き出し

**Files:**
- Create: `scripts/merge.ts`, `scripts/fetch.ts`, `exclude.json`（中身は `[]`）
- Test: `tests/merge.test.ts`, `tests/fetch.test.ts`

**Interfaces:**
- Consumes: `fetchNico`（Task 3）、`fetchYoutube`（Task 4）、`buildDictionary`・`matchCharacters`（Task 2）
- Produces:
  - `resolveSource(fetched: Video[] | null, previous: Video[]): { videos: Video[]; ok: boolean }` … `null` は取得失敗。`previous.length > 0` かつ `fetched.length < previous.length / 2` も失敗。失敗時は `previous` を返す
  - `applyExclusions(videos: Video[], exclude: ExcludeEntry[]): Video[]`
  - `type RunDeps = { now: () => Date; previous: VideosFile | null; exclude: ExcludeEntry[]; fetchNico: () => Promise<Video[]>; fetchYoutube: (() => Promise<Video[]>) | null }`（キーが無ければ `fetchYoutube` は `null`）
  - `run(deps: RunDeps): Promise<VideosFile>` … 両方失敗し、前回のデータも無ければ throw する

- [ ] **Step 1: `merge.ts` の失敗するテストを書く**

```ts
// tests/merge.test.ts
it("uses fetched videos on success", () => {
  const r = resolveSource([makeVideo({ id: "sm2" })], [makeVideo({ id: "sm1" })]);
  expect(r).toEqual({ ok: true, videos: [makeVideo({ id: "sm2" })] });
});
it("keeps previous on failure", () => {
  const prev = [makeVideo({ id: "sm1" })];
  expect(resolveSource(null, prev)).toEqual({ ok: false, videos: prev });
});
it("treats a drop below half as failure", () => {
  const prev = [1, 2, 3, 4, 5].map((n) => makeVideo({ id: `sm${n}` }));
  expect(resolveSource(prev.slice(0, 2), prev).ok).toBe(false);
});
it("skips the half check on first run", () => {
  expect(resolveSource([makeVideo()], []).ok).toBe(true);
});
it("removes excluded ids", () => {
  const vs = [makeVideo({ id: "sm1" }), makeVideo({ id: "yt:abc" })];
  expect(applyExclusions(vs, [{ id: "yt:abc", reason: "x" }]).map((v) => v.id)).toEqual(["sm1"]);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run tests/merge.test.ts`
Expected: FAIL

- [ ] **Step 3: `resolveSource` と `applyExclusions` を `scripts/merge.ts` に実装する**

- [ ] **Step 4: 成功を確認する**

Run: `npx vitest run tests/merge.test.ts`
Expected: PASS（5件）

- [ ] **Step 5: `run` の失敗するテストを書く**

```ts
// tests/fetch.test.ts
it("fills YouTube characters from the nico dictionary", async () => {
  // fetchNico → [characters: ["ゴールドシップ"]]、fetchYoutube → [title: "ごーるどしっぷMAD"]
  // → YouTube 側の characters が ["ゴールドシップ"]
});
it("keeps previous nico videos and fetchedAt when nico fails", async () => {
  // fetchNico が reject、previous に nico 1件・fetchedAt "2026-10-01T…"
  // → videos にその1件が残り、sources.nico.fetchedAt は前回の値のまま
});
it("skips YouTube when no API key", async () => {
  // fetchYoutube: null、previous に YouTube 1件 → その1件が残る
});
it("applies exclusions and sorts by publishedAt desc", async () => { /* … */ });
it("throws when both fail and there is no previous data", async () => {
  // fetchNico も fetchYoutube も reject、previous: null → rejects.toThrow()
});
```

- [ ] **Step 6: 失敗を確認する**

Run: `npx vitest run tests/fetch.test.ts`
Expected: FAIL

- [ ] **Step 7: `run` と入口処理を `scripts/fetch.ts` に実装する**

- `run` の流れ
  1. 前回データを `source` ごとに分ける
  2. それぞれ取得して `resolveSource` にかける
  3. ニコ動の動画から辞書を作り、成功した YouTube の動画の `characters` を埋める
  4. まとめて除外し、`publishedAt` の新しい順に並べる
  5. `sources.*.count` は除外後の件数。`fetchedAt` は成功したサイトだけ `now()` にし、失敗したサイトは前回の値を残す
- 入口処理は `import.meta.url` がこのファイルのときだけ動かす（テストから import しても動かないようにする）
  - `process.loadEnvFile()` で `.env` を読む。ファイルが無くても止まらないよう try で囲む
  - `data/videos.json` と `exclude.json` を読む
  - 結果を `JSON.stringify(file, null, 2)` + 改行で書く
  - サイトごとの成否と件数を `console.log` する
  - 失敗したら `process.exitCode = 1` にする

- [ ] **Step 8: 成功を確認する**

Run: `npm test`
Expected: すべて PASS

- [ ] **Step 9: 本物の API で動かす**

Run: `npm run fetch`
Expected:
- ニコ動が成功し、件数が約2,700件
- YouTube は「API キーなし」で飛ばされる
- `data/videos.json` ができる
- 終了コードは 0（ニコ動が成功しているため）

- [ ] **Step 10: コミットする**

```bash
git add scripts/merge.ts scripts/fetch.ts exclude.json data/videos.json tests/merge.test.ts tests/fetch.test.ts
git commit -m "feat: 取得結果をまとめて data/videos.json に書き出す"
```

---

### Task 6: 検索・絞り込み・URL の状態

**Files:**
- Create: `src/filter.ts`, `src/url-state.ts`
- Test: `tests/filter.test.ts`, `tests/url-state.test.ts`

**Interfaces:**
- Consumes: `normalize`、`Video`
- Produces:
  - `type State = { q: string; src: "all" | "nico" | "youtube"; sort: "new" | "views" | "likes"; chara: string }`
  - `DEFAULT_STATE: State`（`{ q: "", src: "all", sort: "new", chara: "" }`）
  - `type Indexed = { video: Video; haystack: string }`
  - `indexVideos(videos: Video[]): Indexed[]` … `haystack` は title・characters・tags を空白でつないで正規化したもの
  - `filterVideos(items: Indexed[], state: State): Video[]`
  - `characterCounts(videos: Video[]): { name: string; count: number }[]` … 件数の多い順。同数なら名前順
  - `parseState(search: string): State`、`stringifyState(state: State): string`（先頭に `?` を付ける。全部既定値なら `""`）

- [ ] **Step 1: 失敗するテストを書く**

```ts
// tests/filter.test.ts の主なテスト
it("ANDs space-separated terms across title, characters and tags", () => {
  // title "ばりめん", characters ["ウインバリアシオン"], tags ["音MAD"]
  // q "ういんばり 音mad" → ヒット、q "ういんばり 合作" → 0件
});
it("treats regex characters literally", () => {
  expect(() => filterVideos(items, { ...DEFAULT_STATE, q: "(*" })).not.toThrow();
});
it("ignores whitespace-only query", () => {
  // q "   " → 全件
});
it("filters by source and exact character", () => { /* … */ });
it("sorts by views, likes and newest", () => { /* … */ });
it("counts characters", () => {
  // [{name:"A",count:2},{name:"B",count:1}]
});

// tests/url-state.test.ts
it("round-trips Japanese values", () => {
  const s = { ...DEFAULT_STATE, chara: "ゴールドシップ", sort: "views" as const };
  expect(parseState(stringifyState(s))).toEqual(s);
});
it("omits defaults", () => {
  expect(stringifyState(DEFAULT_STATE)).toBe("");
});
it("falls back to default sort", () => {
  expect(parseState("?sort=bogus&src=x").sort).toBe("new");
  expect(parseState("?sort=bogus&src=x").src).toBe("all");
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run tests/filter.test.ts tests/url-state.test.ts`
Expected: FAIL

- [ ] **Step 3: `src/filter.ts` と `src/url-state.ts` を実装する**

検索語の照合は `String.prototype.includes` で行い、正規表現は使わない。

- [ ] **Step 4: 成功を確認する**

Run: `npx vitest run tests/filter.test.ts tests/url-state.test.ts`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/filter.ts src/url-state.ts tests/filter.test.ts tests/url-state.test.ts
git commit -m "feat: 検索・絞り込み・URL での状態共有"
```

---

### Task 7: 表示用の整形と埋め込み URL

**Files:**
- Create: `src/format.ts`
- Test: `tests/format.test.ts`

**Interfaces:**
- Produces:
  - `formatCount(n: number): string` … 9999 → `"9,999"`、12345 → `"1.2万"`、123456789 → `"1.2億"`
  - `formatDuration(sec: number): string` … 77 → `"1:17"`、3723 → `"1:02:03"`
  - `formatDate(iso: string): string` … `"2026-10-16T23:54:37+09:00"` → `"2026/10/16"`（日本時間で表示）
  - `embedUrl(video: Video): string` … 設計書 4.2 の URL。YouTube は `yt:` を外す。末尾に `?autoplay=1` を付ける

- [ ] **Step 1: 上の例をそのまま `tests/format.test.ts` のテストにする**
- [ ] **Step 2: 失敗を確認する** — Run: `npx vitest run tests/format.test.ts` / Expected: FAIL
- [ ] **Step 3: `src/format.ts` を実装する**（日付は `Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo" })` を使う）
- [ ] **Step 4: 成功を確認する** — Run: `npx vitest run tests/format.test.ts` / Expected: PASS
- [ ] **Step 5: コミットする**

```bash
git add src/format.ts tests/format.test.ts
git commit -m "feat: 表示用の整形と埋め込み URL"
```

---

### Task 8: 画面

**Files:**
- Create: `index.html`, `src/main.ts`, `src/render.ts`, `src/player.ts`, `src/style.css`, `src/vite-env.d.ts`
- Modify: `vite.config.ts`（`define` を足す）

**Interfaces:**
- Consumes: Task 6・7 のすべて、`data/videos.json`（`import videosFile from "../data/videos.json"` で取り込む）
- Produces:
  - `renderCards(container: HTMLElement, videos: Video[], onOpen: (v: Video) => void): void` … 追記する（既存のカードは消さない）
  - `openPlayer(video: Video): void`
  - `vite.config.ts` の `define: { __REPO_URL__ }` … ビルド時の `process.env.GITHUB_REPOSITORY` から `https://github.com/<repo>` を作る。無ければ `""`

- [ ] **Step 1: `index.html` と `src/style.css` を作る**
  - 構成は `header`（操作バー）、`main`（件数表示・一覧・「もっと見る」・0件時の文言）、`footer`、`dialog`（再生用）
  - 色は `:root` の CSS 変数で決め、`@media (prefers-color-scheme: dark)` でダーク用に差し替える
  - 一覧は `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`。360px 幅で横スクロールが出ないようにする
  - サムネイルは `aspect-ratio: 16 / 9` で `object-fit: cover`、`loading="lazy"`

- [ ] **Step 2: `src/render.ts` を実装する**
  - カードは `<button>` にする（キーボードでも開けるように）
  - 文字はすべて `textContent` で入れる

- [ ] **Step 3: `src/player.ts` を実装する**
  - `<dialog>` の `showModal()` で開き、中に `<iframe allow="autoplay; fullscreen" allowfullscreen>` を作る
  - 閉じ方は3つ:Esc、背景のクリック、閉じるボタン
  - 閉じたら iframe を取り除き、再生を止める
  - 元ページへのリンクを付け、`target="_blank" rel="noopener"` で開く

- [ ] **Step 4: `src/main.ts` で配線する**
  - 起動
    1. `parseState(location.search)` で状態を読む
    2. 操作バーの各部品にその値を入れる
    3. 描画する
  - 操作が変わったとき
    1. 状態を更新する
    2. `history.replaceState` で URL を書き換える
    3. 一覧を作り直す
  - 一覧は 60件ずつ出す。キーワード入力だけは 150ms 待ってから反映する
  - キャラ選択は `<input list>` + `<datalist>` で作り、候補を「名前（件数）」の形で出す。入力が辞書に完全一致したときだけ `chara` を決める。空欄にしたら解除する
  - 0件のときは「見つかりませんでした」を出し、「もっと見る」を隠す
  - フッター
    - 「各動画の権利は投稿者に帰属します」
    - `__REPO_URL__` があれば `<__REPO_URL__>/issues` へのリンク「掲載の取り下げ依頼」
    - `generatedAt` を `formatDate` で出す

- [ ] **Step 5: 型とテストを確認する**

Run: `npm run build && npm test`
Expected:
- ビルドが成功する
- テストはすべて PASS

- [ ] **Step 6: `innerHTML` に動画データを渡していないか確認する**

Run: `grep -n "innerHTML" src/*.ts`
Expected: 一致なし、または固定の文字列を入れている箇所だけ

- [ ] **Step 7: ブラウザで確認する**（`npm run dev` を開く）

次をすべて確かめる。
- 一覧が出て、件数表示が `data/videos.json` の件数と合う
- 「もっと見る」で 60件ずつ増える
- 検索
  - 「ごーるど」でゴールドシップの動画が出る
  - 「(*」でもエラーが出ない
- 絞り込みと並び順
  - キャラ選択と並び順を変えると URL が変わる
  - その URL を読み直すと同じ状態に戻る
- `?chara=存在しない名前` で「見つかりませんでした」が出る
- 再生
  - カードを押すとニコ動の埋め込みプレーヤーで再生される
  - Esc で閉じると音が止まる
- タイトルの安全性:`data/videos.json` を一時的に書き換え、タイトルに `<img src=x onerror=alert(1)>` を入れる
  - 文字のまま表示され、アラートは出ない
  - 確認したら元に戻す
- スマホ幅（375px）で横スクロールが出ない
- ダークモードで文字が読める

- [ ] **Step 8: コミットする**

```bash
git add index.html src vite.config.ts
git commit -m "feat: 一覧・検索・再生の画面"
```

---

### Task 9: 自動更新と公開の準備

**Files:**
- Create: `.github/workflows/update.yml`, `README.md`

**Interfaces:**
- Consumes: `npm test`、`npm run fetch`、`npm run build`（出力は `dist/`）

- [ ] **Step 1: `.github/workflows/update.yml` を書く**
  - `on`: `schedule`（cron `0 21 * * *`）、`push`（`branches: [main]`）、`workflow_dispatch`
  - `permissions`: `contents: write`、`pages: write`、`id-token: write`
  - `concurrency`: `group: update`、`cancel-in-progress: false`
  - job `build` の手順
    1. `actions/checkout`
    2. `actions/setup-node`（`node-version: 24`、`cache: npm`）
    3. `npm ci`
    4. `npm test`
    5. `npm run fetch`（`env: YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}`）
    6. `data/videos.json` に差分があれば `github-actions[bot]` の名前でコミットして push する
    7. `npm run build`
    8. `actions/upload-pages-artifact`（`path: dist`）
  - job `deploy`: `needs: build`、`environment: github-pages`、`actions/deploy-pages`
  - 取得が失敗しても（終了コード 1）、前回データでビルドと公開は続ける。`npm run fetch` に `continue-on-error: true` を付ける。失敗は Actions の画面に警告として残る

- [ ] **Step 2: `README.md` を書く**

次を手順として書く。
- 手元での動かし方:`npm install`、`.env` に `YOUTUBE_API_KEY=...`、`npm run fetch`、`npm run dev`
- YouTube API キーの作り方
  1. Google Cloud Console でプロジェクトを作る
  2. YouTube Data API v3 を有効にする
  3. 認証情報で API キーを作る
  4. 「API の制限」で YouTube Data API v3 だけに絞る
- GitHub の設定
  - Settings → Secrets and variables → Actions に `YOUTUBE_API_KEY` を登録する
  - Settings → Pages の Source を「GitHub Actions」にする
- 除外のしかた:`exclude.json` に `{ "id": "sm…", "reason": "…" }` を足してコミットする

- [ ] **Step 3: ワークフローを読み直す**

Step 1 の箇条書きと1項目ずつ突き合わせる。`secrets.YOUTUBE_API_KEY` の綴り、`path: dist`、`environment: github-pages` が合っているか確認する。実際に動くかどうかは、Step 5 の初回実行で確認する。

- [ ] **Step 4: コミットする**

```bash
git add .github README.md
git commit -m "ci: 毎日の取得と GitHub Pages への公開"
```

- [ ] **Step 5: 公開について、ユーザーに確認する（ここで止まる）**

GitHub リポジトリの作成、push、Secrets と Pages の設定は、ユーザーのアカウントで行う外向きの操作になる。次の2つをユーザーに尋ね、OK をもらってから進める。
- GitHub のユーザー名と、使うリポジトリ名
- `gh` で作成と push をこちらで行うか、ユーザー自身で行うか

push したら、Actions の初回実行が成功し、Pages の URL でサイトが開けることを確認する。
