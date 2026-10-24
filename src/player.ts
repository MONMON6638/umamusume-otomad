import { embedUrl } from "./format.ts";
import type { Video } from "./types.ts";

const dialog = document.getElementById("player") as HTMLDialogElement;
const frame = document.getElementById("player-frame") as HTMLElement;
const title = document.getElementById("player-title") as HTMLElement;
const link = document.getElementById("player-link") as HTMLAnchorElement;
const authorButton = document.getElementById("player-author") as HTMLButtonElement;
let showAuthor: (() => void) | undefined;
authorButton.addEventListener("click", () => {
  dialog.close();
  showAuthor?.();
});

// 閉じたら iframe ごと消して再生を止める（Esc・背景クリック・閉じるボタンのどれでも close が来る）
dialog.addEventListener("close", () => frame.replaceChildren());
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
document.getElementById("player-close")?.addEventListener("click", () => dialog.close());

// onAuthor は「この投稿者の動画を見る」を押したときに投稿者名を受け取る
export function openPlayer(video: Video, onAuthor: (name: string) => void): void {
  const author = video.author;
  authorButton.hidden = !author;
  authorButton.textContent = author ? `${author.name} さんの動画を見る` : "";
  showAuthor = author ? () => onAuthor(author.name) : undefined;

  const iframe = document.createElement("iframe");
  iframe.src = embedUrl(video);
  iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
  iframe.allowFullscreen = true;
  iframe.title = video.title;
  frame.replaceChildren(iframe);
  title.textContent = video.title;
  link.href = video.url;
  dialog.showModal();
}
