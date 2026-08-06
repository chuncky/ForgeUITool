import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateProjectDir } from "@forgeui/core";

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

describe("CLI validate wiring (FR-058)", () => {
  it("forgeui validate command maps to validateProjectDir", () => {
    const cli = fs.readFileSync(path.join(repoRoot, "apps/cli/src/cli.ts"), "utf8");
    expect(cli).toContain('if (cmd === "validate")');
    expect(cli).toContain("validateProjectDir");
  });

  it("hello-dual-screen template passes validateProjectDir", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-cli-validate-"));
    copyDir(templateRoot, tmp);
    const result = validateProjectDir(tmp);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((d) => d.level === "error")).toHaveLength(0);
  });

  it("invalid lvglVersion fails validateProjectDir", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-cli-validate-bad-"));
    copyDir(templateRoot, tmp);
    const pj = JSON.parse(fs.readFileSync(path.join(tmp, "project.json"), "utf8"));
    pj.lvglVersion = "8.99.99";
    fs.writeFileSync(path.join(tmp, "project.json"), JSON.stringify(pj, null, 2));
    const result = validateProjectDir(tmp);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.level === "error")).toBe(true);
  });
});
