/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const coreSrc = path.join(root, "packages/core/src");

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      // More-specific @forgeui/core/* must come before the barrel alias.
      { find: "@forgeui/core/widgets", replacement: path.join(coreSrc, "widgets.ts") },
      { find: "@forgeui/core/builtin-fonts", replacement: path.join(coreSrc, "builtin-fonts.ts") },
      { find: "@forgeui/core/opacity", replacement: path.join(coreSrc, "opacity.ts") },
      { find: "@forgeui/core/frame-anchor", replacement: path.join(coreSrc, "frame-anchor.ts") },
      { find: "@forgeui/core/types", replacement: path.join(coreSrc, "types.ts") },
      { find: "@forgeui/core/themes", replacement: path.join(coreSrc, "themes.ts") },
      { find: "@forgeui/core", replacement: path.join(coreSrc, "index.ts") },
      { find: "@forgeui/shared", replacement: path.join(root, "packages/shared/src/index.ts") },
      { find: "@forgeui/codegen", replacement: path.join(root, "packages/codegen/src/index.ts") },
      { find: "@forgeui/preview-host", replacement: path.join(root, "packages/preview-host/src/index.ts") },
      { find: "@forgeui/platforms", replacement: path.join(root, "packages/platforms/src/index.ts") },
      { find: "@forgeui/packer", replacement: path.join(root, "packages/packer/src/index.ts") },
      { find: "@forgeui/loader", replacement: path.join(root, "packages/loader/src/index.ts") },
      { find: "@forgeui/mcp", replacement: path.join(root, "packages/mcp/src/index.ts") },
      { find: "@forgeui/importers", replacement: path.join(root, "packages/importers/src/index.ts") },
      { find: "pinia", replacement: path.join(root, "node_modules/pinia/dist/pinia.js") },
      { find: "vue", replacement: path.join(root, "node_modules/vue/dist/vue.runtime.esm-bundler.js") },
    ],
    dedupe: ["vue", "pinia"],
  },
  test: {
    include: ["packages/**/src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30000,
  },
});
