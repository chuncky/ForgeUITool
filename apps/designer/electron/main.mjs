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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.FORGEUI_DESIGNER_DEV === "1";
const repoRoot = path.resolve(__dirname, "../../..");

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
  return { core, codegen, preview, platforms, packer };
}

let apiPromise = null;
function getApi() {
  if (!apiPromise) apiPromise = api();
  return apiPromise;
}

/** @type {import('@forgeui/core').LoadedProject | null} */
let current = null;

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
    },
    title: "ForgeUI Kit Designer",
  });

  win.once("ready-to-show", () => {
    win.maximize();
    win.show();
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
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

ipcMain.handle("project:create", async (_e, opts) => {
  const { core } = await getApi();
  const root = opts?.root;
  if (!root) throw new Error("root required");
  current = core.createProject({
    root,
    name: opts.name || path.basename(root),
    platform: opts.platform || "qm10xd",
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

ipcMain.handle("app:readDoc", async (_e, id) => {
  const map = {
    "hello-qm10xd": path.join(repoRoot, "templates/boards/qm10xd/HELLO.md"),
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

ipcMain.handle("project:save", async () => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  try {
    core.saveProject(current);
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

ipcMain.handle("project:addNode", async (_e, { screenId, parentId, type, _editor, skipHistory }) => {
  const { core } = await getApi();
  if (!current) throw new Error("No project open");
  withHistory(_editor, skipHistory);
  const node = core.addChildNode(current, screenId, parentId, type);
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

ipcMain.handle("tool:preview", async (event, { prepareOnly = false, buildOnly = false, runOnly = false, skipGenerate = false } = {}) => {
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
  const result = await host.run(current.root, {
    backend: "sdl",
    prepareOnly,
    buildOnly,
    runOnly,
    skipGenerate,
    onBuildLog: sendLog,
  });
  return { ...result, autoSaved };
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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  getApi().catch(() => {});
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
