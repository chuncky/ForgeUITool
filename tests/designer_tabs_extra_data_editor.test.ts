/**
 * BK 对照：子项「标签页名称」编辑必须写回 extraData.tabs 并驱动画布。
 * @vitest-environment happy-dom
 */
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import TabsExtraDataEditor from "../apps/designer/src/components/prop-panel/extra-data/TabsExtraDataEditor.vue";
import { buildTabviewChrome } from "../apps/designer/src/utils/tabview-chrome";

describe("TabsExtraDataEditor — BK 标签页名称", () => {
  it("输入标签页名称后 emit extraData.tabs，且 chrome 文案同步", async () => {
    const w = mount(TabsExtraDataEditor, {
      props: {
        model: {
          tabs: [{ name: "Tab 1" }, { name: "Tab 2" }],
          selectedTabIndex: 0,
        },
      },
    });
    await w.vm.$nextTick();

    const input = w.get('[data-testid="tab-name-input"]');
    expect((input.element as HTMLInputElement).value).toBe("Tab 1");

    await input.setValue("通用");
    await input.trigger("input");

    const emitted = w.emitted("change");
    expect(emitted?.length).toBeGreaterThan(0);
    const last = emitted![emitted!.length - 1]![0] as {
      tabs: Array<{ name: string }>;
      selectedTabIndex: number;
    };
    expect(last.tabs[0]?.name).toBe("通用");
    expect(last.tabs[1]?.name).toBe("Tab 2");

    const chrome = buildTabviewChrome({
      frame: { x: 0, y: 0, w: 280, h: 160 },
      props: { tab_bar_size: 50, tab_bar_position: "TOP" },
      extraData: last,
    });
    expect(chrome.tabs).toEqual(["通用", "Tab 2"]);
  });

  it("缺省 tabs 时自动补齐默认项并 emit", async () => {
    const w = mount(TabsExtraDataEditor, {
      props: { model: {} },
    });
    await w.vm.$nextTick();
    const emitted = w.emitted("change");
    expect(emitted?.length).toBeGreaterThan(0);
    const last = emitted![emitted!.length - 1]![0] as { tabs: Array<{ name: string }> };
    expect(last.tabs.length).toBe(2);
    expect(last.tabs.map((t) => t.name)).toEqual(["Tab 1", "Tab 2"]);
    expect(w.text()).toContain("标签页名称");
    expect(w.text()).toContain("新增标签页");
  });

  it("切换 chip 写回 selectedTabIndex（画布当前页）", async () => {
    const w = mount(TabsExtraDataEditor, {
      props: {
        model: {
          tabs: [{ name: "A" }, { name: "B" }],
          selectedTabIndex: 0,
          initialTabIndex: 0,
        },
      },
    });
    const chips = w.findAll('[data-testid="tab-chip"]');
    expect(chips).toHaveLength(2);
    await chips[1]!.trigger("click");
    const last = w.emitted("change")!.at(-1)![0] as {
      tabs: Array<{ name: string }>;
      selectedTabIndex: number;
    };
    expect(last.selectedTabIndex).toBe(1);
    expect(chips[1]!.classes()).toContain("on");
  });

  it("切换 chip 后编辑对应标签名称", async () => {
    const w = mount(TabsExtraDataEditor, {
      props: {
        model: {
          tabs: [{ name: "A" }, { name: "B" }],
          selectedTabIndex: 0,
        },
      },
    });
    const chips = w.findAll('[data-testid="tab-chip"]');
    expect(chips).toHaveLength(2);
    await chips[1]!.trigger("click");
    const input = w.get('[data-testid="tab-name-input"]');
    expect((input.element as HTMLInputElement).value).toBe("B");
    await input.setValue("网络");
    await input.trigger("input");
    const last = w.emitted("change")!.at(-1)![0] as { tabs: Array<{ name: string }> };
    expect(last.tabs.map((t) => t.name)).toEqual(["A", "网络"]);
  });
});
