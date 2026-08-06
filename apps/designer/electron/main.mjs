import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  clearProjectHistory,
  historyFlags,
  recordEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
} from "./project-history.mjs";
import { createForgeUiBridge, loadMcpCallTool } from "./bridge.mjs";
import {
  beginAiTransactionIfNeeded,
  commitAiTransaction,
  getAiTransactionState,
  recordAiChanges,
  rollbackAiTransaction,
  clearAiTransaction,
} from "./ai-transaction.mjs";
import {
  buildMcpConfigSnippet,
  ensureForgeAiWorkspace,
  forgeAiWorkspacePath,
  isForgeAiWorkspaceReady,
  pingBridge,
} from "./ai-workspace.mjs";
import { readProjectAssetDataUrl } from "./asset-data-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev =
  process.env.FORGEUI_DESIGNER_DEV === "1" && !app.isPackaged;

/** Monorepo root in dev; `resources/forgeui-root` after electron-builder pack. */
function resolveRepoRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "forgeui-root");
  }
  return path.resolve(__dirname, "../../..");
}

const repoRoot = resolveRepoRoot();

try {
  const bootLog = path.join(process.resourcesPath || __dirname, "boot.log");
  fs.writeFileSync(
    bootLog,
    `boot ${new Date().toISOString()} packaged=${app.isPackaged} resourcesPath=${process.resourcesPath} repoRoot=${repoRoot} dirname=${__dirname}\n`,
    "utf8",
  );
} catch {
  /* ignore */
}

function distImport(pkgRel) {
  const href = pathToFileURL(path.join(repoRoot, pkgRel)).href;
  return import(href);
}

async function api() {
  const core = await distImport("packages/core/dist/index.js");
  const codegen = await distImport("packages/codegen/dist/index.js");
  const preview = await distImport("packages/preview-host/dist/index.js");
  const platforms = await distImport("packages/platforms/dist/index.js");
  const packer = await distImport("packages/packer/dist/index.js");
  const importers = await distImport("packages/importers/dist/index.js");
  const loader = await distImport("packages/loader/dist/index.js");
  return { core, codegen, preview, platforms, packer, importers, loader };
}

let apiPromise = null;
function getApi() {
  if (!apiPromise) apiPromise = api();
  return apiPromise;
}

/** @type {import('@forgeui/core').LoadedProject | null} */
let current = null;

let bridgePreviewBusy = false;
/** @type {ReturnType<createForgeUiBridge> | null} */
let forgeBridge = null;

const BRIDGE_WRITE_TOOLS = new Set([
  "forgeui_batch_update",
  "forgeui_update_node",
  "forgeui_add_node_tree",
]);

function broadcastModelUpdate() {
  if (!current) return;
  const tx = getAiTransactionState();
  const payload = { loaded: serializeLoaded(current), ...tx };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("ai:modelUpdated", payload);
  }
}

async function applyBridgeWrite(tool, args) {
  const mcp = await distImport("packages/mcp/dist/index.js");
  if (!current) throw new Error("No project open");
  beginAiTransactionIfNeeded(serializeLoaded, current);
  const base = getAiTransactionState().changeCount;
  let result;
  if (tool === "forgeui_batch_update") {
    result = mcp.applyBatchUpdate(current, args.operations ?? [], {
      mode: args.mode,
      changeCountBase: base,
    });
  } else if (tool === "forgeui_update_node") {
    result = mcp.applyBatchUpdate(
      current,
      [
        {
          type: "update_node",
          screenId: args.screenId,
          nodeId: args.nodeId,
          frame: args.frame,
          props: args.props,
          styles: args.styles,
          events: args.events,
        },
      ],
      { changeCountBase: base },
    );
  } else if (tool === "forgeui_add_node_tree") {
    result = mcp.applyBatchUpdate(
      current,
      [
        {
          type: "add_node_tree",
          screenId: args.screenId,
          parentId: args.parentId ?? null,
          ref: args.ref,
          tree: args.tree,
        },
      ],
      { changeCountBase: base },
    );
  } else {
    throw new Error(`Unsupported bridge write tool: ${tool}`);
  }
  const delta = (result.aiTransaction?.changeCount ?? base) - base;
  if (delta > 0) recordAiChanges(delta);
  broadcastModelUpdate();
  return result;
}

