import type { I18nConfig, I18nString } from "./i18n.js";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTag(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1] : undefined;
}

function extractAttr(tagOpen: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i");
  const m = tagOpen.match(re);
  return m ? m[1] : undefined;
}

export type XliffTargetState = "new" | "needs-translation" | "translated" | "final";

export interface XliffExportOptions {
  sourceLocale: string;
  targetLocale: string;
  /** Product / project name for file header */
  productName?: string;
  /** Only export units missing/empty target (translation workflow) */
  onlyMissing?: boolean;
}

export interface XliffImportResult {
  sourceLocale: string;
  targetLocale: string;
  units: Array<{
    id: string;
    source: string;
    target: string;
    note?: string;
    state?: XliffTargetState;
  }>;
}

export interface LocaleProgress {
  localeId: string;
  total: number;
  translated: number;
  missing: number;
  /** 0..1 */
  ratio: number;
  missingIds: string[];
}

export interface I18nProgressReport {
  sourceLocale: string;
  locales: LocaleProgress[];
  /** Overall average ratio across non-source locales */
  overallRatio: number;
}

function isFilled(v: string | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Unit translation state relative to source/target (FR-043 workflow). */
export function unitTranslationState(
  entry: I18nString,
  sourceLocale: string,
  targetLocale: string,
): XliffTargetState {
  const src = entry.values[sourceLocale];
  const tgt = entry.values[targetLocale];
  if (!isFilled(src)) return "new";
  if (!isFilled(tgt)) return "needs-translation";
  if (tgt!.trim() === src!.trim() && sourceLocale !== targetLocale) return "needs-translation";
  return "translated";
}

/** Per-locale fill rates for designer progress UI (FR-043). */
export function computeI18nProgress(i18n: I18nConfig, sourceLocale?: string): I18nProgressReport {
  const src = sourceLocale ?? i18n.defaultLocale;
  const locales: LocaleProgress[] = [];
  for (const loc of i18n.locales) {
    if (loc.id === src) continue;
    const missingIds: string[] = [];
    let translated = 0;
    for (const s of i18n.strings) {
      const st = unitTranslationState(s, src, loc.id);
      if (st === "translated" || st === "final") translated += 1;
      else missingIds.push(s.id);
    }
    const total = i18n.strings.length;
    const missing = missingIds.length;
    locales.push({
      localeId: loc.id,
      total,
      translated,
      missing,
      ratio: total === 0 ? 1 : translated / total,
      missingIds,
    });
  }
  const overallRatio =
    locales.length === 0 ? 1 : locales.reduce((a, l) => a + l.ratio, 0) / locales.length;
  return { sourceLocale: src, locales, overallRatio };
}

/** Export XLIFF 1.2 document (FR-043). */
export function exportXliff12(i18n: I18nConfig, opts: XliffExportOptions): string {
  const { sourceLocale, targetLocale } = opts;
  const product = xmlEscape(opts.productName ?? "ForgeUI");
  let strings = i18n.strings;
  if (opts.onlyMissing) {
    strings = strings.filter((s) => unitTranslationState(s, sourceLocale, targetLocale) !== "translated");
  }
  const bodies = strings
    .map((s) => {
      const source = xmlEscape(s.values[sourceLocale] ?? "");
      const target = xmlEscape(s.values[targetLocale] ?? "");
      const state = unitTranslationState(s, sourceLocale, targetLocale);
      const note = s.note ? `      <note>${xmlEscape(s.note)}</note>\n` : "";
      return `    <trans-unit id="${xmlEscape(s.id)}">
      <source>${source}</source>
      <target state="${state}">${target}</target>
${note}    </trans-unit>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="${product}" source-language="${xmlEscape(sourceLocale)}" target-language="${xmlEscape(targetLocale)}" datatype="plaintext">
    <body>
${bodies}
    </body>
  </file>
</xliff>
`;
}

/** Parse XLIFF 1.2 (subset: file + trans-unit source/target/note). */
export function importXliff12(xml: string): XliffImportResult {
  const fileOpen = xml.match(/<file\b[^>]*>/i)?.[0] ?? "";
  const sourceLocale = extractAttr(fileOpen, "source-language") ?? "en";
  const targetLocale = extractAttr(fileOpen, "target-language") ?? sourceLocale;
  const units: XliffImportResult["units"] = [];
  const unitRe = /<trans-unit\b([^>]*)>([\s\S]*?)<\/trans-unit>/gi;
  let m: RegExpExecArray | null;
  while ((m = unitRe.exec(xml))) {
    const openAttrs = m[1] ?? "";
    const body = m[2] ?? "";
    const id = extractAttr(openAttrs, "id");
    if (!id) continue;
    const sourceRaw = extractTag(body, "source") ?? "";
    const targetMatch = body.match(/<target\b([^>]*)>([\s\S]*?)<\/target>/i);
    const targetAttrs = targetMatch?.[1] ?? "";
    const targetRaw = targetMatch?.[2] ?? extractTag(body, "target") ?? "";
    const noteRaw = extractTag(body, "note");
    const stateAttr = extractAttr(targetAttrs, "state") as XliffTargetState | undefined;
    units.push({
      id: xmlUnescape(id),
      source: xmlUnescape(sourceRaw.trim()),
      target: xmlUnescape(targetRaw.trim()),
      note: noteRaw !== undefined ? xmlUnescape(noteRaw.trim()) : undefined,
      state: stateAttr,
    });
  }
  return { sourceLocale, targetLocale, units };
}

/** Merge imported XLIFF units into i18n config (creates locales/strings as needed). */
export function mergeXliffIntoI18n(i18n: I18nConfig, imported: XliffImportResult): number {
  if (!i18n.locales.some((l) => l.id === imported.sourceLocale)) {
    i18n.locales.push({ id: imported.sourceLocale, name: imported.sourceLocale });
  }
  if (!i18n.locales.some((l) => l.id === imported.targetLocale)) {
    i18n.locales.push({ id: imported.targetLocale, name: imported.targetLocale });
  }
  let updated = 0;
  for (const u of imported.units) {
    let entry: I18nString | undefined = i18n.strings.find((s) => s.id === u.id);
    if (!entry) {
      entry = { id: u.id, values: {} };
      i18n.strings.push(entry);
    }
    if (u.note) entry.note = u.note;
    if (u.source) entry.values[imported.sourceLocale] = u.source;
    if (u.target) entry.values[imported.targetLocale] = u.target;
    updated += 1;
  }
  i18n.enabled = true;
  return updated;
}
