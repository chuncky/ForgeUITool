/**
 * BK-aligned canvas coordinate / out-of-screen contract tests (V1.32).
 *
 * Beken (`canvas-content-inner`):
 * - Device content layer clips with overflow:hidden (when screen radius > 0;
 *   ForgeUI always clips via `.screen-clip` for LVGL-accurate preview).
 * - Widget root stays position:absolute; left/top = logical frame.x/y
 *   (same numbers CodeGen emits as lv_obj_set_pos).
 * - ForgeUI additionally clamps frame to parent on add/update/drag so persisted
 *   coords never sit outside the screen — stricter than BK drag, matches sim clip.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  addChildNode,
  clampFrameWithinParent,
  createProject,
  findNode,
  openProject,
  updateNodeProps,
} from "@forgeui/core";
import { clampFrameToParent } from "../apps/designer/src/utils/frame-clamp";
import { buildWidgetCanvasChrome, splitCanvasChrome } from "../apps/designer/src/utils/canvas-chrome";

const rootDir = resolve(".");

describe("BK-aligned: widgets cannot persist outside screen", () => {
  const tmpRoots: string[] = [];
  afterEach(() => {
    for (const r of tmpRoots) fs.rmSync(r, { recursive: true, force: true });
    tmpRoots.length = 0;
  });

  it("Canvas has BK-like content clip layer (.screen-clip overflow:hidden)", () => {
    const src = readFileSync(resolve(rootDir, "apps/designer/src/components/Canvas.vue"), "utf8");
    expect(src).toMatch(/class="screen-clip"/);
    expect(src).toMatch(/\.screen-clip\s*\{[^}]*overflow:\s*hidden/s);
    // Must not reintroduce the bug that broke absolute coords:
    expect(src).not.toMatch(/\.screen\s*>\s*:not\(\.screen-bg-img\)\s*\{[^}]*position:\s*relative/s);
  });

  it("core addChildNode + updateNodeProps clamp into screen (AI/MCP / panel)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-bk-out-"));
    tmpRoots.push(tmp);
    createProject({ root: tmp, name: "out", platform: "qm10xd" });
    const loaded = openProject(tmp);
    const screenId = loaded.project.defaultScreen;
    const screen = loaded.screens.get(screenId)!;
    const { w: sw, h: sh } = screen.frame;

    const node = addChildNode(loaded, screenId, screenId, "button", {
      frame: { x: sw + 200, y: sh + 100, w: 120, h: 40 },
    });
    expect(node.frame.x).toBeGreaterThanOrEqual(0);
    expect(node.frame.y).toBeGreaterThanOrEqual(0);
    expect(node.frame.x + node.frame.w).toBeLessThanOrEqual(sw);
    expect(node.frame.y + node.frame.h).toBeLessThanOrEqual(sh);

    updateNodeProps(loaded, screenId, node.id, { frame: { x: -80, y: sh + 50 } });
    const again = findNode(screen, node.id)!;
    expect(again.frame.x).toBe(0);
    expect(again.frame.y + again.frame.h).toBeLessThanOrEqual(sh);
  });

  it("designer live clamp matches core clampFrameWithinParent", () => {
    const cases = [
      { frame: { x: 900, y: -20, w: 100, h: 40 }, pw: 480, ph: 320 },
      { frame: { x: -10, y: -10, w: 50, h: 50 }, pw: 200, ph: 200 },
      { frame: { x: 100, y: 100, w: 500, h: 500 }, pw: 480, ph: 320 },
    ];
    for (const c of cases) {
      const a = clampFrameToParent(c.frame, c.pw, c.ph);
      const b = clampFrameWithinParent(c.frame, c.pw, c.ph);
      expect(a.x).toBe(b.x);
      expect(a.y).toBe(b.y);
      expect(a.w).toBe(b.w);
      expect(a.h).toBe(b.h);
      expect(a.x + a.w).toBeLessThanOrEqual(c.pw);
      expect(a.y + a.h).toBeLessThanOrEqual(c.ph);
    }
  });

  it("WidgetView drag/resize paths call clampFrameToParent", () => {
    const src = readFileSync(resolve(rootDir, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toContain("clampFrameToParent");
    expect(src).toContain("parentContentSize");
    // live drag must not only Math.max(0) without upper bound
    expect(src).not.toMatch(
      /onDragStart[\s\S]*?x:\s*Math\.max\(0,\s*Math\.round\(ox/ ,
    );
  });
});

describe("BK-aligned: canvas left/top == frame == sim lv_obj_set_pos", () => {
  it("widget shell chrome uses absolute left/top from frame.x/y", () => {
    const chrome = buildWidgetCanvasChrome({
      type: "button",
      frame: { x: 88, y: 120, w: 100, h: 40 },
      props: { text: "Hi" },
      style: {},
    });
    expect(chrome.left).toBe("88px");
    expect(chrome.top).toBe("120px");
    expect(chrome.width).toBe("100px");
    expect(chrome.height).toBe("40px");

    const { shell, body } = splitCanvasChrome(chrome);
    expect(shell.left).toBe("88px");
    expect(shell.top).toBe("120px");
    // overflow (long_mode etc.) stays on body, not shell — BK CanvasComponent pattern
    expect(shell.overflow).toBeUndefined();
  });

  it("WidgetView shell is position:absolute (not overridden by Canvas)", () => {
    const widget = readFileSync(resolve(rootDir, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(widget).toMatch(/\.widget\s*\{[^}]*position:\s*absolute/s);

    const canvas = readFileSync(resolve(rootDir, "apps/designer/src/components/Canvas.vue"), "utf8");
    expect(canvas).not.toMatch(/\.screen\s*>\s*:not\(\.screen-bg-img\)\s*\{[^}]*position:\s*relative/s);
    expect(canvas).toContain("must stay absolute so left/top == frame.x/y");
  });

  it("drop/pointer mapping uses .screen-clip (logical device content)", () => {
    const src = readFileSync(resolve(rootDir, "apps/designer/src/components/Canvas.vue"), "utf8");
    expect(src).toContain('querySelector(".screen-clip")');
    expect(src).toContain("screenLocalFromClient");
  });

  it("CodeGen emits lv_obj_set_pos from the same frame.x/y", () => {
    const src = readFileSync(resolve(rootDir, "packages/codegen/src/generate.ts"), "utf8");
    expect(src).toMatch(/lv_obj_set_pos\(\$\{sym\},\s*\$\{x\},\s*\$\{y\}\)/);
    expect(src).toMatch(/const x = node\.frame\.x/);
    expect(src).toMatch(/const y = node\.frame\.y/);
  });

  it("optimistic store patch clamps frame like core (no canvas/sim desync flash)", () => {
    const src = readFileSync(resolve(rootDir, "apps/designer/src/stores/project.ts"), "utf8");
    expect(src).toContain("applyLocalNodePatch");
    expect(src).toContain("pw - w");
    expect(src).toContain("ph - h");
  });
});
