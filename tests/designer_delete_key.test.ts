/**
 * @vitest-environment happy-dom
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isEditableKeyboardTarget } from "../apps/designer/src/utils/keyboard";

describe("FR-012a Delete/Backspace removes selected widget", () => {
  const root = path.resolve(import.meta.dirname, "..");

  it("DesignerWorkbench wires Delete/Backspace to removeSelected", () => {
    const src = fs.readFileSync(
      path.join(root, "apps/designer/src/components/DesignerWorkbench.vue"),
      "utf8",
    );
    expect(src).toContain("isEditableKeyboardTarget");
    expect(src).toContain('e.key === "Delete"');
    expect(src).toContain('e.key === "Backspace"');
    expect(src).toContain("removeSelected");
    expect(src).toContain("store.selectedId === store.screenId");
  });

  it("isEditableKeyboardTarget ignores widget delete in form fields", () => {
    expect(isEditableKeyboardTarget(null)).toBe(false);

    const input = document.createElement("input");
    expect(isEditableKeyboardTarget(input)).toBe(true);

    const textarea = document.createElement("textarea");
    expect(isEditableKeyboardTarget(textarea)).toBe(true);

    const select = document.createElement("select");
    expect(isEditableKeyboardTarget(select)).toBe(true);

    const div = document.createElement("div");
    expect(isEditableKeyboardTarget(div)).toBe(false);

    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(isEditableKeyboardTarget(editable)).toBe(true);

    const wrap = document.createElement("div");
    const nested = document.createElement("span");
    wrap.appendChild(nested);
    const parentInput = document.createElement("div");
    parentInput.appendChild(wrap);
    // span inside input is invalid HTML; use closest via wrapping label-like structure
    const host = document.createElement("div");
    const field = document.createElement("input");
    host.appendChild(field);
    expect(isEditableKeyboardTarget(field)).toBe(true);
  });

  it("docs declare FR-012a Delete shortcut", () => {
    const req = fs.readFileSync(path.join(root, "docs/嵌入式UI工具_设计需求文档.md"), "utf8");
    const lld = fs.readFileSync(path.join(root, "docs/嵌入式UI工具_软件详细设计说明.md"), "utf8");
    expect(req).toContain("FR-012a");
    expect(req).toContain("Delete");
    expect(lld).toContain("FR-012a");
    expect(lld).toContain("Delete / Backspace");
  });
});
