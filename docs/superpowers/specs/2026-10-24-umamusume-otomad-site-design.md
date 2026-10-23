# ウマ娘音MADまとめサイト 設計書

- 作成日: 2026-10-24
- 状態: レビュー待ち

## 1. 目的

ウマ娘の音MADだけを集めた公開サイトを作る。ニコニコ動画と YouTube から自動で動画を集め、見る人が新着・人気順で眺めたり、キャラ別に絞り込んだり、キーワードで探したりして、サイト内でそのまま再生できるようにする。

### 成功の条件

- ニコ動の対象動画（約2,700件）と YouTube 再生リストの動画（約878本）が一覧に出ている
- 新着・再生数・いいね数で並べ替えられる
- キャラ別の絞り込みとキーワード検索ができる
- カードを押すとサイト内の埋め込みプレーヤーで再生できる
- 毎日自動で新しい動画が追加され、手作業は除外リストの編集だけで済む
- 費用がかからない（GitHub Pages と GitHub Actions の無料枠に収まる）

## 2. 取得元

### 2.1 ニコニコ動画

公式のスナップショット検索 API v2 を使う。

- エンドポイント: `https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search`
- 問い合わせは次の2本で、結果を `contentId` で重複除去してまとめる。
  1. `q=ウマ娘 音MAD`（2026-10-24 時点で 581件）
  2. `q=ウマ娘プリティーダービー 音MAD`（同 1,593件。うち「ウマ娘」タグなしが 1,124件）
- 共通パラメータ
  - `targets=tagsExact`（タグ完全一致。q 内の空白は AND）
  - `fields=contentId,title,viewCounter,likeCounter,commentCounter,startTime,tags,thumbnailUrl,lengthSeconds`
  - `_sort=-startTime`（`_sort` は必須。無いと 400 になる）
  - `_limit=100`、`_offset` を 100 ずつ進めて全件取得する
  - `_context=umamusume-otomad`、`User-Agent` に連絡先を示すリポジトリ URL を入れる
- 調査時の注意
  - API は CORS ヘッダーを返さないため、ブラウザから直接は呼べない。取得はビルド時に行う
  - `OR` 構文は今回の書き方では 0件になったため、使わずに2本の問い合わせに分ける
  - データは毎日 5時ごろ（日本時間）に更新される
- 問い合わせは1件ずつ順番に送り、間に 1秒の待ち時間を入れる

### 2.2 YouTube

YouTube Data API v3 で、指定の再生リストを取得する。

- 再生リスト ID: `PLr6e2du4c5xBxBP4WkmVZPRKVAa0qgC8h`（「ウマ娘 音mad / umamusume otomad」、2026-10-24 時点で 878本）
- `playlistItems.list`（`part=snippet,contentDetails`、`maxResults=50`）で全件の動画 ID を集める
- `videos.list`（`part=snippet,statistics,contentDetails`、ID を 50件ずつ）で再生数・いいね数・長さ・投稿日を取る
- 削除済み・非公開の動画（`videos.list` で返ってこないもの）は除く
- 1回の実行で約36ユニット。無料枠は1日 10,000ユニット
- API キーは環境変数 `YOUTUBE_API_KEY` から読む

## 3. データ

### 3.1 動画1本の形式

```ts
type Video = {
  id: string;            // ニコ動は "sm123"、YouTube は "yt:<videoId>"
  source: "nico" | "youtube";
  title: string;
  url: string;           // 元ページ
  thumbnail: string;
  publishedAt: string;   // ISO 8601
  views: number;
  likes: number;
  duration: number;      // 秒
  tags: string[];        // YouTube は空配列
  characters: string[];  // キャラ名
};
```

### 3.2 出力ファイル `data/videos.json`

```ts
type VideosFile = {
  generatedAt: string;
  sources: {
    nico:    { fetchedAt: string; count: number };
    youtube: { fetchedAt: string; count: number };
  };
  videos: Video[];
};
```

`fetchedAt` は、そのサイトの取得に最後に成功した時刻。

### 3.3 除外リスト `exclude.json`

1行に1件書けるよう、ID と理由の配列にする。理由は省略してよい。

```json
[
  { "id": "sm12345678", "reason": "ウマ娘と関係ない" },
  { "id": "yt:abcdefghijk" }
]
```

### 3.4 キャラの判定

- **ニコ動**: タグのうち `〇〇(ウマ娘)` または `〇〇（ウマ娘）` の形のものから `〇〇` を取り出す
- **辞書**: ニコ動の全動画から取り出したキャラ名を集めて辞書にする
- **YouTube**: 辞書の各キャラ名が、表記ゆれを吸収したタイトルに含まれていればそのキャラとみなす
  - 誤判定を減らすため、3文字未満の名前はタイトル判定には使わない
  - 愛称（「タキオン」など）は判定できない。今回はこの制限を受け入れる

### 3.5 取得に失敗したとき

- サイトごとに独立して扱う。片方が失敗しても、もう片方は更新する
- 失敗したサイトのぶんは、前回の `data/videos.json` にある同じサイトの動画をそのまま残す
- 次の場合も失敗として扱う
  - 取得件数が前回の半分未満だった（API が一部しか返さなかった場合の保護。前回のデータが無い初回はこの判定をしない）
  - `YOUTUBE_API_KEY` が無い（YouTube のみ）
- 両方とも失敗し、かつ前回のデータも無いときだけ、スクリプトを異常終了させる

## 4. サイト

