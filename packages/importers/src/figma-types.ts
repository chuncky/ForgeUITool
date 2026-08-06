/** Adapter input — Figma plugin / REST export → ForgeUI JSON (AR-030). */
export interface FigmaExportDocument {
  format: "forgeui-figma";
  formatVersion: 1;
  name: string;
  platform?: string;
  display?: { width: number; height: number; colorDepth?: number };
  pages: FigmaExportPage[];
}

export interface FigmaExportPage {
  id?: string;
  name: string;
  frame: { x: number; y: number; w: number; h: number };
  backgroundColor?: string;
  nodes: FigmaExportNode[];
}

export interface FigmaExportNode {
  figmaType: string;
  name: string;
  frame: { x: number; y: number; w: number; h: number };
  text?: string;
  fillColor?: string;
  cornerRadius?: number;
  /** Optional ForgeUI widget type override */
  widgetType?: string;
  children?: FigmaExportNode[];
}
