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
  if (t.startsWith("@")) return t;
  if (t.startsWith("#") && t.length === 9) return t;
  if (t.startsWith("#") && t.length === 7) return `${t}ff`;
  return t;
}

export function displayColorValue(value: unknown, colors: Array<{ id: string; value: string }>): string {
  const s = String(value ?? "");
  if (s.startsWith("@")) {
    const id = s.slice(1);
    const hit = colors.find((c) => c.id === id);
    return hit?.value ?? s;
  }
  return s;
}

/** Read AA channel from #RRGGBB / #RRGGBBAA (default 255). */
export function getColorAlpha255(value: unknown): number {
  const s = String(value ?? "").trim();
  if (!s || s.startsWith("@")) return 255;
  const hex = s.startsWith("#") ? s.slice(1) : s;
  if (/^[0-9a-fA-F]{8}$/.test(hex)) {
    return Number.parseInt(hex.slice(6, 8), 16);
  }
  return 255;
}

/** Set AA on a color string; keep @colorId refs unchanged. */
export function setColorAlpha255(value: unknown, alpha: number): string {
  const a = Math.max(0, Math.min(255, Math.round(Number(alpha))));
  const aa = a.toString(16).padStart(2, "0");
  const s = String(value ?? "").trim();
  if (!s || s.startsWith("@")) return s || `#000000${aa}`;
  const hex = s.startsWith("#") ? s.slice(1) : s;
  if (/^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{8}$/.test(hex)) {
    return `#${hex.slice(0, 6)}${aa}`;
  }
  return toRgbaHex(s.startsWith("#") ? s : `#${s}`);
}

/** Replace RGB from #RRGGBB swatch while keeping existing AA (BK color&opacity). */
export function withRgbKeepAlpha(prev: unknown, rgbHex: string): string {
  const aa = getColorAlpha255(prev).toString(16).padStart(2, "0");
  const raw = rgbHex.trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}${aa}`;
  return toRgbaHex(raw);
}
