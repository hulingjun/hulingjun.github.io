import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  root: "github-pages",
  base: "/",
  build: {
    outDir: "../github-dist",
    emptyOutDir: true,
    rollupOptions: { input: { home: resolve(__dirname, "github-pages/index.html"), alpha3d: resolve(__dirname, "github-pages/3d-alpha/index.html") } },
  },
});