function ensureBridge() {
  if (forgeBridge) return forgeBridge;
  forgeBridge = createForgeUiBridge({
    port: Number(process.env.FORGEUI_BRIDGE_PORT ?? 39201),
    getContext: () => ({
      ready: !!current,
      busy: bridgePreviewBusy,
      projectRoot: current?.root ?? null,
      aiWorkspacePath: current ? path.join(current.root, ".forge-ai") : null,
    }),
    callTool: async (tool, args) => {
      if (BRIDGE_WRITE_TOOLS.has(tool)) return applyBridgeWrite(tool, args);
      const callMcpTool = await loadMcpCallTool(repoRoot);
      return callMcpTool(tool, args);
    },
  });
  forgeBridge.start();
  return forgeBridge;
}

function serializeLoaded(loaded) {
  return {
    root: loaded.root,
    project: loaded.project,
    screens: Object.fromEntries(loaded.screens.entries()),
  };
}

function hydrateLoaded(payload) {
  const clone = JSON.parse(JSON.stringify(payload));
  return {
    root: clone.root,
    project: clone.project,
    screens: new Map(Object.entries(clone.screens)),
  };
}

function withHistory(editor, skipHistory) {
  if (!skipHistory && editor?.screenId) {
    recordEditorHistory(serializeLoaded, current, editor);
  }
}

