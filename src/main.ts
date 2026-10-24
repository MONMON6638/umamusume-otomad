import "./style.css";
import videosJson from "../data/videos.json";
import { authorCounts, characterCounts, filterVideos, indexVideos, upNext, type State } from "./filter.ts";
import { formatDate } from "./format.ts";
import { createCombo } from "./combo.ts";
import { renderCards } from "./render.ts";
import type { Video, VideosFile } from "./types.ts";
import { parseState, stringifyState } from "./url-state.ts";
import { showVideo, stopVideo } from "./watch.ts";

const PAGE_SIZE = 60;
const UP_NEXT_SIZE = 30;
const SEARCH_DELAY_MS = 150;

const file = videosJson as VideosFile;
const items = indexVideos(file.videos);
const byId = new Map(file.videos.map((v) => [v.id, v]));

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const qInput = $<HTMLInputElement>("q");
const charaInput = $<HTMLInputElement>("chara");
const authorInput = $<HTMLInputElement>("author");
const srcSelect = $<HTMLSelectElement>("src");
const sortSelect = $<HTMLSelectElement>("sort");
const browse = $<HTMLElement>("browse");
const watch = $<HTMLElement>("watch");
const watchAuthor = $<HTMLButtonElement>("watch-author");

// 一覧と「次に見る」の両方で使う、少しずつ表示するリスト
function pager(container: HTMLElement, more: HTMLButtonElement, empty: HTMLElement, size: number) {
  let list: Video[] = [];
  let shown = 0;
  const showMore = () => {
    renderCards(container, list.slice(shown, shown + size), open);
    shown = Math.min(shown + size, list.length);
    more.hidden = shown >= list.length;
  };
  more.addEventListener("click", showMore);
  return (next: Video[]) => {
    list = next;
    shown = 0;
    container.replaceChildren();
    showMore();
    empty.hidden = list.length > 0;
  };
}

const showGrid = pager($("grid"), $("more"), $("empty"), PAGE_SIZE);
const showUpNext = pager($("watch-list"), $("watch-more"), $("watch-empty"), UP_NEXT_SIZE);

let state: State = parseState(location.search);

function render() {
  const results = filterVideos(items, state);
  const current = state.v ? byId.get(state.v) : undefined;
  browse.hidden = Boolean(current);
  watch.hidden = !current;
  document.body.classList.toggle("watching", Boolean(current));

  if (current) {
    showVideo(current);
    watchAuthor.hidden = !current.author;
    watchAuthor.textContent = current.author ? `${current.author.name} さんの動画を見る` : "";
    const next = upNext(results, current.id);
    $("watch-count").textContent = `${next.length.toLocaleString("ja-JP")}件`;
    showUpNext(next);
  } else {
    stopVideo();
    $("count").textContent = `${results.length.toLocaleString("ja-JP")}件`;
    showGrid(results);
  }
}

// 見る動画が変わるときは履歴に積み、ブラウザの「戻る」で前の動画や一覧に戻れるようにする
function update(patch: Partial<State>) {
  const push = patch.v !== undefined && patch.v !== state.v;
  state = { ...state, ...patch };
  const url = location.pathname + stringifyState(state);
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
  render();
}

function open(video: Video) {
  update({ v: video.id });
  window.scrollTo({ top: 0 });
}

const charaCombo = createCombo(charaInput, characterCounts(file.videos), (name) => update({ chara: name }));
const authorCombo = createCombo(authorInput, authorCounts(file.videos), (name) => update({ author: name }));

// 操作バーに状態を反映
function syncInputs() {
  qInput.value = state.q;
  charaCombo.setValue(state.chara);
  authorCombo.setValue(state.author);
  srcSelect.value = state.src;
  sortSelect.value = state.sort;
}

window.addEventListener("popstate", () => {
  state = parseState(location.search);
  syncInputs();
  render();
});

let searchTimer: ReturnType<typeof setTimeout> | undefined;
qInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => update({ q: qInput.value }), SEARCH_DELAY_MS);
});
srcSelect.addEventListener("change", () => update({ src: srcSelect.value as State["src"] }));
sortSelect.addEventListener("change", () => update({ sort: sortSelect.value as State["sort"] }));

// 再生は続けたまま、「次に見る」をこの投稿者の動画にする
watchAuthor.addEventListener("click", () => {
  const name = state.v ? byId.get(state.v)?.author?.name : undefined;
  if (!name) return;
  authorCombo.setValue(name);
  update({ author: name });
});
$("watch-back").addEventListener("click", () => update({ v: "" }));

// 視聴ページの「次に見る」をヘッダーのすぐ下に固定するため、ヘッダーの高さを CSS に渡す
const bar = document.querySelector<HTMLElement>(".bar");
if (bar) {
  new ResizeObserver(() => document.documentElement.style.setProperty("--bar-h", `${bar.offsetHeight}px`)).observe(bar);
}

$<HTMLElement>("updated").textContent = `最終更新 ${formatDate(file.generatedAt)}`;
if (__REPO_URL__) {
  const issues = $<HTMLAnchorElement>("issues");
  issues.href = `${__REPO_URL__}/issues`;
  issues.hidden = false;
}

syncInputs();
render();
