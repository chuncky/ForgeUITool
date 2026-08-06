import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { packProject } from "@forgeui/packer";
import { JsonRuntimeLoader } from "@forgeui/loader";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

const JSON_RT_TYPES = new Set([
  "label",
  "button",
  "container",
  "slider",
  "switch",
  "image",
  "checkbox",
  "bar",
  "dropdown",
  "list",
  "led",
  "spinner",
  "roller",
  "arc",
  "textarea",
  "line",
  "imagebutton",
  "animimg",
  "tabview",
  "buttonmatrix",
  "keyboard",
  "msgbox",
  "table",
  "chart",
  "linechart",
  "barchart",
  "scatterchart",
  "spinbox",
  "canvas",
  "qrcode",
  "barcode",
  "digitalclock",
  "tileview",
  "win",
  "menu",
  "spangroup",
  "scale",
  "calendar",
]);

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

function countJsonRuntimeWidgets(screen: { children: Array<{ type: string; children?: unknown[] }> }): number {
  let n = 0;
  const walk = (nodes: Array<{ type: string; children?: unknown[] }>) => {
    for (const node of nodes) {
      if (JSON_RT_TYPES.has(node.type)) n++;
      if (Array.isArray(node.children)) {
        walk(node.children as Array<{ type: string; children?: unknown[] }>);
      }
    }
  };
  walk(screen.children);
  return n;
}

