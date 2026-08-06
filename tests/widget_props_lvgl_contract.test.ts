import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import { getWidgetSpec, listPaletteWidgetSpecs, type WidgetSpec } from "@forgeui/core";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

/** Homologous LVGL pairs may share the same prop names (still distinct create APIs). */
const SHARED_PROP_ALLOWLIST = new Set(["barchart,linechart,scatterchart", "bar,slider"]);

/** Empty-prop containers/editors (extraData-only) may share []. */
const EMPTY_PROP_TYPES = new Set(["container", "list", "menu", "spangroup", "tileview"]);

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

function propSignature(spec: WidgetSpec): string {
  return spec.props
    .map((p) => p.name)
    .sort()
    .join(",");
}

/** Force props so CodeGen emits optional/conditional setters. */
function enrichedProps(spec: WidgetSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of spec.props) {
    if (p.default !== undefined) out[p.name] = structuredClone(p.default);
  }
  if (spec.type === "checkbox" || spec.type === "switch") out.checked = true;
  if (spec.type === "textarea") {
    out.placeholder = "hint";
    out.one_line = true;
    out.password_mode = true;
    out.max_length = 32;
  }
  if (spec.type === "line") out.y_invert = true;
  if (spec.type === "linechart" || spec.type === "barchart" || spec.type === "scatterchart") {
    out.enable_secondary_y = true;
  }
  if (spec.type === "image") out.src = "assets/images/missing.png";
  if (spec.type === "imagebutton") {
    out.src_released = "assets/images/a.png";
    out.src_pressed = "assets/images/b.png";
    out.src_checked = "assets/images/c.png";
  }
  // Force static path so lv_label_set_text_static appears (mutually exclusive with set_text).
  if (spec.type === "label") out.is_text_static = true;
  return out;
}

function isImageSrcProp(spec: WidgetSpec, propName: string): boolean {
  return spec.props.some((p) => p.name === propName && p.type === "imageSrc");
}

describe("FR-016d widget PropSpec ↔ LVGL API contract", () => {
  it("every registered prop has lvglPropApis mapping", () => {
    const missing: string[] = [];
    for (const spec of listPaletteWidgetSpecs()) {
      if (!spec.props.length) continue;
      const map = spec.lvglPropApis ?? {};
      for (const p of spec.props) {
        if (!map[p.name]?.length) missing.push(`${spec.type}.${p.name}`);
      }
    }
    expect(missing, `missing lvglPropApis: ${missing.join(", ")}`).toEqual([]);
  });

  it("unrelated widgets do not share identical prop name sets", () => {
    const bySig = new Map<string, string[]>();
    for (const spec of listPaletteWidgetSpecs()) {
      const sig = propSignature(spec);
      if (!sig && EMPTY_PROP_TYPES.has(spec.type)) continue;
      const list = bySig.get(sig) ?? [];
      list.push(spec.type);
      bySig.set(sig, list);
    }
    const collisions: string[] = [];
    for (const [sig, types] of bySig) {
      if (types.length < 2) continue;
      if (!sig && types.every((t) => EMPTY_PROP_TYPES.has(t))) continue;
      const key = [...types].sort().join(",");
      const chartOnly = types.every((t) =>
        ["linechart", "barchart", "scatterchart", "chart"].includes(t),
      );
      if (chartOnly || SHARED_PROP_ALLOWLIST.has(key)) continue;
      collisions.push(`${key} => [${sig}]`);
    }
    expect(collisions, collisions.join(" | ")).toEqual([]);
  });

  it("CodeGen emits declared LVGL APIs for each widget create-time props", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-props-lvgl-"));
    copyDir(templateRoot, tmp);
    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));

    let y = 8;
    for (const spec of listPaletteWidgetSpecs()) {
      const node: Record<string, unknown> = {
        type: spec.type,
        id: `w_${spec.type}`,
        name: spec.label["zh-CN"],
        frame: { x: 8, y, w: spec.defaultFrame.w, h: spec.defaultFrame.h },
        props: enrichedProps(spec),
        style: {},
        events: [],
        children: [],
      };
      if (spec.defaultExtraData) {
        node.extraData = structuredClone(spec.defaultExtraData);
        if (
          (spec.type === "linechart" ||
            spec.type === "barchart" ||
            spec.type === "scatterchart") &&
          Array.isArray((node.extraData as { series?: unknown[] }).series)
        ) {
          const series = (node.extraData as { series: unknown[] }).series;
          if (series.length < 2) {
            series.push({
              name: "Series 2",
              color: "#ff0000",
              values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            });
          }
        }
      }
      home.children.push(node);
      y += Math.min(spec.defaultFrame.h, 40) + 4;
    }
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");

    const failures: string[] = [];
    for (const spec of listPaletteWidgetSpecs()) {
      expect(screenC).toContain(spec.lvgl.create);
      const map = spec.lvglPropApis ?? {};
      for (const [prop, apis] of Object.entries(map)) {
        if (isImageSrcProp(spec, prop)) continue; // needs imported asset; TODO bind is OK
        // Multiple APIs = mutually exclusive emitters (e.g. set_text vs set_text_static).
        if (apis.length > 1) {
          if (!apis.some((api) => screenC.includes(api))) {
            failures.push(`${spec.type}.${prop} → missing any of ${apis.join(" | ")}`);
          }
        } else if (apis[0] && !screenC.includes(apis[0])) {
          failures.push(`${spec.type}.${prop} → missing ${apis[0]}`);
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("label/slider/spinbox prop sets differ and map to distinct LVGL families", () => {
    const label = getWidgetSpec("label")!;
    const slider = getWidgetSpec("slider")!;
    const spinbox = getWidgetSpec("spinbox")!;
    expect(propSignature(label)).not.toBe(propSignature(slider));
    expect(propSignature(slider)).not.toBe(propSignature(spinbox));
    expect(label.lvglPropApis?.long_mode).toContain("lv_label_set_long_mode");
    expect(label.lvglPropApis?.is_text_static).toContain("lv_label_set_text_static");
    expect(slider.lvglPropApis?.mode).toContain("lv_slider_set_mode");
    expect(spinbox.lvglPropApis?.digit_count).toContain("lv_spinbox_set_digit_format");
  });
});
