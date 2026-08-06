import type { LoadedProject, Node, ProjectDocument } from "./types.js";
import { uniqueId } from "./themes.js";

export interface I18nLocale {
  id: string;
  name: string;
}

export interface I18nString {
  id: string;
  note?: string;
  /** localeId → translated text */
  values: Record<string, string>;
}

export interface I18nConfig {
  enabled: boolean;
  defaultLocale: string;
  /** Designer preview locale (persisted for convenience) */
  previewLocale?: string;
  locales: I18nLocale[];
  strings: I18nString[];
}

const TEXT_PROP_KEYS = ["text", "label", "placeholder", "title", "value"] as const;

export function defaultI18nConfig(): I18nConfig {
  return {
    enabled: false,
    defaultLocale: "en",
    previewLocale: "en",
    locales: [
      { id: "en", name: "English" },
      { id: "zh-CN", name: "简体中文" },
    ],
    strings: [],
  };
}

export function normalizeI18n(project: ProjectDocument): I18nConfig {
  const raw = project.i18n;
  if (!raw || typeof raw !== "object") return defaultI18nConfig();
  const base = defaultI18nConfig();
  const locales = Array.isArray(raw.locales)
    ? raw.locales
        .filter((l): l is I18nLocale => !!l && typeof l === "object" && typeof l.id === "string")
        .map((l) => ({ id: l.id, name: typeof l.name === "string" ? l.name : l.id }))
    : base.locales;
  const strings = Array.isArray(raw.strings)
    ? raw.strings
        .filter((s): s is I18nString => !!s && typeof s === "object" && typeof s.id === "string")
        .map((s) => ({
          id: s.id,
          note: typeof s.note === "string" ? s.note : undefined,
          values: s.values && typeof s.values === "object" ? { ...s.values } : {},
        }))
    : [];
  const defaultLocale =
    typeof raw.defaultLocale === "string" && locales.some((l) => l.id === raw.defaultLocale)
      ? raw.defaultLocale
      : (locales[0]?.id ?? base.defaultLocale);
  const previewLocale =
    typeof raw.previewLocale === "string" && locales.some((l) => l.id === raw.previewLocale)
      ? raw.previewLocale
      : defaultLocale;
  return {
    enabled: !!raw.enabled,
    defaultLocale,
    previewLocale,
    locales: locales.length ? locales : base.locales,
    strings,
  };
}

export function ensureI18n(project: ProjectDocument): I18nConfig {
  if (!project.i18n) project.i18n = defaultI18nConfig();
  return normalizeI18n(project);
}

export function resolveI18nText(
  i18n: I18nConfig,
  key: string,
  locale?: string,
): string | undefined {
  const entry = i18n.strings.find((s) => s.id === key);
  if (!entry) return undefined;
  const loc = locale ?? i18n.previewLocale ?? i18n.defaultLocale;
  return entry.values[loc] ?? entry.values[i18n.defaultLocale] ?? Object.values(entry.values)[0];
}

/** Resolve display text for a node prop: prefers i18nKey when i18n enabled. */
export function resolveNodeTextProp(
  node: Node,
  propKey: string,
  i18n: I18nConfig | undefined,
  locale?: string,
): string {
  const props = node.props ?? {};
  const i18nKey = props.i18nKey;
  if (i18n?.enabled && typeof i18nKey === "string" && i18nKey.trim()) {
    const translated = resolveI18nText(i18n, i18nKey, locale);
    if (translated !== undefined) return translated;
  }
  const v = props[propKey];
  return typeof v === "string" ? v : "";
}

export function upsertI18nString(
  i18n: I18nConfig,
  id: string,
  patch: { note?: string; values?: Record<string, string> },
): I18nString {
  let entry = i18n.strings.find((s) => s.id === id);
  if (!entry) {
    entry = { id, values: {} };
    i18n.strings.push(entry);
  }
  if (patch.note !== undefined) entry.note = patch.note;
  if (patch.values) entry.values = { ...entry.values, ...patch.values };
  return entry;
}

export function removeI18nString(i18n: I18nConfig, id: string): boolean {
  const idx = i18n.strings.findIndex((s) => s.id === id);
  if (idx < 0) return false;
  i18n.strings.splice(idx, 1);
  return true;
}

export function addI18nLocale(i18n: I18nConfig, id: string, name?: string): I18nLocale {
  const existing = i18n.locales.find((l) => l.id === id);
  if (existing) {
    if (name) existing.name = name;
    return existing;
  }
  const locale: I18nLocale = { id, name: name ?? id };
  i18n.locales.push(locale);
  return locale;
}

/** Collect suggested string keys from screen text props (for auto-seed). */
export function collectTextPropsFromNode(node: Node, out: Array<{ nodeId: string; prop: string; text: string }>): void {
  for (const key of TEXT_PROP_KEYS) {
    const v = node.props?.[key];
    if (typeof v === "string" && v.trim()) {
      out.push({ nodeId: node.id, prop: key, text: v });
    }
  }
  for (const child of node.children ?? []) collectTextPropsFromNode(child, out);
}

export function seedI18nFromProject(loaded: LoadedProject, locale?: string): number {
  const i18n = ensureI18n(loaded.project);
  loaded.project.i18n = i18n;
  const loc = locale ?? i18n.defaultLocale;
  let added = 0;
  const used = new Set(i18n.strings.map((s) => s.id));
  for (const screen of loaded.screens.values()) {
    const texts: Array<{ nodeId: string; prop: string; text: string }> = [];
    for (const child of screen.children) collectTextPropsFromNode(child, texts);
    for (const t of texts) {
      const base = `str_${t.nodeId}_${t.prop}`.replace(/[^A-Za-z0-9_]/g, "_");
      const id = used.has(base) ? uniqueId(base, used) : base;
      used.add(id);
      if (!i18n.strings.some((s) => s.id === id)) {
        i18n.strings.push({ id, note: `${t.nodeId}.${t.prop}`, values: { [loc]: t.text } });
        added += 1;
      }
    }
  }
  i18n.enabled = true;
  return added;
}
