import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { createProject } from "@forgeui/core";

describe("FR-057 build-manifest + prune-orphans", () => {
  it("writes enriched build-manifest and removes orphans outside custom/", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-prune-"));
    createProject({ root: tmp, name: "prune", fromTemplate: "blank" });
    const gen1 = await generate(tmp);
    expect(gen1.ok).toBe(true);
    const manifestPath = path.join(tmp, ".forge/build-manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const man = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(man.schemaVersion).toBe(1);
    expect(man.codegenDir).toBe("forgeui_generated");
    expect(Array.isArray(man.files)).toBe(true);
    expect(man.files.some((f: string) => f.includes("ui.c"))).toBe(true);

    const orphan = path.join(tmp, "forgeui_generated", "orphan_dead.c");
    fs.writeFileSync(orphan, "/* orphan */\n", "utf8");
    const customKeep = path.join(tmp, "forgeui_generated", "custom", "keep_me.txt");
    fs.writeFileSync(customKeep, "stay\n", "utf8");

    const gen2 = await generate(tmp, { pruneOrphans: true });
    expect(gen2.ok).toBe(true);
    expect(fs.existsSync(orphan)).toBe(false);
    expect(fs.existsSync(customKeep)).toBe(true);
    expect(gen2.filesPruned?.some((f) => f.includes("orphan_dead.c"))).toBe(true);
    expect(gen2.diagnostics.some((d) => d.code === "E_GEN_PRUNE")).toBe(true);
  });
});
