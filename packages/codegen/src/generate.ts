import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import {
  buildIR,
  cleanCodegenExceptCustom,
  migrateLegacyCodegenLayout,
  normalizeFontAssets,
  openProject,
  parseGridTrackCount,
  parseLayoutType,
  resolveCodegenPaths,
  saveProject,
  symbolFor,
  type Action,
  type FontAsset,
  type ProjectIR,
  type WidgetIR,
} from "@forgeui/core";
import { emitWidgetStyleLines } from "./style-emit.js";
import { emitProjectFonts } from "./font-emit.js";
import { emitProjectI18n } from "./i18n-emit.js";
import { emitProjectAnimations } from "./anim-emit.js";
import { emitProjectVariables } from "./vars-emit.js";
import { emitMicroPython } from "./micropython-emit.js";
import { emitProjectImages, imageSymbolForPath, type EmittedImage } from "./image-emit.js";
import { pruneCodegenOrphans } from "./prune-orphans.js";
import { collectSetProps, setPropSuffix, type SetPropEmit } from "./set-prop-emit.js";
import { lvLabelLongModeExpr } from "./label-long-mode.js";
import { Diagnostic, ErrorCodes, ForgeError } from "@forgeui/shared";

export interface CodeGenOptions {
  cleanGenerated?: boolean;
  /** Delete codegen output (except custom/) without regenerating. */
  cleanOnly?: boolean;
  /** When cleanOnly, wipe `.forge/preview-build/out` entirely (slow next compile). Default false. */
  cleanPreviewBuild?: boolean;
  /** FR-057: after generate, delete files under codegen/ (except custom/) not in this run's output. */
  pruneOrphans?: boolean;
}

export interface CodeGenResult {
  ok: boolean;
  filesWritten: string[];
  filesSkipped: string[];
  filesPruned?: string[];
  diagnostics: Diagnostic[];
}

function templatesDir(): string {
  const candidates = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates"),
    path.resolve(process.cwd(), "packages/codegen/templates"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new ForgeError(ErrorCodes.E_GEN_001, "CodeGen templates not found");
}

function ensureDir(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function writeFile(file: string, content: string, written: string[], skipped: string[]): void {
  ensureDir(file);
  const normalized = content.replace(/\r?\n/g, "\n");
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, "utf8");
    if (existing === normalized) {
      skipped.push(file);
      return;
    }
  }
  fs.writeFileSync(file, normalized, "utf8");
  written.push(file);
}

function copyTemplateFile(name: string, dest: string, written: string[], skipped: string[]): void {
  const src = path.join(templatesDir(), name);
  writeFile(dest, fs.readFileSync(src, "utf8"), written, skipped);
}

/** Relative .c paths under codegen dir (posix), for forgeui_generated.cmake explicit list. */
export function listGeneratedCRelPaths(codegenAbs: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      if (name === "micropython" || name === "node_modules") continue;
      const abs = path.join(dir, name);
      const childRel = rel ? `${rel}/${name}` : name;
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs, childRel);
      else if (name.endsWith(".c")) out.push(childRel.replace(/\\/g, "/"));
    }
  };
  walk(codegenAbs, "");
  return out.sort();
}

function cString(value: unknown): string {
  const s = String(value ?? "");
  return JSON.stringify(s);
}

function emitNodeStyles(
  sym: string,
  node: WidgetIR,
  ir: ProjectIR,
  fonts: FontAsset[],
  lines: string[],
  emittedImages: EmittedImage[],
  imageIncludes: Set<string>,
  fontIncludes: Set<string>,
): void {
  lines.push(
    ...emitWidgetStyleLines(
      sym,
      node,
      ir.meta.colors,
      fonts,
      emittedImages,
      imageIncludes,
      fontIncludes,
    ),
  );
}

function propRange(props: Record<string, unknown>, fallback = { min: 0, max: 100 }) {
  const r = props.range;
  if (r && typeof r === "object" && !Array.isArray(r)) {
    const o = r as { min?: unknown; max?: unknown };
    return { min: Number(o.min ?? fallback.min), max: Number(o.max ?? fallback.max) };
  }
  if (props.range_min !== undefined || props.range_max !== undefined) {
    return {
      min: Number(props.range_min ?? fallback.min),
      max: Number(props.range_max ?? fallback.max),
    };
  }
  return {
    min: Number(props.min ?? fallback.min),
    max: Number(props.max ?? fallback.max),
  };
}

function colorOpaLiteral(value: unknown): number {
  if (typeof value !== "string") return 255;
  const m = value.trim().replace("#", "");
  if (/^[0-9a-fA-F]{8}$/.test(m)) return Number.parseInt(m.slice(6, 8), 16);
  return 255;
}

