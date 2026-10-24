import { embedUrl, formatCount, formatDate } from "./format.ts";
import type { Video } from "./types.ts";

const frame = document.getElementById("watch-frame") as HTMLElement;
const title = document.getElementById("watch-title") as HTMLElement;
const authorName = document.getElementById("watch-author-name") as HTMLElement;
const meta = document.getElementById("watch-meta") as HTMLElement;
const charas = document.getElementById("watch-charas") as HTMLElement;
const link = document.getElementById("watch-link") as HTMLAnchorElement;

let playingId = "";

// 同じ動画のまま呼ばれたら iframe を作り直さない（絞り込みを変えても再生が止まらないように）
export function showVideo(video: Video): void {
  if (video.id !== playingId) {
    const iframe = document.createElement("iframe");
    iframe.src = embedUrl(video);
    iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.title = video.title;
    frame.replaceChildren(iframe);
    playingId = video.id;
  }
  // 動画データは textContent で入れる
  title.textContent = video.title;
  authorName.textContent = video.author?.name ?? "";
  meta.textContent = `▶ ${formatCount(video.views)}　♥ ${formatCount(video.likes)}　${formatDate(video.publishedAt)}`;
  charas.textContent = video.characters.join("・");
  link.href = video.url;
}

// 一覧に戻ったら iframe ごと消して再生を止める
export function stopVideo(): void {
  frame.replaceChildren();
  playingId = "";
}
