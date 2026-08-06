import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addChildNode, openProject } from "@forgeui/core";
import { packProject } from "@forgeui/packer";
import { JsonRuntimeLoader, countRuntimeWidgets } from "@forgeui/loader";

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

describe("M6 JsonRuntimeLoader (A2 JSON runtime step 1)", () => {
  it("parses packed ui/screens/*.json into runtime screen trees", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-json-rt-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    addChildNode(loaded, "home", "home", "label");
    const pack = await packProject(tmp);
    expect(pack.ok).toBe(true);

    const loader = new JsonRuntimeLoader();
    const result = await loader.apply(pack.outDir, {
      width: 480,
      height: 320,
      colorDepth: 16,
      lvglVersion: "9.10",
    });

    expect(result.ok).toBe(true);
    expect(result.entryScreen).toBeTruthy();
    expect(result.screens?.length).toBeGreaterThan(0);

    const entry = loader.entryDocument(result);
    expect(entry?.type).toBe("screen");
    expect(countRuntimeWidgets(entry!)).toBeGreaterThan(0);

    const home = result.screens?.find((s) => s.id === "home");
    expect(home?.document.children.some((c) => c.type === "label")).toBe(true);
  });

  it("rejects invalid package before parsing screens", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-json-rt-bad-"));
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, "manifest.json"), "{}");

    const loader = new JsonRuntimeLoader();
    const result = await loader.apply(tmp, {
      width: 480,
      height: 320,
      colorDepth: 16,
      lvglVersion: "9.10",
    });

    expect(result.ok).toBe(false);
    expect(result.screens).toBeUndefined();
  });
});
