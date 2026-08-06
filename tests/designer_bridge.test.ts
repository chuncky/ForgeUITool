import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("designer Bridge wiring", () => {
  it("main.mjs starts ForgeUI Bridge on app ready", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    expect(main).toContain("createForgeUiBridge");
    expect(main).toContain("ensureBridge()");
    expect(main).toContain("bridgePreviewBusy");
  });

  it("bridge.mjs exposes POST /bridge/invoke", () => {
    const bridge = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/bridge.mjs"), "utf8");
    expect(bridge).toContain("/bridge/invoke");
    expect(bridge).toContain("NOT_IN_WORKSPACE");
  });
});
