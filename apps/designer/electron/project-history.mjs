import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = app.isPackaged
  ? path.join(process.resourcesPath, "forgeui-root")
  : path.resolve(__dirname, "../../..");

const { EditorHistory } = await import(
  pathToFileURL(path.join(repoRoot, "packages/core/dist/editor-history.js")).href
);

/** @type {EditorHistory<object>} */
export const projectHistory = new EditorHistory();

export function clearProjectHistory() {
  projectHistory.clear();
}

export function clonePayload(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function historyFlags() {
  return {
    canUndo: projectHistory.canUndo,
    canRedo: projectHistory.canRedo,
  };
}

export function recordEditorHistory(serializeLoaded, current, editor) {
  if (!current || !editor?.screenId) return;
  projectHistory.push({
    data: clonePayload(serializeLoaded(current)),
    screenId: editor.screenId,
    selectedId: editor.selectedId ?? editor.screenId,
  });
}

export function undoEditorHistory(serializeLoaded, current, editor, hydrateLoaded) {
  if (!current) return { ok: false, ...historyFlags() };
  const snap = projectHistory.popUndo({
    data: clonePayload(serializeLoaded(current)),
    screenId: editor.screenId,
    selectedId: editor.selectedId ?? editor.screenId,
  });
  if (!snap) return { ok: false, ...historyFlags() };
  const next = hydrateLoaded(snap.data);
  return {
    ok: true,
    current: next,
    loaded: serializeLoaded(next),
    screenId: snap.screenId,
    selectedId: snap.selectedId,
    ...historyFlags(),
  };
}

export function redoEditorHistory(serializeLoaded, current, editor, hydrateLoaded) {
  if (!current) return { ok: false, ...historyFlags() };
  const snap = projectHistory.popRedo({
    data: clonePayload(serializeLoaded(current)),
    screenId: editor.screenId,
    selectedId: editor.selectedId ?? editor.screenId,
  });
  if (!snap) return { ok: false, ...historyFlags() };
  const next = hydrateLoaded(snap.data);
  return {
    ok: true,
    current: next,
    loaded: serializeLoaded(next),
    screenId: snap.screenId,
    selectedId: snap.selectedId,
    ...historyFlags(),
  };
}
