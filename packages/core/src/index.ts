export type { Frame, Action, EventBinding, Node, ScreenDocument, ScreenRef, ProjectDocument, LoadedProject } from "./types.js";
export { validateProjectDir } from "./validate.js";
export { openProject, saveProject, createProject } from "./workspace.js";
export type { CreateProjectOptions } from "./workspace.js";
export { buildIR, symbolFor } from "./ir.js";
export type { ProjectIR, ScreenIR, WidgetIR } from "./ir.js";
export { listWidgetSpecs, listPaletteWidgetSpecs, groupPaletteWidgetsByCategory, filterPaletteWidgets, getWidgetSpec, isKnownWidgetType, WIDGET_CATEGORY_ORDER, WIDGET_CATEGORY_LABELS } from "./widgets.js";
export type { WidgetSpec, WidgetCategoryId, WidgetCategoryGroup, PropSpec, PropSpecType } from "./widgets.js";
export {
  findNode,
  updateNodeProps,
  setNodeEvents,
  addChildNode,
  removeNode,
  addScreen,
  renameScreen,
  removeScreen,
  duplicateScreen,
  reorderScreen,
  setDefaultScreen,
  duplicateNode,
  moveNodeOrder,
  setNodeFlags,
  alignNodeToNeighbors,
  updateProjectMeta,
} from "./mutate.js";
export { normalizeStyle, styleProp, patchStyleProps, MVP_STYLE_FIELDS } from "./style.js";
export type { StyleProps, NormalizedStyle } from "./style.js";
export {
  applyMutation,
  buildEditorState,
  summarizeScreenTree,
  validateLoaded,
  ProjectModelOps,
} from "./project-model.js";
export type { MutationResult, ModelEvent, EditorStateSummary } from "./project-model.js";
export { EditorHistory } from "./editor-history.js";
export type { EditorSnapshot } from "./editor-history.js";
export {
  DEFAULT_CODEGEN_DIR,
  DEFAULT_CUSTOM_SUBDIR,
  resolveExportFields,
  resolveCodegenPaths,
  normalizeExportFields,
  needsLegacyCodegenMigration,
  migrateLegacyCodegenLayout,
  cleanCodegenExceptCustom,
  codegenArtifactsReady,
} from "./codegen-paths.js";
export type { CodegenPaths } from "./codegen-paths.js";
