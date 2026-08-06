import { symbolFor, type ProjectIR, type WidgetIR } from "@forgeui/core";

export interface SetPropEmit {
  suffix: string;
  /** Body lines (indented) inside the event callback. */
  body: string;
  externDecl?: string;
}

function cIdentToken(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

function cString(value: unknown): string {
  return JSON.stringify(String(value ?? ""));
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = String(value ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function asNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function walkFind(
  node: WidgetIR,
  nodeId: string,
): WidgetIR | null {
  if (node.id === nodeId) return node;
  for (const c of node.children) {
    const hit = walkFind(c, nodeId);
    if (hit) return hit;
  }
  return null;
}

export function resolveSetPropTarget(
  ir: ProjectIR,
  nodeId: string,
): { screenId: string; widget: WidgetIR; targetExpr: string; externDecl?: string } | null {
  for (const s of ir.screens) {
    if (s.id === nodeId || s.root.id === nodeId) {
      return {
        screenId: s.id,
        widget: s.root,
        targetExpr: `${ir.screenPrefix}${s.id}_get()`,
      };
    }
    const hit = walkFind(s.root, nodeId);
    if (hit) {
      const sym = symbolFor(s.id, hit.id, ir.cPrefix);
      return {
        screenId: s.id,
        widget: hit,
        targetExpr: sym,
        externDecl: `extern lv_obj_t *${sym};`,
      };
    }
  }
  return null;
}

function emitSetterLines(widgetType: string, prop: string, value: unknown): string[] {
  switch (prop) {
    case "text": {
      const s = cString(value);
      if (widgetType === "textarea") return [`    lv_textarea_set_text(target, ${s});`];
      if (widgetType === "checkbox") return [`    lv_checkbox_set_text(target, ${s});`];
      if (widgetType === "button") {
        return [
          `    lv_obj_t *label = lv_obj_get_child(target, 0);`,
          `    if (label) lv_label_set_text(label, ${s});`,
        ];
      }
      return [`    lv_label_set_text(target, ${s});`];
    }
    case "hidden":
      return asBool(value)
        ? [`    lv_obj_add_flag(target, LV_OBJ_FLAG_HIDDEN);`]
        : [`    lv_obj_clear_flag(target, LV_OBJ_FLAG_HIDDEN);`];
    case "opacity":
      return [`    lv_obj_set_style_opa(target, ${asNum(value)}, LV_PART_MAIN);`];
    case "x":
      return [`    lv_obj_set_x(target, ${asNum(value)});`];
    case "y":
      return [`    lv_obj_set_y(target, ${asNum(value)});`];
    case "w":
      return [`    lv_obj_set_width(target, ${asNum(value)});`];
    case "h":
      return [`    lv_obj_set_height(target, ${asNum(value)});`];
    case "checked":
      return asBool(value)
        ? [`    lv_obj_add_state(target, LV_STATE_CHECKED);`]
        : [`    lv_obj_clear_state(target, LV_STATE_CHECKED);`];
    case "disabled":
      return asBool(value)
        ? [`    lv_obj_add_state(target, LV_STATE_DISABLED);`]
        : [`    lv_obj_clear_state(target, LV_STATE_DISABLED);`];
    case "value": {
      const n = asNum(value);
      if (widgetType === "slider") return [`    lv_slider_set_value(target, ${n}, LV_ANIM_OFF);`];
      if (widgetType === "bar") return [`    lv_bar_set_value(target, ${n}, LV_ANIM_OFF);`];
      if (widgetType === "arc") return [`    lv_arc_set_value(target, ${n});`];
      if (widgetType === "spinbox") return [`    lv_spinbox_set_value(target, ${n});`];
      if (widgetType === "spinner") return [`    /* SET_PROP value: spinner has no set_value */`];
      return [`    lv_obj_set_style_opa(target, ${n}, LV_PART_MAIN); /* fallback value→opa */`];
    }
    case "placeholder":
      return [`    lv_textarea_set_placeholder_text(target, ${cString(value)});`];
    case "bright":
      return [`    lv_led_set_brightness(target, ${asNum(value)});`];
    case "color":
      if (widgetType === "led") {
        const hex =
          typeof value === "string"
            ? `0x${value.replace("#", "").slice(0, 6).toUpperCase() || "00FF00"}`
            : "0x00FF00";
        return [`    lv_led_set_color(target, lv_color_hex(${hex}));`];
      }
      return [`    /* unsupported SET_PROP color for ${widgetType} */`];
    case "qr_data": {
      const s = String(value ?? "");
      return [`    lv_qrcode_update(target, ${cString(s)}, ${s.length});`];
    }
    case "barcode_data":
      return [`    lv_barcode_update(target, ${cString(value)});`];
    default:
      return [`    /* unsupported SET_PROP prop: ${prop} */`];
  }
}

export function setPropSuffix(nodeId: string, prop: string, value: unknown): string {
  const raw = value === undefined || value === null ? "" : String(value);
  const safe = raw.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 24) || "v";
  return `${cIdentToken(nodeId)}_${cIdentToken(prop)}_${safe}`;
}

/** Build unique SET_PROP callback payloads for ui.c / ui.h. */
export function collectSetProps(ir: ProjectIR): SetPropEmit[] {
  const map = new Map<string, SetPropEmit>();

  const walk = (n: WidgetIR) => {
    for (const ev of n.events) {
      for (const a of ev.actions) {
        if (a.type !== "SET_PROP") continue;
        const suffix = setPropSuffix(a.nodeId, a.prop, a.value);
        if (map.has(suffix)) continue;
        const resolved = resolveSetPropTarget(ir, a.nodeId);
        const targetExpr = resolved?.targetExpr ?? "NULL";
        const lines = [
          `    lv_obj_t *target = ${targetExpr};`,
          `    if (!target) return;`,
          ...emitSetterLines(resolved?.widget.type ?? "label", a.prop, a.value),
        ];
        map.set(suffix, {
          suffix,
          body: lines.join("\n"),
          externDecl: resolved?.externDecl,
        });
      }
    }
    n.children.forEach(walk);
  };
  for (const s of ir.screens) walk(s.root);
  return [...map.values()];
}
