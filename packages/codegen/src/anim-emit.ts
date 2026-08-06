import type { LoadedProject, Node, ScreenDocument } from "@forgeui/core";
import { normalizeAnimations, symbolFor, type AnimProperty, type TimelineAnimation } from "@forgeui/core";
import type { Diagnostic } from "@forgeui/shared";
import fs from "node:fs";
import path from "node:path";

function cIdent(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

function propSetter(prop: AnimProperty): { exec: string; values: string } {
  switch (prop) {
    case "x":
      return { exec: "lv_obj_set_x", values: "lv_anim_set_values" };
    case "y":
      return { exec: "lv_obj_set_y", values: "lv_anim_set_values" };
    case "w":
      return { exec: "lv_obj_set_width", values: "lv_anim_set_values" };
    case "h":
      return { exec: "lv_obj_set_height", values: "lv_anim_set_values" };
    case "opacity":
      return { exec: "lv_obj_set_style_opa", values: "lv_anim_set_values" };
    case "rotation":
      return { exec: "lv_obj_set_style_transform_rotation", values: "lv_anim_set_values" };
    default:
      return { exec: "lv_obj_set_x", values: "lv_anim_set_values" };
  }
}

interface NodeBinding {
  screenId: string;
  /** C expression yielding lv_obj_t* */
  expr: string;
  /** optional extern for child widgets */
  externDecl?: string;
  include?: string;
}

function walkFind(node: Node, nodeId: string): boolean {
  if (node.id === nodeId) return true;
  return node.children.some((c) => walkFind(c, nodeId));
}

/** Resolve design-time nodeId → generated lv_obj_t* expression (FR-071). */
export function resolveAnimNodeBinding(
  loaded: LoadedProject,
  nodeId: string,
  cPrefix: string,
  screenPrefix: string,
): NodeBinding | null {
  for (const ref of loaded.project.screens) {
    const screen = loaded.screens.get(ref.id);
    if (!screen) continue;
    if (screen.id === nodeId || (screen as ScreenDocument).id === nodeId) {
      return {
        screenId: ref.id,
        expr: `${screenPrefix}${ref.id}_get()`,
        include: `screens/screen_${ref.id}.h`,
      };
    }
    if (walkFind(screen, nodeId)) {
      const sym = symbolFor(ref.id, nodeId, cPrefix);
      return {
        screenId: ref.id,
        expr: sym,
        externDecl: `extern lv_obj_t *${sym};`,
        include: `screens/screen_${ref.id}.h`,
      };
    }
  }
  return null;
}

function emitOneAnim(
  anim: TimelineAnimation,
  resolve: (nodeId: string) => NodeBinding | null,
  missing: string[],
): string {
  const fn = `ui_anim_play_${cIdent(anim.id)}`;
  const lines: string[] = [`void ${fn}(void)`, `{`];
  if (!anim.tracks.length) {
    lines.push(`    /* empty timeline ${anim.id} */`, `}`, ``);
    return lines.join("\n");
  }
  for (const track of anim.tracks) {
    const kfs = track.keyframes;
    if (kfs.length < 1) continue;
    const start = kfs[0]!;
    const end = kfs[kfs.length - 1]!;
    const duration = Math.max(1, end.t - start.t || anim.duration);
    const { exec } = propSetter(track.property);
    const varName = `a_${cIdent(track.id)}`;
    const binding = resolve(track.nodeId);
    if (!binding) missing.push(`${anim.id}/${track.nodeId}`);
    const targetExpr = binding?.expr ?? "NULL";
    lines.push(`    /* track ${track.id}: ${track.nodeId}.${track.property} */`);
    lines.push(`    {`);
    lines.push(`        lv_anim_t ${varName};`);
    lines.push(`        lv_anim_init(&${varName});`);
    lines.push(`        lv_obj_t *target = ${targetExpr};`);
    lines.push(`        if (target) {`);
    lines.push(`            lv_anim_set_var(&${varName}, target);`);
    lines.push(`            lv_anim_set_exec_cb(&${varName}, (lv_anim_exec_xcb_t)${exec});`);
    lines.push(`            lv_anim_set_values(&${varName}, ${Math.round(start.value)}, ${Math.round(end.value)});`);
    lines.push(`            lv_anim_set_time(&${varName}, ${duration});`);
    if (anim.loop) {
      lines.push(`            lv_anim_set_repeat_count(&${varName}, LV_ANIM_REPEAT_INFINITE);`);
    }
    lines.push(`            lv_anim_start(&${varName});`);
    lines.push(`        }`);
    lines.push(`    }`);
  }
  lines.push(`}`, ``);
  return lines.join("\n");
}

/** Emit ui_anim.h / ui_anim.c for FR-071 timeline animations. */
export function emitProjectAnimations(
  loaded: LoadedProject,
  outDir: string,
  diagnostics: Diagnostic[],
): string[] {
  const anims = normalizeAnimations(loaded.project);
  if (!anims.length) return [];

  fs.mkdirSync(outDir, { recursive: true });
  const hPath = path.join(outDir, "ui_anim.h");
  const cPath = path.join(outDir, "ui_anim.c");

  const cPrefix = loaded.project.naming?.cPrefix ?? "ui_";
  const screenPrefix = loaded.project.naming?.screenPrefix ?? "screen_";
  const resolve = (nodeId: string) => resolveAnimNodeBinding(loaded, nodeId, cPrefix, screenPrefix);

  const missing: string[] = [];
  const bodies = anims.map((a) => emitOneAnim(a, resolve, missing)).join("\n");

  const includes = new Set<string>();
  const externs = new Set<string>();
  for (const a of anims) {
    for (const t of a.tracks) {
      const b = resolve(t.nodeId);
      if (!b) continue;
      if (b.include) includes.add(b.include);
      if (b.externDecl) externs.add(b.externDecl);
    }
  }

  const decls = anims.map((a) => `void ui_anim_play_${cIdent(a.id)}(void);`).join("\n");
  const h = `#ifndef FORGEUI_UI_ANIM_H
#define FORGEUI_UI_ANIM_H
#include "lvgl/lvgl.h"

#ifdef __cplusplus
extern "C" {
#endif

${decls}
void ui_anim_play(const char *animation_id);

#ifdef __cplusplus
}
#endif

#endif
`;

  const dispatch = anims
    .map((a) => `    if (strcmp(animation_id, "${a.id}") == 0) { ui_anim_play_${cIdent(a.id)}(); return; }`)
    .join("\n");

  const includeBlock = [...includes].map((f) => `#include "${f}"`).join("\n");
  const externBlock = [...externs].join("\n");

  const c = `#include "ui_anim.h"
#include <string.h>
${includeBlock ? `${includeBlock}\n` : ""}${externBlock ? `${externBlock}\n` : ""}
${bodies}
void ui_anim_play(const char *animation_id)
{
    if (!animation_id) return;
${dispatch}
}
`;

  fs.writeFileSync(hPath, h, "utf8");
  fs.writeFileSync(cPath, c, "utf8");
  diagnostics.push({
    level: "info",
    code: "E_ANIM_OK",
    message: `animations → ui_anim.c (${anims.length} timeline(s))`,
  });
  if (missing.length) {
    diagnostics.push({
      level: "warning",
      code: "E_ANIM_UNBOUND",
      message: `animation tracks with unresolved nodeId (NULL target): ${missing.join(", ")}`,
    });
  }
  return [hPath, cPath];
}
