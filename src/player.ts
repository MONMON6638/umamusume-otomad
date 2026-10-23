import { embedUrl } from "./format.ts";
import type { Video } from "./types.ts";

const dialog = document.getElementById("player") as HTMLDialogElement;
const frame = document.getElementById("player-frame") as HTMLElement;
const title = document.getElementById("player-title") as HTMLElement;
const link = document.getElementById("player-link") as HTMLAnchorElement;

// 閉じたら iframe ごと消して再生を止める（Esc・背景クリック・閉じるボタンのどれでも close が来る）
dialog.addEventListener("close", () => frame.replaceChildren());
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
document.getElementById("player-close")?.addEventListener("click", () => dialog.close());

export function openPlayer(video: Video): void {
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
