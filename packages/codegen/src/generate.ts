import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import {
  buildIR,
  cleanCodegenExceptCustom,
  migrateLegacyCodegenLayout,
  openProject,
  resolveCodegenPaths,
  saveProject,
  symbolFor,
  styleProp,
  type ProjectIR,
  type WidgetIR,
} from "@forgeui/core";
import { Diagnostic, ErrorCodes, ForgeError } from "@forgeui/shared";

export interface CodeGenOptions {
  cleanGenerated?: boolean;
  /** Delete codegen output (except custom/) without regenerating. */
  cleanOnly?: boolean;
  /** When cleanOnly, wipe `.forge/preview-build/out` entirely (slow next compile). Default false. */
  cleanPreviewBuild?: boolean;
}

export interface CodeGenResult {
  ok: boolean;
  filesWritten: string[];
  filesSkipped: string[];
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

function cString(value: unknown): string {
  const s = String(value ?? "");
  return JSON.stringify(s);
}

function colorToHex(value: unknown): string {
  if (typeof value !== "string") return "0x000000";
  const m = value.trim().replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(m)) return `0x${m.toUpperCase()}`;
  return "0x000000";
}

function bgColorOf(node: WidgetIR): string {
  const v = styleProp(node.style, "main", "default", "bg_color");
  return colorToHex(v ?? "#000000");
}

function textColorOf(node: WidgetIR): string {
  const v = styleProp(node.style, "main", "default", "text_color");
  return colorToHex(v ?? "#FFFFFF");
}

function propRange(props: Record<string, unknown>, fallback = { min: 0, max: 100 }) {
  const r = props.range;
  if (r && typeof r === "object" && !Array.isArray(r)) {
    const o = r as { min?: unknown; max?: unknown };
    return { min: Number(o.min ?? fallback.min), max: Number(o.max ?? fallback.max) };
  }
  return {
    min: Number(props.min ?? fallback.min),
    max: Number(props.max ?? fallback.max),
  };
}

function compileTemplate(name: string): Handlebars.TemplateDelegate {
  const file = path.join(templatesDir(), name);
  const src = fs.readFileSync(file, "utf8");
  return Handlebars.compile(src, { noEscape: true });
}