function attachHistory(result) {
  return { ...result, ...historyFlags() };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
    title: "ForgeUI Kit Designer",
  });

  const debugStartup = process.env.FORGEUI_DEBUG_STARTUP === "1";
  const startupLog = path.join(
    process.resourcesPath || app.getPath("userData"),
    "startup.log",
  );
  const fallbackLog = path.join(app.getPath("userData"), "startup.log");
  const writeStartup = (line) => {
    if (!debugStartup && !app.isPackaged) return;
    // Always keep a short packaged startup trail for field diagnosis.
    const text = `[${new Date().toISOString()}] ${line}\n`;
    for (const p of [startupLog, fallbackLog]) {
      try {
        fs.appendFileSync(p, text, "utf8");
      } catch {
        /* ignore */
      }
    }
  };
  writeStartup(
    `boot packaged=${app.isPackaged} repoRoot=${repoRoot} __dirname=${__dirname} userData=${app.getPath("userData")}`,
  );

  win.once("ready-to-show", () => {
    writeStartup(`ready-to-show title=${win.getTitle()}`);
    win.maximize();
    win.show();
  });

  win.webContents.on("did-fail-load", (_ev, errorCode, errorDescription, validatedURL) => {
    writeStartup(`did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });
  win.webContents.on("did-finish-load", () => {
    writeStartup(`did-finish-load title=${win.getTitle()} url=${win.webContents.getURL()}`);
  });
  win.webContents.on("console-message", (_ev, level, message, line, sourceId) => {
    if (level >= 2) writeStartup(`console[${level}] ${message} (${sourceId}:${line})`);
  });

  if (isDev) {
    const devUrl = "http://localhost:5173/#/home";
    const loadDev = () => win.loadURL(devUrl);
    loadDev();
    win.webContents.on("did-fail-load", (_ev, errorCode) => {
      // ERR_CONNECTION_REFUSED / ERR_CONNECTION_RESET — Vite not ready or stopped
      if (errorCode === -102 || errorCode === -106) {
        setTimeout(loadDev, 1500);
      }
    });
    // Detached DevTools is opt-in — auto-open feels like a stray white debug window.
    if (process.env.FORGEUI_OPEN_DEVTOOLS === "1") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    const indexHtml = path.join(__dirname, "../dist/index.html");
    writeStartup(`loadFile ${indexHtml} exists=${fs.existsSync(indexHtml)}`);
    win.loadFile(indexHtml).catch((e) => writeStartup(`loadFile rejected: ${e?.message ?? e}`));
  }
}

ipcMain.handle("dialog:openProjectDir", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "选择 ForgeUI 工程目录（含 project.json）",
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("dialog:chooseNewProjectDir", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title: "选择新建工程所在空目录（将在此目录写入 project.json）",
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("app:getRepoRoot", () => repoRoot);

ipcMain.handle("shell:openProjectFolder", async () => {
  if (!current) throw new Error("No project open");
  const err = await shell.openPath(current.root);
  return { ok: !err, error: err || undefined, path: current.root };
});

ipcMain.handle("project:open", async (_e, projectDir) => {
  const { core } = await getApi();
  clearAiTransaction();
  current = core.openProject(projectDir);
  clearProjectHistory();
  return serializeLoaded(current);
});

ipcMain.handle("project:openHello", async () => {
  const { core } = await getApi();
  const hello = path.join(repoRoot, "templates/hello-dual-screen");
  current = core.openProject(hello);
  clearProjectHistory();
  return serializeLoaded(current);
});

ipcMain.handle("project:importFigma", async () => {
  const { core, importers } = await getApi();
  const fileResult = await dialog.showOpenDialog({
    title: "导入 Figma 适配 JSON",
    properties: ["openFile"],
    filters: [
      { name: "Figma Export", extensions: ["figma.json", "fig.json", "json"] },
    ],
  });
  if (fileResult.canceled || !fileResult.filePaths[0]) {
    return { ok: false, cancelled: true, diagnostics: [] };
  }
  const dirResult = await dialog.showOpenDialog({
    title: "选择导入目标目录（空目录）",
    properties: ["openDirectory", "createDirectory"],
  });
  if (dirResult.canceled || !dirResult.filePaths[0]) {
    return { ok: false, cancelled: true, diagnostics: [] };
  }
  const dest = dirResult.filePaths[0];
  const result = importers.importFigmaJson(fileResult.filePaths[0], dest);
  if (!result.ok) {
    return { ok: false, diagnostics: result.diagnostics ?? [] };
  }
  current = core.openProject(dest);
  clearProjectHistory();
  return {
    ok: true,
    loaded: serializeLoaded(current),
    diagnostics: result.diagnostics ?? [],
    ...historyFlags(),
  };
});

ipcMain.handle("project:importForgeui", async () => {
  const { core, importers } = await getApi();
  const fileResult = await dialog.showOpenDialog({
    title: "导入 .forgeui 分享包",
    properties: ["openFile"],
    filters: [{ name: "ForgeUI Bundle", extensions: ["forgeui"] }],
  });
  if (fileResult.canceled || !fileResult.filePaths[0]) {
    return { ok: false, cancelled: true, diagnostics: [] };
  }
  const dirResult = await dialog.showOpenDialog({
    title: "选择导入目标目录（空目录，将写入 project.json）",
    properties: ["openDirectory", "createDirectory"],
  });
  if (dirResult.canceled || !dirResult.filePaths[0]) {
    return { ok: false, cancelled: true, diagnostics: [] };
  }
  const dest = dirResult.filePaths[0];
  const result = importers.unbundleProject(fileResult.filePaths[0], dest);
  if (!result.ok) {
    return { ok: false, diagnostics: result.diagnostics ?? [] };
  }
  current = core.openProject(dest);
  clearProjectHistory();
  return {
    ok: true,
    loaded: serializeLoaded(current),
    diagnostics: result.diagnostics ?? [],
    ...historyFlags(),
  };
});

ipcMain.handle("project:create", async (_e, opts) => {
  const { core } = await getApi();
  const root = opts?.root;
  if (!root) throw new Error("root required");
  current = core.createProject({
    root,
    name: opts.name || path.basename(root),
    ...(opts.platform ? { platform: opts.platform } : {}),
    display: opts.display || {
      width: 480,
      height: 320,
      colorDepth: 16,
      rotation: 0,
    },
    fromTemplate: opts.fromTemplate || "blank",
    deliveryMode: opts.deliveryMode || "both",
  });
  clearProjectHistory();
  return serializeLoaded(current);
});

ipcMain.handle("project:historyState", () => historyFlags());

ipcMain.handle("project:listSnapshots", async () => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  return core.listSnapshots(current.root);
});

ipcMain.handle("project:createSnapshot", async (_e, label) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  core.saveProject(current);
  const meta = core.createSnapshot(current.root, typeof label === "string" ? label : undefined);
  return { ok: true, meta, loaded: serializeLoaded(current) };
});

ipcMain.handle("project:restoreSnapshot", async (_e, snapshotId) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  current = core.restoreSnapshot(current.root, snapshotId);
  clearProjectHistory();
  return { ok: true, loaded: serializeLoaded(current), ...historyFlags() };
});

ipcMain.handle("app:readDoc", async (_e, id) => {
  const map = {
    "hello-qm10xd": path.join(repoRoot, "templates/boards/qm10xd/HELLO.md"),
    "mvp-gui-acceptance": path.join(repoRoot, "docs/MVP_GUI_ACCEPTANCE_UI-01-08.md"),
    "ac-005-board-bringup": path.join(repoRoot, "docs/AC-005_BOARD_BRINGUP.md"),
    readme: path.join(repoRoot, "README.md"),
  };
  const file = map[id];
  if (!file || !fs.existsSync(file)) return `文档未找到: ${id}`;
  return fs.readFileSync(file, "utf8");
});

ipcMain.handle("project:updateMeta", async (_e, args) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  const patch = args?.patch ?? args;
  const _editor = args?._editor;
  const skipHistory = args?.skipHistory;
  withHistory(_editor, skipHistory);
  core.updateProjectMeta(current, patch);
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("project:seedI18n", async (_e, args) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  const _editor = args?._editor;
  withHistory(_editor, args?.skipHistory);
  const added = core.seedI18nFromProject(current);
  return attachHistory({ loaded: serializeLoaded(current), added });
});

ipcMain.handle("project:exportXliff", async (_e, args) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  const i18n = core.normalizeI18n(current.project);
  const sourceLocale = args?.sourceLocale ?? i18n.defaultLocale;
  const targetLocale = args?.targetLocale ?? i18n.locales.find((l) => l.id !== sourceLocale)?.id ?? sourceLocale;
  const result = await dialog.showSaveDialog({
    title: "导出 XLIFF",
    defaultPath: path.join(current.root, `i18n_${sourceLocale}_${targetLocale}.xliff`),
    filters: [
      { name: "XLIFF", extensions: ["xliff", "xlf"] },
      { name: "All", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  const xml = core.exportXliff12(i18n, {
    sourceLocale,
    targetLocale,
    productName: current.project.name,
    onlyMissing: !!args?.onlyMissing,
  });
  fs.writeFileSync(result.filePath, xml, "utf8");
  return { ok: true, path: result.filePath, onlyMissing: !!args?.onlyMissing };
});

ipcMain.handle("project:importXliff", async (_e, args) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  const _editor = args?._editor;
  const open = await dialog.showOpenDialog({
    title: "导入 XLIFF",
    properties: ["openFile"],
    filters: [
      { name: "XLIFF", extensions: ["xliff", "xlf"] },
      { name: "All", extensions: ["*"] },
    ],
  });
  if (open.canceled || !open.filePaths?.[0]) return { ok: false, canceled: true };
  withHistory(_editor, args?.skipHistory);
  const xml = fs.readFileSync(open.filePaths[0], "utf8");
  const imported = core.importXliff12(xml);
  const i18n = core.ensureI18n(current.project);
  current.project.i18n = i18n;
  const updated = core.mergeXliffIntoI18n(i18n, imported);
  return attachHistory({ loaded: serializeLoaded(current), updated, path: open.filePaths[0] });
});

ipcMain.handle("project:save", async () => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  try {
    core.saveProjectWithSnapshot(current);
    clearProjectHistory();
    const loaded = serializeLoaded(current);
    return { ok: true, loaded, ...historyFlags() };
  } catch (err) {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: "E_SAVE_001",
          message: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }
});

ipcMain.handle("project:undo", async (_e, editor) => {
  const result = undoEditorHistory(serializeLoaded, current, editor ?? {}, hydrateLoaded);
  if (result.ok) current = result.current;
  return result;
});

ipcMain.handle("project:redo", async (_e, editor) => {
  const result = redoEditorHistory(serializeLoaded, current, editor ?? {}, hydrateLoaded);
  if (result.ok) current = result.current;
  return result;
});

ipcMain.handle("project:updateNode", async (_e, { screenId, nodeId, patch, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.updateNodeProps(current, screenId, nodeId, patch);
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("project:setEvents", async (_e, { screenId, nodeId, events, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.setNodeEvents(current, screenId, nodeId, events);
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("dialog:openImageFiles", async () => {
  const r = await dialog.showOpenDialog({
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }],
    properties: ["openFile", "multiSelections"],
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle("dialog:openFontFiles", async () => {
  const r = await dialog.showOpenDialog({
    filters: [{ name: "Fonts", extensions: ["ttf", "otf", "woff", "woff2"] }],
    properties: ["openFile", "multiSelections"],
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle("project:importImages", async (_e, { paths, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  const imported = core.importImageAssets(current, paths ?? []);
  return attachHistory({ loaded: serializeLoaded(current), imported });
});

ipcMain.handle("project:importFonts", async (_e, { paths, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  const imported = core.importFontAssets(current, paths ?? []);
  return attachHistory({ loaded: serializeLoaded(current), imported });
});

ipcMain.handle("project:addNode", async (_e, { screenId, parentId, type, frame, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  const node = core.addChildNode(current, screenId, parentId, type, frame ? { frame } : undefined);
  return attachHistory({ loaded: serializeLoaded(current), node });
});

ipcMain.handle("project:saveAsCustomWidget", async (_e, { screenId, nodeId, id, name, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  const def = core.saveNodeAsCustomWidget(current, screenId, nodeId, { id, name });
  return attachHistory({ loaded: serializeLoaded(current), customWidget: def });
});

ipcMain.handle("project:addCustomWidget", async (_e, { screenId, parentId, customId, frame, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  const node = core.addCustomWidgetInstance(current, screenId, parentId, customId, frame ? { frame } : undefined);
  return attachHistory({ loaded: serializeLoaded(current), node });
});

ipcMain.handle("project:removeNode", async (_e, { screenId, nodeId, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.removeNode(current, screenId, nodeId);
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("project:addScreen", async (_e, args = {}) => {
  const { _editor, skipHistory, ...opts } = args;
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  const screen = core.addScreen(current, opts);
  return attachHistory({ loaded: serializeLoaded(current), screenId: screen.id });
});

ipcMain.handle("project:renameScreen", async (_e, { screenId, newId, name, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.renameScreen(current, screenId, newId, name);
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("project:removeScreen", async (_e, { screenId, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.removeScreen(current, screenId);
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("project:duplicateScreen", async (_e, { screenId, newId, name, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  const screen = core.duplicateScreen(current, screenId, { newId, name });
  return attachHistory({ loaded: serializeLoaded(current), screenId: screen.id });
});

ipcMain.handle("project:reorderScreen", async (_e, { screenId, where, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.reorderScreen(current, screenId, where);
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("project:setDefaultScreen", async (_e, { screenId, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.setDefaultScreen(current, screenId);
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("project:duplicateNode", async (_e, { screenId, nodeId, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  const node = core.duplicateNode(current, screenId, nodeId);
  return attachHistory({ loaded: serializeLoaded(current), node });
});

ipcMain.handle("project:moveNodeOrder", async (_e, { screenId, nodeId, where, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.moveNodeOrder(current, screenId, nodeId, where);
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("project:setNodeFlags", async (_e, { screenId, nodeId, locked, hidden, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.setNodeFlags(current, screenId, nodeId, { locked, hidden });
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("project:alignNode", async (_e, { screenId, nodeId, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.alignNodeToNeighbors(current, screenId, nodeId);
  return attachHistory({ loaded: serializeLoaded(current) });
});

ipcMain.handle("project:alignNodes", async (_e, { screenId, nodeIds, mode, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  core.alignNodes(current, screenId, nodeIds, mode);
  return attachHistory({ loaded: serializeLoaded(current) });
});

async function codegenLayout() {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  return core.resolveCodegenPaths(current.root, current.project);
}

function assertProjectRelPath(relPath, layout) {
  const normalized = String(relPath).replace(/\\/g, "/");
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid path");
  }
  const prefix = `${layout.codegenDir}/`;
  if (!normalized.startsWith(prefix)) {
    throw new Error(`Only ${layout.codegenDir}/ files are accessible`);
  }
  return normalized;
}

function walkCodeFiles(dir, relPrefix, editable, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    const rel = `${relPrefix}/${name}`;
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      walkCodeFiles(abs, rel, editable, out);
    } else if (/\.(c|h|cmake|txt|md)$/i.test(name)) {
      out.push({ relPath: rel, editable });
    }
  }
}

ipcMain.handle("project:listCodeFiles", async () => {
  if (!current) throw new Error("No project open");
  const layout = await codegenLayout();
  const root = current.root;
  const files = [];
  const customPrefix = `${layout.codegenDir}/${layout.customSubdir}`;
  walkCodeFiles(path.join(root, layout.codegenDir), layout.codegenDir, false, files);
  for (const f of files) {
    if (f.relPath.startsWith(`${customPrefix}/`) || f.relPath === customPrefix) {
      f.editable = true;
    }
  }
  return files;
});

ipcMain.handle("project:readFile", async (_e, relPath) => {
  if (!current) throw new Error("No project open");
  const layout = await codegenLayout();
  const rel = assertProjectRelPath(relPath, layout);
  const abs = path.join(current.root, rel);
  if (!fs.existsSync(abs)) {
    return { ok: false, error: "文件不存在" };
  }
  return { ok: true, content: fs.readFileSync(abs, "utf8"), relPath: rel };
});

/** FR-016e-a: project-relative image/font → data URL for canvas chrome (must actually load). */
ipcMain.handle("project:assetDataUrl", async (_e, relPath) => {
  if (!current) return { ok: false, error: "No project open" };
  return readProjectAssetDataUrl(current.root, relPath);
});

ipcMain.handle("project:writeUserFile", async (_e, { relPath, content }) => {
  if (!current) throw new Error("No project open");
  const layout = await codegenLayout();
  const rel = assertProjectRelPath(relPath, layout);
  const customPrefix = `${layout.codegenDir}/${layout.customSubdir}/`;
  if (!rel.startsWith(customPrefix)) {
    throw new Error(`Only ${layout.codegenDir}/${layout.customSubdir}/ files are writable`);
  }
  const abs = path.join(current.root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content ?? "", "utf8");
  return { ok: true, relPath: rel };
});

ipcMain.handle("project:listWidgets", async () => {
  const { core } = await getApi();
  return core.listWidgetSpecs();
});

ipcMain.handle("tool:generate", async (_e, opts = {}) => {
  const { codegen, core } = await getApi();
  if (!current) throw new Error("No project open");
  let autoSaved = false;
  if (!opts.cleanOnly) {
    core.saveProject(current);
    clearProjectHistory();
    autoSaved = true;
  }
  const result = await codegen.generate(current.root, {
    cleanGenerated: !!opts.cleanGenerated,
    cleanOnly: !!opts.cleanOnly,
    cleanPreviewBuild: !!opts.cleanPreviewBuild,
  });
  if (result.ok) {
    current = core.openProject(current.root);
  }
  return { ...result, autoSaved };
});

ipcMain.handle("tool:preview", async (event, { prepareOnly = false, buildOnly = false, runOnly = false, skipGenerate = false, backend } = {}) => {
  const { preview, core } = await getApi();
  if (!current) throw new Error("No project open");
  let autoSaved = false;
  if (!runOnly) {
    core.saveProject(current);
    clearProjectHistory();
    autoSaved = true;
  }
  const host = preview.createPreviewHost();
  const sendLog = (line) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send("preview:buildLog", line);
    }
  };
  bridgePreviewBusy = true;
  let result;
  try {
    result = await host.run(current.root, {
      backend: backend ?? current.project.previewBackend ?? "sdl",
      prepareOnly,
      buildOnly,
      runOnly,
      skipGenerate,
      onBuildLog: sendLog,
    });
  } finally {
    bridgePreviewBusy = false;
  }
  let previewUrl = null;
  if (result?.ok && result.session?.buildDir) {
    const indexHtml = path.join(result.session.buildDir, "index.html");
    if (fs.existsSync(indexHtml)) {
      previewUrl = `file:///${indexHtml.replace(/\\/g, "/")}`;
    }
  }
  return { ...result, autoSaved, previewUrl };
});

