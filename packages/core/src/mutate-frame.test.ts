import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addChildNode, createProject, findNode, openProject, updateNodeProps } from "./index.js";

describe("addChildNode frame option", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const r of roots) {
      fs.rmSync(r, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  it("applies custom frame position from drag-drop", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-add-"));
    roots.push(root);
    createProject({ root, name: "drag", platform: "qm10xd" });
    const loaded = openProject(root);
    const screenId = loaded.project.defaultScreen;

    const node = addChildNode(loaded, screenId, screenId, "button", {
      frame: { x: 88, y: 120 },
    });

    expect(node.frame.x).toBe(88);
    expect(node.frame.y).toBe(120);
    expect(node.frame.w).toBeGreaterThan(0);
    expect(node.frame.h).toBeGreaterThan(0);
  });

  it("seeds container defaultStyle aligned with LVGL theme_default Light card", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-add-c-"));
    roots.push(root);
    createProject({ root, name: "cont", platform: "qm10xd" });
    const loaded = openProject(root);
    const screenId = loaded.project.defaultScreen;
    const node = addChildNode(loaded, screenId, screenId, "container");
    const style = node.style as { main?: { default?: Record<string, unknown> } };
    expect(style.main?.default?.bg_color).toBe("#ffffffff");
    expect(style.main?.default?.radius).toBe(8);
    expect(style.main?.default?.border_width).toBe(2);
  });

  it("seeds button defaultStyle with primary blue", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-add-b-"));
    roots.push(root);
    createProject({ root, name: "btn", platform: "qm10xd" });
    const loaded = openProject(root);
    const screenId = loaded.project.defaultScreen;
    const node = addChildNode(loaded, screenId, screenId, "button");
    const style = node.style as { main?: { default?: Record<string, unknown> } };
    expect(style.main?.default?.bg_color).toBe("#2196F3ff");
    expect(style.main?.default?.text_color).toBe("#ffffffff");
    expect(style.main?.default?.text_font).toBe("@SourceHanSansCN-Bold");
    expect(style.main?.default?.text_font_size).toBe(16);
    expect(style.main?.default?.text_align).toBe("center");
  });

  it("clamps AI/MCP frame so the button stays inside the screen", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-clamp-"));
    roots.push(root);
    createProject({ root, name: "clamp", platform: "qm10xd" });
    const loaded = openProject(root);
    const screenId = loaded.project.defaultScreen;
    const screen = loaded.screens.get(screenId)!;
    const { w: sw, h: sh } = screen.frame;

    const node = addChildNode(loaded, screenId, screenId, "button", {
      frame: { x: 900, y: 800, w: 120, h: 40 },
    });
    expect(node.frame.x + node.frame.w).toBeLessThanOrEqual(sw);
    expect(node.frame.y + node.frame.h).toBeLessThanOrEqual(sh);
    expect(node.frame.x).toBeGreaterThanOrEqual(0);
    expect(node.frame.y).toBeGreaterThanOrEqual(0);

    updateNodeProps(loaded, screenId, node.id, { frame: { x: -50, y: 999 } });
    const again = findNode(screen, node.id)!;
    expect(again.frame.x).toBe(0);
    expect(again.frame.y + again.frame.h).toBeLessThanOrEqual(sh);
  });
});