function parseLinePoints(raw: unknown): Array<{ x: number; y: number }> {
  const s = String(raw ?? "").trim();
  if (!s) return [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  const pts: Array<{ x: number; y: number }> = [];
  for (const part of s.split(/[;|]/)) {
    const [xs, ys] = part.split(",").map((t) => t.trim());
    const x = Number(xs);
    const y = Number(ys);
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
  }
  return pts.length >= 2 ? pts : [{ x: 0, y: 0 }, { x: 100, y: 0 }];
}

function digitalClockText(props: Record<string, unknown>): string {
  const raw = String(props.initial_time ?? "12:00:00");
  const showSecond = props.show_second !== false && props.format !== "HM";
  const parts = raw.split(":");
  if (!showSecond) return parts.slice(0, 2).join(":") || "12:00";
  if (parts.length >= 3) return `${parts[0]}:${parts[1]}:${parts[2]}`;
  return raw || "12:00:00";
}

function compileTemplate(name: string): Handlebars.TemplateDelegate {
  const file = path.join(templatesDir(), name);
  const src = fs.readFileSync(file, "utf8");
  return Handlebars.compile(src, { noEscape: true });
}

function bindImageAsset(
  sym: string,
  src: unknown,
  emittedImages: EmittedImage[],
  imageIncludes: Set<string>,
  lines: string[],
  fallbackLabel: string,
  mode: "image" | "imagebutton_released" | "imagebutton_pressed" | "imagebutton_checked",
): void {
  const imgSym = imageSymbolForPath(src, emittedImages);
  if (imgSym) {
    imageIncludes.add(imgSym);
    if (mode === "image") {
      lines.push(`  lv_image_set_src(${sym}, &${imgSym});`);
    } else if (mode === "imagebutton_released") {
      lines.push(
        `  lv_imagebutton_set_src(${sym}, LV_IMAGEBUTTON_STATE_RELEASED, NULL, &${imgSym}, NULL);`,
      );
    } else if (mode === "imagebutton_pressed") {
      lines.push(
        `  lv_imagebutton_set_src(${sym}, LV_IMAGEBUTTON_STATE_PRESSED, NULL, &${imgSym}, NULL);`,
      );
    } else {
      lines.push(
        `  lv_imagebutton_set_src(${sym}, LV_IMAGEBUTTON_STATE_CHECKED_RELEASED, NULL, &${imgSym}, NULL);`,
      );
    }
  } else if (src) {
    lines.push(`  /* TODO: bind ${fallbackLabel} ${cString(src)} — import asset in designer */`);
  }
}

function animFrameSources(node: WidgetIR): string[] {
  const frames = node.extraData?.frames;
  if (!Array.isArray(frames)) return [];
  const out: string[] = [];
  for (const f of frames) {
    if (f && typeof f === "object" && "src" in f) {
      const src = (f as { src?: unknown }).src;
      if (typeof src === "string" && src.trim()) out.push(src.replace(/\\/g, "/"));
    }
  }
  return out;
}

function extraDataItems(node: WidgetIR): Array<{ text?: string }> {
  const items = node.extraData?.items;
  if (!Array.isArray(items)) return [];
  return items.filter((i) => i && typeof i === "object") as Array<{ text?: string }>;
}

function emitListExtraData(sym: string, node: WidgetIR, lines: string[]): void {
  for (const item of extraDataItems(node)) {
    if (item.text) {
      lines.push(`  lv_list_add_text(${sym}, ${cString(item.text)});`);
    }
  }
}

function emitSpangroupExtraData(sym: string, node: WidgetIR, lines: string[]): void {
  const items = extraDataItems(node).filter((i) => i.text);
  if (!items.length) return;
  lines.push(`  {`);
  lines.push(`    lv_span_t *span;`);
  for (const item of items) {
    lines.push(`    span = lv_spangroup_add_span(${sym});`);
    lines.push(`    lv_span_set_text(span, ${cString(item.text!)});`);
  }
  lines.push(`  }`);
}

function emitDropdownExtraData(sym: string, node: WidgetIR, lines: string[]): void {
  const items = extraDataItems(node);
  if (items.length) {
    const opts = items.map((i) => i.text ?? "").join("\n");
    lines.push(`  lv_dropdown_set_options(${sym}, ${cString(opts)});`);
    return;
  }
  lines.push(`  lv_dropdown_set_options(${sym}, ${cString(node.props.options ?? "")});`);
}

function emitRollerExtraData(sym: string, node: WidgetIR, lines: string[]): void {
  const items = extraDataItems(node);
  if (!items.length) return;
  const opts = items.map((i) => i.text ?? "").join("\n");
  const mode = String(node.props.mode ?? "NORMAL");
  lines.push(`  lv_roller_set_options(${sym}, ${cString(opts)}, LV_ROLLER_MODE_${mode});`);
}

function emitTabviewExtraData(sym: string, node: WidgetIR, lines: string[]): void {
  const tabs = node.extraData?.tabs;
  if (Array.isArray(tabs)) {
    for (const tab of tabs) {
      if (tab && typeof tab === "object" && "name" in tab) {
        const name = (tab as { name?: unknown }).name;
        lines.push(`  lv_tabview_add_tab(${sym}, ${cString(name ?? "Tab")});`);
      }
    }
  }
  const idx = Number(node.extraData?.initialTabIndex ?? node.extraData?.selectedTabIndex ?? 0);
  if (Number.isFinite(idx) && idx > 0) {
    lines.push(`  lv_tabview_set_active(${sym}, ${idx}, LV_ANIM_OFF);`);
  }
}

function emitButtonmatrixExtraData(sym: string, node: WidgetIR, lines: string[]): void {
  const items = extraDataItems(node);
  if (!items.length) return;
  const colCount = Math.max(1, Number(node.props.col_cnt ?? 3));
  const mapParts: string[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && i % colCount === 0) mapParts.push('"\\n"');
    mapParts.push(cString(items[i]?.text ?? ""));
  }
  mapParts.push('""');
  const mapName = `${sym}_map`;
  lines.push(`  {`);
  lines.push(`    static const char *${mapName}[] = { ${mapParts.join(", ")} };`);
  lines.push(`    lv_buttonmatrix_set_map(${sym}, ${mapName});`);
  lines.push(`  }`);
}

function emitTableExtraData(sym: string, node: WidgetIR, lines: string[]): void {
  const cells = node.extraData?.cells;
  if (!Array.isArray(cells)) return;
  for (let r = 0; r < cells.length; r++) {
    const row = cells[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (typeof val === "string" && val.length) {
        lines.push(`  lv_table_set_cell_value(${sym}, ${r}, ${c}, ${cString(val)});`);
      }
    }
  }
}

function colorHexLiteral(value: unknown): string {
  if (typeof value !== "string") return "0x000000";
  const m = value.trim().replace("#", "");
  if (/^[0-9a-fA-F]{6,8}$/.test(m)) return `0x${m.slice(0, 6).toUpperCase()}`;
  return "0x000000";
}

type ChartSeriesRow = { name?: string; color?: string; values?: number[] };

function extraDataSeries(node: WidgetIR): ChartSeriesRow[] {
  const series = node.extraData?.series;
  if (!Array.isArray(series)) return [];
  return series
    .filter((s) => s && typeof s === "object" && !Array.isArray(s))
    .map((s) => {
      const row = s as ChartSeriesRow;
      const values = Array.isArray(row.values)
        ? row.values.map((v) => Number(v)).filter((n) => Number.isFinite(n))
        : [];
      return { ...row, values };
    });
}

function chartTypeForWidget(type: string, props?: Record<string, unknown>): string {
  const fromProp = props?.chart_type != null ? String(props.chart_type) : "";
  if (fromProp === "BAR" || fromProp === "SCATTER" || fromProp === "LINE") {
    return `LV_CHART_TYPE_${fromProp}`;
  }
  switch (type) {
    case "barchart":
      return "LV_CHART_TYPE_BAR";
    case "scatterchart":
      return "LV_CHART_TYPE_SCATTER";
    case "linechart":
    case "chart":
    default:
      return "LV_CHART_TYPE_LINE";
  }
}

function keymapToken(token: string): string {
  const t = token.trim();
  if (/^LV_SYMBOL_[A-Z0-9_]+$/.test(t)) return t;
  return cString(t);
}

function extraDataKeymapRows(node: WidgetIR): string[] {
  const rows = node.extraData?.rows;
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map((r) => String(r ?? "").trim()).filter(Boolean);
}