### 4.1 技術

- Vite + TypeScript。UI フレームワークは使わない
- 取得スクリプトも TypeScript で書き、Node の型除去実行（`--experimental-strip-types`）で動かす。enum など型除去で動かない書き方は使わない
- 実行時に使う外部ライブラリは無し。開発用に Vite・TypeScript・Vitest のみ

### 4.2 画面

1ページだけの構成にする。

- **操作バー**: キーワード検索、取得元の切り替え（すべて／ニコ動／YouTube）、並び順（新着／再生数／いいね数）、キャラ選択（入力で候補を絞り込み、件数つきで1人選ぶ）
- **一覧**: サムネイルのカードを並べる。カードにはタイトル、取得元バッジ、再生数・いいね数、投稿日、長さ、キャラ名を出す。最初は 60件で、「もっと見る」で 60件ずつ増やす
- **再生**: カードを押すとモーダルが開き、埋め込みプレーヤーで再生する。元ページへのリンクも付ける
  - ニコ動: `https://embed.nicovideo.jp/watch/<id>`
  - YouTube: `https://www.youtube-nocookie.com/embed/<videoId>`
  - 一覧の段階ではプレーヤーを読み込まない
- **フッター**: 「各動画の権利は投稿者に帰属します」の一文、掲載をやめてほしい人向けの GitHub Issues へのリンク、データの最終更新時刻

### 4.3 検索

- 対象はタイトル、キャラ名、タグ
- 次の順で文字列をそろえてから比べる: NFKC 正規化 → 小文字化 → ひらがなをカタカナに変換
- 空白で区切った語はすべて含むもの（AND）を出す

### 4.4 URL で状態を共有

絞り込みの状態をクエリ文字列に残す。`q`（キーワード）、`src`（`nico`／`youtube`）、`sort`（`new`／`views`／`likes`）、`chara`（キャラ名）。既定値の項目は URL に書かない。

### 4.5 見た目

- 明るい配色を基本にし、OS の設定に合わせてダークモードにも切り替える
- スマホ幅（360px 程度）でも横スクロールが出ないようにする
- 公式のロゴやキャラ画像は使わない。画像は各動画のサムネイルだけ

## 5. 公開と運用

### 5.1 公開先

GitHub の公開リポジトリから GitHub Pages で公開する。

### 5.2 自動更新 `.github/workflows/update.yml`

- 動くタイミング
  - 毎日 6時（日本時間、cron は `0 21 * * *`）
  - `main` への push
  - 手動実行（`workflow_dispatch`）
- 手順
  1. 取得スクリプトを実行し、`data/videos.json` を作り直す
  2. 変更があればコミットして push する（`GITHUB_TOKEN` による push は次のワークフローを起動しないので、無限ループにはならない）
  3. Vite でビルドし、`actions/deploy-pages` で公開する
- Node 24 を使う
- 同時実行は1つまでにする（`concurrency`）

### 5.3 API キー

- GitHub Secrets に `YOUTUBE_API_KEY` として登録する
- 手元では `.env` に書き、`.gitignore` で Git に入れない
- キーはユーザーが Google Cloud Console で作り、YouTube Data API v3 だけに使えるよう制限をかける（手順は実装時に案内する）

### 5.4 除外の運用

GitHub 上で `exclude.json` を編集してコミットすると、push をきっかけにワークフローが動き、数分でサイトから消える。

## 6. ファイル構成

```
umamusume-otomad/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ exclude.json
├─ data/videos.json
├─ scripts/
│  ├─ fetch.ts          # 入口。各取得を呼び、まとめて書き出す
│  ├─ nico.ts           # ニコ動の取得と Video への変換
│  ├─ youtube.ts        # YouTube の取得と Video への変換
│  ├─ characters.ts     # タグからのキャラ抽出、辞書、タイトル判定
│  └─ merge.ts          # 重複除去、除外、失敗時の前回データ引き継ぎ
├─ src/
│  ├─ main.ts           # 起動、イベントの配線
│  ├─ normalize.ts      # 表記ゆれの吸収（取得スクリプトと共用）
│  ├─ filter.ts         # 検索・絞り込み・並び替え
│  ├─ url-state.ts      # URL と状態の相互変換
│  ├─ render.ts         # カードと一覧の描画
│  ├─ player.ts         # 再生モーダル
│  └─ style.css
├─ tests/               # Vitest のテストと API 返答サンプル
└─ .github/workflows/update.yml
```

## 7. テスト

- Vitest で、ネットにつながなくても試せる関数を自動テストする
  - 表記ゆれを吸収した検索（`normalize.ts`、`filter.ts`）
  - タグからのキャラ名の取り出し、タイトルからのキャラ判定（`characters.ts`）
  - 重複のまとめ、除外、取得失敗時に前回データを残す処理（`merge.ts`）
  - URL と状態の相互変換（`url-state.ts`）
- API の読み取り部分（`nico.ts`、`youtube.ts`）は、保存した API の返答サンプルを使ってテストする。テストでは本物の API を呼ばない
- 公開前に、実データを入れたサイトをブラウザで開き、PC 幅とスマホ幅で表示と操作を確認する

## 8. 今回やらないこと

- ニコ動と YouTube にある同じ作品の統合（判定が難しく、誤ってまとめるおそれがあるため）
- 複数キャラの同時選択
- YouTube の愛称でのキャラ判定
- 管理画面、ログイン、コメント、お気に入りなどの機能
