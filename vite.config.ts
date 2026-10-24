import { defineConfig } from "vite";

const repo = process.env.GITHUB_REPOSITORY; // "owner/name"（Actions のときだけある）
const [owner, name] = repo?.split("/") ?? [];
// GitHub Pages の公開 URL。カード画像（og:image）は完全な URL が必要なので、ここで作る
const siteUrl = owner && name ? `https://${owner.toLowerCase()}.github.io/${name}/` : "/";

export default defineConfig({
  base: "./",
  define: {
    __REPO_URL__: JSON.stringify(repo ? `https://github.com/${repo}` : ""),
  },
  plugins: [
    {
      name: "site-url",
      transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", siteUrl),
    },
  ],
});
