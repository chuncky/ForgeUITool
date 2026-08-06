import { describe, expect, it } from "vitest";
import { resolveCanvasStyleProps } from "../apps/designer/src/utils/style";

describe("V1-B preview_state canvas style merge", () => {
  it("overlays main[pressed] onto main.default", () => {
    const style = {
      main: {
        default: { bg_color: "#111111ff", text_color: "#eeeeeeff", radius: 4 },
        pressed: { bg_color: "#ff0000ff" },
        focused: { bg_color: "#0000ffff" },
      },
    };
    expect(resolveCanvasStyleProps(style, "default").bg_color).toBe("#111111ff");
    expect(resolveCanvasStyleProps(style, "pressed").bg_color).toBe("#ff0000ff");
    expect(resolveCanvasStyleProps(style, "pressed").text_color).toBe("#eeeeeeff");
    expect(resolveCanvasStyleProps(style, "focused").bg_color).toBe("#0000ffff");
  });

  it("WidgetView wires buildWidgetCanvasChrome (resolves preview_state styles)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "..");
    const src = fs.readFileSync(path.join(root, "apps/designer/src/components/WidgetView.vue"), "utf8");
    expect(src).toContain("buildWidgetCanvasChrome");
    const chrome = fs.readFileSync(path.join(root, "apps/designer/src/utils/canvas-chrome.ts"), "utf8");
    expect(chrome).toContain("resolveCanvasStyleProps");
    expect(chrome).toContain("preview_state");
  });
});