ipcMain.handle("tool:hotReloadPreview", async () => {
  const { preview, core } = await getApi();
  if (!current) throw new Error("No project open");
  core.saveProject(current);
  const host = preview.createPreviewHost();
  if (typeof host.hotReload !== "function") {
    return { ok: false, message: "hotReload not supported", diagnostics: [] };
  }
  return host.hotReload(current.root);
});

ipcMain.handle("tool:exportSdk", async (_e, { sdkPath, force = true }) => {
  const { platforms, codegen, core } = await getApi();
  if (!current) throw new Error("No project open");
  core.saveProject(current);
  clearProjectHistory();
  await codegen.generate(current.root);
  return platforms.exportToSdk(current.root, { sdkPath, force });
});

ipcMain.handle("tool:pack", async () => {
  const { packer } = await getApi();
  if (!current) throw new Error("No project open");
  return packer.packProject(current.root);
});

/** FR-086: pack then load the same package via JsonRuntimeLoader on PC. */
ipcMain.handle("tool:packPreview", async () => {
  const { packer, loader } = await getApi();
  const fs = await import("node:fs");
  const path = await import("node:path");
  if (!current) throw new Error("No project open");
  const packResult = await packer.packProject(current.root);
  if (!packResult.ok) {
    return {
      ok: false,
      outDir: packResult.outDir,
      diagnostics: packResult.diagnostics ?? [],
      widgetCount: 0,
      screenCount: 0,
      entryScreen: null,
      packageLogic: null,
      screens: [],
    };
  }
  const caps = {
    width: current.project.display?.width ?? 480,
    height: current.project.display?.height ?? 320,
    colorDepth: current.project.display?.colorDepth ?? 16,
    lvglVersion: current.project.lvglVersion ?? "9.2.0",
  };
  const runtime = await new loader.JsonRuntimeLoader().apply(packResult.outDir, caps);
  let packageLogic = null;
  const logicPath = path.join(packResult.outDir, "package-logic.json");
  if (fs.existsSync(logicPath)) {
    try {
      packageLogic = JSON.parse(fs.readFileSync(logicPath, "utf8"));
    } catch {
      packageLogic = null;
    }
  }
  const summary = loader.summarizePackRuntime(runtime);
  return {
    ok: !!(packResult.ok && runtime.ok),
    outDir: packResult.outDir,
    diagnostics: [...(packResult.diagnostics ?? []), ...(runtime.diagnostics ?? [])],
    widgetCount: summary.widgetCount,
    screenCount: summary.screenCount,
    entryScreen: summary.entryScreen ?? current.project.defaultScreen ?? null,
    packageLogic,
    screens: summary.screens,
  };
});

