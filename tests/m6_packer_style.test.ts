import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openProject, saveProject, importFontAsset, updateNodeProps } from "@forgeui/core";
import { generate } from "@forgeui/codegen";
import { packProject } from "@forgeui/packer";
import { ReferenceLoader } from "@forgeui/loader";
import { lvglSelector } from "@forgeui/codegen";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

describe("M6 packer full package (AR-012)", () => {
  it("writes manifest + ui/ tree + assets (not skeleton)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-pack-full-"));
    copyDir(templateRoot, tmp);
    const result = await packProject(tmp);
    expect(result.ok).toBe(true);
    expect(result.skeleton).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "E_PACK_NOT_IMPL")).toBe(false);

    const manifest = JSON.parse(fs.readFileSync(path.join(result.outDir, "manifest.json"), "utf8"));
    expect(manifest.entryScreen).toBeTruthy();
    expect(manifest.minLoaderVersion).toBe("1.0.0");
    expect(fs.existsSync(path.join(result.outDir, "ui/project.meta.json"))).toBe(true);
    expect(fs.existsSync(path.join(result.outDir, "ui/screens/home.json"))).toBe(true);
    expect(fs.existsSync(path.join(result.outDir, "assets"))).toBe(true);
    expect(fs.existsSync(path.join(result.outDir, "assets/manifest.json"))).toBe(true);
    const assetsManifest = JSON.parse(
      fs.readFileSync(path.join(result.outDir, "assets/manifest.json"), "utf8"),
    );
    expect(Array.isArray(assetsManifest.files)).toBe(true);
    expect(fs.existsSync(path.join(result.outDir, "assets/fonts/subsets.json"))).toBe(true);
    expect(fs.existsSync(path.join(result.outDir, "ui.stub"))).toBe(false);

    const loader = new ReferenceLoader();
    const load = await loader.load(result.outDir, {
      width: 480,
      height: 320,
      colorDepth: 16,
      lvglVersion: "9.10",
    });
    expect(load.ok).toBe(true);
  });

  it("loader rejects tampered asset hash", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-pack-tamper-"));
    copyDir(templateRoot, tmp);
    const result = await packProject(tmp);
    expect(result.ok).toBe(true);
    const assetsManifestPath = path.join(result.outDir, "assets/manifest.json");
    const assetsManifest = JSON.parse(fs.readFileSync(assetsManifestPath, "utf8"));
    if (assetsManifest.files?.length) {
      const entry = assetsManifest.files[0];
      const target = path.join(result.outDir, "assets", entry.path);
      fs.writeFileSync(target, Buffer.from("tampered"));
    } else {
      const fake = path.join(result.outDir, "assets/images/tamper.png");
      fs.mkdirSync(path.dirname(fake), { recursive: true });
      fs.writeFileSync(fake, Buffer.from("x"));
      assetsManifest.files = [{ path: "images/tamper.png", size: 1, sha256: "0".repeat(64) }];
      fs.writeFileSync(assetsManifestPath, JSON.stringify(assetsManifest));
    }
    const loader = new ReferenceLoader();
    const load = await loader.load(result.outDir, {
      width: 480,
      height: 320,
      colorDepth: 16,
      lvglVersion: "9.10",
    });
    expect(load.ok).toBe(false);
    expect(load.diagnostics.some((d) => d.message.includes("sha256") || d.message.includes("size"))).toBe(
      true,
    );
  });

  it("packs font subset sidecars when fonts registered", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-pack-font-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    const stubFont = path.join(tmp, "stub.ttf");
    fs.writeFileSync(stubFont, Buffer.from([0x00, 0x01, 0x00, 0x00]));
    importFontAsset(loaded, stubFont, { size: 16 });
    saveProject(loaded);
    const result = await packProject(tmp);
    expect(result.ok).toBe(true);
    const subsets = JSON.parse(
      fs.readFileSync(path.join(result.outDir, "assets/fonts/subsets.json"), "utf8"),
    );
    expect(subsets.fonts.length).toBe(1);
    expect(subsets.fonts[0].bundled).toBe(true);
    expect(fs.existsSync(path.join(result.outDir, "assets/fonts/stub.charset.txt"))).toBe(true);
    const loader = new ReferenceLoader();
    const load = await loader.load(result.outDir, {
      width: 480,
      height: 320,
      colorDepth: 16,
      lvglVersion: "9.10",
    });
    expect(load.ok).toBe(true);
  });
});

describe("codegen Part/State style emit", () => {
  it("maps indicator/pressed to LVGL selector", () => {
    expect(lvglSelector("indicator", "pressed")).toBe("LV_PART_INDICATOR | LV_STATE_PRESSED");
  });

  it("emits lv_obj_set_style for non-main parts", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-style-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "btn_next", {
      styleKeys: {
        part: "indicator",
        state: "pressed",
        props: { bg_color: "#AABBCCff" },
      },
    });
    saveProject(loaded);
    await generate(tmp);
    const uiC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(uiC).toContain("LV_PART_INDICATOR | LV_STATE_PRESSED");
    expect(uiC).toContain("lv_obj_set_style_bg_color");
  });
});
