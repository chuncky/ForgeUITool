/** Designer-side i18n display helpers (FR-042). Avoids pulling Node @forgeui/core into renderer. */

export function resolveI18nDisplayText(
  i18n:
    | {
        enabled?: boolean;
        defaultLocale?: string;
        previewLocale?: string;
        strings?: Array<{ id: string; values: Record<string, string> }>;
      }
    | undefined,
  key: string | undefined,
  fallback: string,
): string {
  if (!i18n?.enabled || !key?.trim() || !i18n.strings?.length) return fallback;
  const entry = i18n.strings.find((s) => s.id === key);
  if (!entry) return fallback;
  const loc = i18n.previewLocale ?? i18n.defaultLocale ?? "en";
  return entry.values[loc] ?? entry.values[i18n.defaultLocale ?? "en"] ?? Object.values(entry.values)[0] ?? fallback;
}

export function nodeDisplayText(
  props: Record<string, unknown> | undefined,
  i18n: Parameters<typeof resolveI18nDisplayText>[0],
  propKey = "text",
): string {
  const fallback = typeof props?.[propKey] === "string" ? String(props[propKey]) : "";
  const key = typeof props?.i18nKey === "string" ? props.i18nKey : undefined;
  return resolveI18nDisplayText(i18n, key, fallback);
}
