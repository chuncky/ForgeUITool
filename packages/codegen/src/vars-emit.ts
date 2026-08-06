import type { LoadedProject } from "@forgeui/core";
import { normalizeVariables } from "@forgeui/core";
import type { Diagnostic } from "@forgeui/shared";
import fs from "node:fs";
import path from "node:path";

function cIdent(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

/** FR-035: emit ui_vars.h/c for project variables. */
export function emitProjectVariables(
  loaded: LoadedProject,
  outDir: string,
  diagnostics: Diagnostic[],
): string[] {
  const vars = normalizeVariables(loaded.project);
  if (!vars.length) return [];

  fs.mkdirSync(outDir, { recursive: true });
  const hPath = path.join(outDir, "ui_vars.h");
  const cPath = path.join(outDir, "ui_vars.c");

  const decls = vars
    .map((v) => {
      if (v.type === "bool") return `extern int forgeui_var_${cIdent(v.id)};`;
      if (v.type === "string") return `extern const char *forgeui_var_${cIdent(v.id)};`;
      return `extern int forgeui_var_${cIdent(v.id)};`;
    })
    .join("\n");

  const h = `#ifndef FORGEUI_UI_VARS_H
#define FORGEUI_UI_VARS_H

#ifdef __cplusplus
extern "C" {
#endif

${decls}
void forgeui_vars_init(void);
void forgeui_var_set_int(const char *id, int value);
int forgeui_var_get_int(const char *id);

#ifdef __cplusplus
}
#endif

#endif
`;

  const defs = vars
    .map((v) => {
      const name = `forgeui_var_${cIdent(v.id)}`;
      if (v.type === "string") {
        const s = String(v.defaultValue ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return `const char *${name} = "${s}";`;
      }
      const n = v.type === "bool" ? (v.defaultValue ? 1 : 0) : Number(v.defaultValue ?? 0);
      return `int ${name} = ${Number.isFinite(n) ? n : 0};`;
    })
    .join("\n");

  const setCases = vars
    .filter((v) => v.type !== "string")
    .map((v) => `    if (strcmp(id, "${v.id}") == 0) { forgeui_var_${cIdent(v.id)} = value; return; }`)
    .join("\n");
  const getCases = vars
    .filter((v) => v.type !== "string")
    .map((v) => `    if (strcmp(id, "${v.id}") == 0) return forgeui_var_${cIdent(v.id)};`)
    .join("\n");

  const c = `#include "ui_vars.h"
#include <string.h>

${defs}

void forgeui_vars_init(void)
{
    /* defaults already set by static initializers */
}

void forgeui_var_set_int(const char *id, int value)
{
    if (!id) return;
${setCases}
}

int forgeui_var_get_int(const char *id)
{
    if (!id) return 0;
${getCases}
    return 0;
}
`;

  fs.writeFileSync(hPath, h, "utf8");
  fs.writeFileSync(cPath, c, "utf8");
  diagnostics.push({
    level: "info",
    code: "E_VARS_OK",
    message: `variables → ui_vars.c (${vars.length})`,
  });
  return [hPath, cPath];
}
