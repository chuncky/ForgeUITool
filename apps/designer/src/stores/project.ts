import { defineStore } from "pinia";
import { computed, nextTick, ref } from "vue";
import type { Diagnostic, EventBinding, SerializedProject, UiNode, WidgetMeta } from "../env";
import { usePreviewStore } from "./preview";
import { useSettingsStore } from "./settings";
import { useUiStore } from "./ui";
import { clearAssetUrlCache } from "../utils/asset-url";

function desktop() {
  if (!window.forgeuiDesktop) {
    throw new Error("请通过 Electron 启动设计器（npm run dev -w @forgeui/designer）");
  }
  return window.forgeuiDesktop;
}

export interface OperationLogLine {
  time: string;
  source: string;
  level: "info" | "warn" | "error";
  message: string;
}

function nowTime() {
  return new Date().toLocaleTimeString();
}

function diagLevel(level: string): OperationLogLine["level"] {
  if (level === "error") return "error";
  if (level === "warning") return "warn";
  return "info";
}

interface EditorSnapshot {
  data: SerializedProject;
  screenId: string;
  selectedId: string;
}

interface EditorHistoryState {
  canUndo?: boolean;
  canRedo?: boolean;
}

interface UndoRedoResult extends EditorHistoryState {
  ok: boolean;
  loaded?: SerializedProject;
  screenId?: string;
  selectedId?: string;
}

