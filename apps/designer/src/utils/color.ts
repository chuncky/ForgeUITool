/** #RRGGBBAA helpers for property panel color inputs. */

export function colorSwatch(value: unknown): string {
  const s = String(value ?? "#000000");
  const hex = s.replace("#", "");
  if (hex.length >= 6) return `#${hex.slice(0, 6)}`;
  return "#000000";
}

export function toRgbaHex(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t.startsWith("#") && t.length === 9) return t;
  if (t.startsWith("#") && t.length === 7) return `${t}ff`;
  return t;
}
