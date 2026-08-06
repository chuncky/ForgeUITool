import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listPaletteWidgetSpecs } from "@forgeui/core";
import { STYLE_SUBGROUPS } from "../apps/designer/src/utils/style-fields";

const repoRoot = path.resolve(import.meta.dirname, "..");
const bekenPropsDir = path.join(repoRoot, "docs/beken界面/属性面板");

/** Handbook §2.3 group order vs PropPanel wiring. */
const REQUIRED_GROUPS = ["位置信息", "属性", "行为配置", "样式"] as const;

/** Beken screenshot folders that should exist for representative widgets. */
const BEKEN_SHOT_DIRS = [
  "按钮属性",
  "标签属性",
  "图片属性",
  "滑块属性",
  "页面属性",
] as const;

describe("V1-B prop panel structure smoke vs Beken/handbook", () => {
  it("keeps handbook group titles in Layout/Behavior/Style modules", () => {
    const layout = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/LayoutGroup.vue"),
      "utf8",
    );
    const behavior = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/BehaviorGroup.vue"),
      "utf8",
    );
    const style = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/StyleGroup.vue"),
      "utf8",
    );
    const propPanel = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/PropPanel.vue"),
      "utf8",
    );
    const inspector = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/InspectorPanel.vue"),
      "utf8",
    );

    expect(layout).toMatch(/位置信息|屏幕信息/);
    expect(propPanel).toContain("#title>属性");
    expect(behavior).toContain("行为配置");
    expect(style).toContain("#title>样式");
    expect(inspector).toMatch(/属性|事件/);

    for (const g of REQUIRED_GROUPS) {
      expect(
        layout.includes(g) || propPanel.includes(g) || behavior.includes(g) || style.includes(g),
      ).toBe(true);
    }
  });

  it("exposes Beken-aligned style subgroups including space & image & gradient", () => {
    const ids = STYLE_SUBGROUPS.map((g) => g.id);
    for (const id of ["background", "font", "space", "border", "padding", "shadow", "outline", "image"]) {
      expect(ids).toContain(id);
    }
    const bg = STYLE_SUBGROUPS.find((g) => g.id === "background")!;
    expect(bg.fields.some((f) => f.key === "bg_grad_dir")).toBe(true);
    expect(bg.fields.some((f) => f.key === "radius")).toBe(false);
    const border = STYLE_SUBGROUPS.find((g) => g.id === "border")!;
    expect(border.fields.some((f) => f.key === "radius")).toBe(true);
    expect(border.fields.some((f) => f.key === "clip_corner")).toBe(true);
    const space = STYLE_SUBGROUPS.find((g) => g.id === "space")!;
    expect(space.fields.some((f) => f.key === "text_letter_space")).toBe(true);
    const font = STYLE_SUBGROUPS.find((g) => g.id === "font")!;
    expect(font.fields.some((f) => f.key === "text_letter_space")).toBe(false);
    const img = STYLE_SUBGROUPS.find((g) => g.id === "image")!;
    expect(img.fields.some((f) => f.key === "img_recolor")).toBe(true);
  });

  it("registers 38 palette widgets (handbook / Beken matrix)", () => {
    expect(listPaletteWidgetSpecs().length).toBe(38);
  });

  it("has Beken reference docs and key screenshot folders", () => {
    expect(fs.existsSync(path.join(bekenPropsDir, "README.md"))).toBe(true);
    expect(fs.existsSync(path.join(bekenPropsDir, "属性面板说明.txt"))).toBe(true);
    const note = fs.readFileSync(path.join(bekenPropsDir, "属性面板说明.txt"), "utf8");
    expect(note).toMatch(/样式|Parts|States|属性面板/);

    for (const dir of BEKEN_SHOT_DIRS) {
      const full = path.join(bekenPropsDir, dir);
      expect(fs.existsSync(full), `missing ${dir}`).toBe(true);
    }
  });

  it("LayoutGroup + StyleGroup cover Part/State and geometry fields", () => {
    const layout = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/LayoutGroup.vue"),
      "utf8",
    );
    const style = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/prop-panel/StyleGroup.vue"),
      "utf8",
    );
    expect(layout).toContain("anchor-grid");
    expect(layout).toContain("alignFrameToParent");
    expect(layout).toMatch(/pos-tl|pos-br/);
    expect(layout).toMatch(/rotation|旋转/);
    expect(style).toContain("PART");
    expect(style).toContain("STATE");
    expect(style).toContain("showPartSelector");
    expect(style).toContain("disabledSubgroups");
    expect(style).toContain("subgroup-summary");
    expect(style).toContain("toggleSubgroup");
    expect(style).not.toContain("toggleSubgroupOpen");
    expect(style).not.toMatch(/class=\"chev\"/);
    // BK: 显示→展开编辑；隐藏→收起（与 disabledSubgroups 同步）
    expect(style).toContain("!isSubgroupOff(group.id)");
  });
});
