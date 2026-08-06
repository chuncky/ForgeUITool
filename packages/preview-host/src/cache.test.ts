import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  computeConfigureFingerprint,
  generatedAssetSourcesListing,
  generatedSourcesFingerprint,
  needsReconfigure,
  PREVIEW_TEMPLATE_VERSION,
  softCleanCmakeCache,
  writeBuildCache,
} from "./cache.js";

describe("preview incremental cache (FR-061b)", () => {
  it("detects when generated screens change and require reconfigure", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-fp-"));
    const gen = path.join(tmp, "forgeui_generated", "screens");
    fs.mkdirSync(gen, { recursive: true });
    fs.writeFileSync(path.join(tmp, "forgeui_generated", "ui.c"), "v1");
    fs.writeFileSync(path.join(gen, "home.c"), "screen1");
    const a = generatedSourcesFingerprint(tmp);
    fs.writeFileSync(path.join(gen, "settings.c"), "screen2");
    const b = generatedSourcesFingerprint(tmp);
    expect(a).not.toBe(b);
  });

  it("configure fingerprint changes when image/ or fonts/ .c appear (link fix)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-fp-assets-"));
    const gen = path.join(tmp, "forgeui_generated");
    const tpl = path.join(tmp, "tpl");
    fs.mkdirSync(path.join(gen, "screens"), { recursive: true });
    fs.mkdirSync(tpl, { recursive: true });
    for (const n of ["CMakeLists.txt", "main.c", "hal.c", "lv_conf.h", "optimize_drivers.cmake"]) {
      fs.writeFileSync(path.join(tpl, n), n);
    }
    fs.writeFileSync(path.join(gen, "screens", "home.c"), "s");
    expect(generatedAssetSourcesListing(tmp)).toBe("screens/home.c");
    const base = {
      templateVersion: PREVIEW_TEMPLATE_VERSION,
      projectRoot: tmp,
      templateDir: tpl,
      lvglRoot: "/lvgl",
      sdl2Root: "/sdl2",
      repoRoot: "/repo",
      display: { width: 480, height: 320, colorDepth: 16 },
      lvglVersion: "9.10.0",
    };
    const a = computeConfigureFingerprint(base);
    fs.mkdirSync(path.join(gen, "image"), { recursive: true });
    fs.writeFileSync(path.join(gen, "image", "forgeui_img_x.c"), "i");
    expect(generatedAssetSourcesListing(tmp)).toContain("image/forgeui_img_x.c");
    const b = computeConfigureFingerprint(base);
    expect(b).not.toBe(a);
  });

  it("skips reconfigure when fingerprint matches cache file", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-out-"));
    fs.writeFileSync(path.join(out, "CMakeCache.txt"), "# dummy");
    const fp = "abc123";
    writeBuildCache(out, {
      fingerprint: fp,
      configuredAt: new Date().toISOString(),
      buildType: "Release",
    });
    expect(needsReconfigure(out, fp)).toBe(false);
    expect(needsReconfigure(out, "other")).toBe(true);
    softCleanCmakeCache(out);
    expect(fs.existsSync(path.join(out, "CMakeCache.txt"))).toBe(false);
  });

  it("builds stable fingerprint from template version", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-fp2-"));
    const buildDir = path.join(tmp, "preview-build");
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(buildDir, "CMakeLists.txt"), "cmake");
    fs.writeFileSync(path.join(buildDir, "main.c"), "main");
    fs.writeFileSync(path.join(buildDir, "hal.c"), "hal");
    fs.writeFileSync(path.join(buildDir, "lv_conf.h"), "conf");
    fs.mkdirSync(path.join(tmp, "forgeui_generated"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "forgeui_generated", "ui.c"), "ui");
    const fp = computeConfigureFingerprint({
      templateVersion: PREVIEW_TEMPLATE_VERSION,
      projectRoot: tmp,
      templateDir: buildDir,
      lvglRoot: "/lvgl",
      sdl2Root: "/sdl2",
      repoRoot: "/repo",
      display: { width: 480, height: 320, colorDepth: 16 },
      lvglVersion: "9.10.0",
      generator: "MinGW Makefiles",
    });
    expect(fp).toHaveLength(20);
  });
});
