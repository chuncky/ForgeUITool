import type { LoadedProject } from "@forgeui/core";
import { normalizeI18n } from "@forgeui/core";
import type { Diagnostic } from "@forgeui/shared";
import fs from "node:fs";
import path from "node:path";

function cStr(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

function cIdent(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

/** Emit ui_i18n.h / ui_i18n.c when project.i18n.enabled (FR-042). */
export function emitProjectI18n(
  loaded: LoadedProject,
  outDir: string,
  diagnostics: Diagnostic[],
): string[] {
  const i18n = normalizeI18n(loaded.project);
  if (!i18n.enabled || !i18n.strings.length) return [];

  fs.mkdirSync(outDir, { recursive: true });
  const hPath = path.join(outDir, "ui_i18n.h");
  const cPath = path.join(outDir, "ui_i18n.c");
  const locales = i18n.locales;
  const strings = i18n.strings;

  const localeEnums = locales.map((l, i) => `    UI_LANG_${cIdent(l.id).toUpperCase()} = ${i}`).join(",\n");

  const h = `#ifndef FORGEUI_UI_I18N_H
#define FORGEUI_UI_I18N_H
#include "lvgl/lvgl.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
${localeEnums}
} ui_lang_t;

void ui_i18n_set_language(ui_lang_t lang);
ui_lang_t ui_i18n_get_language(void);
const char *ui_i18n_get(const char *key);
int ui_i18n_lang_count(void);

#ifdef __cplusplus
}
#endif

#endif
`;

  const tableRows = strings
    .map((s) => {
      const cols = locales.map((l) => cStr(s.values[l.id] ?? s.values[i18n.defaultLocale] ?? "")).join(", ");
      return `    { ${cStr(s.id)}, { ${cols} } }`;
    })
    .join(",\n");

  const c = `#include "ui_i18n.h"

#define UI_I18N_LANG_COUNT ${locales.length}
#define UI_I18N_STR_COUNT ${strings.length}

typedef struct {
    const char *key;
    const char *values[UI_I18N_LANG_COUNT];
} ui_i18n_entry_t;

static ui_lang_t s_lang = UI_LANG_${cIdent(i18n.defaultLocale).toUpperCase()};

static const ui_i18n_entry_t s_entries[UI_I18N_STR_COUNT] = {
${tableRows}
};

void ui_i18n_set_language(ui_lang_t lang)
{
    if ((int)lang >= 0 && (int)lang < UI_I18N_LANG_COUNT) {
        s_lang = lang;
    }
}

ui_lang_t ui_i18n_get_language(void)
{
    return s_lang;
}

int ui_i18n_lang_count(void)
{
    return UI_I18N_LANG_COUNT;
}

const char *ui_i18n_get(const char *key)
{
    int i;
    if (!key) return "";
    for (i = 0; i < UI_I18N_STR_COUNT; i++) {
        if (strcmp(s_entries[i].key, key) == 0) {
            const char *v = s_entries[i].values[s_lang];
            return v ? v : "";
        }
    }
    return key;
}
`;

  // Need string.h for strcmp
  const cFixed = c.replace('#include "ui_i18n.h"', '#include "ui_i18n.h"\n#include <string.h>');

  fs.writeFileSync(hPath, h, "utf8");
  fs.writeFileSync(cPath, cFixed, "utf8");
  diagnostics.push({
    level: "info",
    code: "E_I18N_OK",
    message: `i18n → ui_i18n.c (${strings.length} keys × ${locales.length} locales)`,
  });
  return [hPath, cPath];
}
