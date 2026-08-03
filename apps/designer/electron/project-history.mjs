import { EditorHistory } from "../../../packages/core/dist/editor-history.js";

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
