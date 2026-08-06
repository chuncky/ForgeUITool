import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPlatformPlugin, listPlatformPlugins, qm10xvPlugin, qm10xhPlugin } from "@forgeui/platforms";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("qm10xv/qm10xh platform FR-007", () => {
  it("registers three qm10x plugins", () => {
    const ids = listPlatformPlugins().map((p) => p.id);
    expect(ids).toEqual(["qm10xd", "qm10xv", "qm10xh"]);
  });

  it("qm10xv/xh resolve SDK from env-style hints", () => {
    expect(qm10xvPlugin.defaultSdkPathHints().some((h) => h.includes("qm10xv"))).toBe(true);
    expect(qm10xhPlugin.defaultSdkPathHints().some((h) => h.includes("qm10xh"))).toBe(true);
    expect(getPlatformPlugin("qm10xv").boardTemplateDir()).toContain("qm10xv");
  });

  it("board HELLO templates exist", () => {
    for (const id of ["qm10xv", "qm10xh"] as const) {
      const hello = path.join(repoRoot, "templates/boards", id, "HELLO.md");
      expect(fs.existsSync(hello)).toBe(true);
      expect(fs.readFileSync(hello, "utf8")).toContain(id);
    }
  });
});
