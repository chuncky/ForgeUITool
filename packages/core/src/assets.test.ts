import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProject, importImageAsset, importImageAssets, normalizeImageAssets, openProject } from "./index.js";

describe("image assets", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const r of roots) {
      fs.rmSync(r, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  function tempProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-assets-"));
    roots.push(root);
    createProject({ root, name: "assets-test", platform: "qm10xd" });
    return openProject(root);
  }

  it("imports image into assets/images and registers in project", () => {
    const loaded = tempProject();
    const src = path.join(loaded.root, "probe.png");
    fs.writeFileSync(src, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const asset = importImageAsset(loaded, src);
    expect(asset.path).toBe("assets/images/probe.png");
    expect(fs.existsSync(path.join(loaded.root, asset.path))).toBe(true);

    const listed = normalizeImageAssets(loaded.project);
    expect(listed.some((a) => a.path === asset.path)).toBe(true);
  });

  it("imports multiple files in one batch", () => {
    const loaded = tempProject();
    const a = path.join(loaded.root, "a.png");
    const b = path.join(loaded.root, "b.png");
    fs.writeFileSync(a, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(b, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const imported = importImageAssets(loaded, [a, b]);
    expect(imported).toHaveLength(2);
    expect(normalizeImageAssets(loaded.project)).toHaveLength(2);
  });

  it("assigns unique filename when target exists", () => {
    const loaded = tempProject();
    const src = path.join(loaded.root, "dup.png");
    fs.writeFileSync(src, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(path.join(loaded.root, "assets/images/dup.png"), Buffer.from([0x00]));

    const asset = importImageAsset(loaded, src);
    expect(asset.path).toMatch(/^assets\/images\/dup_\d+\.png$/);
  });
});
