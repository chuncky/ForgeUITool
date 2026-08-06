/** AI change transaction (MCP §7) — memory edits until user Save/Discard. */

let pending = false;
let snapshot = null;
let changeCount = 0;

export function getAiTransactionState() {
  return { pending, changeCount };
}

export function beginAiTransactionIfNeeded(serializeLoaded, current) {
  if (!current) return;
  if (!pending) {
    snapshot = serializeLoaded(current);
    pending = true;
    changeCount = 0;
  }
}

export function recordAiChanges(n = 1) {
  if (pending) changeCount += n;
}

export function rollbackAiTransaction(hydrateLoaded, setCurrent) {
  if (snapshot) setCurrent(hydrateLoaded(snapshot));
  pending = false;
  snapshot = null;
  changeCount = 0;
}

export function commitAiTransaction(saveFn, current) {
  if (!current) return;
  saveFn(current);
  pending = false;
  snapshot = null;
  changeCount = 0;
}

export function clearAiTransaction() {
  pending = false;
  snapshot = null;
  changeCount = 0;
}