function emitWidgetCreate(
  ir: ProjectIR,
  screenId: string,
  node: WidgetIR,
  parentSym: string,
  lines: string[],
): void {
  const sym = symbolFor(screenId, node.id, ir.cPrefix);
  const x = node.frame.x;
  const y = node.frame.y;
  const w = node.frame.w;
  const h = node.frame.h;

  switch (node.type) {
    case "label":
      lines.push(`  ${sym} = lv_label_create(${parentSym});`);
      lines.push(`  lv_label_set_text(${sym}, ${cString(node.props.text ?? "")});`);
      break;
    case "button":
      lines.push(`  ${sym} = lv_button_create(${parentSym});`);
      lines.push(`  {`);
      lines.push(`    lv_obj_t *label = lv_label_create(${sym});`);
      lines.push(`    lv_label_set_text(label, ${cString(node.props.text ?? "Button")});`);
      lines.push(`    lv_obj_center(label);`);
      lines.push(`  }`);
      break;
    case "image":
      lines.push(`  ${sym} = lv_image_create(${parentSym});`);
      lines.push(`  /* TODO: bind image src ${cString(node.props.src ?? "")} */`);
      break;
    case "slider": {
      lines.push(`  ${sym} = lv_slider_create(${parentSym});`);
      const sr = propRange(node.props);
      lines.push(`  lv_slider_set_range(${sym}, ${sr.min}, ${sr.max});`);
      lines.push(`  lv_slider_set_value(${sym}, ${Number(node.props.value ?? 0)}, LV_ANIM_OFF);`);
      break;
    }
    case "switch":
      lines.push(`  ${sym} = lv_switch_create(${parentSym});`);
      if (node.props.checked) lines.push(`  lv_obj_add_state(${sym}, LV_STATE_CHECKED);`);
      break;
    case "checkbox":
      lines.push(`  ${sym} = lv_checkbox_create(${parentSym});`);
      lines.push(`  lv_checkbox_set_text(${sym}, ${cString(node.props.text ?? "")});`);
      break;
    case "bar": {
      lines.push(`  ${sym} = lv_bar_create(${parentSym});`);
      const br = propRange(node.props);
      lines.push(`  lv_bar_set_range(${sym}, ${br.min}, ${br.max});`);
      lines.push(`  lv_bar_set_value(${sym}, ${Number(node.props.value ?? 0)}, LV_ANIM_OFF);`);
      break;
    }
    case "arc": {
      lines.push(`  ${sym} = lv_arc_create(${parentSym});`);
      const ar = propRange(node.props);
      lines.push(`  lv_arc_set_range(${sym}, ${ar.min}, ${ar.max});`);
      lines.push(`  lv_arc_set_value(${sym}, ${Number(node.props.value ?? 0)});`);
      break;
    }
    case "dropdown":
      lines.push(`  ${sym} = lv_dropdown_create(${parentSym});`);
      lines.push(`  lv_dropdown_set_options(${sym}, ${cString(node.props.options ?? "")});`);
      break;
    case "textarea":
      lines.push(`  ${sym} = lv_textarea_create(${parentSym});`);
      lines.push(`  lv_textarea_set_text(${sym}, ${cString(node.props.text ?? "")});`);
      break;
    case "list":
      lines.push(`  ${sym} = lv_list_create(${parentSym});`);
      break;
    case "roller":
      lines.push(`  ${sym} = lv_roller_create(${parentSym});`);
      lines.push(`  lv_roller_set_visible_row_count(${sym}, ${Number(node.props.visible_row_count ?? 3)});`);
      break;
    case "imagebutton":
      lines.push(`  ${sym} = lv_imagebutton_create(${parentSym});`);
      break;
    case "spinner":
      lines.push(
        `  ${sym} = lv_spinner_create(${parentSym}, ${Number(node.props.arc_length ?? 60)}, ${Number(node.props.anim_time ?? 1000)});`,
      );
      break;
    case "container":
    default:
      lines.push(`  ${sym} = lv_obj_create(${parentSym});`);
      break;
  }

  lines.push(`  lv_obj_set_pos(${sym}, ${x}, ${y});`);
  lines.push(`  lv_obj_set_size(${sym}, ${w}, ${h});`);

  if (node.type === "label") {
    lines.push(`  lv_obj_set_style_text_color(${sym}, lv_color_hex(${textColorOf(node)}), 0);`);
  }
  if (node.type === "container" || node.type === "screen") {
    lines.push(`  lv_obj_set_style_bg_color(${sym}, lv_color_hex(${bgColorOf(node)}), 0);`);
  }

  for (const ev of node.events) {
    for (const action of ev.actions) {
      if (action.type === "CHANGE_SCREEN") {
        lines.push(`  lv_obj_add_event_cb(${sym}, ${ir.cPrefix}event_change_screen_${action.target}, LV_EVENT_${ev.trigger}, NULL);`);
      } else if (action.type === "CALL_FUNCTION") {
        lines.push(`  lv_obj_add_event_cb(${sym}, ${ir.cPrefix}event_call_${action.handler}, LV_EVENT_${ev.trigger}, NULL);`);
      }
    }
  }

  for (const child of node.children) {
    emitWidgetCreate(ir, screenId, child, sym, lines);
  }
}

function collectSymbols(screenId: string, node: WidgetIR, cPrefix: string, out: string[], isRoot = true): void {
  if (!isRoot) out.push(symbolFor(screenId, node.id, cPrefix));
  for (const c of node.children) collectSymbols(screenId, c, cPrefix, out, false);
}

function appendMissingHandlers(userC: string, handlers: string[]): { content: string; appended: string[] } {
  const appended: string[] = [];
  let content = userC;
  for (const h of handlers) {
    const re = new RegExp(`\\bvoid\\s+${h}\\s*\\(`);
    if (!re.test(content)) {
      content += `\nvoid ${h}(void)\n{\n    /* TODO: implement */\n}\n`;
      appended.push(h);
    }
  }
  return { content, appended };
}

