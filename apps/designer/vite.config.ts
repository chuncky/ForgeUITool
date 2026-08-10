import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

const coreSrc = path.resolve(__dirname, "../../packages/core/src");

export default defineConfig({
  plugins: [vue()],
  root: ".",
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Browser-safe core subpaths only (never barrel — pulls validate/createRequire).
      "@forgeui/core/widgets": path.join(coreSrc, "widgets.ts"),
      "@forgeui/core/builtin-fonts": path.join(coreSrc, "builtin-fonts.ts"),
      "@forgeui/core/opacity": path.join(coreSrc, "opacity.ts"),
      "@forgeui/core/frame-anchor": path.join(coreSrc, "frame-anchor.ts"),
      "@forgeui/core/types": path.join(coreSrc, "types.ts"),
      "@forgeui/core/themes": path.join(coreSrc, "themes.ts"),
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
