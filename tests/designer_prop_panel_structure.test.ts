import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const propPanelDir = path.join(repoRoot, "apps/designer/src/components/prop-panel");
const eventPanelDir = path.join(repoRoot, "apps/designer/src/components/event-panel");

describe("prop panel module structure (LLD supplement)", () => {
  it("includes decomposed prop-panel components", () => {
    for (const file of [
      "PropGroup.vue",
      "PropIdentityHeader.vue",
      "LayoutGroup.vue",
      "DynamicPropForm.vue",
      "BehaviorGroup.vue",
      "StyleGroup.vue",
    ]) {
      expect(fs.existsSync(path.join(propPanelDir, file))).toBe(true);
    }
  });

  it("PropPanel wires subcomponents per design doc", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/PropPanel.vue"),
      "utf8",
    );
    expect(src).toContain("DynamicPropForm");
    expect(src).toContain("StyleGroup");
    expect(src).toContain("BehaviorGroup");
    expect(src).toContain("LayoutGroup");
    expect(src).not.toContain("MAIN · DEFAULT");
  });

  it("LayoutGroup has 3×3 parent-align grid with distinct cell glyphs", () => {
    const src = fs.readFileSync(path.join(propPanelDir, "LayoutGroup.vue"), "utf8");
    expect(src).toContain("anchor-grid");
    expect(src).toContain("alignFrameToParent");
    expect(src).not.toContain("reanchorFrame");
    expect(src).toContain("parentWidth");
    for (const key of ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"]) {
      expect(src).toContain(`pos-${key}`);
    }
  });

  it("LayoutGroup has rotation and layout_type controls", () => {
    const lg = fs.readFileSync(path.join(propPanelDir, "LayoutGroup.vue"), "utf8");
    const pp = fs.readFileSync(path.join(repoRoot, "apps/designer/src/components/PropPanel.vue"), "utf8");
    expect(lg).toContain("旋转");
    expect(lg).toContain("flex_row");
    expect(lg).toContain("showLayoutType");
    expect(pp).toContain("layout_type");
  });

  it("StyleGroup always shows STATE; PART only when multi-part", () => {
    const src = fs.readFileSync(path.join(propPanelDir, "StyleGroup.vue"), "utf8");
    expect(src).toContain("PART *");
    expect(src).toContain("STATE *");
    expect(src).toContain("showPartSelector");
    expect(src).toContain("styleParts.length > 1");
    expect(src).not.toMatch(/v-if="showPartState"/);
    expect(src).toContain('v-if="showPartSelector"');
    expect(src).toContain("state-only");
  });

  it("EventPanel uses EventCard and ActionRow", () => {
    expect(fs.existsSync(path.join(eventPanelDir, "EventCard.vue"))).toBe(true);
    expect(fs.existsSync(path.join(eventPanelDir, "ActionRow.vue"))).toBe(true);
    const src = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/EventPanel.vue"),
      "utf8",
    );
    expect(src).toContain("EventCard");
  });
});

describe("designer style utils", () => {
  it("reads nested style.parts", async () => {
    const { readStyleProp } = await import("../apps/designer/src/utils/style.ts");
    const style = {
      parts: {
        main: { default: { bg_color: "#111111ff" } },
        indicator: { pressed: { bg_color: "#222222ff" } },
      },
    };
    expect(readStyleProp(style, "main", "default", "bg_color")).toBe("#111111ff");
    expect(readStyleProp(style, "indicator", "pressed", "bg_color")).toBe("#222222ff");
  });
});