function emitKeyboardExtraData(sym: string, node: WidgetIR, lines: string[]): void {
  const rows = extraDataKeymapRows(node);
  if (!rows.length) return;
  const mapParts: string[] = [];
  let buttonCount = 0;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) mapParts.push('"\\n"');
    const keys = rows[i]!.split(/\s+/).filter(Boolean);
    for (const key of keys) {
      mapParts.push(keymapToken(key));
      buttonCount++;
    }
  }
  mapParts.push('""');
  const mapName = `${sym}_map`;
  const ctrlName = `${sym}_ctrl`;
  const ctrlEntries = Array(buttonCount).fill("LV_KEYBOARD_CTRL_BUTTON_FLAGS").join(", ");
  const mode = String(node.props.mode ?? "TEXT_LOWER");
  lines.push(`  {`);
  lines.push(`    static const char *${mapName}[] = { ${mapParts.join(", ")} };`);
  lines.push(`    static const lv_buttonmatrix_ctrl_t ${ctrlName}[] = { ${ctrlEntries} };`);
  lines.push(`    lv_keyboard_set_map(${sym}, LV_KEYBOARD_MODE_${mode}, ${mapName}, ${ctrlName});`);
  lines.push(`  }`);
}

function emitMsgboxExtraData(sym: string, node: WidgetIR, lines: string[]): void {
  const buttons = node.extraData?.buttons;
  if (!Array.isArray(buttons)) return;
  for (const btn of buttons) {
    if (btn && typeof btn === "object" && "text" in btn) {
      const text = (btn as { text?: unknown }).text;
      if (typeof text === "string" && text.length) {
        lines.push(`  lv_msgbox_add_footer_button(${sym}, ${cString(text)});`);
      }
    }
  }
}

function emitChartExtraData(sym: string, node: WidgetIR, lines: string[]): void {
  lines.push(`  lv_chart_set_type(${sym}, ${chartTypeForWidget(node.type, node.props)});`);
  if (node.type === "chart") {
    const hdiv = Number(node.props.div_line_count_h ?? 5);
    const vdiv = Number(node.props.div_line_count_v ?? 5);
    lines.push(`  lv_chart_set_div_line_count(${sym}, ${hdiv}, ${vdiv});`);
  }
  const series = extraDataSeries(node);
  if (!series.length) return;
  const secondaryY = node.props.enable_secondary_y === true;
  lines.push(`  {`);
  for (let i = 0; i < series.length; i++) {
    const ser = series[i]!;
    const values = ser.values ?? [];
    const serSym = `${sym}_ser${i}`;
    const valuesSym = `${serSym}_values`;
    const axis =
      secondaryY && i > 0 ? "LV_CHART_AXIS_SECONDARY_Y" : "LV_CHART_AXIS_PRIMARY_Y";
    lines.push(
      `    lv_chart_series_t * ${serSym} = lv_chart_add_series(${sym}, lv_color_hex(${colorHexLiteral(ser.color)}), ${axis});`,
    );
    if (values.length) {
      lines.push(
        `    static const int32_t ${valuesSym}[] = { ${values.map((v) => Math.round(v)).join(", ")} };`,
      );
      lines.push(
        `    lv_chart_set_series_values(${sym}, ${serSym}, ${valuesSym}, ${values.length});`,
      );
    }
  }
  lines.push(`  }`);
}

function emitContainerLayout(sym: string, props: Record<string, unknown>, lines: string[]): void {
  const layout = parseLayoutType(props.layout_type);
  if (layout === "flex_row") {
    lines.push(`  lv_obj_set_layout(${sym}, LV_LAYOUT_FLEX);`);
    lines.push(`  lv_obj_set_flex_flow(${sym}, LV_FLEX_FLOW_ROW);`);
  } else if (layout === "flex_column") {
    lines.push(`  lv_obj_set_layout(${sym}, LV_LAYOUT_FLEX);`);
    lines.push(`  lv_obj_set_flex_flow(${sym}, LV_FLEX_FLOW_COLUMN);`);
  } else if (layout === "grid") {
    const cols = parseGridTrackCount(props.grid_columns, 2);
    const rows = parseGridTrackCount(props.grid_rows, 2);
    const colSym = `${sym}_col_dsc`;
    const rowSym = `${sym}_row_dsc`;
    const colInit = Array.from({ length: cols }, () => "LV_GRID_FR(1)").join(", ");
    const rowInit = Array.from({ length: rows }, () => "LV_GRID_FR(1)").join(", ");
    lines.push(`  static lv_coord_t ${colSym}[] = {${colInit}, LV_GRID_TEMPLATE_LAST};`);
    lines.push(`  static lv_coord_t ${rowSym}[] = {${rowInit}, LV_GRID_TEMPLATE_LAST};`);
    lines.push(`  lv_obj_set_layout(${sym}, LV_LAYOUT_GRID);`);
    lines.push(`  lv_obj_set_grid_dsc_array(${sym}, ${colSym}, ${rowSym});`);
  }
}

function emitFrameRotation(sym: string, frame: WidgetIR["frame"], lines: string[]): void {
  const deg = Number(frame.rotation ?? 0);
  if (!Number.isFinite(deg)) return;
  const norm = ((Math.round(deg) % 360) + 360) % 360;
  if (norm === 0) return;
  const sel = "LV_PART_MAIN | LV_STATE_DEFAULT";
  lines.push(`  lv_obj_set_style_transform_pivot_x(${sym}, lv_pct(50), ${sel});`);
  lines.push(`  lv_obj_set_style_transform_pivot_y(${sym}, lv_pct(50), ${sel});`);
  lines.push(`  lv_obj_set_style_transform_rotation(${sym}, ${norm * 10}, ${sel});`);
}

/** Behavior panel props.lvgl_flags → LV_OBJ_FLAG_* (V1-B). Only when array is present. */
const LVGL_FLAG_IDS = [
  "CLICKABLE",
  "SCROLLABLE",
  "SCROLL_CHAIN_HOR",
  "SCROLL_CHAIN_VER",
  "SCROLL_ELASTIC",
  "SCROLL_MOMENTUM",
  "SNAPPABLE",
  "PRESS_LOCK",
  "CHECKABLE",
  "HIDDEN",
] as const;

function emitLvglFlags(sym: string, props: Record<string, unknown>, lines: string[]): void {
  if (!Array.isArray(props.lvgl_flags)) return;
  const enabled = new Set(props.lvgl_flags.map((f) => String(f).toUpperCase()));
  for (const id of LVGL_FLAG_IDS) {
    const macro = `LV_OBJ_FLAG_${id}`;
    if (enabled.has(id)) lines.push(`  lv_obj_add_flag(${sym}, ${macro});`);
    else lines.push(`  lv_obj_clear_flag(${sym}, ${macro});`);
  }
}