export async function generate(projectRoot: string, opts: CodeGenOptions = {}): Promise<CodeGenResult> {
  const diagnostics: Diagnostic[] = [];
  const filesWritten: string[] = [];
  const filesSkipped: string[] = [];

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

    const screenMetas = ir.screens.map((s) => {
      const symbols: string[] = [];
      collectSymbols(s.id, s.root, ir.cPrefix, symbols);
      const body: string[] = [];
      const screenSym = symbolFor(s.id, s.root.id, ir.cPrefix);
      body.push(`  ${screenSym} = lv_obj_create(NULL);`);
      body.push(`  lv_obj_set_size(${screenSym}, ${s.root.frame.w}, ${s.root.frame.h});`);
      body.push(`  lv_obj_set_style_bg_color(${screenSym}, lv_color_hex(${bgColorOf(s.root)}), 0);`);
      for (const child of s.root.children) {
        emitWidgetCreate(ir, s.id, child, screenSym, body);
      }
      return { ...s, symbols, body: body.join("\n"), screenSym };
    });

    const changeTargets = new Set<string>();
    for (const s of ir.screens) {
      const walk = (n: WidgetIR) => {
        for (const ev of n.events) {
          for (const a of ev.actions) {
            if (a.type === "CHANGE_SCREEN") changeTargets.add(a.target);
          }
        }
        n.children.forEach(walk);
      };
      walk(s.root);
    }

    writeFile(
      path.join(paths.codegenAbs, "ui.h"),
      uiH({
        ir,
        screens: screenMetas,
        includeGuard: "FORGEUI_GENERATED_UI_H",
        lvglInclude: ir.meta.export?.lvglInclude ?? "lvgl/lvgl.h",
        changeTargets: [...changeTargets],
      }),
      filesWritten,
      filesSkipped,
    );

    writeFile(
      path.join(paths.codegenAbs, "ui.c"),
      uiC({
        ir,
        screens: screenMetas,
        changeTargets: [...changeTargets],
        defaultScreen: ir.meta.defaultScreen,
      }),
      filesWritten,
      filesSkipped,
    );

    const lvglInclude = ir.meta.export?.lvglInclude ?? "lvgl/lvgl.h";
    writeFile(path.join(paths.codegenAbs, "ui_nav.h"), uiNavH({ lvglInclude }), filesWritten, filesSkipped);
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

    copyTemplateFile(
      "c/forgeui_generated.cmake",
      path.join(paths.codegenAbs, "forgeui_generated.cmake"),
      filesWritten,
      filesSkipped,
    );

    const userHPath = path.join(paths.customAbs, "ui_events.h");
    const userCPath = path.join(paths.customAbs, "ui_events.c");
    if (!fs.existsSync(userHPath)) {
      writeFile(userHPath, userH({ handlers: ir.callHandlers }), filesWritten, filesSkipped);
    } else {
      filesSkipped.push(userHPath);
    }

    if (!fs.existsSync(userCPath)) {
      writeFile(userCPath, userC({ handlers: ir.callHandlers }), filesWritten, filesSkipped);
    } else {
      const existing = fs.readFileSync(userCPath, "utf8");
      const { content, appended } = appendMissingHandlers(existing, ir.callHandlers);
      if (appended.length) {
        writeFile(userCPath, content, filesWritten, filesSkipped);
      } else {
        filesSkipped.push(userCPath);
      }
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      lvglVersion: ir.meta.lvglVersion,
      files: filesWritten.map((f) => path.relative(loaded.root, f).replace(/\\/g, "/")),
    };
    writeFile(path.join(forgeDir, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, filesWritten, filesSkipped);

    if (ir.meta.deliveryMode === "both" || ir.meta.deliveryMode === "dynamic_ui") {
      diagnostics.push({
        level: "info",
        code: ErrorCodes.E_PACK_NOT_IMPL,
        message: "deliveryMode requests A2 pack; Packer is stubbed in MVP (skipped)",
      });
    }

    return { ok: true, filesWritten, filesSkipped, diagnostics };
  } catch (e) {
    const err = e as Error;
    diagnostics.push({
      level: "error",
      code: err instanceof ForgeError ? err.code : ErrorCodes.E_GEN_001,
      message: err.message,
    });
    return { ok: false, filesWritten, filesSkipped, diagnostics };
  }
}
