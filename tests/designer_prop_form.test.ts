/**
 * @vitest-environment happy-dom
 */
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import DynamicPropForm from "../apps/designer/src/components/prop-panel/DynamicPropForm.vue";
import type { PropSpecMeta } from "../apps/designer/src/env";

vi.mock("../apps/designer/src/stores/ui", () => ({
  useUiStore: () => ({
    showAssets: false,
    openAssetsForImagePick: vi.fn(),
  }),
}));

vi.mock("../apps/designer/src/stores/project", () => ({
  useProjectStore: () => ({
    imageAssets: [],
    i18nConfig: {
      enabled: false,
      strings: [],
      defaultLocale: "zh-CN",
      previewLocale: "zh-CN",
    },
  }),
}));

const SPECS: PropSpecMeta[] = [
  { name: "text", type: "text", label: "文本", default: "Hi" },
  { name: "value", type: "number", label: "数值", default: 1 },
  { name: "checked", type: "boolean", label: "选中", default: false },
  {
    name: "mode",
    type: "enum",
    label: "模式",
    default: "A",
    enum: ["A", "B"],
    enumLabels: { A: "甲", B: "乙" },
  },
  { name: "tint", type: "color", label: "颜色", default: "#112233ff" },
  { name: "src", type: "imageSrc", label: "图片", default: "" },
  { name: "range", type: "range", label: "范围", default: { min: 0, max: 10 } },
];

describe("DynamicPropForm", () => {
  it("renders PropSpec field types", () => {
    setActivePinia(createPinia());
    const wrapper = mount(DynamicPropForm, {
      props: {
        specs: SPECS,
        nodeProps: {
          text: "Hello",
          value: 5,
          checked: true,
          mode: "B",
          tint: "#aabbccff",
          src: "assets/a.png",
          range: { min: 1, max: 9 },
        },
      },
    });

    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.find('input[type="number"]').exists()).toBe(true);
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);
    expect(wrapper.find("select").exists()).toBe(true);
    expect(wrapper.find('input[type="color"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("选择");
  });

  it("text 类型默认单行 input，不重复兜底框（两个文本框问题）", () => {
    setActivePinia(createPinia());
    const wrapper = mount(DynamicPropForm, {
      props: {
        specs: [{ name: "text", type: "text", label: "文本", default: "Label" }],
        nodeProps: { text: "Hello world" },
      },
    });

    expect(wrapper.find("textarea").exists()).toBe(false);
    const textInputs = wrapper.findAll("input").filter((n) => {
      const t = n.attributes("type");
      return t === undefined || t === "text";
    });
    expect(textInputs).toHaveLength(1);
  });

  it("multiline text 仍用 textarea（如下拉 options）", () => {
    setActivePinia(createPinia());
    const wrapper = mount(DynamicPropForm, {
      props: {
        specs: [
          {
            name: "options",
            type: "text",
            label: "选项（每行一项）",
            default: "One\nTwo",
            multiline: true,
          },
        ],
        nodeProps: { options: "One\nTwo" },
      },
    });
    expect(wrapper.findAll("textarea")).toHaveLength(1);
    expect(wrapper.find('input[type="text"]').exists()).toBe(false);
  });

  it("emits change with parsed values", async () => {
    setActivePinia(createPinia());
    const wrapper = mount(DynamicPropForm, {
      props: { specs: SPECS.slice(0, 1), nodeProps: { text: "x" } },
    });

    await wrapper.find('input[type="text"]').setValue("updated");
    await wrapper.find('input[type="text"]').trigger("change");

    expect(wrapper.emitted("change")?.[0]).toEqual(["text", "updated"]);
  });

  it("emits range object when min/max edited", async () => {
    setActivePinia(createPinia());
    const wrapper = mount(DynamicPropForm, {
      props: {
        specs: SPECS.filter((s) => s.name === "range"),
        nodeProps: { range: { min: 0, max: 100 } },
      },
    });

    const inputs = wrapper.findAll('input[type="number"]');
    await inputs[0]!.setValue("5");
    await inputs[0]!.trigger("change");

    const payload = wrapper.emitted("change")?.[0];
    expect(payload?.[0]).toBe("range");
    expect(payload?.[1]).toEqual({ min: 5, max: 100 });
  });
});