describe("M6 C JSON runtime module (widget subset)", () => {
  it("ships forge_json_runtime parse + LVGL load API", () => {
    const h = fs.readFileSync(
      path.join(repoRoot, "packages/loader/c/include/forge_json_runtime.h"),
      "utf8",
    );
    const c = fs.readFileSync(path.join(repoRoot, "packages/loader/c/src/forge_json_runtime.c"), "utf8");
    expect(h).toContain("forge_json_runtime_parse_screen");
    expect(h).toContain("forge_json_widget_desc_t");
    expect(c).toContain("lv_label_create");
    expect(c).toContain("lv_button_create");
    expect(c).toContain("lv_slider_create");
    expect(c).toContain("lv_switch_create");
    expect(c).toContain("lv_image_create");
    expect(c).toContain("lv_checkbox_create");
    expect(c).toContain("lv_bar_create");
    expect(c).toContain("parse_extra_data_items");
    expect(c).toContain("lv_dropdown_create");
    expect(c).toContain("lv_list_create");
    expect(c).toContain("lv_list_add_text");
    expect(c).toContain("lv_led_create");
    expect(c).toContain("lv_spinner_create");
    expect(c).toContain("lv_arc_create");
    expect(c).toContain("lv_roller_create");
    expect(c).toContain("lv_textarea_create");
    expect(c).toContain("lv_line_create");
    expect(c).toContain("lv_imagebutton_create");
    expect(c).toContain("lv_animimg_create");
    expect(c).toContain("parse_extra_data_frames");
    expect(c).toContain("lv_animimg_set_src");
    expect(c).toContain("lv_animimg_start");
    expect(c).toContain("lv_tabview_create");
    expect(c).toContain("lv_tabview_add_tab");
    expect(c).toContain("lv_buttonmatrix_create");
    expect(c).toContain("parse_extra_data_tabs");
    expect(c).toContain("lv_keyboard_create");
    expect(c).toContain("parse_extra_data_keymap");
    expect(c).toContain("lv_keyboard_set_map");
    expect(c).toContain("LV_KEYBOARD_CTRL_BUTTON_FLAGS");
    expect(c).toContain("lv_msgbox_create");
    expect(c).toContain("parse_extra_data_buttons");
    expect(c).toContain("lv_table_create");
    expect(c).toContain("lv_chart_create");
    expect(c).toContain("parse_extra_data_table_cells");
    expect(c).toContain("lv_spinbox_create");
    expect(c).toContain("lv_qrcode_create");
    expect(c).toContain("lv_tileview_create");
    expect(c).toContain("lv_calendar_create");
    expect(c).toContain("parse_type_props");
    expect(c).toContain("build_lvgl_from_object");
    expect(c).toContain("scan_children_array");
    expect(c).toContain("parse_style_block");
    expect(c).toContain("apply_main_default_style");
    expect(c).toContain("parse_indicator_style_block");
    expect(c).toContain("apply_indicator_styles");
    expect(c).toContain("LV_PART_INDICATOR | LV_STATE_DEFAULT");
    expect(c).toContain("LV_PART_INDICATOR | LV_STATE_PRESSED");
    expect(c).toContain("parse_knob_style_block");
    expect(c).toContain("apply_knob_styles");
    expect(c).toContain("LV_PART_KNOB | LV_STATE_DEFAULT");
    expect(c).toContain("parse_items_style_block");
    expect(c).toContain("parse_scrollbar_style_block");
    expect(c).toContain("apply_items_scrollbar_styles");
    expect(c).toContain("apply_subpart_style");
    expect(c).toContain("LV_PART_ITEMS");
    expect(c).toContain("LV_PART_SCROLLBAR");
    expect(c).toContain("parse_selected_style_block");
    expect(c).toContain("parse_checked_style_blocks");
    expect(c).toContain("parse_part_state_styles");
    expect(c).toContain("apply_selected_checked_styles");
    expect(c).toContain("LV_PART_SELECTED");
    expect(c).toContain("LV_STATE_CHECKED");
    expect(c).toContain("LV_STATE_PRESSED");
    expect(c).toContain("LV_STATE_FOCUSED");
    expect(c).toContain("LV_STATE_DISABLED");
    expect(h).toContain("main_pressed_style");
    expect(h).toContain("main_focused_style");
    expect(h).toContain("main_disabled_style");
    expect(c).toContain("parse_cursor_style_block");
    expect(c).toContain("parse_series_style_block");
    expect(c).toContain("apply_cursor_series_styles");
    expect(c).toContain("LV_PART_CURSOR");
    expect(c).toContain("lv_obj_set_style_text_color");
    expect(c).toContain("lv_obj_set_style_radius");
    expect(c).toContain("lv_obj_set_style_pad_top");
    expect(c).toContain("lv_obj_set_style_border_width");
    expect(c).toContain("lv_obj_set_style_bg_opa");
    expect(c).toContain("lv_obj_set_style_text_letter_space");
    expect(c).toContain("bind_image_src");
    expect(c).toContain("lv_image_set_src");
    expect(c).toContain("bind_imagebutton_src");
    expect(c).toContain("parse_extra_data_chart_series");
    expect(c).toContain("apply_chart_series");
    expect(c).toContain("lv_chart_add_series");
    expect(c).toContain("apply_frame_rotation");
    expect(c).toContain("lv_obj_set_style_transform_rotation");
    expect(c).toContain("read_rotation_field");
    expect(c).toContain("apply_flex_layout");
    expect(c).toContain("lv_obj_set_style_line_color");
    expect(c).toContain("lv_obj_set_style_outline_width");
    expect(c).toContain("lv_obj_set_style_outline_color");
    expect(c).toContain("lv_obj_set_style_outline_opa");
    expect(c).toContain("lv_obj_set_style_text_font");
    expect(c).toContain("text_decor_from_string");
    expect(c).toContain("lv_obj_set_style_text_decor");
    expect(c).toContain("lv_spangroup_create");
    expect(c).toContain("lv_spangroup_add_span");
    expect(c).toContain("lv_span_set_text");
  });

  it("forge_loader_apply_json uses JSON runtime parse path", () => {
    const h = fs.readFileSync(path.join(repoRoot, "packages/loader/c/include/forge_loader.h"), "utf8");
    const c = fs.readFileSync(path.join(repoRoot, "packages/loader/c/src/forge_loader.c"), "utf8");
    expect(h).toContain("forge_loader_apply_json");
    expect(c).toContain("forge_json_runtime_parse_screen");
  });

  it("packed home screen has JSON-runtime widget subset", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-json-c-"));
    copyDir(templateRoot, tmp);
    const pack = await packProject(tmp);
    expect(pack.ok).toBe(true);

    const loader = new JsonRuntimeLoader();
    const applied = await loader.apply(pack.outDir, {
      width: 480,
      height: 320,
      colorDepth: 16,
      lvglVersion: "9.10",
    });
    const home = applied.screens?.find((s) => s.id === "home")?.document;
    expect(home).toBeTruthy();
    expect(countJsonRuntimeWidgets(home!)).toBeGreaterThan(0);
  });
});
