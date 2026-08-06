import { describe, expect, it } from "vitest";
import {
  defaultI18nConfig,
  normalizeI18n,
  resolveI18nText,
  upsertI18nString,
  exportXliff12,
  importXliff12,
  mergeXliffIntoI18n,
  computeI18nProgress,
  unitTranslationState,
  createTimelineAnimation,
  createAnimTrack,
  sampleTrackValue,
  normalizeAnimations,
} from "../src/index.js";
import type { ProjectDocument } from "../src/types.js";

describe("FR-042 i18n", () => {
  it("normalizes empty project i18n to defaults", () => {
    const cfg = normalizeI18n({} as ProjectDocument);
    expect(cfg.enabled).toBe(false);
    expect(cfg.locales.length).toBeGreaterThanOrEqual(2);
    expect(cfg.defaultLocale).toBe("en");
  });

  it("resolves text by locale with fallback", () => {
    const i18n = defaultI18nConfig();
    i18n.enabled = true;
    upsertI18nString(i18n, "hello", { values: { en: "Hello", "zh-CN": "你好" } });
    expect(resolveI18nText(i18n, "hello", "zh-CN")).toBe("你好");
    expect(resolveI18nText(i18n, "hello", "fr")).toBe("Hello");
  });
});

describe("FR-043 XLIFF", () => {
  it("round-trips export/import and merge", () => {
    const i18n = defaultI18nConfig();
    i18n.enabled = true;
    upsertI18nString(i18n, "title", { note: "home title", values: { en: "Home", "zh-CN": "首页" } });
    const xml = exportXliff12(i18n, { sourceLocale: "en", targetLocale: "zh-CN", productName: "demo" });
    expect(xml).toContain('version="1.2"');
    expect(xml).toContain('id="title"');
    expect(xml).toContain("<source>Home</source>");
    expect(xml).toContain('<target state="translated">首页</target>');

    const parsed = importXliff12(xml);
    expect(parsed.sourceLocale).toBe("en");
    expect(parsed.targetLocale).toBe("zh-CN");
    expect(parsed.units).toHaveLength(1);
    expect(parsed.units[0]?.target).toBe("首页");
    expect(parsed.units[0]?.state).toBe("translated");

    const empty = defaultI18nConfig();
    const n = mergeXliffIntoI18n(empty, parsed);
    expect(n).toBe(1);
    expect(empty.enabled).toBe(true);
    expect(resolveI18nText(empty, "title", "zh-CN")).toBe("首页");
  });

  it("computes progress and exports onlyMissing", () => {
    const i18n = defaultI18nConfig();
    i18n.enabled = true;
    upsertI18nString(i18n, "a", { values: { en: "A", "zh-CN": "甲" } });
    upsertI18nString(i18n, "b", { values: { en: "B" } });
    const prog = computeI18nProgress(i18n);
    const zh = prog.locales.find((l) => l.localeId === "zh-CN");
    expect(zh?.translated).toBe(1);
    expect(zh?.missing).toBe(1);
    expect(zh?.missingIds).toContain("b");
    expect(unitTranslationState(i18n.strings[1]!, "en", "zh-CN")).toBe("needs-translation");

    const xml = exportXliff12(i18n, {
      sourceLocale: "en",
      targetLocale: "zh-CN",
      onlyMissing: true,
    });
    expect(xml).toContain('id="b"');
    expect(xml).not.toContain('id="a"');
    expect(xml).toContain('state="needs-translation"');
  });
});

describe("FR-071 timeline animations", () => {
  it("creates animation + track and samples keyframes", () => {
    const anims = [] as ReturnType<typeof createTimelineAnimation>[];
    const anim = createTimelineAnimation(anims, { name: "fade", duration: 1000 });
    anims.push(anim);
    const track = createAnimTrack(anim, { nodeId: "btn1", property: "opacity" });
    track.keyframes = [
      { t: 0, value: 0 },
      { t: 1000, value: 255 },
    ];
    expect(sampleTrackValue(track, 0)).toBe(0);
    expect(sampleTrackValue(track, 500)).toBe(127.5);
    expect(sampleTrackValue(track, 1000)).toBe(255);

    const project = { animations: anims } as ProjectDocument;
    expect(normalizeAnimations(project)).toHaveLength(1);
  });
});