function emitWidgetCreate(
  ir: ProjectIR,
  screenId: string,
  node: WidgetIR,
  parentSym: string,
  lines: string[],
  fonts: FontAsset[],
  emittedImages: EmittedImage[],
  imageIncludes: Set<string>,
  fontIncludes: Set<string>,
): void {
  const sym = symbolFor(screenId, node.id, ir.cPrefix);
  const x = node.frame.x;
  const y = node.frame.y;
  const w = node.frame.w;
  const h = node.frame.h;

  switch (node.type) {
    case "label": {
      lines.push(`  ${sym} = lv_label_create(${parentSym});`);
      {
        const textLit = cString(node.props.text ?? "");
        if (node.props.is_text_static === true) {
          lines.push(`  lv_label_set_text_static(${sym}, ${textLit});`);
        } else {
          lines.push(`  lv_label_set_text(${sym}, ${textLit});`);
        }
      }
      const longMode = String(node.props.long_mode ?? "WRAP");
      lines.push(`  lv_label_set_long_mode(${sym}, ${lvLabelLongModeExpr(longMode)});`);
      // Align is style-only (Beken); emitted via style-emit, not props.
      break;
    }
    case "button":
      lines.push(`  ${sym} = lv_button_create(${parentSym});`);
      lines.push(`  {`);
      lines.push(`    lv_obj_t *label = lv_label_create(${sym});`);
      lines.push(`    lv_label_set_text(label, ${cString(node.props.text ?? "Button")});`);
      {
        const longMode = String(node.props.long_mode ?? "WRAP");
        lines.push(`    lv_label_set_long_mode(label, ${lvLabelLongModeExpr(longMode)});`);
      }
      // BK widget_button.hbs intent: label width 100% so DOTS/WRAP honor button box
      lines.push(`    lv_obj_set_width(label, LV_PCT(100));`);
      lines.push(`    lv_obj_align(label, LV_ALIGN_CENTER, 0, 0);`);
      lines.push(`  }`);
      break;
    case "image":
      lines.push(`  ${sym} = lv_image_create(${parentSym});`);
      bindImageAsset(sym, node.props.src, emittedImages, imageIncludes, lines, "image src", "image");
      break;
    case "slider": {
      lines.push(`  ${sym} = lv_slider_create(${parentSym});`);
      const sr = propRange(node.props);
      lines.push(`  lv_slider_set_range(${sym}, ${sr.min}, ${sr.max});`);
      lines.push(`  lv_slider_set_value(${sym}, ${Number(node.props.value ?? 0)}, LV_ANIM_OFF);`);
      lines.push(`  lv_slider_set_mode(${sym}, LV_SLIDER_MODE_${String(node.props.mode ?? "NORMAL")});`);
      break;
    }
    case "switch":
      lines.push(`  ${sym} = lv_switch_create(${parentSym});`);
      if (node.props.checked) lines.push(`  lv_obj_add_state(${sym}, LV_STATE_CHECKED);`);
      break;
    case "checkbox":
      lines.push(`  ${sym} = lv_checkbox_create(${parentSym});`);
      lines.push(`  lv_checkbox_set_text(${sym}, ${cString(node.props.text ?? "")});`);
      if (node.props.checked) lines.push(`  lv_obj_add_state(${sym}, LV_STATE_CHECKED);`);
      break;
    case "bar": {
      lines.push(`  ${sym} = lv_bar_create(${parentSym});`);
      const br = propRange(node.props);
      lines.push(`  lv_bar_set_range(${sym}, ${br.min}, ${br.max});`);
      lines.push(`  lv_bar_set_value(${sym}, ${Number(node.props.value ?? 0)}, LV_ANIM_OFF);`);
      lines.push(`  lv_bar_set_mode(${sym}, LV_BAR_MODE_${String(node.props.mode ?? "NORMAL")});`);
      break;
    }
    case "arc": {
      lines.push(`  ${sym} = lv_arc_create(${parentSym});`);
      const ar = propRange(node.props);
      lines.push(`  lv_arc_set_range(${sym}, ${ar.min}, ${ar.max});`);
      lines.push(`  lv_arc_set_value(${sym}, ${Number(node.props.value ?? 0)});`);
      lines.push(
        `  lv_arc_set_bg_angles(${sym}, ${Number(node.props.bg_start_angle ?? 135)}, ${Number(node.props.bg_end_angle ?? 45)});`,
      );
      lines.push(`  lv_arc_set_rotation(${sym}, ${Number(node.props.rotation ?? 0)});`);
      break;
    }
    case "dropdown":
      lines.push(`  ${sym} = lv_dropdown_create(${parentSym});`);
      emitDropdownExtraData(sym, node, lines);
      break;
    case "textarea":
      lines.push(`  ${sym} = lv_textarea_create(${parentSym});`);
      lines.push(`  lv_textarea_set_text(${sym}, ${cString(node.props.text ?? "")});`);
      if (node.props.placeholder != null && String(node.props.placeholder).length) {
        lines.push(`  lv_textarea_set_placeholder_text(${sym}, ${cString(node.props.placeholder)});`);
      }
      if (node.props.one_line) lines.push(`  lv_textarea_set_one_line(${sym}, true);`);
      if (node.props.password_mode) lines.push(`  lv_textarea_set_password_mode(${sym}, true);`);
      {
        const maxLen = Number(node.props.max_length ?? 0);
        if (maxLen > 0) lines.push(`  lv_textarea_set_max_length(${sym}, ${maxLen});`);
      }
      break;
    case "list":
      lines.push(`  ${sym} = lv_list_create(${parentSym});`);
      emitListExtraData(sym, node, lines);
      break;
    case "roller":
      lines.push(`  ${sym} = lv_roller_create(${parentSym});`);
      lines.push(`  lv_roller_set_visible_row_count(${sym}, ${Number(node.props.visible_row_count ?? 3)});`);
      emitRollerExtraData(sym, node, lines);
      {
        const sel = Number(node.props.selected ?? 0);
        if (Number.isFinite(sel) && sel >= 0) {
          lines.push(`  lv_roller_set_selected(${sym}, ${sel}, LV_ANIM_OFF);`);
        }
      }
      break;
    case "imagebutton":
      lines.push(`  ${sym} = lv_imagebutton_create(${parentSym});`);
      bindImageAsset(
        sym,
        node.props.src_released,
        emittedImages,
        imageIncludes,
        lines,
        "src_released",
        "imagebutton_released",
      );
      bindImageAsset(
        sym,
        node.props.src_pressed,
        emittedImages,
        imageIncludes,
        lines,
        "src_pressed",
        "imagebutton_pressed",
      );
      bindImageAsset(
        sym,
        node.props.src_checked,
        emittedImages,
        imageIncludes,
        lines,
        "src_checked",
        "imagebutton_checked",
      );
      break;
    case "spinner":
      lines.push(`  ${sym} = lv_spinner_create(${parentSym});`);
      lines.push(
        `  lv_spinner_set_anim_params(${sym}, ${Number(node.props.anim_time ?? 1000)}, ${Number(node.props.arc_length ?? 60)});`,
      );
      break;
    case "tabview":
      lines.push(`  ${sym} = lv_tabview_create(${parentSym});`);
      lines.push(`  lv_tabview_set_tab_bar_size(${sym}, ${Number(node.props.tab_bar_size ?? 40)});`);
      lines.push(
        `  lv_tabview_set_tab_bar_position(${sym}, LV_DIR_${String(node.props.tab_bar_position ?? "TOP")});`,
      );
      emitTabviewExtraData(sym, node, lines);
      break;
    case "keyboard":
      lines.push(`  ${sym} = lv_keyboard_create(${parentSym});`);
      lines.push(`  lv_keyboard_set_mode(${sym}, LV_KEYBOARD_MODE_${String(node.props.mode ?? "TEXT_LOWER")});`);
      emitKeyboardExtraData(sym, node, lines);
      break;
    case "msgbox":
      lines.push(`  ${sym} = lv_msgbox_create(${parentSym});`);
      lines.push(`  lv_msgbox_add_title(${sym}, ${cString(node.props.title ?? "")});`);
      lines.push(`  lv_msgbox_add_text(${sym}, ${cString(node.props.text ?? "")});`);
      emitMsgboxExtraData(sym, node, lines);
      break;
    case "line": {
      lines.push(`  ${sym} = lv_line_create(${parentSym});`);
      const pts = parseLinePoints(node.props.points);
      const ptsSym = `${sym}_pts`;
      lines.push(`  {`);
      lines.push(`    static lv_point_precise_t ${ptsSym}[] = {`);
      for (const p of pts) {
        lines.push(`      { .x = ${p.x}, .y = ${p.y} },`);
      }
      lines.push(`    };`);
      lines.push(`    lv_line_set_points(${sym}, ${ptsSym}, ${pts.length});`);
      lines.push(`  }`);
      if (node.props.y_invert) lines.push(`  lv_line_set_y_invert(${sym}, true);`);
      break;
    }
    case "led":
      lines.push(`  ${sym} = lv_led_create(${parentSym});`);
      lines.push(`  lv_led_set_brightness(${sym}, ${Number(node.props.bright ?? 255)});`);
      lines.push(`  lv_led_set_color(${sym}, lv_color_hex(${colorHexLiteral(node.props.color)}));`);
      break;
    case "animimg":
      lines.push(`  ${sym} = lv_animimg_create(${parentSym});`);
      lines.push(`  lv_animimg_set_duration(${sym}, ${Number(node.props.duration ?? 200)});`);
      {
        const repeat = node.props.repeat !== false;
        lines.push(
          `  lv_animimg_set_repeat_count(${sym}, ${repeat ? "LV_ANIM_REPEAT_INFINITE" : "1"});`,
        );
        const frameSyms: string[] = [];
        for (const src of animFrameSources(node)) {
          const imgSym = imageSymbolForPath(src, emittedImages);
          if (imgSym) {
            imageIncludes.add(imgSym);
            frameSyms.push(`&${imgSym}`);
          }
        }
        if (frameSyms.length > 0) {
          const arr = `${sym}_frames`;
          lines.push(`  {`);
          lines.push(`    static const lv_image_dsc_t *${arr}[] = { ${frameSyms.join(", ")} };`);
          lines.push(`    lv_animimg_set_src(${sym}, (const void **)${arr}, ${frameSyms.length});`);
          lines.push(`    lv_animimg_start(${sym});`);
          lines.push(`  }`);
        }
      }
      break;
    case "spinbox": {
      lines.push(`  ${sym} = lv_spinbox_create(${parentSym});`);
      const spr = propRange(node.props, { min: 0, max: 999 });
      lines.push(`  lv_spinbox_set_range(${sym}, ${spr.min}, ${spr.max});`);
      lines.push(
        `  lv_spinbox_set_digit_format(${sym}, ${Number(node.props.digit_count ?? 3)}, ${Number(node.props.separator_position ?? 0)});`,
      );
      lines.push(`  lv_spinbox_set_step(${sym}, ${Number(node.props.step ?? 1)});`);
      lines.push(`  lv_spinbox_set_value(${sym}, ${Number(node.props.value ?? 0)});`);
      break;
    }
    case "canvas":
      lines.push(`  ${sym} = lv_canvas_create(${parentSym});`);
      lines.push(
        `  lv_obj_set_style_bg_color(${sym}, lv_color_hex(${colorHexLiteral(node.props.bg_color)}), 0);`,
      );
      lines.push(`  lv_obj_set_style_bg_opa(${sym}, ${colorOpaLiteral(node.props.bg_color)}, 0);`);
      break;
    case "qrcode": {
      lines.push(`  ${sym} = lv_qrcode_create(${parentSym});`);
      const qrSize = Number(node.props.qr_size ?? w ?? 80);
      lines.push(`  lv_qrcode_set_size(${sym}, ${qrSize});`);
      lines.push(`  lv_qrcode_set_dark_color(${sym}, lv_color_hex(${colorHexLiteral(node.props.dark_color)}));`);
      lines.push(`  lv_qrcode_set_light_color(${sym}, lv_color_hex(${colorHexLiteral(node.props.light_color)}));`);
      {
        const data = String(node.props.qr_data ?? "");
        if (data.length) {
          lines.push(`  lv_qrcode_update(${sym}, ${cString(data)}, ${data.length});`);
        }
      }
      break;
    }
    case "barcode": {
      lines.push(`  ${sym} = lv_barcode_create(${parentSym});`);
      lines.push(`  lv_barcode_set_scale(${sym}, ${Number(node.props.scale ?? 1)});`);
      {
        const data = String(node.props.barcode_data ?? "");
        if (data.length) {
          lines.push(`  lv_barcode_update(${sym}, ${cString(data)});`);
        }
      }
      break;
    }
    case "digitalclock":
      lines.push(`  ${sym} = lv_label_create(${parentSym});`);
      lines.push(`  lv_label_set_text(${sym}, ${cString(digitalClockText(node.props))});`);
      break;
    case "tileview":
      lines.push(`  ${sym} = lv_tileview_create(${parentSym});`);
      break;
    case "win":
      lines.push(`  ${sym} = lv_win_create(${parentSym});`);
      lines.push(
        `  lv_obj_set_height(lv_win_get_header(${sym}), ${Number(node.props.header_height ?? 32)});`,
      );
      if (node.props.title != null && String(node.props.title).length) {
        lines.push(`  lv_win_add_title(${sym}, ${cString(node.props.title)});`);
      }
      break;
    case "menu":
      lines.push(`  ${sym} = lv_menu_create(${parentSym});`);
      break;
    case "spangroup":
      lines.push(`  ${sym} = lv_spangroup_create(${parentSym});`);
      emitSpangroupExtraData(sym, node, lines);
      break;
    case "table":
      lines.push(`  ${sym} = lv_table_create(${parentSym});`);
      lines.push(`  lv_table_set_row_count(${sym}, ${Number(node.props.row_cnt ?? 3)});`);
      lines.push(`  lv_table_set_column_count(${sym}, ${Number(node.props.col_cnt ?? 2)});`);
      emitTableExtraData(sym, node, lines);
      break;
    case "buttonmatrix":
      lines.push(`  ${sym} = lv_buttonmatrix_create(${parentSym});`);
      emitButtonmatrixExtraData(sym, node, lines);
      break;
    case "scale": {
      lines.push(`  ${sym} = lv_scale_create(${parentSym});`);
      lines.push(`  lv_scale_set_mode(${sym}, LV_SCALE_MODE_${String(node.props.mode ?? "HORIZONTAL_BOTTOM")});`);
      lines.push(`  lv_scale_set_total_tick_count(${sym}, ${Number(node.props.tick_cnt ?? 10)});`);
      lines.push(`  lv_scale_set_major_tick_every(${sym}, ${Number(node.props.major_tick_every ?? 5)});`);
      lines.push(`  lv_scale_set_angle_range(${sym}, ${Number(node.props.angle_range ?? 270)});`);
      {
        const sc = propRange(node.props, { min: 0, max: 100 });
        lines.push(`  lv_scale_set_range(${sym}, ${sc.min}, ${sc.max});`);
      }
      break;
    }
    case "calendar":
      lines.push(`  ${sym} = lv_calendar_create(${parentSym});`);
      lines.push(
        `  lv_calendar_set_today_date(${sym}, ${Number(node.props.today_year ?? 2026)}, ${Number(node.props.today_month ?? 8)}, ${Number(node.props.today_day ?? 1)});`,
      );
      break;
    case "linechart":
    case "barchart":
    case "scatterchart":
    case "chart":
      lines.push(`  ${sym} = lv_chart_create(${parentSym});`);
      lines.push(`  lv_chart_set_point_count(${sym}, ${Number(node.props.point_count ?? 10)});`);
      emitChartExtraData(sym, node, lines);
      break;
    case "container":
    default:
      lines.push(`  ${sym} = lv_obj_create(${parentSym});`);
      break;
  }

  lines.push(`  lv_obj_set_pos(${sym}, ${x}, ${y});`);
  lines.push(`  lv_obj_set_size(${sym}, ${w}, ${h});`);
  emitFrameRotation(sym, node.frame, lines);
  if (node.type === "container") {
    emitContainerLayout(sym, node.props, lines);
  }
  emitLvglFlags(sym, node.props, lines);

  emitNodeStyles(sym, node, ir, fonts, lines, emittedImages, imageIncludes, fontIncludes);

  for (const ev of node.events) {
    for (const action of ev.actions) {
      const cb = eventCbForAction(ir.cPrefix, action);
      if (cb) {
        lines.push(`  lv_obj_add_event_cb(${sym}, ${cb}, LV_EVENT_${ev.trigger}, NULL);`);
      }
    }
  }

  for (const child of node.children) {
    emitWidgetCreate(ir, screenId, child, sym, lines, fonts, emittedImages, imageIncludes, fontIncludes);
  }
}

