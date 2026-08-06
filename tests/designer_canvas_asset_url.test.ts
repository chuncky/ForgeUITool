/**
 * FR-016e-a/c：工程资源必须解析为可加载 data URL；禁止裸 assets/ 路径冒充完成。
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  bufferToDataUrl,
  canvasFontFamilyName,
  mimeFromAssetPath,
  normalizeAssetRelPath,
  readProjectAssetDataUrl,
  resolveAssetAbsPath,
} from "../apps/designer/electron/asset-data-url.mjs";
import { buildWidgetCanvasChrome } from "../apps/designer/src/utils/canvas-chrome";
import { isUsableDataUrl } from "../apps/designer/src/utils/asset-url";

/** 1×1 PNG */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("FR-016e-a project asset data URL", () => {
  it("normalizes and rejects path escape", () => {
    expect(normalizeAssetRelPath("assets/images/a.png")).toBe("assets/images/a.png");
    expect(normalizeAssetRelPath("../secret.png")).toBeNull();
    expect(normalizeAssetRelPath("C:/windows/x.png")).toBeNull();
    const root = path.join(os.tmpdir(), "forgeui-asset-root");
    fs.mkdirSync(root, { recursive: true });
    expect(resolveAssetAbsPath(root, "assets/x.png").ok).toBe(true);
    expect(resolveAssetAbsPath(root, "../outside.png").ok).toBe(false);
  });

  it("mimeFromAssetPath covers images and fonts", () => {
    expect(mimeFromAssetPath("a.png")).toBe("image/png");
    expect(mimeFromAssetPath("a.TTF")).toBe("font/ttf");
    expect(mimeFromAssetPath("a.woff2")).toBe("font/woff2");
  });

  it("reads real PNG under project root as data:image URL", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-asset-"));
    const rel = "assets/images/btn.png";
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, PNG_1X1);

    const res = readProjectAssetDataUrl(root, rel);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.mime).toBe("image/png");
    expect(res.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(isUsableDataUrl(res.dataUrl)).toBe(true);
    // round-trip: decode base64 length matches file
    const b64 = res.dataUrl.split(",")[1]!;
    expect(Buffer.from(b64, "base64").equals(PNG_1X1)).toBe(true);
  });

  it("missing file fails clearly", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-asset-miss-"));
    const res = readProjectAssetDataUrl(root, "assets/images/nope.png");
    expect(res.ok).toBe(false);
  });

  it("bufferToDataUrl embeds mime", () => {
    expect(bufferToDataUrl("image/png", PNG_1X1)).toMatch(/^data:image\/png;base64,/);
  });

  it("canvasFontFamilyName is CSS-safe", () => {
    expect(canvasFontFamilyName("@montserrat")).toBe("forgeui-font-montserrat");
    expect(canvasFontFamilyName("My Font!")).toBe("forgeui-font-My_Font_");
  });
});

describe("FR-016e canvas chrome uses only loadable bg", () => {
  function styleOf(defaults: Record<string, unknown>) {
    return { main: { default: defaults } };
  }

  it("raw assets/ path alone does NOT set backgroundImage (no fake complete)", () => {
    const s = buildWidgetCanvasChrome({
      type: "button",
      frame: { x: 0, y: 0, w: 100, h: 40 },
      props: { text: "B" },
      style: styleOf({ bg_image: "assets/images/btn.png" }),
    });
    expect(s.backgroundImage).toBeUndefined();
  });

  it("resolved data URL sets loadable backgroundImage", () => {
    const dataUrl = bufferToDataUrl("image/png", PNG_1X1);
    const s = buildWidgetCanvasChrome({
      type: "button",
      frame: { x: 0, y: 0, w: 100, h: 40 },
      props: { text: "B" },
      style: styleOf({ bg_image: "assets/images/btn.png" }),
      resolvedBgImage: dataUrl,
    });
    expect(String(s.backgroundImage)).toMatch(/^url\("data:image\/png;base64,/);
    expect(isUsableDataUrl(dataUrl)).toBe(true);
  });

  it("text_font_size maps to fontSize px", () => {
    const a = buildWidgetCanvasChrome({
      type: "button",
      frame: { x: 0, y: 0, w: 100, h: 40 },
      props: { text: "B" },
      style: styleOf({ text_font_size: 16 }),
    });
    const b = buildWidgetCanvasChrome({
      type: "button",
      frame: { x: 0, y: 0, w: 100, h: 40 },
      props: { text: "B" },
      style: styleOf({ text_font_size: 24 }),
    });
    expect(a.fontSize).toBe("16px");
    expect(b.fontSize).toBe("24px");
    expect(a.fontSize).not.toBe(b.fontSize);
  });

  it("resolvedFontFamily is applied", () => {
    const s = buildWidgetCanvasChrome({
      type: "button",
      frame: { x: 0, y: 0, w: 100, h: 40 },
      props: { text: "B" },
      style: styleOf({ text_font: "@montserrat" }),
      resolvedFontFamily: "forgeui-font-montserrat",
    });
    expect(s.fontFamily).toBe("forgeui-font-montserrat");
  });

  it("WidgetView / preload / IPC wire resolveAssetDataUrl", () => {
    const root = path.join(__dirname, "..");
    const view = fs.readFileSync(path.join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(view).toContain("resolveProjectAssetDataUrl");
    expect(view).toContain("resolvedBgImage");
    expect(view).toContain("ensureCanvasFontFace");
    expect(view).toMatch(/width:\s*100%/);
    const preload = fs.readFileSync(path.join(root, "apps/designer/electron/preload.cjs"), "utf8");
    expect(preload).toContain("resolveAssetDataUrl");
    const main = fs.readFileSync(path.join(root, "apps/designer/electron/main.mjs"), "utf8");
    expect(main).toContain("project:assetDataUrl");
    expect(main).toContain("readProjectAssetDataUrl");
  });
});
