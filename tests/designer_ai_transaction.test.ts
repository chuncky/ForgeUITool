import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("AI transaction UI (Loop#13)", () => {
  it("AiTransactionBar is mounted in workbench", () => {
    const wb = fs.readFileSync(path.join(repoRoot, "apps/designer/src/components/DesignerWorkbench.vue"), "utf8");
    expect(wb).toContain("AiTransactionBar");
    expect(wb).toContain("applyAiModelUpdate");
  });

  it("electron exposes ai transaction IPC", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    expect(main).toContain('"ai:commitTransaction"');
    expect(main).toContain("applyBridgeWrite");
    expect(main).toContain("pending && current && cachedCore");
    expect(preload).toContain("onAiModelUpdated");
  });
});