function collectSymbols(screenId: string, node: WidgetIR, cPrefix: string, out: string[], isRoot = true): void {
  if (!isRoot) out.push(symbolFor(screenId, node.id, cPrefix));
  for (const c of node.children) collectSymbols(screenId, c, cPrefix, out, false);
}

function cIdentToken(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

function setVarSuffix(variableId: string, value: unknown): string {
  const raw = value === undefined || value === null ? "0" : String(value);
  const safe = raw.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 32) || "0";
  return `${cIdentToken(variableId)}_${safe}`;
}

/** FR-034 / FR-035: map action → generated lv_event callback symbol. */
function eventCbForAction(cPrefix: string, action: Action): string | null {
  switch (action.type) {
    case "CHANGE_SCREEN":
      return `${cPrefix}event_change_screen_${action.target}`;
    case "CALL_FUNCTION":
      return `${cPrefix}event_call_${action.handler}`;
    case "SET_VAR":
      return `${cPrefix}event_set_var_${setVarSuffix(action.variableId, action.value)}`;
    case "TOGGLE_VAR":
      return `${cPrefix}event_toggle_var_${cIdentToken(action.variableId)}`;
    case "SWITCH_LANGUAGE":
      return `${cPrefix}event_switch_lang_${cIdentToken(action.locale)}`;
    case "PLAY_ANIMATION":
      return `${cPrefix}event_play_anim_${cIdentToken(action.animationId)}`;
    case "SET_PROP":
      return `${cPrefix}event_set_prop_${setPropSuffix(action.nodeId, action.prop, action.value)}`;
    default:
      return null;
  }
}

