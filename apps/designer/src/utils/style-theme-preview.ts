/**
 * Mini preview chrome for style library thumbnails (BK style icon).
 * Approximate button/label from Part×State props — not full canvas chrome.
 */
export function styleThemePreviewChrome(props: Record<string, unknown> | undefined): {
  background: string;
  color: string;
  borderRadius: string;
  border: string;
} {
  const p = props ?? {};
  const bg = String(p.bg_color ?? "#2d75b9ff");
  const fg = String(p.text_color ?? "#ffffffff");
  const radius = Number(p.radius ?? 6);
  const bw = Number(p.border_width ?? 0);
  const bc = String(p.border_color ?? "#94a3b8ff");
  return {
    background: toCssColor(bg, "#2d75b9"),
    color: toCssColor(fg, "#ffffff"),
    borderRadius: `${Number.isFinite(radius) ? radius : 6}px`,
    border: bw > 0 ? `${bw}px solid ${toCssColor(bc, "#94a3b8")}` : "none",
  };
}

function toCssColor(raw: string, fallback: string): string {
  const s = raw.trim();
  if (s.startsWith("@")) return fallback;
  if (/^#[0-9a-fA-F]{8}$/.test(s)) {
    const a = Number.parseInt(s.slice(7, 9), 16) / 255;
    const r = Number.parseInt(s.slice(1, 3), 16);
    const g = Number.parseInt(s.slice(3, 5), 16);
    const b = Number.parseInt(s.slice(5, 7), 16);
    if (a >= 0.999) return `#${s.slice(1, 7)}`;
    return `rgba(${r},${g},${b},${Math.round(a * 1000) / 1000})`;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return fallback;
}

export function formatStyleCreatedAt(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
