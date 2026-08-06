import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addChildNode,
  collectProjectGlyphs,
  createProject,
  importFontAsset,
  mergeFontCharset,
  openProject,
  updateNodeProps,
} from "./index.js";

describe("fonts FR-041", () => {
  it("collectProjectGlyphs gathers label text from screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-g-"));
    createProject({ root: tmp, name: "fg", fromTemplate: "blank" });
    const loaded = openProject(tmp);
    const sid = loaded.project.defaultScreen;
    const lbl = addChildNode(loaded, sid, sid, "label");
    updateNodeProps(loaded, sid, lbl.id, { props: { text: "你好Hi" } });
    expect(collectProjectGlyphs(loaded)).toContain("你好Hi");
    expect(mergeFontCharset(collectProjectGlyphs(loaded))).toMatch(/A/);
    expect(mergeFontCharset(collectProjectGlyphs(loaded), "★")).toContain("★");
  });

  it("importFontAsset copies TTF into assets/fonts", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-i-"));
    createProject({ root: tmp, name: "fi", fromTemplate: "blank" });
    const src = path.join(tmp, "mini.ttf");
    fs.writeFileSync(src, "dummy-ttf");
    const loaded = openProject(tmp);
    const asset = importFontAsset(loaded, src, { size: 20 });
    expect(asset.path).toMatch(/^assets\/fonts\//);
    expect(asset.size).toBe(20);
    expect(fs.existsSync(path.join(tmp, asset.path))).toBe(true);
  });
});
