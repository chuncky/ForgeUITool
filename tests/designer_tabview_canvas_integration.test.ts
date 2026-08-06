/**
 * Tabview：扩展数据 tabs[].name 必须反映到 WidgetView 画布 DOM（非仅 buildTabviewChrome 单测）。
 * @vitest-environment happy-dom
 */
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addChildNode, createProject, openProject, updateNodeProps } from "../packages/core/src/index.js";
import { buildTabviewChrome, resolveTabEntryLabel, isTabviewChildVisible } from "../apps/designer/src/utils/tabview-chrome";
import WidgetView from "../apps/designer/src/components/WidgetView.vue";
import type { UiNode } from "../apps/designer/src/env";

vi.mock("../apps/designer/src/utils/asset-url", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../apps/designer/src/utils/asset-url")>();
  return {
    ...actual,
    resolveProjectAssetDataUrl: async () => null,
    fontPathForId: () => null,
    ensureCanvasFontFace: () => null,
  };
});

function tabviewNode(extraData: Record<string, unknown>): UiNode {
  return {
    id: "tabview_1",
    type: "tabview",
    name: "Tabs",
    frame: { x: 0, y: 0, w: 280, h: 160 },
    props: { tab_bar_size: 50, tab_bar_position: "TOP" },
    extraData,
    style: {},
    events: [],
    children: [],
  };
}

describe("tabview canvas integration", () => {
  it("updateNodeProps(extraData.tabs) → buildTabviewChrome 文案变化", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-tv-int-"));
    createProject({ root, name: "tv", platform: "qm10xd" });
    const loaded = openProject(root);
    const sid = loaded.project.defaultScreen;
    const node = addChildNode(loaded, sid, sid, "tabview");
    updateNodeProps(loaded, sid, node.id, {
      extraData: { tabs: [{ name: "通用" }, { name: "网络" }], selectedTabIndex: 0 },
    });
    const chrome = buildTabviewChrome({
      frame: node.frame,
      props: node.props as Record<string, unknown>,
      style: {},
      extraData: node.extraData ?? null,
    });
    expect(chrome.tabs).toEqual(["通用", "网络"]);
  });

  it("WidgetView 渲染 extraData.tabs 变更后的标签文案", async () => {
    setActivePinia(createPinia());
    const node = tabviewNode({
      tabs: [{ name: "Tab 1" }, { name: "Tab 2" }],
      selectedTabIndex: 0,
    });
    const wrapper = mount(WidgetView, { props: { node } });
    expect(wrapper.findAll(".tab-item").map((el) => el.text())).toEqual(["Tab 1", "Tab 2"]);

    await wrapper.setProps({
      node: tabviewNode({
        tabs: [{ name: "设置" }, { name: "关于" }],
        selectedTabIndex: 1,
      }),
    });
    expect(wrapper.findAll(".tab-item").map((el) => el.text())).toEqual(["设置", "关于"]);
  });

  it("WidgetView 将 tabview 子控件放进 tab-content，标签栏不被子层盖住", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../apps/designer/src/components/WidgetView.vue"),
      "utf8",
    );
    expect(src).toContain("tab-content");
    expect(src).toMatch(/node\.type !== ['"]tabview['"]/);
    expect(src).toContain("z-index: 2");
  });

  it("TabsExtraDataEditor 提供 BK 标签页名称字段", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../apps/designer/src/components/prop-panel/extra-data/TabsExtraDataEditor.vue"),
      "utf8",
    );
    expect(src).toContain("标签页名称");
    expect(src).toContain("新增标签页");
    expect(src).toContain("v-model");
    expect(src).toContain("emitPatch");
  });

  it("patchSelected 对 extraData 做乐观本地更新", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../apps/designer/src/stores/project.ts"),
      "utf8",
    );
    expect(src).toContain("applyLocalNodePatch");
    expect(src).toContain("patch.extraData");
  });

  it("resolveTabEntryLabel 兼容 name / title / 字符串", () => {
    expect(resolveTabEntryLabel({ name: "A" })).toBe("A");
    expect(resolveTabEntryLabel({ title: "Legacy" })).toBe("Legacy");
    expect(resolveTabEntryLabel("Plain")).toBe("Plain");
  });

  it("isTabviewChildVisible 按 selectedTabIndex 过滤子控件", () => {
    expect(isTabviewChildVisible({ props: { tabIndex: 0 } }, 0)).toBe(true);
    expect(isTabviewChildVisible({ props: { tabIndex: 1 } }, 0)).toBe(false);
    expect(isTabviewChildVisible({ props: { tabIndex: 1 } }, 1)).toBe(true);
    expect(isTabviewChildVisible({ props: {} }, 1)).toBe(true); // unassigned → all tabs
    expect(isTabviewChildVisible({ layout: { tabIndex: 2 }, props: {} }, 2)).toBe(true);
  });
});
