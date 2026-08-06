import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { packProject } from "@forgeui/packer";
import { buildMemRefDescriptor, parseMemRefDescriptor } from "@forgeui/loader";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

describe("M6 forge_loader_open_mem descriptor", () => {
  it("C loader implements forgeui-mem-ref format", () => {
    const c = fs.readFileSync(path.join(repoRoot, "packages/loader/c/src/forge_loader.c"), "utf8");
    expect(c).toContain("forgeui-mem-ref");
    expect(c).toContain("parse_mem_descriptor");
    expect(c).not.toMatch(/forge_loader_open_mem[\s\S]*E_LOADER_NOT_IMPL/);
  });

  it("buildMemRefDescriptor round-trips root path", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-mem-ref-"));
    copyDir(templateRoot, tmp);
    const pack = await packProject(tmp);
    expect(pack.ok).toBe(true);

    const buf = buildMemRefDescriptor(pack.outDir);
    const parsed = parseMemRefDescriptor(buf);
    expect(parsed?.format).toBe("forgeui-mem-ref");
    expect(parsed?.root).toBe(pack.outDir.replace(/\\/g, "/"));
  });

  it("parseMemRefDescriptor rejects bad format", () => {
    expect(parseMemRefDescriptor('{"format":"other","root":"/x"}')).toBeNull();
    expect(parseMemRefDescriptor('{"format":"forgeui-mem-ref"}')).toBeNull();
  });
});
