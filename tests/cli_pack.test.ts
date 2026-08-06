import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packProject } from "@forgeui/packer";

const repoRoot = path.resolve(import.meta.dirname, "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

describe("CLI pack wiring (Loop#39)", () => {
  it("forgeui pack command maps to packProject full package", async () => {
    const cli = fs.readFileSync(path.join(repoRoot, "apps/cli/src/cli.ts"), "utf8");
    expect(cli).toContain('if (cmd === "pack")');
    expect(cli).toContain("Pack OK →");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-cli-pack-"));
    copyDir(templateRoot, tmp);
    const outDir = path.join(tmp, "out-package");
    const result = await packProject(tmp, { outDir });
    expect(result.ok).toBe(true);
    expect(result.skeleton).toBe(false);
    expect(fs.existsSync(path.join(outDir, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "assets/manifest.json"))).toBe(true);
  });
});
