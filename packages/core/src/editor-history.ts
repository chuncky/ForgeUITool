export interface EditorSnapshot<T = unknown> {
  data: T;
  screenId: string;
  selectedId: string;
}

/** In-memory undo/redo stack for design-time edits (FR-010 undo). */
export class EditorHistory<T = unknown> {
  private undo: EditorSnapshot<T>[] = [];
  private redo: EditorSnapshot<T>[] = [];

  clear(): void {
    this.undo = [];
    this.redo = [];
  }

  get canUndo(): boolean {
    return this.undo.length > 0;
  }

  get canRedo(): boolean {
    return this.redo.length > 0;
  }

  push(entry: EditorSnapshot<T>, max = 50): void {
    this.undo.push({
      data: structuredClone(entry.data),
      screenId: entry.screenId,
      selectedId: entry.selectedId,
    });
    if (this.undo.length > max) this.undo.shift();
    this.redo = [];
  }

  popUndo(current: EditorSnapshot<T>): EditorSnapshot<T> | null {
    const target = this.undo.pop();
    if (!target) return null;
    this.redo.push({
      data: structuredClone(current.data),
      screenId: current.screenId,
      selectedId: current.selectedId,
    });
    return target;
  }

  popRedo(current: EditorSnapshot<T>): EditorSnapshot<T> | null {
    const target = this.redo.pop();
    if (!target) return null;
    this.undo.push({
      data: structuredClone(current.data),
      screenId: current.screenId,
      selectedId: current.selectedId,
    });
    return target;
  }
}
