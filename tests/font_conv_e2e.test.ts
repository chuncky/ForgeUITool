import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { isLikelyFontFile } from "@forgeui/codegen";
import {
  createProject,
  importFontAsset,
  openProject,
  saveProject,
} from "@forgeui/core";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureTtf = path.join(repoRoot, "tests/fixtures/forgeui-test.ttf");

/** Resolve a real TTF for lv_font_conv E2E; skip when unavailable (CI without fixture). */
function resolveE2eTtf(): string | null {
  if (process.env.FORGEUI_FONT_E2E === "0") return null;

  const fromEnv = process.env.FORGEUI_TEST_TTF;
  if (fromEnv && fs.existsSync(fromEnv) && isLikelyFontFile(fromEnv)) return fromEnv;

  if (fs.existsSync(fixtureTtf) && isLikelyFontFile(fixtureTtf)) return fixtureTtf;

  const windir = process.env.WINDIR ?? process.env.SystemRoot;
  if (windir) {
    for (const name of ["consola.ttf", "arial.ttf", "segoeui.ttf"]) {
      const candidate = path.join(windir, "Fonts", name);
      if (fs.existsSync(candidate) && isLikelyFontFile(candidate)) return candidate;
    }
  }

  return null;
}

describe("M7 lv_font_conv E2E (FR-041)", () => {
  const ttf = resolveE2eTtf();

  it.skipIf(!ttf)("generate emits bitmap font from real TTF via lv_font_conv", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-font-e2e-"));
    createProject({ root: tmp, name: "font-e2e", fromTemplate: "blank" });

    const loaded = openProject(tmp);
    const asset = importFontAsset(loaded, ttf!, { size: 12 });
    saveProject(loaded);

    const result = await generate(tmp);
    expect(result.ok).toBe(true);

    const base = `font_${asset.id}_${asset.size ?? 12}`;
    const hPath = path.join(tmp, "forgeui_generated/fonts", `${base}.h`);
    const cPath = path.join(tmp, "forgeui_generated/fonts", `${base}.c`);
    expect(fs.existsSync(hPath)).toBe(true);
    expect(fs.existsSync(cPath)).toBe(true);

    const h = fs.readFileSync(hPath, "utf8");
    const c = fs.readFileSync(cPath, "utf8");
    expect(h).toContain("Bitmap font from lv_font_conv");
    expect(h).not.toContain("Stub:");
    expect(c).not.toContain("lv_font_montserrat_14");
    expect(c).toContain(`const lv_font_t *forgeui_font_${asset.id}_${asset.size ?? 12}`);
    expect(result.diagnostics.some((d) => d.code === "E_FONT_OK")).toBe(true);
  });
});