ipcMain.handle("ai:getTransactionState", () => getAiTransactionState());

ipcMain.handle("ai:commitTransaction", async () => {
  const { core } = await getApi();
  if (!current) return { ok: false, error: "No project open" };
  commitAiTransaction((loaded) => {
    core.saveProject(loaded);
    clearProjectHistory();
  }, current);
  broadcastModelUpdate();
  return { ok: true, loaded: serializeLoaded(current), ...getAiTransactionState() };
});

ipcMain.handle("ai:rollbackTransaction", async () => {
  if (!current) return { ok: false, error: "No project open" };
  rollbackAiTransaction(hydrateLoaded, (loaded) => {
    current = loaded;
  });
  clearProjectHistory();
  broadcastModelUpdate();
  return { ok: true, loaded: serializeLoaded(current), ...getAiTransactionState() };
});

ipcMain.handle("ai:setupWorkspace", async () => {
  if (!current) return { ok: false, error: "No project open" };
  ensureBridge();
  const bridgePort = Number(process.env.FORGEUI_BRIDGE_PORT ?? 39201);
  const aiDir = ensureForgeAiWorkspace(current.root, { bridgePort });
  return { ok: true, aiWorkspacePath: aiDir };
});

ipcMain.handle("ai:getPanelState", async () => {
  ensureBridge();
  const bridgePort = Number(process.env.FORGEUI_BRIDGE_PORT ?? 39201);
  const mcp = await distImport("packages/mcp/dist/index.js");
  const aiPath = current ? forgeAiWorkspacePath(current.root) : null;
  let bridgePing = null;
  try {
    bridgePing = await pingBridge(bridgePort);
  } catch (e) {
    bridgePing = { ok: false, error: e.message ?? String(e) };
  }
  return {
    ok: true,
    bridgePort,
    projectOpen: !!current,
    previewBusy: bridgePreviewBusy,
    aiWorkspacePath: aiPath,
    workspaceReady: current ? isForgeAiWorkspaceReady(current.root) : false,
    transaction: getAiTransactionState(),
    tools: mcp.listMcpTools(),
    mcpConfigJson: JSON.stringify(
      buildMcpConfigSnippet(repoRoot, bridgePort, {
        packaged: app.isPackaged,
        execPath: process.execPath,
      }),
      null,
      2,
    ),
    bridgePing,
  };
});

