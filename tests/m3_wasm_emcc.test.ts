import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("wasm emcc build wiring (Loop#48)", () => {
  it("wasm-emcc.ts exports buildWasmLvgl", () => {
    const src = fs.readFileSync(path.join(repoRoot, "packages/preview-host/src/wasm-emcc.ts"), "utf8");
    expect(src).toContain("export async function buildWasmLvgl");
    expect(src).toContain("preview-mode.json");
  });

  it("wasm template main uses emscripten main loop", () => {
    const main = fs.readFileSync(path.join(repoRoot, "templates/wasm-sim/main.c"), "utf8");
    expect(main).toContain("emscripten_set_main_loop");
    expect(main).toContain("ui_init");
  });

  it("index.html redirects when preview-mode lvgl-wasm", () => {
    const html = fs.readFileSync(path.join(repoRoot, "templates/wasm-sim/index.html"), "utf8");
    expect(html).toContain("preview-mode.json");
    expect(html).toContain("lvgl-wasm");
  });
});