interface CollectedActions {
  changeTargets: string[];
  setVars: Array<{ suffix: string; variableId: string; intValue: number }>;
  toggleVars: string[];
  switchLangs: Array<{ locale: string; suffix: string; enumName: string }>;
  playAnims: string[];
  setProps: SetPropEmit[];
  hasVars: boolean;
  hasI18n: boolean;
  hasAnim: boolean;
}

function collectActions(ir: ProjectIR): CollectedActions {
  const changeTargets = new Set<string>();
  const setVars = new Map<string, { suffix: string; variableId: string; intValue: number }>();
  const toggleVars = new Set<string>();
  const switchLangs = new Map<string, { locale: string; suffix: string; enumName: string }>();
  const playAnims = new Set<string>();

  const walk = (n: WidgetIR) => {
    for (const ev of n.events) {
      for (const a of ev.actions) {
        if (a.type === "CHANGE_SCREEN") changeTargets.add(a.target);
        else if (a.type === "SET_VAR") {
          const suffix = setVarSuffix(a.variableId, a.value);
          const nVal = typeof a.value === "boolean" ? (a.value ? 1 : 0) : Number(a.value ?? 0);
          setVars.set(suffix, {
            suffix,
            variableId: a.variableId,
            intValue: Number.isFinite(nVal) ? nVal : 0,
          });
        } else if (a.type === "TOGGLE_VAR") toggleVars.add(a.variableId);
        else if (a.type === "SWITCH_LANGUAGE") {
          const suffix = cIdentToken(a.locale);
          switchLangs.set(a.locale, {
            locale: a.locale,
            suffix,
            enumName: `UI_LANG_${suffix.toUpperCase()}`,
          });
        } else if (a.type === "PLAY_ANIMATION") playAnims.add(a.animationId);
      }
    }
    n.children.forEach(walk);
  };
  for (const s of ir.screens) walk(s.root);

  const setProps = collectSetProps(ir);
  return {
    changeTargets: [...changeTargets],
    setVars: [...setVars.values()],
    toggleVars: [...toggleVars],
    switchLangs: [...switchLangs.values()],
    playAnims: [...playAnims],
    setProps,
    hasVars: setVars.size > 0 || toggleVars.size > 0,
    hasI18n: switchLangs.size > 0,
    hasAnim: playAnims.size > 0,
  };
}

