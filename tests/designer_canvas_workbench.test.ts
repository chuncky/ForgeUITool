import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("P0 canvas workbench (FR-021a～d / FR-010g)", () => {
  const root = path.resolve(import.meta.dirname, "..");

  it("canvasView store exposes zoom / pan / rulers / grid / pointer defaults", () => {
    const src = fs.readFileSync(path.join(root, "apps/designer/src/stores/canvasView.ts"), "utf8");
    expect(src).toContain("showRulers");
    expect(src).toContain("showGrid");
    expect(src).toContain("showPointerCoords");
    expect(src).toContain("fitToWindow");
    expect(src).toContain("zoomIn");
    expect(src).toContain("panX");
    expect(src).toContain("panY");
    expect(src).toContain("resetPan");
    expect(src).toContain("ZOOM_MIN");
  });

  it("Canvas.vue: no scrollbars; wheel zoom; left-drag pan", () => {
    const canvas = fs.readFileSync(path.join(root, "apps/designer/src/components/Canvas.vue"), "utf8");
    expect(canvas).toContain("useCanvasViewStore");
    expect(canvas).toContain("视图 ▾");
    expect(canvas).toContain("showRulers");
    expect(canvas).toContain("showGrid");
    expect(canvas).toContain("showPointerCoords");
    expect(canvas).toContain("pointer-coords");
    expect(canvas).toContain("drawRulers");
    expect(canvas).toContain("onWheelZoom");
    expect(canvas).toContain("@wheel.prevent");
    expect(canvas).toContain("onStageMouseDown");
    expect(canvas).toContain("onPanMove");
    expect(canvas).toContain("panX");
    expect(canvas).toContain("overflow: hidden");
    expect(canvas).not.toMatch(/overflow:\s*auto/);
    expect(canvas).toContain("适应");
  });

  it("BottomAuxPanel provides log / assets / config tabs without events", () => {
    const aux = fs.readFileSync(path.join(root, "apps/designer/src/components/BottomAuxPanel.vue"), "utf8");
    const workbench = fs.readFileSync(
      path.join(root, "apps/designer/src/components/DesignerWorkbench.vue"),
      "utf8",
    );
    const ui = fs.readFileSync(path.join(root, "apps/designer/src/stores/ui.ts"), "utf8");

    expect(ui).toContain("bottomAuxTab");
    expect(ui).toContain('"log" | "assets" | "config"');
    expect(aux).toContain("日志");
    expect(aux).toContain("资源");
    expect(aux).toContain("配置");
    expect(aux).not.toMatch(/label:\s*[\"']事件[\"']/);
    expect(aux).toContain("showProjectSettings");
    expect(aux).toContain("importImages");
    expect(workbench).toContain("BottomAuxPanel");
    expect(workbench).not.toMatch(/<LogPanel\s*\/>/);
  });
});