ipcMain.handle("ai:openWorkspaceFolder", async () => {
  if (!current) return { ok: false, error: "No project open" };
  const aiDir = isForgeAiWorkspaceReady(current.root)
    ? forgeAiWorkspacePath(current.root)
    : ensureForgeAiWorkspace(current.root);
  await shell.openPath(aiDir);
  return { ok: true, aiWorkspacePath: aiDir };
});

ipcMain.handle("ai:pingBridge", async () => {
  ensureBridge();
  const bridgePort = Number(process.env.FORGEUI_BRIDGE_PORT ?? 39201);
  try {
    const data = await pingBridge(bridgePort);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message ?? String(e) };
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ensureBridge();
  createWindow();
  getApi().catch((e) => {
    console.error("getApi failed", e);
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((e) => {
  console.error("whenReady failed", e);
  try {
    fs.writeFileSync(
      path.join(process.resourcesPath || __dirname, "boot-error.log"),
      String(e?.stack ?? e),
      "utf8",
    );
  } catch {
    /* ignore */
  }
});

process.on("uncaughtException", (e) => {
  try {
    fs.appendFileSync(
      path.join(process.resourcesPath || __dirname, "boot-error.log"),
      `\nuncaught ${new Date().toISOString()}\n${e?.stack ?? e}\n`,
      "utf8",
    );
  } catch {
    /* ignore */
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