function appendMissingHandlers(
  userC: string,
  handlers: string[],
  weak: boolean,
): { content: string; appended: string[] } {
  const appended: string[] = [];
  let content = userC;
  const attr = weak ? "__attribute__((weak))\n" : "";
  for (const h of handlers) {
    const re = new RegExp(`\\bvoid\\s+${h}\\s*\\(`);
    if (!re.test(content)) {
      content += `\n${attr}void ${h}(void)\n{\n    /* TODO: implement */\n}\n`;
      appended.push(h);
    }
  }
  return { content, appended };
}

export async function generate(projectRoot: string, opts: CodeGenOptions = {}): Promise<CodeGenResult> {
  const diagnostics: Diagnostic[] = [];
  const filesWritten: string[] = [];
  const filesSkipped: string[] = [];
  const filesPruned: string[] = [];

  try {
    const loaded = openProject(projectRoot);
    if (migrateLegacyCodegenLayout(loaded.root, loaded.project)) {
      saveProject(loaded);
      diagnostics.push({
        level: "info",
        code: "E_GEN_MIGRATE",
        message: "已迁移 legacy generated/ + user/ 至 forgeui_generated/custom/",
      });
    }

    const paths = resolveCodegenPaths(loaded.root, loaded.project);
    const ir = buildIR(loaded);
    const forgeDir = path.join(loaded.root, ".forge");

    if (opts.cleanOnly) {
      cleanCodegenExceptCustom(paths.codegenAbs, paths.customSubdir);
      if (opts.cleanPreviewBuild) {
        fs.rmSync(path.join(forgeDir, "preview-build", "out"), { recursive: true, force: true });
      }
      diagnostics.push({
        level: "info",
        code: "E_GEN_CLEAN",
        message: opts.cleanPreviewBuild
          ? `已清理 ${paths.codegenDir}/（保留 ${paths.customSubdir}/）与预览编译输出`
          : `已清理 ${paths.codegenDir}/（保留 ${paths.customSubdir}/）；预览 LVGL 缓存未动（与 Beken 一致）`,
      });
      return { ok: true, filesWritten: [], filesSkipped: [], diagnostics };
    }

    if (opts.cleanGenerated) cleanCodegenExceptCustom(paths.codegenAbs, paths.customSubdir);

    fs.mkdirSync(paths.codegenAbs, { recursive: true });
    fs.mkdirSync(path.join(paths.codegenAbs, "screens"), { recursive: true });
    fs.mkdirSync(path.join(paths.codegenAbs, "image"), { recursive: true });
    fs.mkdirSync(path.join(paths.codegenAbs, "fonts"), { recursive: true });
    fs.mkdirSync(paths.customAbs, { recursive: true });
    fs.mkdirSync(forgeDir, { recursive: true });

    const uiH = compileTemplate("c/ui.h.hbs");
    const uiC = compileTemplate("c/ui.c.hbs");
    const uiNavH = compileTemplate("c/ui_nav.h.hbs");
    const uiNavC = compileTemplate("c/ui_nav.c.hbs");
    const screenC = compileTemplate("c/screen.c.hbs");
    const screenH = compileTemplate("c/screen.h.hbs");
    const userH = compileTemplate("c/custom/ui_events.h.hbs");
    const userC = compileTemplate("c/custom/ui_events.c.hbs");
    const customFuncH = compileTemplate("c/custom/custom_func.h.hbs");
    const customFuncC = compileTemplate("c/custom/custom_func.c.hbs");

    const lvglInclude = ir.meta.export?.lvglInclude ?? "lvgl/lvgl.h";
    const imageMode = ir.meta.export?.imageMode ?? "c_array";
    let emittedImages: EmittedImage[] = [];
    if (imageMode === "c_array") {
      const { emitted, files } = emitProjectImages(
        loaded,
        path.join(paths.codegenAbs, "image"),
        lvglInclude,
        diagnostics,
      );
      emittedImages = emitted;
      for (const f of files) {
        if (!filesWritten.includes(f)) filesWritten.push(f);
      }
    }

    const fonts = normalizeFontAssets(loaded.project);

    const screenMetas = ir.screens.map((s) => {
      const symbols: string[] = [];
      collectSymbols(s.id, s.root, ir.cPrefix, symbols);
      const imageIncludes = new Set<string>();
      const fontIncludes = new Set<string>();
      const body: string[] = [];
      const screenSym = symbolFor(s.id, s.root.id, ir.cPrefix);
      body.push(`  ${screenSym} = lv_obj_create(NULL);`);
      body.push(`  lv_obj_set_size(${screenSym}, ${s.root.frame.w}, ${s.root.frame.h});`);
      emitContainerLayout(screenSym, s.root.props, body);
      emitFrameRotation(screenSym, s.root.frame, body);
      emitNodeStyles(screenSym, s.root, ir, fonts, body, emittedImages, imageIncludes, fontIncludes);
      for (const child of s.root.children) {
        emitWidgetCreate(ir, s.id, child, screenSym, body, fonts, emittedImages, imageIncludes, fontIncludes);
      }
      return {
        ...s,
        symbols,
        body: body.join("\n"),
        screenSym,
        imageIncludes: [...imageIncludes],
        fontIncludes: [...fontIncludes],
      };
    });

    const collected = collectActions(ir);

    writeFile(
      path.join(paths.codegenAbs, "ui.h"),
      uiH({
        ir,
        screens: screenMetas,
        includeGuard: "FORGEUI_GENERATED_UI_H",
        lvglInclude: ir.meta.export?.lvglInclude ?? "lvgl/lvgl.h",
        changeTargets: collected.changeTargets,
        setVars: collected.setVars,
        toggleVars: collected.toggleVars,
        switchLangs: collected.switchLangs,
        playAnims: collected.playAnims,
        setProps: collected.setProps,
      }),
      filesWritten,
      filesSkipped,
    );

    writeFile(
      path.join(paths.codegenAbs, "ui.c"),
      uiC({
        ir,
        screens: screenMetas,
        changeTargets: collected.changeTargets,
        setVars: collected.setVars,
        toggleVars: collected.toggleVars,
        switchLangs: collected.switchLangs,
        playAnims: collected.playAnims,
        setProps: collected.setProps,
        hasVars: collected.hasVars,
        hasI18n: collected.hasI18n,
        hasAnim: collected.hasAnim,
        defaultScreen: ir.meta.defaultScreen,
      }),
      filesWritten,
      filesSkipped,
    );

    const lvglIncludeNav = lvglInclude;
    writeFile(path.join(paths.codegenAbs, "ui_nav.h"), uiNavH({ lvglInclude: lvglIncludeNav }), filesWritten, filesSkipped);
    writeFile(
      path.join(paths.codegenAbs, "ui_nav.c"),
      uiNavC({
        screens: screenMetas.map((s) => ({ id: s.id })),
        screenPrefix: ir.screenPrefix,
        lvglInclude,
      }),
      filesWritten,
      filesSkipped,
    );

    for (const s of screenMetas) {
      writeFile(
        path.join(paths.codegenAbs, "screens", `screen_${s.id}.h`),
        screenH({ ir, screen: s }),
        filesWritten,
        filesSkipped,
      );
      writeFile(
        path.join(paths.codegenAbs, "screens", `screen_${s.id}.c`),
        screenC({ ir, screen: s }),
        filesWritten,
        filesSkipped,
      );
    }

    for (const f of emitProjectFonts(loaded, path.join(paths.codegenAbs, "fonts"), diagnostics)) {
      if (!filesWritten.includes(f)) filesWritten.push(f);
    }

    for (const f of emitProjectI18n(loaded, paths.codegenAbs, diagnostics)) {
      if (!filesWritten.includes(f)) filesWritten.push(f);
    }

    for (const f of emitProjectAnimations(loaded, paths.codegenAbs, diagnostics)) {
      if (!filesWritten.includes(f)) filesWritten.push(f);
    }

    for (const f of emitProjectVariables(loaded, paths.codegenAbs, diagnostics)) {
      if (!filesWritten.includes(f)) filesWritten.push(f);
    }

    for (const f of emitMicroPython(loaded, path.join(paths.codegenAbs, "micropython"), diagnostics)) {
      if (!filesWritten.includes(f)) filesWritten.push(f);
    }

    {
      const cmakeSources = listGeneratedCRelPaths(paths.codegenAbs);
      const cmakeTpl = compileTemplate("c/forgeui_generated.cmake.hbs");
      writeFile(
        path.join(paths.codegenAbs, "forgeui_generated.cmake"),
        cmakeTpl({ sources: cmakeSources }),
        filesWritten,
        filesSkipped,
      );
    }

    const weakStubs = loaded.project.export?.eventStubStyle === "weak";
    const userHPath = path.join(paths.customAbs, "ui_events.h");
    const userCPath = path.join(paths.customAbs, "ui_events.c");
    if (!fs.existsSync(userHPath)) {
      writeFile(userHPath, userH({ handlers: ir.callHandlers }), filesWritten, filesSkipped);
    } else {
      filesSkipped.push(userHPath);
    }

    if (!fs.existsSync(userCPath)) {
      writeFile(userCPath, userC({ handlers: ir.callHandlers, weak: weakStubs }), filesWritten, filesSkipped);
    } else {
      const existing = fs.readFileSync(userCPath, "utf8");
      const { content, appended } = appendMissingHandlers(existing, ir.callHandlers, weakStubs);
      if (appended.length) {
        writeFile(userCPath, content, filesWritten, filesSkipped);
      } else {
        filesSkipped.push(userCPath);
      }
    }

    const customFuncHPath = path.join(paths.customAbs, "custom_func.h");
    const customFuncCPath = path.join(paths.customAbs, "custom_func.c");
    if (!fs.existsSync(customFuncHPath)) {
      writeFile(customFuncHPath, customFuncH({}), filesWritten, filesSkipped);
    } else {
      filesSkipped.push(customFuncHPath);
    }
    if (!fs.existsSync(customFuncCPath)) {
      writeFile(customFuncCPath, customFuncC({}), filesWritten, filesSkipped);
    } else {
      filesSkipped.push(customFuncCPath);
    }

    const relFiles = filesWritten.map((f) => path.relative(loaded.root, f).replace(/\\/g, "/"));
    const manifest = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      lvglVersion: ir.meta.lvglVersion,
      codegenDir: paths.codegenDir,
      customSubdir: paths.customSubdir,
      files: relFiles,
      skipped: filesSkipped.map((f) => path.relative(loaded.root, f).replace(/\\/g, "/")),
    };
    writeFile(path.join(forgeDir, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, filesWritten, filesSkipped);

    if (opts.pruneOrphans) {
      const keep = [...filesWritten, ...filesSkipped];
      const pruned = pruneCodegenOrphans(loaded.root, paths.codegenAbs, keep, paths.customSubdir);
      filesPruned.push(...pruned);
      if (pruned.length) {
        diagnostics.push({
          level: "info",
          code: "E_GEN_PRUNE",
          message: `prune-orphans removed ${pruned.length} file(s)`,
        });
        // refresh manifest files list after prune (already accurate for keep set)
        const prunedSet = new Set(pruned);
        manifest.files = relFiles.filter((f) => !prunedSet.has(f));
        fs.writeFileSync(path.join(forgeDir, "build-manifest.json"), `${JSON.stringify({ ...manifest, pruned }, null, 2)}\n`, "utf8");
      } else {
        diagnostics.push({
          level: "info",
          code: "E_GEN_PRUNE",
          message: "prune-orphans: no orphan files",
        });
      }
    }

    if (ir.meta.deliveryMode === "both" || ir.meta.deliveryMode === "dynamic_ui") {
      diagnostics.push({
        level: "info",
        code: "E_GEN_PACK_HINT",
        message: "deliveryMode includes A2 pack; run `forgeui pack` after generate when needed",
      });
    }

    return { ok: true, filesWritten, filesSkipped, filesPruned, diagnostics };
  } catch (e) {
    const err = e as Error;
    diagnostics.push({
      level: "error",
      code: err instanceof ForgeError ? err.code : ErrorCodes.E_GEN_001,
      message: err.message,
    });
    return { ok: false, filesWritten, filesSkipped, filesPruned, diagnostics };
  }
}
