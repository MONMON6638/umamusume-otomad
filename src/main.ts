import "./style.css";
import videosJson from "../data/videos.json";
import { characterCounts, filterVideos, indexVideos, type State } from "./filter.ts";
import { formatDate } from "./format.ts";
import { openPlayer } from "./player.ts";
import { renderCards } from "./render.ts";
import type { Video, VideosFile } from "./types.ts";
import { parseState, stringifyState } from "./url-state.ts";

const PAGE_SIZE = 60;
const SEARCH_DELAY_MS = 150;

const file = videosJson as VideosFile;
const items = indexVideos(file.videos);
const characters = characterCounts(file.videos);
const characterNames = new Set(characters.map((c) => c.name));

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const qInput = $<HTMLInputElement>("q");
const charaInput = $<HTMLInputElement>("chara");
const srcSelect = $<HTMLSelectElement>("src");
const sortSelect = $<HTMLSelectElement>("sort");
const grid = $<HTMLElement>("grid");
const count = $<HTMLElement>("count");
const empty = $<HTMLElement>("empty");
const more = $<HTMLButtonElement>("more");

let state: State = parseState(location.search);
let results: Video[] = [];
let shown = 0;

function showMore() {
  renderCards(grid, results.slice(shown, shown + PAGE_SIZE), openPlayer);
  shown = Math.min(shown + PAGE_SIZE, results.length);
  more.hidden = shown >= results.length;
}

function update(patch: Partial<State>) {
  state = { ...state, ...patch };
  history.replaceState(null, "", location.pathname + stringifyState(state));
  results = filterVideos(items, state);
  grid.replaceChildren();
  shown = 0;
  showMore();
  count.textContent = `${results.length.toLocaleString("ja-JP")}件`;
  empty.hidden = results.length > 0;
}

// 操作バーに URL の状態を反映
qInput.value = state.q;
charaInput.value = state.chara;
srcSelect.value = state.src;
sortSelect.value = state.sort;

const list = $<HTMLDataListElement>("chara-list");
for (const c of characters) {
  const option = document.createElement("option");
  option.value = c.name;
  option.label = `${c.name}（${c.count}）`;
  list.append(option);
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
qInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => update({ q: qInput.value }), SEARCH_DELAY_MS);
});
// 辞書に完全一致したときだけ絞り込む。空欄にしたら解除
charaInput.addEventListener("input", () => {
  const v = charaInput.value.trim();
  if (v === "") update({ chara: "" });
  else if (characterNames.has(v)) update({ chara: v });
});
srcSelect.addEventListener("change", () => update({ src: srcSelect.value as State["src"] }));
sortSelect.addEventListener("change", () => update({ sort: sortSelect.value as State["sort"] }));
more.addEventListener("click", showMore);

$<HTMLElement>("updated").textContent = `最終更新 ${formatDate(file.generatedAt)}`;
if (__REPO_URL__) {
  const issues = $<HTMLAnchorElement>("issues");
  issues.href = `${__REPO_URL__}/issues`;
  issues.hidden = false;
}

update({});
