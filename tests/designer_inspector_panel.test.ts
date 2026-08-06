/**
 * @vitest-environment happy-dom
 */
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../apps/designer/src/components/PropPanel.vue", () => ({
  default: {
    template: '<section class="prop-panel" data-testid="prop-panel">属性内容</section>',
  },
}));

vi.mock("../apps/designer/src/components/EventPanel.vue", () => ({
  default: {
    template: '<section class="block" data-testid="event-panel">事件内容</section>',
  },
}));

import InspectorPanel from "../apps/designer/src/components/InspectorPanel.vue";
import { useUiStore } from "../apps/designer/src/stores/ui";

function mountInspector() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const wrapper = mount(InspectorPanel, {
    global: {
      plugins: [pinia],
    },
  });
  return { wrapper, ui: useUiStore() };
}

function panelDisplay(wrapper: ReturnType<typeof mount>, testId: string) {
  return wrapper.get(`[data-testid=${testId}]`).element.style.display;
}

describe("InspectorPanel tabs (Beken 属性 | 事件)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("defaults to props tab with PropPanel visible", () => {
    const { wrapper, ui } = mountInspector();

    expect(ui.rightTab).toBe("props");

    const tabs = wrapper.findAll(".tabs button");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.text()).toBe("属性");
    expect(tabs[1]?.text()).toBe("事件");
    expect(tabs[0]?.classes()).toContain("active");
    expect(tabs[1]?.classes()).not.toContain("active");

    expect(panelDisplay(wrapper, "prop-panel")).not.toBe("none");
    expect(panelDisplay(wrapper, "event-panel")).toBe("none");
  });

  it("switches to events tab on click and shows EventPanel only", async () => {
    const { wrapper, ui } = mountInspector();

    await wrapper.findAll(".tabs button")[1]?.trigger("click");

    expect(ui.rightTab).toBe("events");

    const tabs = wrapper.findAll(".tabs button");
    expect(tabs[0]?.classes()).not.toContain("active");
    expect(tabs[1]?.classes()).toContain("active");

    expect(panelDisplay(wrapper, "prop-panel")).toBe("none");
    expect(panelDisplay(wrapper, "event-panel")).not.toBe("none");
  });

  it("switches back to props tab", async () => {
    const { wrapper, ui } = mountInspector();
    const tabs = wrapper.findAll(".tabs button");

    await tabs[1]?.trigger("click");
    await tabs[0]?.trigger("click");

    expect(ui.rightTab).toBe("props");
    expect(panelDisplay(wrapper, "prop-panel")).not.toBe("none");
    expect(panelDisplay(wrapper, "event-panel")).toBe("none");
  });

  it("supports arrow-key tab navigation (V1-C focus order)", async () => {
    const { wrapper, ui } = mountInspector();
    const tablist = wrapper.get('[role="tablist"]');

    await tablist.trigger("keydown", { key: "ArrowRight" });
    expect(ui.rightTab).toBe("events");

    await tablist.trigger("keydown", { key: "ArrowLeft" });
    expect(ui.rightTab).toBe("props");

    await tablist.trigger("keydown", { key: "End" });
    expect(ui.rightTab).toBe("events");

    await tablist.trigger("keydown", { key: "Home" });
    expect(ui.rightTab).toBe("props");
  });

  it("marks inactive tabpanel inert/hidden for tab order", () => {
    const { wrapper } = mountInspector();
    const propsPanel = wrapper.get("#inspector-panel-props");
    const eventsPanel = wrapper.get("#inspector-panel-events");
    expect(propsPanel.attributes("inert")).toBeUndefined();
    expect(eventsPanel.attributes("inert")).toBeDefined();
    expect(eventsPanel.attributes("hidden")).toBeDefined();
  });
});
