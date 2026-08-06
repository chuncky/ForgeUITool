import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  plugins: [vue()],
  root: ".",
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@forgeui/core/frame-anchor": path.resolve(__dirname, "../../packages/core/src/frame-anchor.ts"),
      "@forgeui/core/types": path.resolve(__dirname, "../../packages/core/src/types.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
