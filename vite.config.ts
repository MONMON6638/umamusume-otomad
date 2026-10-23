import { defineConfig } from "vite";

const repo = process.env.GITHUB_REPOSITORY;

export default defineConfig({
  base: "./",
  define: {
    __REPO_URL__: JSON.stringify(repo ? `https://github.com/${repo}` : ""),
  },
});
