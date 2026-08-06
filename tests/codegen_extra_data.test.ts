import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";

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

describe("V1-B extraData list/tabview codegen", () => {
  it("emits lv_list_add_text and lv_tabview_add_tab from extraData", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-extra-"));
    copyDir(templateRoot, tmp);
    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    home.children.push({
      type: "list",
      id: "lst",
      name: "List",
      frame: { x: 8, y: 8, w: 120, h: 80 },
      props: {},
      extraData: { items: [{ text: "Alpha" }, { text: "Beta" }] },
      style: {},
      events: [],
      children: [],
    });
    home.children.push({
      type: "tabview",
      id: "tabs",
      name: "Tabs",
      frame: { x: 140, y: 8, w: 200, h: 120 },
      props: { tab_bar_size: 32, tab_bar_position: "TOP" },
      extraData: { tabs: [{ name: "Home" }, { name: "Settings" }], selectedTabIndex: 1 },
      style: {},
      events: [],
      children: [],
    });
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).toContain('lv_list_add_text(');
    expect(screenC).toContain('"Alpha"');
    expect(screenC).toContain('lv_tabview_add_tab(');
    expect(screenC).toContain('"Home"');
    expect(screenC).toContain("lv_tabview_set_active");
  });

  it("emits buttonmatrix map and table cell values", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-extra2-"));
    copyDir(templateRoot, tmp);
    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    home.children.push({
      type: "buttonmatrix",
      id: "bm",
      name: "BM",
      frame: { x: 8, y: 100, w: 160, h: 60 },
      props: { col_cnt: 2 },
      extraData: { items: [{ text: "A" }, { text: "B" }, { text: "C" }, { text: "D" }] },
      style: {},
      events: [],
      children: [],
    });
    home.children.push({
      type: "table",
      id: "tbl",
      name: "Tbl",
      frame: { x: 180, y: 100, w: 160, h: 80 },
      props: { row_cnt: 2, col_cnt: 2 },
      extraData: { cells: [["H1", "H2"], ["V1", "V2"]] },
      style: {},
      events: [],
      children: [],
    });
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).toContain("lv_buttonmatrix_set_map");
    expect(screenC).toContain('"\\n"');
    expect(screenC).toContain("lv_table_set_cell_value");
    expect(screenC).toContain('"H1"');
  });

  it("emits chart series values and chart type", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-extra-chart-"));
    copyDir(templateRoot, tmp);
    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    home.children.push({
      type: "linechart",
      id: "lc",
      name: "Line",
      frame: { x: 8, y: 200, w: 180, h: 100 },
      props: { point_count: 5 },
      extraData: {
        series: [{ name: "A", color: "#4a90e2", values: [10, 30, 50, 20, 40] }],
      },
      style: {},
      events: [],
      children: [],
    });
    home.children.push({
      type: "chart",
      id: "ch",
      name: "Chart",
      frame: { x: 200, y: 200, w: 180, h: 100 },
      props: { point_count: 3, div_line_count_h: 4, div_line_count_v: 6 },
      extraData: {
        series: [
          { name: "S1", color: "#ff0000", values: [1, 2, 3] },
          { name: "S2", color: "#00ff00", values: [4, 5, 6] },
        ],
      },
      style: {},
      events: [],
      children: [],
    });
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).toContain("LV_CHART_TYPE_LINE");
    expect(screenC).toContain("lv_chart_add_series");
    expect(screenC).toContain("lv_chart_set_series_values");
    expect(screenC).toContain("10, 30, 50, 20, 40");
    expect(screenC).toContain("lv_chart_set_div_line_count");
    expect(screenC).toContain("0xFF0000");
    expect(screenC).toContain("0x00FF00");
  });

  it("emits keyboard keymap and msgbox footer buttons", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-extra-kb-"));
    copyDir(templateRoot, tmp);
    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    home.children.push({
      type: "keyboard",
      id: "kb",
      name: "KB",
      frame: { x: 0, y: 300, w: 320, h: 120 },
      props: { mode: "NUMBER" },
      extraData: {
        rows: ["1 2 3", "LV_SYMBOL_OK LV_SYMBOL_CLOSE"],
      },
      style: {},
      events: [],
      children: [],
    });
    home.children.push({
      type: "msgbox",
      id: "mb",
      name: "MB",
      frame: { x: 40, y: 40, w: 240, h: 120 },
      props: { title: "Alert", text: "Hello" },
      extraData: { buttons: [{ text: "OK" }, { text: "Cancel" }] },
      style: {},
      events: [],
      children: [],
    });
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).toContain("lv_keyboard_set_map");
    expect(screenC).toContain("LV_KEYBOARD_MODE_NUMBER");
    expect(screenC).toContain("LV_SYMBOL_OK");
    expect(screenC).toContain('"\\n"');
    expect(screenC).toContain("lv_msgbox_add_footer_button");
    expect(screenC).toContain('"Cancel"');
  });

  it("emits spangroup spans from extraData items", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-extra-span-"));
    copyDir(templateRoot, tmp);
    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    home.children.push({
      type: "spangroup",
      id: "sg",
      name: "Spans",
      frame: { x: 8, y: 8, w: 160, h: 48 },
      props: {},
      extraData: { items: [{ text: "Span 1" }, { text: "Span 2" }] },
      style: {},
      events: [],
      children: [],
    });
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).toContain("lv_spangroup_add_span");
    expect(screenC).toContain("lv_span_set_text");
    expect(screenC).toContain('"Span 1"');
    expect(screenC).toContain('"Span 2"');
  });

  it("emits roller options from extraData items", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-extra-roller-"));
    copyDir(templateRoot, tmp);
    const homePath = path.join(tmp, "screens/home.json");
    const home = JSON.parse(fs.readFileSync(homePath, "utf8"));
    home.children.push({
      type: "roller",
      id: "rl",
      name: "Roller",
      frame: { x: 8, y: 400, w: 100, h: 120 },
      props: { visible_row_count: 3 },
      extraData: { items: [{ text: "One" }, { text: "Two" }, { text: "Three" }] },
      style: {},
      events: [],
      children: [],
    });
    fs.writeFileSync(homePath, JSON.stringify(home, null, 2));

    const result = await generate(tmp);
    expect(result.ok).toBe(true);
    const screenC = fs.readFileSync(path.join(tmp, "forgeui_generated/screens/screen_home.c"), "utf8");
    expect(screenC).toContain("lv_roller_set_options");
    expect(screenC).toContain("One");
  });
});
