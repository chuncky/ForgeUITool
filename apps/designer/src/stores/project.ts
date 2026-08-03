import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Diagnostic, EventBinding, SerializedProject, UiNode, WidgetMeta } from "../env";
import { usePreviewStore } from "./preview";
import { useSettingsStore } from "./settings";

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

  const currentScreen = computed(() => {
    if (!loaded.value || !screenId.value) return null;
    return loaded.value.screens[screenId.value] ?? null;
  });

  const selectedNode = computed(() => {
    if (!currentScreen.value || !selectedId.value) return null;
    return findNode(currentScreen.value, selectedId.value);
  });

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

  function applyLoadedData(
    data: SerializedProject,
    opts: {
      resetHistory?: boolean;
      remember?: boolean;
      screenId?: string;
      selectedId?: string;
    } = {},
  ) {
    loaded.value = JSON.parse(JSON.stringify(data)) as SerializedProject;
    const sid =
      opts.screenId ??
      (data.project.defaultScreen || data.project.screens[0]?.id || "");
    screenId.value = sid;
    selectedId.value = opts.selectedId
      ? resolveSelection(data, sid, opts.selectedId)
      : sid;
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
    platform: "qm10xd" | "qm10xv" | "qm10xh";
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
      platform: opts.platform,
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
    log.value = `已新建工程: ${data.root}（${opts.platform} / ${opts.template}）`;
    return true;
  }

  async function save() {
    if (!loaded.value || !dirty.value) return;
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
    appendLog("save", "info", `已保存到 ${loaded.value?.root ?? ""}`);
  }

  async function updateMeta(patch: Record<string, unknown>) {
    if (!loaded.value) return;
    const result = await desktop().updateMeta({ patch, _editor: editorContext() });
    applyMutationResult(result);
    await save();
    log.value = "已更新项目设置";
  }

  async function select(id: string) {
    selectedId.value = id;
  }

  async function switchScreen(id: string) {
    screenId.value = id;
    selectedId.value = id;
  }

  async function patchSelected(patch: Record<string, unknown>) {
    if (!loaded.value || !selectedId.value) return;
    const result = await desktop().updateNode({
      screenId: screenId.value,
      nodeId: selectedId.value,
      patch,
      _editor: editorContext(),
    });
    applyMutationResult(result);
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

  function widgetSpec(type: string): WidgetMeta | undefined {
    return widgets.value.find((w) => w.type === type);
  }

  async function setEvents(events: EventBinding[]) {
    if (!loaded.value || !selectedId.value) return;
    const result = await desktop().setEvents({
      screenId: screenId.value,
      nodeId: selectedId.value,
      events,
      _editor: editorContext(),
    });
    applyMutationResult(result);
  }

  async function addWidget(type: string) {
    if (!loaded.value) return;
    const parentId =
      selectedNode.value?.type === "screen" || (selectedNode.value && isContainer(selectedNode.value))
        ? selectedId.value
        : screenId.value;
    const result = await desktop().addNode({
      screenId: screenId.value,
      parentId,
      type,
      _editor: editorContext(),
    });
    applyMutationResult(result);
    selectedId.value = result.node.id;
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
    preview.begin(opts.cleanGenerated ? "清理并生成代码" : "生成代码");
    const wasDirty = dirty.value;
    try {
      appendLog("generate", "info", opts.cleanGenerated ? "清理并生成代码..." : "生成代码...");
      const result = await desktop().generate(opts);
      appendDiagnostics("generate", result.diagnostics);
      if (result.ok) {
        noteAutoSaved(wasDirty, result.autoSaved);
        appendLog("generate", "info", `生成成功，共 ${result.filesWritten.length} 个文件`);
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
      appendLog("preview", "info", "启动 SDL 模拟运行...");
      const result = await desktop().preview({ runOnly: true, skipGenerate: true });
      if (!result.ok) appendDiagnostics("preview", result.diagnostics);
      if (result.ok) {
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

  async function generateCompileAndRun() {
    const preview = usePreviewStore();
    if (preview.busy) return;
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
    return node.type === "screen" || node.type === "container" || node.type === "button";
  }

  return {
    loaded,
    screenId,
    selectedId,
    widgets,
    log,
    statusLine,
    logText,
    operationLogs,
    dirty,
    canUndo,
    canRedo,
    currentScreen,
    selectedNode,
    openHello,
    openDir,
    openPath,
    revealProjectFolder,
    createNew,
    save,
    updateMeta,
    select,
    switchScreen,
    patchSelected,
    patchSelectedStyle,
    patchDisplay,
    widgetSpec,
    setEvents,
    addWidget,
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
    toggleNodeHidden,
    toggleNodeLocked,
    removeNodeById,
    alignSelected,
    undo,
    redo,
    clean,
    generate,
    previewBuild,
    previewRun,
    generateCompileAndRun,
    clearLogs,
    exportSdk,
    pack,
  };
});

export { findNode };
