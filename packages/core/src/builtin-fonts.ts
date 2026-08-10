/** Browser-safe builtin font constants (no node:fs / path / url). */

/** Product default — BK panel shows an explicit family; we use bundled CJK Bold. */
export const DEFAULT_TEXT_FONT_ID = "SourceHanSansCN-Bold";
/** BK 字体属性截图字号为 16；画布/面板与之一致。 */
export const DEFAULT_TEXT_FONT_SIZE = 16;

export function defaultTextFontRef(): string {
  return `@${DEFAULT_TEXT_FONT_ID}`;
}

export type BuiltinFontDef = {
  id: string;
  fileName: string;
  label: string;
};

/** Shipped under `xos-package/res/ttf` (also staged into forgeui-root on release). */
export const BUILTIN_FONTS: BuiltinFontDef[] = [
  {
    id: "SourceHanSansCN-Bold",
    fileName: "SourceHanSansCN-Bold.ttf",
    label: "SourceHanSansCN-Bold",
  },
  {
    id: "2312_v9",
    fileName: "2312_v9.ttf",
    label: "2312_v9",
  },
];

/** Keys seeded into WidgetSpec.defaultStyle for font subgroup / BK panel parity. */
export const DEFAULT_FONT_STYLE_PROPS: Record<string, unknown> = {
  text_font: defaultTextFontRef(),
  text_font_size: DEFAULT_TEXT_FONT_SIZE,
};
