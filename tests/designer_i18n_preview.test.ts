import { describe, expect, it } from "vitest";
import { nodeDisplayText, resolveI18nDisplayText } from "../apps/designer/src/utils/i18n-display";

describe("FR-042 designer preview locale", () => {
  const i18n = {
    enabled: true,
    defaultLocale: "en",
    previewLocale: "zh-CN",
    strings: [{ id: "hello", values: { en: "Hello", "zh-CN": "你好" } }],
  };

  it("resolves preview locale text with fallback", () => {
    expect(resolveI18nDisplayText(i18n, "hello", "fallback")).toBe("你好");
    expect(resolveI18nDisplayText({ ...i18n, previewLocale: "en" }, "hello", "x")).toBe("Hello");
    expect(resolveI18nDisplayText(i18n, "missing", "fallback")).toBe("fallback");
    expect(resolveI18nDisplayText({ ...i18n, enabled: false }, "hello", "plain")).toBe("plain");
  });

  it("nodeDisplayText prefers i18nKey when enabled", () => {
    expect(nodeDisplayText({ text: "Button", i18nKey: "hello" }, i18n)).toBe("你好");
    expect(nodeDisplayText({ text: "Button" }, i18n)).toBe("Button");
  });
});
