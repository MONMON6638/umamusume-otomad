import { formatCount, formatDate, formatDuration } from "./format.ts";
import type { Video } from "./types.ts";

// 動画データは必ず textContent か属性で入れる（タイトルに HTML が入っていても実行させない）
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createCard(video: Video, onOpen: (v: Video) => void): HTMLElement {
  const card = el("button", "card");
  card.type = "button";
  card.addEventListener("click", () => onOpen(video));

  const thumb = el("div", "thumb");
  const img = el("img", "thumb-img");
  img.src = video.thumbnail;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  thumb.append(img, el("span", "duration", formatDuration(video.duration)));

  const badge = el("span", `badge badge-${video.source}`, video.source === "nico" ? "ニコ動" : "YouTube");
  const meta = el("p", "meta", `▶ ${formatCount(video.views)}　♥ ${formatCount(video.likes)}　${formatDate(video.publishedAt)}`);

  const body = el("div", "card-body");
  body.append(badge, el("h2", "title", video.title), meta);
  if (video.characters.length > 0) body.append(el("p", "charas", video.characters.join("・")));

  card.append(thumb, body);
  return card;
}

export function renderCards(container: HTMLElement, videos: Video[], onOpen: (v: Video) => void): void {
  const frag = document.createDocumentFragment();
  for (const v of videos) frag.append(createCard(v, onOpen));
  container.append(frag);
}
