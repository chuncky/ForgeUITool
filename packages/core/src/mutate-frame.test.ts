import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addChildNode, createProject, openProject } from "./index.js";

describe("addChildNode frame option", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const r of roots) {
      fs.rmSync(r, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  it("applies custom frame position from drag-drop", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-add-"));
    roots.push(root);
    createProject({ root, name: "drag", platform: "qm10xd" });
    const loaded = openProject(root);
    const screenId = loaded.project.defaultScreen;

    const node = addChildNode(loaded, screenId, screenId, "button", {
      frame: { x: 88, y: 120 },
    });

    expect(node.frame.x).toBe(88);
    expect(node.frame.y).toBe(120);
    expect(node.frame.w).toBeGreaterThan(0);
    expect(node.frame.h).toBeGreaterThan(0);
  });
});
