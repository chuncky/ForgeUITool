/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@forgeui/shared": path.join(root, "packages/shared/src/index.ts"),
      "@forgeui/core": path.join(root, "packages/core/src/index.ts"),
      "@forgeui/codegen": path.join(root, "packages/codegen/src/index.ts"),
      "@forgeui/preview-host": path.join(root, "packages/preview-host/src/index.ts"),
      "@forgeui/platforms": path.join(root, "packages/platforms/src/index.ts"),
      "@forgeui/packer": path.join(root, "packages/packer/src/index.ts"),
      "@forgeui/loader": path.join(root, "packages/loader/src/index.ts"),
      "@forgeui/mcp": path.join(root, "packages/mcp/src/index.ts"),
      "@forgeui/importers": path.join(root, "packages/importers/src/index.ts"),
      pinia: path.join(root, "node_modules/pinia/dist/pinia.js"),
      vue: path.join(root, "node_modules/vue/dist/vue.runtime.esm-bundler.js"),
    },
    dedupe: ["vue", "pinia"],
  },
  test: {
    include: ["packages/**/src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30000,
  },
});