function findNode(node: UiNode, id: string): UiNode | null {
  if (node.id === id) return node;
  for (const c of node.children) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

/** Direct parent of `id` under `root`, or null if `id` is root / missing. */
function findParentNode(root: UiNode, id: string): UiNode | null {
  function walk(node: UiNode, parent: UiNode | null): UiNode | null | undefined {
    if (node.id === id) return parent;
    for (const c of node.children) {
      const hit = walk(c, node);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }
  const hit = walk(root, null);
  return hit === undefined ? null : hit;
}

function resolveSelection(data: SerializedProject, sid: string, preferred: string): string {
  const screen = data.screens[sid];
  if (!screen) return sid;
  if (findNode(screen, preferred)) return preferred;
  return sid;
}

export const useProjectStore = defineStore("project", () => {
  const loaded = ref<SerializedProject | null>(null);
  const screenId = ref<string>("");
  const selectedId = ref<string>("");
  const selectedIds = ref<string[]>([]);
  const widgets = ref<WidgetMeta[]>([]);
  const log = ref<string>("");
  const statusLine = ref<string>("就绪");
  const operationLogs = ref<OperationLogLine[]>([]);
  const buildStreamText = ref("");
  let buildStreamBuf = "";
  let buildStreamTimer: ReturnType<typeof setTimeout> | null = null;
  let buildStreamUnsub: (() => void) | null = null;
  const dirty = ref(false);
  const canUndo = ref(false);
  const canRedo = ref(false);
  const aiTransactionPending = ref(false);
  const aiChangeCount = ref(0);

  /** Serialize IPC mutations so flush-before-switch/save can await in-flight commits. */
  let mutationChain: Promise<void> = Promise.resolve();

  function enqueueMutation<T>(task: () => Promise<T>): Promise<T> {
    const run = mutationChain.then(task, task);
    mutationChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /**
   * Blur active input so @change handlers fire, then wait for mutation IPC.
   * Prevents multi-page edit loss when switching screens / saving (FR-011d).
   */
  async function flushPendingEditor(): Promise<void> {
    if (typeof document !== "undefined") {
      const el = document.activeElement as HTMLElement | null;
      if (el && typeof el.blur === "function") {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) {
          el.blur();
        }
      }
    }
    await nextTick();
    await mutationChain;
  }

  /** FR-086: A2 pack load overlay on canvas (does not mutate project). */
  const packPreview = ref<{
    active: boolean;
    outDir: string;
    entryScreen: string;
    viewScreenId: string;
    widgetCount: number;
    screens: Array<{ id: string; name: string; document: UiNode }>;
  } | null>(null);

  const packPreviewScreen = computed(() => {
    if (!packPreview.value?.active) return null;
    const id = packPreview.value.viewScreenId;
    return packPreview.value.screens.find((s) => s.id === id)?.document ?? null;
  });

  const currentScreen = computed(() => {
    if (!loaded.value || !screenId.value) return null;
    return loaded.value.screens[screenId.value] ?? null;
  });

  const selectedNode = computed(() => {
    if (!currentScreen.value || !selectedId.value) return null;
    return findNode(currentScreen.value, selectedId.value);
  });

  /** Parent content box for 3×3 snap (Beken); screen children use display / screen frame. */
  const selectedParentSize = computed((): { w: number; h: number } => {
    const screen = currentScreen.value;
    const id = selectedId.value;
    if (!screen || !id) {
      return {
        w: loaded.value?.project.display.width ?? 480,
        h: loaded.value?.project.display.height ?? 320,
      };
    }
    const parent = findParentNode(screen, id);
    if (!parent || parent.type === "screen") {
      return {
        w: screen.frame?.w ?? loaded.value?.project.display.width ?? 480,
        h: screen.frame?.h ?? loaded.value?.project.display.height ?? 320,
      };
    }
    return { w: parent.frame.w, h: parent.frame.h };
  });

  const imageAssets = computed(() => {
    const raw = loaded.value?.project.assets?.images ?? [];
    return raw
      .map((item) => {
        if (typeof item === "string") {
          const base = item.split("/").pop() ?? item;
          const id = base.replace(/\.[^.]+$/, "");
          return { id, path: item };
        }
        if (item && typeof item === "object" && "path" in item) {
          const o = item as { id?: string; path: string };
          const base = o.path.split("/").pop() ?? o.path;
          return { id: o.id ?? base.replace(/\.[^.]+$/, ""), path: o.path };
        }
        return null;
      })
      .filter((x): x is { id: string; path: string } => x !== null);
  });

  const fontAssets = computed(() => {
    const raw = loaded.value?.project.assets?.fonts ?? [];
    return raw
      .map((item) => {
        if (typeof item === "string") {
          const base = item.split("/").pop() ?? item;
          return { id: base.replace(/\.[^.]+$/, ""), path: item };
        }
        if (item && typeof item === "object" && "path" in item) {
          const o = item as { id?: string; path: string; size?: number };
          const base = o.path.split("/").pop() ?? o.path;
          return { id: o.id ?? base.replace(/\.[^.]+$/, ""), path: o.path, size: o.size };
        }
        return null;
      })
      .filter((x): x is { id: string; path: string; size?: number } => x !== null);
  });

  const colorLibrary = computed(() => loaded.value?.project.colors ?? []);
  const colorThemes = computed(() => loaded.value?.project.colorThemes ?? []);
  /** Mine + palette-theme colors for @id resolve / swatches. */
  const allNamedColors = computed(() => {
    const out = [...colorLibrary.value];
    for (const t of colorThemes.value) {
      for (const c of t.colors ?? []) out.push(c);
    }
    return out;
  });

  const styleThemes = computed(() => loaded.value?.project.themes ?? []);
  const customWidgets = computed(() => loaded.value?.project.customWidgets ?? []);
  const i18nConfig = computed(() => {
    const raw = loaded.value?.project.i18n;
    if (!raw || typeof raw !== "object") {
      return {
        enabled: false,
        defaultLocale: "en",
        previewLocale: "en",
        locales: [
          { id: "en", name: "English" },
          { id: "zh-CN", name: "简体中文" },
        ],
        strings: [] as Array<{ id: string; note?: string; values: Record<string, string> }>,
      };
    }
    return {
      enabled: !!raw.enabled,
      defaultLocale: raw.defaultLocale ?? "en",
      previewLocale: raw.previewLocale ?? raw.defaultLocale ?? "en",
      locales: Array.isArray(raw.locales) ? raw.locales : [],
      strings: Array.isArray(raw.strings) ? raw.strings : [],
    };
  });
  const animations = computed(() =>
    Array.isArray(loaded.value?.project.animations) ? loaded.value!.project.animations! : [],
  );

  const logText = computed(() => {
    const base = operationLogs.value.map((l) => `[${l.time}] [${l.source}] ${l.message}`).join("\n");
    if (!buildStreamText.value) return base;
    return base ? `${base}\n${buildStreamText.value}` : buildStreamText.value;
  });

  function appendLog(source: string, level: OperationLogLine["level"], message: string) {
    operationLogs.value.push({ time: nowTime(), source, level, message });
    statusLine.value = message.length > 120 ? `${message.slice(0, 117)}...` : message;
    log.value = message;
  }

  function appendDiagnostics(source: string, diagnostics: Diagnostic[]) {
    for (const d of diagnostics) {
      appendLog(source, diagLevel(d.level), d.message);
    }
  }

  function flushBuildStreamBuffer() {
    if (!buildStreamBuf) return;
    buildStreamText.value += (buildStreamText.value ? "\n" : "") + buildStreamBuf;
    buildStreamBuf = "";
  }

  function pushBuildStreamLine(line: string) {
    buildStreamBuf += (buildStreamBuf ? "\n" : "") + line;
    if (
      line.includes("%") ||
      line.startsWith("[timing]") ||
      line.startsWith("[cache]") ||
      line.startsWith("--- cmake")
    ) {
      statusLine.value = line.length > 120 ? `${line.slice(0, 117)}...` : line;
    }
    if (!buildStreamTimer) {
      buildStreamTimer = setTimeout(() => {
        flushBuildStreamBuffer();
        buildStreamTimer = null;
      }, 80);
    }
  }

  function beginBuildStream() {
    buildStreamText.value = "";
    buildStreamBuf = "";
    buildStreamUnsub?.();
    buildStreamUnsub = desktop().onPreviewBuildLog(pushBuildStreamLine);
  }

  function endBuildStream() {
    if (buildStreamTimer) {
      clearTimeout(buildStreamTimer);
      buildStreamTimer = null;
    }
    flushBuildStreamBuffer();
    buildStreamUnsub?.();
    buildStreamUnsub = null;
    if (buildStreamText.value.trim()) {
      operationLogs.value.push({
        time: nowTime(),
        source: "preview",
        level: "info",
        message: buildStreamText.value,
      });
      buildStreamText.value = "";
    }
  }

  function appendBuildLogs(source: string, lines: string[] | undefined) {
    if (!lines?.length) return;
    // Fallback when IPC streaming is unavailable (e.g. unit tests)
    const text = lines.join("\n");
    const max = 16_000;
    appendLog(
      source,
      "info",
      text.length > max ? `${text.slice(0, max)}\n…（构建日志已截断，完整输出见 .forge/preview-build/out）` : text,
    );
    const timing = lines.filter((l) => l.startsWith("[timing]") || l.startsWith("[cache]"));
    if (timing.length) {
      statusLine.value = timing.join(" · ");
    }
  }

  function clearLogs() {
    operationLogs.value = [];
    buildStreamText.value = "";
    buildStreamBuf = "";
  }

  function editorContext() {
    return { screenId: screenId.value, selectedId: selectedId.value };
  }

  function syncHistoryFlags(state?: EditorHistoryState) {
    if (state?.canUndo !== undefined) canUndo.value = state.canUndo;
    if (state?.canRedo !== undefined) canRedo.value = state.canRedo;
  }

  async function refreshHistoryFlags() {
    const state = await desktop().historyState();
    syncHistoryFlags(state);
  }

  async function refreshAiTransactionState() {
    const state = await desktop().getAiTransactionState();
    aiTransactionPending.value = state.pending;
    aiChangeCount.value = state.changeCount;
  }

  function applyAiModelUpdate(payload: {
    loaded: SerializedProject;
    pending?: boolean;
    changeCount?: number;
  }) {
    applyLoadedData(payload.loaded, { resetHistory: true });
    aiTransactionPending.value = payload.pending ?? false;
    aiChangeCount.value = payload.changeCount ?? 0;
  }

  async function commitAiTransaction() {
    const result = await desktop().commitAiTransaction();
    if (result.loaded) applyLoadedData(result.loaded, { resetHistory: true });
    aiTransactionPending.value = false;
    aiChangeCount.value = 0;
    statusLine.value = "已保存 AI 变更";
  }

  async function rollbackAiTransaction() {
    const result = await desktop().rollbackAiTransaction();
    if (result.loaded) applyLoadedData(result.loaded, { resetHistory: true });
    aiTransactionPending.value = false;
    aiChangeCount.value = 0;
    statusLine.value = "已撤销 AI 变更";
  }

  function applyLoadedData(
    data: SerializedProject,
    opts: {
      resetHistory?: boolean;
      remember?: boolean;
      screenId?: string;
      selectedId?: string;
    } = {},
  ) {
    clearAssetUrlCache();
    loaded.value = JSON.parse(JSON.stringify(data)) as SerializedProject;
    const sid =
      opts.screenId ??
      (data.project.defaultScreen || data.project.screens[0]?.id || "");
    screenId.value = sid;
    selectedId.value = opts.selectedId
      ? resolveSelection(data, sid, opts.selectedId)
      : sid;
    if (selectedId.value === sid) {
      selectedIds.value = [];
    } else {
      selectedIds.value = [selectedId.value];
    }
    dirty.value = false;
    if (opts.resetHistory !== false) {
      canUndo.value = false;
      canRedo.value = false;
    }
    if (opts.remember !== false) remember(data);
  }

  function applyMutationResult(result: { loaded: SerializedProject } & EditorHistoryState) {
    loaded.value = JSON.parse(JSON.stringify(result.loaded)) as SerializedProject;
    syncHistoryFlags(result);
    dirty.value = true;
  }

  function remember(data: SerializedProject) {
    try {
      useSettingsStore().rememberProject({
        root: data.root,
        name: data.project.name,
        platform: data.project.platform,
        width: data.project.display.width,
        height: data.project.display.height,
      });
    } catch {
      /* settings store may be unavailable in tests */
    }
  }

  function applyLoaded(data: SerializedProject, opts: { resetHistory?: boolean; remember?: boolean } = {}) {
    applyLoadedData(data, opts);
  }

  async function ensureWidgets() {
    widgets.value = await desktop().listWidgets();
  }

  async function openHello() {
    const data = await desktop().openHello();
    applyLoaded(data);
    await ensureWidgets();
    log.value = `已打开示例工程: ${data.root}`;
  }

  async function openDir() {
    const dir = await desktop().openProjectDir();
    if (!dir) return;
    await openPath(dir);
  }

  async function openPath(dir: string) {
    const data = await desktop().openProject(dir);
    applyLoaded(data);
    await ensureWidgets();
    log.value = `已打开: ${data.root}`;
  }

  async function importForgeui(): Promise<boolean> {
    const result = await desktop().importForgeui();
    if (result.cancelled) return false;
    if (!result.ok) {
      appendDiagnostics("import", result.diagnostics ?? []);
      statusLine.value = "导入 .forgeui 失败";
      return false;
    }
    if (result.loaded) {
      applyLoaded(result.loaded);
      syncHistoryFlags(result);
    }
    await ensureWidgets();
    log.value = `已从 .forgeui 导入: ${loaded.value?.root ?? ""}`;
    statusLine.value = "导入完成";
    return true;
  }

  async function importFigma(): Promise<boolean> {
    const result = await desktop().importFigma();
    if (result.cancelled) return false;
    if (!result.ok) {
      appendDiagnostics("import", result.diagnostics ?? []);
      statusLine.value = "导入 Figma JSON 失败";
      return false;
    }
    if (result.loaded) {
      applyLoaded(result.loaded);
      syncHistoryFlags(result);
    }
    await ensureWidgets();
    log.value = `已从 Figma JSON 导入: ${loaded.value?.root ?? ""}`;
    statusLine.value = "导入完成";
    return true;
  }

  async function revealProjectFolder() {
    if (!loaded.value) return;
    const result = await desktop().openProjectFolder();
    if (result.ok) {
      statusLine.value = `已在资源管理器中打开项目文件夹`;
    } else {
      appendLog("workspace", "error", result.error ?? "无法打开项目文件夹");
      statusLine.value = "打开文件夹失败";
    }
  }

  async function createNew(opts: {
    name: string;
    template: "blank" | "hello-dual-screen";
    width: number;
    height: number;
    deliveryMode?: "both" | "static_c" | "dynamic_ui";
  }) {
    const root = await desktop().chooseNewProjectDir();
    if (!root) return false;
    const data = await desktop().createProject({
      root,
      name: opts.name,
      fromTemplate: opts.template,
      deliveryMode: opts.deliveryMode ?? "both",
      display: {
        width: opts.width,
        height: opts.height,
        colorDepth: 16,
        rotation: 0,
      },
    });
    applyLoaded(data);
    await ensureWidgets();
    log.value = `已新建工程: ${data.root}（${opts.template}）`;
    return true;
  }

  async function save() {
    if (!loaded.value) return;
    await flushPendingEditor();
    if (!dirty.value) return;
    appendLog("save", "info", "正在保存工程...");
    const result = await desktop().saveProject();
    if (!result.ok) {
      appendDiagnostics("save", result.diagnostics ?? []);
      statusLine.value = "保存失败";
      return;
    }
    if (result.loaded) {
      loaded.value = JSON.parse(JSON.stringify(result.loaded)) as SerializedProject;
    }
    syncHistoryFlags(result);
    dirty.value = false;
    const name = loaded.value?.project.name ?? "工程";
    statusLine.value = `已保存 · ${name}`;
    appendLog("save", "info", `已保存到 ${loaded.value?.root ?? ""}（已写入历史快照）`);
  }

  async function fetchSnapshots() {
    if (!loaded.value) return [];
    return desktop().listSnapshots();
  }

  async function fetchSnapshotPreview(id: string) {
    return desktop().getSnapshotPreview(id);
  }

  async function deleteSnapshot(id: string) {
    if (!loaded.value) return [];
    const result = await desktop().deleteSnapshot(id);
    return result.list ?? [];
  }

  async function restoreSnapshot(id: string) {
    if (!loaded.value) return false;
    if (!window.confirm("恢复历史版本将覆盖当前工程文件，是否继续？")) return false;
    const result = await desktop().restoreSnapshot(id);
    if (!result.ok || !result.loaded) return false;
    applyLoaded(result.loaded, { resetHistory: true });
    syncHistoryFlags(result);
    dirty.value = false;
    appendLog("history", "info", `已恢复历史版本 ${id}`);
    statusLine.value = `已恢复历史 · ${id}`;
    return true;
  }

  async function createNamedSnapshot(label: string) {
    if (!loaded.value) return null;
    try {
      const result = await desktop().createSnapshot(label);
      if (result.loaded) {
        loaded.value = JSON.parse(JSON.stringify(result.loaded)) as SerializedProject;
      }
      dirty.value = false;
      appendLog("history", "info", `已创建快照 ${result.meta.id}${label ? ` (${label})` : ""}`);
      return result.meta;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog("history", "error", msg);
      window.alert(msg);
      return null;
    }
  }

  async function updateMeta(patch: Record<string, unknown>) {
    if (!loaded.value) return;
    const result = await desktop().updateMeta({ patch, _editor: editorContext() });
    applyMutationResult(result);
    await save();
    log.value = "已更新项目设置";
  }

  async function select(id: string, opts?: { additive?: boolean }) {
    if (id === screenId.value) {
      selectedId.value = id;
      selectedIds.value = [];
      return;
    }
    if (opts?.additive) {
      const set = new Set(selectedIds.value.length ? selectedIds.value : selectedId.value !== screenId.value ? [selectedId.value] : []);
      if (set.has(id)) {
        set.delete(id);
        if (!set.size) {
          selectedId.value = screenId.value;
          selectedIds.value = [];
          return;
        }
        selectedId.value = [...set].at(-1)!;
      } else {
        set.add(id);
        selectedId.value = id;
      }
      selectedIds.value = [...set];
      return;
    }
    selectedId.value = id;
    selectedIds.value = [id];
  }

  function isSelected(id: string): boolean {
    if (selectedIds.value.length) return selectedIds.value.includes(id);
    return selectedId.value === id;
  }

  async function switchScreen(id: string) {
    if (id === screenId.value) {
      selectedId.value = id;
      selectedIds.value = [];
      return;
    }
    await flushPendingEditor();
    screenId.value = id;
    selectedId.value = id;
    selectedIds.value = [];
  }

  /** Apply patch to in-memory tree immediately so canvas/panel update before IPC returns. */
  function applyLocalNodePatch(sid: string, nid: string, patch: Record<string, unknown>) {
    if (!loaded.value) return;
    const screen = loaded.value.screens[sid];
    if (!screen) return;
    const node = findNode(screen, nid);
    if (!node) return;
    if (patch.name !== undefined) node.name = String(patch.name);
    if (patch.frame && typeof patch.frame === "object") {
      const next = { ...node.frame, ...(patch.frame as Record<string, number>) };
      if (nid === sid) {
        node.frame = next;
      } else {
        const parent = findParentNode(screen, nid) ?? screen;
        const pw = parent.frame?.w ?? loaded.value.project.display.width;
        const ph = parent.frame?.h ?? loaded.value.project.display.height;
        // Keep optimistic paint inside parent — same rule as core clampFrameWithinParent.
        const w = Math.min(Math.max(1, next.w), Math.max(1, pw));
        const h = Math.min(Math.max(1, next.h), Math.max(1, ph));
        node.frame = {
          ...next,
          w,
          h,
          x: Math.min(Math.max(0, next.x), Math.max(0, pw - w)),
          y: Math.min(Math.max(0, next.y), Math.max(0, ph - h)),
        };
      }
    }
    if (patch.props && typeof patch.props === "object") {
      node.props = { ...node.props, ...(patch.props as Record<string, unknown>) };
    }
    if (patch.extraData && typeof patch.extraData === "object") {
      node.extraData = {
        ...(node.extraData ?? {}),
        ...(patch.extraData as Record<string, unknown>),
      };
    }
    if (patch.styleRef !== undefined) {
      if (patch.styleRef === null || patch.styleRef === "") delete node.styleRef;
      else node.styleRef = String(patch.styleRef);
    }
    if (patch.style && typeof patch.style === "object") {
      node.style = patch.style as UiNode["style"];
    }
  }

  async function patchSelected(patch: Record<string, unknown>) {
    if (!loaded.value || !selectedId.value) return;
    const sid = screenId.value;
    const nid = selectedId.value;
    const editor = { screenId: sid, selectedId: nid };
    // Optimistic: tab names / props must paint on canvas without waiting for Electron IPC.
    applyLocalNodePatch(sid, nid, patch);
    dirty.value = true;
    await enqueueMutation(async () => {
      const result = await desktop().updateNode({
        screenId: sid,
        nodeId: nid,
        patch,
        _editor: editor,
      });
      applyMutationResult(result);
    });
  }

  async function patchSelectedStyle(part: string, state: string, props: Record<string, unknown>) {
    await patchSelected({ styleKeys: { part, state, props } });
  }

  async function patchDisplay(patch: { width?: number; height?: number }) {
    if (!loaded.value) return;
    const result = await desktop().updateMeta({
      patch: { display: patch },
      _editor: editorContext(),
    });
    applyMutationResult(result);
  }

  async function setColorLibrary(colors: Array<{ id: string; name: string; value: string }>) {
    await updateMeta({ colors });
  }

  async function setColorThemes(
    themes: Array<{
      id: string;
      name: string;
      colors: Array<{ id: string; name: string; value: string }>;
      createdAt?: string;
    }>,
  ) {
    await updateMeta({ colorThemes: themes });
  }

  async function setStyleThemes(
    themes: Array<{
      id: string;
      name: string;
      description?: string;
      createdAt?: string;
      widgetType?: string;
      part: string;
      state: string;
      props: Record<string, unknown>;
    }>,
  ) {
    await updateMeta({ themes });
  }

  async function setI18n(i18n: Record<string, unknown>) {
    await updateMeta({ i18n });
  }

  async function setPreviewLocale(locale: string) {
    if (!loaded.value) return;
    const cur = i18nConfig.value;
    await updateMeta({
      i18n: {
        ...cur,
        strings: cur.strings.map((s) => ({ ...s, values: { ...s.values } })),
        locales: cur.locales.map((l) => ({ ...l })),
        previewLocale: locale,
        enabled: true,
      },
    });
  }

  async function setAnimations(animations: unknown[]) {
    await updateMeta({ animations });
  }

  async function seedI18nFromProject() {
    if (!loaded.value) return;
    const result = await desktop().seedI18n({ _editor: editorContext() });
    applyMutationResult(result);
    appendLog("i18n", "info", `已播种 ${result.added ?? 0} 条词条`);
  }

  async function exportI18nXliff(
    sourceLocale: string,
    targetLocale: string,
    opts?: { onlyMissing?: boolean },
  ) {
    const result = await desktop().exportXliff({
      sourceLocale,
      targetLocale,
      onlyMissing: opts?.onlyMissing,
    });
    if (result.ok) {
      appendLog(
        "i18n",
        "info",
        `已导出 XLIFF → ${result.path}${opts?.onlyMissing ? "（仅缺失）" : ""}`,
      );
    }
  }

  async function importI18nXliff() {
    if (!loaded.value) return;
    const result = await desktop().importXliff({ _editor: editorContext() });
    if (result.canceled) return;
    applyMutationResult(result);
    appendLog("i18n", "info", `已导入 XLIFF，更新 ${result.updated ?? 0} 条`);
  }

  async function estimateMemory() {
    const loadedProj = loaded.value;
    if (!loadedProj) {
      return {
        imagesBytes: 0,
        fontsEstimateBytes: 0,
        screensBytes: 0,
        animEstimateBytes: 0,
        totalBytes: 0,
        notes: [] as string[],
      };
    }
    const images = imageAssets.value.length;
    const fonts = fontAssets.value.length;
    let nodeCount = 0;
    const walk = (n: { children?: unknown[] }) => {
      nodeCount += 1;
      for (const c of n.children ?? []) walk(c as { children?: unknown[] });
    };
    for (const s of Object.values(loadedProj.screens)) walk(s as { children?: unknown[] });
    const anims = animations.value;
    const imagesBytes = images * 64 * 64 * 4;
    const fontsEstimateBytes = fonts * 12_000;
    const screensBytes = nodeCount * 256;
    const animEstimateBytes = anims.reduce((a, x) => a + x.tracks.length * 64 + 128, 0);
    return {
      imagesBytes,
      fontsEstimateBytes,
      screensBytes,
      animEstimateBytes,
      totalBytes: imagesBytes + fontsEstimateBytes + screensBytes + animEstimateBytes,
      notes: [
        `${images} image(s) ≈ 64×64 ARGB8888`,
        `${fonts} font(s) ≈ 12KB each`,
        `${nodeCount} nodes × 256B`,
        `${anims.length} animation(s)`,
      ],
    };
  }

  async function previewPackedUi() {
    if (!loaded.value) return;
    appendLog("pack", "info", "正在打包并装载预览（FR-086）…");
    const packResult = await desktop().packPreview();
    appendDiagnostics("pack", packResult.diagnostics ?? []);
    if (!packResult.ok) {
      packPreview.value = null;
      appendLog("pack", "error", "UI 包装载预览失败");
      return;
    }
    const screens = packResult.screens ?? [];
    const entry = packResult.entryScreen ?? screens[0]?.id ?? "";
    packPreview.value = {
      active: true,
      outDir: packResult.outDir,
      entryScreen: entry,
      viewScreenId: entry,
      widgetCount: packResult.widgetCount,
      screens,
    };
    const logicNote = packResult.packageLogic?.allowedActions?.length
      ? `；包内动作白名单 ${packResult.packageLogic.allowedActions.length} 项（FR-090）`
      : "";
    appendLog(
      "pack",
      "info",
      `UI 包装载预览成功：${packResult.outDir} · ${packResult.screenCount} 屏 · ${packResult.widgetCount} 控件 · entry=${entry || "?"}${logicNote}`,
    );
  }

  function setPackPreviewScreen(id: string) {
    if (!packPreview.value?.active) return;
    if (!packPreview.value.screens.some((s) => s.id === id)) return;
    packPreview.value = { ...packPreview.value, viewScreenId: id };
  }

  function clearPackPreview() {
    packPreview.value = null;
    appendLog("pack", "info", "已退出 UI 包装载预览，恢复设计画布");
  }

  async function saveStyleTheme(input: {
    name: string;
    description?: string;
    part: string;
    state: string;
    props: Record<string, unknown>;
    widgetType?: string;
  }) {
    const name = input.name.trim();
    if (!name) return;
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "_")
      .replace(/^_+|_+$/g, "") || "theme";
    const existing = new Set(styleThemes.value.map((t) => t.id));
    let id = base;
    if (existing.has(id)) {
      let i = 2;
      while (existing.has(`${base}_${i}`)) i += 1;
      id = `${base}_${i}`;
    }
    const description = input.description?.trim() || undefined;
    await setStyleThemes([
      ...styleThemes.value,
      {
        id,
        name,
        description,
        createdAt: new Date().toISOString(),
        widgetType: input.widgetType,
        part: input.part,
        state: input.state,
        props: { ...input.props },
      },
    ]);
  }

  async function deleteStyleTheme(themeId: string) {
    await setStyleThemes(styleThemes.value.filter((t) => t.id !== themeId));
  }

  async function applyStyleTheme(themeId: string) {
    const theme = styleThemes.value.find((t) => t.id === themeId);
    if (!theme) return;
    await patchSelected({
      styleKeys: { part: theme.part, state: theme.state, props: theme.props },
      styleRef: theme.id,
    });
  }

  function widgetSpec(type: string): WidgetMeta | undefined {
    return widgets.value.find((w) => w.type === type);
  }

  async function setEvents(events: EventBinding[]) {
    if (!loaded.value || !selectedId.value) return;
    const sid = screenId.value;
    const nid = selectedId.value;
    const editor = { screenId: sid, selectedId: nid };
    await enqueueMutation(async () => {
      const result = await desktop().setEvents({
        screenId: sid,
        nodeId: nid,
        events,
        _editor: editor,
      });
      applyMutationResult(result);
    });
  }

  async function addWidget(type: string, frame?: { x: number; y: number }) {
    if (!loaded.value) return;
    const parentId =
      selectedNode.value?.type === "screen" || (selectedNode.value && isContainer(selectedNode.value))
        ? selectedId.value
        : screenId.value;
    const spec = widgetSpec(type);
    const patchFrame = frame
      ? {
          x: Math.max(0, Math.round(frame.x)),
          y: Math.max(0, Math.round(frame.y)),
          w: spec?.defaultFrame.w ?? 100,
          h: spec?.defaultFrame.h ?? 40,
        }
      : undefined;
    const result = await desktop().addNode({
      screenId: screenId.value,
      parentId,
      type,
      frame: patchFrame,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    selectedId.value = result.node.id;
    // BK: children of tabview belong to the designer-selected tab (layout.tabIndex / props.tabIndex).
    const parentNode = findNode(loaded.value!.screens[screenId.value]!, parentId);
    if (parentNode?.type === "tabview") {
      const tabIndex = Number(
        (parentNode.extraData as Record<string, unknown> | undefined)?.selectedTabIndex ?? 0,
      );
      await enqueueMutation(async () => {
        const r = await desktop().updateNode({
          screenId: screenId.value,
          nodeId: result.node.id,
          patch: { props: { tabIndex: Number.isFinite(tabIndex) ? tabIndex : 0 } },
          _editor: editorContext(),
        });
        applyMutationResult(r);
      });
      selectedId.value = result.node.id;
    }
  }

  async function addWidgetAt(type: string, frame: { x: number; y: number }) {
    await addWidget(type, frame);
  }

  async function addCustomWidget(customId: string, frame?: { x: number; y: number }) {
    if (!loaded.value) return;
    const parentId =
      selectedNode.value?.type === "screen" || (selectedNode.value && isContainer(selectedNode.value))
        ? selectedId.value
        : screenId.value;
    const def = loaded.value.project.customWidgets?.find((c) => c.id === customId);
    const patchFrame = frame
      ? {
          x: Math.max(0, Math.round(frame.x)),
          y: Math.max(0, Math.round(frame.y)),
          w: def?.root.frame.w,
          h: def?.root.frame.h,
        }
      : undefined;
    const result = await desktop().addCustomWidget({
      screenId: screenId.value,
      parentId,
      customId,
      frame: patchFrame,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    selectedId.value = result.node.id;
  }

  async function saveNodeAsCustomWidget(nodeId: string, name: string) {
    if (!loaded.value || nodeId === screenId.value) return false;
    const result = await desktop().saveAsCustomWidget({
      screenId: screenId.value,
      nodeId,
      name: name.trim() || undefined,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    statusLine.value = `已保存自定义控件「${result.customWidget.name}」`;
    return true;
  }

  async function importImages() {
    const paths = await desktop().openImageFiles();
    if (!paths.length) return;
    const result = await desktop().importImages({
      paths,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    appendLog("assets", "info", `已导入 ${paths.length} 张图片`);
  }

  async function importFonts() {
    const paths = await desktop().openFontFiles();
    if (!paths.length) return;
    const result = await desktop().importFonts({
      paths,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    appendLog("assets", "info", `已导入 ${paths.length} 个字体`);
  }

  async function deleteImage(imagePath: string) {
    const result = await desktop().deleteImage({
      path: imagePath,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    appendLog("assets", "info", `已删除图片 ${imagePath}`);
  }

  async function deleteFont(fontId: string) {
    const result = await desktop().deleteFont({
      fontId,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    appendLog("assets", "info", `已删除字体 ${fontId}`);
  }

  async function pruneOrphanImages() {
    const result = await desktop().pruneOrphanImages({
      _editor: editorContext(),
    });
    applyMutationResult(result);
    const n = result.removed?.length ?? 0;
    appendLog("assets", "info", n ? `已清理 ${n} 个孤立图片文件` : "无孤立图片可清理");
    return result.removed ?? [];
  }

  async function removeSelected() {
    if (!loaded.value || !selectedId.value || selectedId.value === screenId.value) return;
    const result = await desktop().removeNode({
      screenId: screenId.value,
      nodeId: selectedId.value,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    selectedId.value = screenId.value;
  }

  async function addScreen() {
    if (!loaded.value) return;
    const result = await desktop().addScreen({ _editor: editorContext() });
    applyMutationResult(result);
    screenId.value = result.screenId;
    selectedId.value = result.screenId;
    log.value = `已添加页面 ${result.screenId}`;
  }

  async function renameCurrentScreen() {
    if (!loaded.value) return;
    const next = window.prompt("页面 id（字母数字下划线）", screenId.value);
    if (!next || next === screenId.value) return;
    const result = await desktop().renameScreen({
      screenId: screenId.value,
      newId: next,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    screenId.value = next;
    selectedId.value = next;
  }

  async function renameScreenName(id: string, name: string) {
    if (!loaded.value || !name.trim()) return;
    const result = await desktop().renameScreen({
      screenId: id,
      newId: id,
      name: name.trim(),
      _editor: editorContext(),
    });
    applyMutationResult(result);
  }

  async function duplicateScreenById(id: string) {
    if (!loaded.value) return;
    const result = await desktop().duplicateScreen({
      screenId: id,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    screenId.value = result.screenId;
    selectedId.value = result.screenId;
    log.value = `已复制页面 ${result.screenId}`;
  }

  async function reorderScreenById(id: string, where: "up" | "down" | "top" | "bottom") {
    if (!loaded.value) return;
    const result = await desktop().reorderScreen({
      screenId: id,
      where,
      _editor: editorContext(),
    });
    applyMutationResult(result);
  }

  async function setStartupScreen(id: string) {
    if (!loaded.value) return;
    const result = await desktop().setDefaultScreen({
      screenId: id,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    log.value = `已设 ${id} 为启动页`;
  }

  async function removeScreenById(id: string) {
    if (!loaded.value || loaded.value.project.screens.length <= 1) {
      log.value = "至少保留一页";
      return;
    }
    if (!window.confirm(`删除页面 ${id}?`)) return;
    const result = await desktop().removeScreen({
      screenId: id,
      _editor: editorContext(),
    });
    applyLoadedData(result.loaded, { resetHistory: false, remember: false });
    syncHistoryFlags(result);
    if (screenId.value === id) {
      screenId.value = result.loaded.project.defaultScreen;
      selectedId.value = screenId.value;
    }
    dirty.value = true;
  }

  async function duplicateNodeById(nodeId: string) {
    if (!loaded.value || nodeId === screenId.value) return;
    const result = await desktop().duplicateNode({
      screenId: screenId.value,
      nodeId,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    selectedId.value = result.node.id;
  }

  async function moveNodeOrderById(nodeId: string, where: "up" | "down" | "top" | "bottom") {
    if (!loaded.value || nodeId === screenId.value) return;
    const result = await desktop().moveNodeOrder({
      screenId: screenId.value,
      nodeId,
      where,
      _editor: editorContext(),
    });
    applyMutationResult(result);
  }

  async function moveNodeById(nodeId: string, newParentId: string | null, index: number) {
    if (!loaded.value || nodeId === screenId.value) return;
    const result = await desktop().moveNode({
      screenId: screenId.value,
      nodeId,
      newParentId,
      index,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    selectedId.value = nodeId;
  }

  async function toggleNodeHidden(nodeId: string) {
    if (!loaded.value) return;
    const node = findNode(loaded.value.screens[screenId.value]!, nodeId);
    if (!node) return;
    const result = await desktop().setNodeFlags({
      screenId: screenId.value,
      nodeId,
      hidden: !node.hidden,
      _editor: editorContext(),
    });
    applyMutationResult(result);
  }

  async function toggleNodeLocked(nodeId: string) {
    if (!loaded.value) return;
    const node = findNode(loaded.value.screens[screenId.value]!, nodeId);
    if (!node) return;
    const result = await desktop().setNodeFlags({
      screenId: screenId.value,
      nodeId,
      locked: !node.locked,
      _editor: editorContext(),
    });
    applyMutationResult(result);
  }

  async function removeNodeById(nodeId: string) {
    if (!loaded.value || nodeId === screenId.value) return;
    const result = await desktop().removeNode({
      screenId: screenId.value,
      nodeId,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    if (selectedId.value === nodeId) selectedId.value = screenId.value;
  }

  async function alignSelected(opts: { recordHistory?: boolean } = {}) {
    if (!loaded.value || !selectedId.value || selectedId.value === screenId.value) return;
    const result = await desktop().alignNode({
      screenId: screenId.value,
      nodeId: selectedId.value,
      _editor: editorContext(),
      skipHistory: opts.recordHistory === false,
    });
    applyMutationResult(result);
  }

  async function alignSelection(mode: string) {
    if (!loaded.value) return;
    const ids =
      selectedIds.value.length > 0
        ? selectedIds.value
        : selectedId.value && selectedId.value !== screenId.value
          ? [selectedId.value]
          : [];
    if (!ids.length) return;
    const result = await desktop().alignNodes({
      screenId: screenId.value,
      nodeIds: ids,
      mode,
      _editor: editorContext(),
    });
    applyMutationResult(result);
  }

  async function undo() {
    if (!canUndo.value || !loaded.value) return;
    const result: UndoRedoResult = await desktop().undo(editorContext());
    if (!result.ok || !result.loaded) return;
    applyLoadedData(result.loaded, {
      resetHistory: false,
      remember: false,
      screenId: result.screenId,
      selectedId: result.selectedId,
    });
    syncHistoryFlags(result);
    dirty.value = true;
    statusLine.value = "已撤销";
    log.value = "已撤销";
  }

  async function redo() {
    if (!canRedo.value) return;
    const result: UndoRedoResult = await desktop().redo(editorContext());
    if (!result.ok || !result.loaded) return;
    applyLoadedData(result.loaded, {
      resetHistory: false,
      remember: false,
      screenId: result.screenId,
      selectedId: result.selectedId,
    });
    syncHistoryFlags(result);
    dirty.value = true;
    statusLine.value = "已重做";
    log.value = "已重做";
  }

  async function clean() {
    const preview = usePreviewStore();
    if (preview.busy) return;
    preview.begin("全部清理");
    try {
      appendLog("generate", "info", "清理 forgeui_generated/（保留 custom/）与预览编译输出...");
      const result = await desktop().generate({ cleanOnly: true });
      appendDiagnostics("generate", result.diagnostics);
      if (result.ok) {
        appendLog("generate", "info", "清理完成");
        statusLine.value = "已清理";
      } else {
        appendLog("generate", "error", "清理失败");
        statusLine.value = "清理失败";
      }
    } finally {
      preview.end();
    }
  }

  function noteAutoSaved(wasDirty: boolean, autoSaved?: boolean) {
    if (autoSaved && wasDirty) {
      dirty.value = false;
      syncHistoryFlags({ canUndo: false, canRedo: false });
      appendLog("save", "info", "已自动保存工程");
    }
  }

  async function generate(opts: { cleanGenerated?: boolean } = {}) {
    const preview = usePreviewStore();
    if (preview.busy) return;
    await flushPendingEditor();
    preview.begin(opts.cleanGenerated ? "清理并生成代码" : "生成代码");
    const wasDirty = dirty.value;
    try {
      appendLog("generate", "info", opts.cleanGenerated ? "清理并生成代码..." : "生成代码...");
      const result = await desktop().generate(opts);
      appendDiagnostics("generate", result.diagnostics);
      if (result.ok) {
        noteAutoSaved(wasDirty, result.autoSaved);
        appendLog("generate", "info", `生成成功，共 ${result.filesWritten.length} 个文件`);
        try {
          const hot = await desktop().hotReloadPreview();
          if (hot.ok) appendLog("preview", "info", hot.message ?? "已热替换常驻 IR 预览（FR-063）");
        } catch {
          /* no resident session */
        }
      } else {
        appendLog("generate", "error", "生成失败");
      }
    } finally {
      preview.end();
    }
  }

  async function previewBuild() {
    const preview = usePreviewStore();
    if (preview.busy) return;
    await flushPendingEditor();
    preview.begin("编译");
    beginBuildStream();
    const wasDirty = dirty.value;
    try {
      appendLog("preview", "info", "编译预览工程…");
      const result = await desktop().preview({ buildOnly: true, skipGenerate: true });
      if (!result.ok) appendDiagnostics("preview", result.diagnostics);
      if (result.ok) {
        noteAutoSaved(wasDirty, result.autoSaved);
        const sec = ((result.elapsedMs ?? 0) / 1000).toFixed(1);
        appendLog("preview", "info", `编译完成 · ${sec}s`);
        statusLine.value = `编译完成 · ${sec}s`;
      } else {
        appendLog("preview", "error", "编译失败，请打开日志查看 cmake 输出");
        statusLine.value = "编译失败";
      }
    } finally {
      endBuildStream();
      preview.end();
    }
  }

  async function previewRun() {
    const preview = usePreviewStore();
    if (preview.busy) return;
    preview.begin("模拟运行");
    beginBuildStream();
    try {
      const backend = loaded.value?.project.previewBackend ?? "sdl";
      appendLog("preview", "info", backend === "wasm" ? "启动 Wasm 预览…" : "启动 SDL 模拟运行...");
      const result = await desktop().preview({ runOnly: true, skipGenerate: true });
      if (!result.ok) appendDiagnostics("preview", result.diagnostics);
      if (result.ok) {
        if (backend === "wasm" && result.previewUrl) {
          const ui = useUiStore();
          ui.showWasmEmbed = true;
        }
        appendLog(
          "preview",
          "info",
          result.session?.pid
            ? `模拟运行已启动 (pid=${result.session.pid})`
            : `模拟运行完成: ${result.session?.buildDir ?? ""}`,
        );
        statusLine.value = result.session?.pid ? "模拟运行中" : "模拟运行完成";
      } else {
        appendLog("preview", "error", "模拟运行失败");
        statusLine.value = "模拟运行失败";
      }
    } finally {
      endBuildStream();
      preview.end();
    }
  }

  async function prepareWasmEmbed(): Promise<{ ok: boolean; previewUrl?: string; error?: string }> {
    if (!loaded.value) return { ok: false, error: "未打开工程" };
    await flushPendingEditor();
    appendLog("preview", "info", "准备 Wasm IR 嵌入预览（FR-064）…");
    const result = await desktop().preview({
      prepareOnly: true,
      skipGenerate: false,
      backend: "wasm",
    });
    appendDiagnostics("preview", result.diagnostics ?? []);
    if (!result.ok || !result.previewUrl) {
      return { ok: false, error: "Wasm IR 准备失败" };
    }
    appendLog("preview", "info", `Wasm IR 就绪：${result.session?.buildDir ?? ""}`);
    return { ok: true, previewUrl: result.previewUrl };
  }

  async function generateCompileAndRun() {
    const preview = usePreviewStore();
    if (preview.busy) return;
    await flushPendingEditor();
    preview.begin("生成+编译+模拟运行");
    const t0 = performance.now();
    const wasDirty = dirty.value;
    try {
      appendLog("generate", "info", "生成代码...");
      const gen = await desktop().generate({});
      appendDiagnostics("generate", gen.diagnostics);
      if (!gen.ok) {
        appendLog("generate", "error", "生成失败，已中止");
        statusLine.value = "生成失败";
        return;
      }
      noteAutoSaved(wasDirty, gen.autoSaved);
      appendLog("generate", "info", `生成成功，共 ${gen.filesWritten.length} 个文件`);

      appendLog("preview", "info", "编译预览工程...");
      beginBuildStream();
      let buildResult;
      try {
        buildResult = await desktop().preview({ buildOnly: true, skipGenerate: true });
      } finally {
        endBuildStream();
      }
      appendDiagnostics("preview", buildResult.diagnostics.filter((d) => d.level === "error"));
      if (!buildResult.ok) {
        appendLog("preview", "error", "编译失败，已中止模拟运行");
        statusLine.value = "编译失败";
        return;
      }
      appendLog("preview", "info", "编译完成，启动模拟运行...");

      beginBuildStream();
      let runResult;
      try {
        runResult = await desktop().preview({ runOnly: true, skipGenerate: true });
      } finally {
        endBuildStream();
      }
      appendDiagnostics("preview", runResult.diagnostics.filter((d) => d.level === "error"));
      const totalSec = ((performance.now() - t0) / 1000).toFixed(1);
      if (runResult.ok) {
        appendLog(
          "preview",
          "info",
          runResult.session?.pid
            ? `模拟运行已启动 (pid=${runResult.session.pid}) · 总耗时 ${totalSec}s`
            : `完成 · 总耗时 ${totalSec}s`,
        );
        statusLine.value = `模拟运行 · ${totalSec}s`;
      } else {
        appendLog("preview", "error", "模拟运行失败");
        statusLine.value = "模拟运行失败";
      }
    } finally {
      preview.end();
    }
  }

  async function exportSdk(explicitSdkPath?: string) {
    const preview = usePreviewStore();
    if (preview.busy || !loaded.value) return;
    preview.begin("导出到 SDK");
    try {
      let sdkPath = explicitSdkPath?.trim() || loaded.value.project.sdk?.path?.trim() || "";
      if (!sdkPath) {
        const picked = await desktop().openProjectDir();
        if (!picked) {
          appendLog("export", "info", "已取消导出");
          return;
        }
        sdkPath = picked;
      }
      appendLog("export", "info", `导出到 SDK: ${sdkPath}`);
      const result = await desktop().exportSdk({ sdkPath, force: true });
      appendDiagnostics("export", result.diagnostics);
      if (result.ok) {
        appendLog("export", "info", `已导出到 ${result.targetDir}`);
        statusLine.value = "已导出到 SDK";
      } else {
        appendLog("export", "error", "导出失败");
        statusLine.value = "导出失败";
      }
    } finally {
      preview.end();
    }
  }

  async function pack() {
    if (!loaded.value) return;
    await flushPendingEditor();
    if (loaded.value.project.deliveryMode === "static_c") {
      appendLog("pack", "info", "当前为 static_c，未启用 A2 UI 包");
      statusLine.value = "未启用 A2";
      return;
    }
    const preview = usePreviewStore();
    if (preview.busy) return;
    preview.begin("打包 UI 包");
    try {
      appendLog("pack", "info", "打包 UI 包...");
      const result = await desktop().pack();
      appendDiagnostics("pack", result.diagnostics);
      if (result.ok) {
        appendLog(
          "pack",
          "info",
          `打包${result.skeleton ? "骨架" : ""} → ${result.outDir}`,
        );
        statusLine.value = "UI 包已打包";
      } else {
        appendLog("pack", "error", "打包失败");
        statusLine.value = "打包失败";
      }
    } finally {
      preview.end();
    }
  }

  function isContainer(node: UiNode) {
    return widgetSpec(node.type)?.isContainer === true;
  }

  return {
    loaded,
    screenId,
    selectedId,
    selectedIds,
    widgets,
    log,
    flushPendingEditor,
    statusLine,
    logText,
    operationLogs,
    dirty,
    canUndo,
    canRedo,
    aiTransactionPending,
    aiChangeCount,
    commitAiTransaction,
    rollbackAiTransaction,
    applyAiModelUpdate,
    refreshAiTransactionState,
    currentScreen,
    selectedNode,
    selectedParentSize,
    imageAssets,
    fontAssets,
    colorLibrary,
    colorThemes,
    allNamedColors,
    styleThemes,
    customWidgets,
    i18nConfig,
    animations,
    openHello,
    openDir,
    openPath,
    importForgeui,
    importFigma,
    revealProjectFolder,
    createNew,
    save,
    fetchSnapshots,
    fetchSnapshotPreview,
    deleteSnapshot,
    restoreSnapshot,
    createNamedSnapshot,
    updateMeta,
    select,
    isSelected,
    switchScreen,
    patchSelected,
    patchSelectedStyle,
    patchDisplay,
    setColorLibrary,
    setColorThemes,
    setStyleThemes,
    setI18n,
    setPreviewLocale,
    setAnimations,
    seedI18nFromProject,
    exportI18nXliff,
    importI18nXliff,
    estimateMemory,
    previewPackedUi,
    packPreview,
    packPreviewScreen,
    setPackPreviewScreen,
    clearPackPreview,
    saveStyleTheme,
    deleteStyleTheme,
    applyStyleTheme,
    widgetSpec,
    setEvents,
    addWidget,
    addWidgetAt,
    addCustomWidget,
    saveNodeAsCustomWidget,
    importImages,
    importFonts,
    deleteImage,
    deleteFont,
    pruneOrphanImages,
    removeSelected,
    addScreen,
    renameCurrentScreen,
    renameScreenName,
    duplicateScreenById,
    reorderScreenById,
    setStartupScreen,
    removeScreenById,
    removeCurrentScreen: removeScreenById,
    duplicateNodeById,
    moveNodeOrderById,
    moveNodeById,
    toggleNodeHidden,
    toggleNodeLocked,
    removeNodeById,
    alignSelected,
    alignSelection,
    undo,
    redo,
    clean,
    generate,
    previewBuild,
    previewRun,
    prepareWasmEmbed,
    generateCompileAndRun,
    clearLogs,
    exportSdk,
    pack,
  };
});

export { findNode, findParentNode };
