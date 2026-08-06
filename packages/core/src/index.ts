export type { Frame,
  Action,
  EventBinding,
  Node,
  ScreenDocument,
  ScreenRef,
  ProjectDocument,
  LoadedProject,
  NamedColor,
  NamedStyleTheme,
  CustomWidgetDefinition,
} from "./types.js";
export { anchorPoint, normalizeAnchor, reanchorFrame, alignFrameToParent } from "./frame-anchor.js";
export type { AnchorAxis } from "./frame-anchor.js";
export { LAYOUT_TYPES, normalizeRotation, parseLayoutType, parseGridTrackCount } from "./types.js";
export type { LayoutType } from "./types.js";
export {
  COLOR_REF_PREFIX,
  isColorRef,
  colorRefId,
  formatColorRef,
  resolveColorValue,
  slugThemeId,
  uniqueId,
  applyThemePropsToStyle,
  resolveStyleWithRef,
  syncStyleRefs,
} from "./themes.js";
export { validateProjectDir } from "./validate.js";
export { openProject, saveProject, createProject } from "./workspace.js";
export type { CreateProjectOptions } from "./workspace.js";
export {
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
  saveProjectWithSnapshot,
  projectHistoryDir,
  snapshotTimestampId,
} from "./project-snapshot.js";
export type { SnapshotMeta } from "./project-snapshot.js";
export { buildIR, symbolFor } from "./ir.js";
export type { ProjectIR, ScreenIR, WidgetIR } from "./ir.js";
export { listWidgetSpecs, listPaletteWidgetSpecs, groupPaletteWidgetsByCategory, filterPaletteWidgets, getWidgetSpec, isKnownWidgetType, WIDGET_CATEGORY_ORDER, WIDGET_CATEGORY_LABELS } from "./widgets.js";
export type { WidgetSpec, WidgetCategoryId, WidgetCategoryGroup, PropSpec, PropSpecType, ExtraDataEditorKind } from "./widgets.js";
export {
  findNode,
  updateNodeProps,
  setNodeEvents,
  addChildNode,
  type AddChildNodeOptions,
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
export { alignNodes, type AlignMode } from "./align.js";
export { normalizeStyle, styleProp, patchStyleProps, withDisabledSubgroups, readDisabledSubgroups, isStyleKeyDisabled, STYLE_SUBGROUP_KEYS, MVP_STYLE_FIELDS } from "./style.js";
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
  importImageAsset,
  importImageAssets,
  normalizeImageAssets,
} from "./assets.js";
export type { ImageAsset } from "./assets.js";
export {
  importFontAsset,
  importFontAssets,
  normalizeFontAssets,
  collectGlyphsFromNode,
  collectProjectGlyphs,
  mergeFontCharset,
} from "./fonts.js";
export type { FontAsset } from "./fonts.js";
export {
  listCustomWidgets,
  saveNodeAsCustomWidget,
  addCustomWidgetInstance,
  removeCustomWidget,
} from "./custom-widgets.js";
export type { AddCustomWidgetOptions } from "./custom-widgets.js";
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
export {
  defaultI18nConfig,
  normalizeI18n,
  ensureI18n,
  resolveI18nText,
  resolveNodeTextProp,
  upsertI18nString,
  removeI18nString,
  addI18nLocale,
  seedI18nFromProject,
  collectTextPropsFromNode,
} from "./i18n.js";
export type { I18nConfig, I18nLocale, I18nString } from "./i18n.js";
export {
  exportXliff12,
  importXliff12,
  mergeXliffIntoI18n,
  computeI18nProgress,
  unitTranslationState,
} from "./xliff.js";
export type {
  XliffExportOptions,
  XliffImportResult,
  XliffTargetState,
  LocaleProgress,
  I18nProgressReport,
} from "./xliff.js";
export {
  ANIM_PROPERTIES,
  ANIM_EASINGS,
  normalizeAnimations,
  createTimelineAnimation,
  createAnimTrack,
  sampleTrackValue,
} from "./animations.js";
export type {
  AnimProperty,
  AnimEasing,
  AnimKeyframe,
  AnimTrack,
  TimelineAnimation,
} from "./animations.js";
export { normalizeVariables, createVariable } from "./variables.js";
export type { ProjectVariable } from "./variables.js";
export { estimateProjectMemory, normalizeTargets } from "./memory-estimate.js";
export type { DisplayTarget, MemoryEstimate } from "./memory-estimate.js";
export {
  PACKAGE_LOGIC_ACTION_WHITELIST,
  FIRMWARE_ONLY_ACTIONS,
  isPackageAllowedAction,
  isFirmwareOnlyAction,
  buildPackageLogicManifest,
} from "./package-logic.js";
export type { PackageLogicActionType, PackageLogicManifest } from "./package-logic.js";
