import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  addChildNode,
  buildIR,
  createProject,
  findNode,
  openProject,
  styleProp,
  updateNodeProps,
  updateProjectMeta,
} from "./index.js";

describe("styleRef (FR-018)", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const r of roots) {
      fs.rmSync(r, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  it("persists styleRef and re-syncs node style when themes update", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-sref-"));
    roots.push(root);
    createProject({ root, name: "sref", platform: "qm10xd" });
    const loaded = openProject(root);
    const sid = loaded.project.defaultScreen;
    const btn = addChildNode(loaded, sid, sid, "button");

    updateProjectMeta(loaded, {
      themes: [
        {
          id: "primary_btn",
          name: "Primary",
          part: "main",
          state: "default",
          props: { bg_color: "#112233ff", radius: 8 },
        },
      ],
    });

    updateNodeProps(loaded, sid, btn.id, {
      styleKeys: { part: "main", state: "default", props: { bg_color: "#112233ff", radius: 8 } },
      styleRef: "primary_btn",
    });

    expect(btn.styleRef).toBe("primary_btn");
    expect(styleProp(btn.style, "main", "default", "bg_color")).toBe("#112233ff");

    updateProjectMeta(loaded, {
      themes: [
        {
          id: "primary_btn",
          name: "Primary",
          part: "main",
          state: "default",
          props: { bg_color: "#aabbccff", radius: 12 },
        },
      ],
    });

    const synced = findNode(loaded.screens.get(sid)!, btn.id)!;
    expect(synced.styleRef).toBe("primary_btn");
    expect(styleProp(synced.style, "main", "default", "bg_color")).toBe("#aabbccff");
    expect(styleProp(synced.style, "main", "default", "radius")).toBe(12);
  });

  it("clears styleRef and merges theme into IR style", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-sref2-"));
    roots.push(root);
    createProject({ root, name: "sref2", platform: "qm10xd" });
    const loaded = openProject(root);
    const sid = loaded.project.defaultScreen;
    const btn = addChildNode(loaded, sid, sid, "button");

    updateProjectMeta(loaded, {
      themes: [
        {
          id: "t1",
          name: "T1",
          part: "main",
          state: "default",
          props: { text_color: "#ffffffff" },
        },
      ],
    });
    updateNodeProps(loaded, sid, btn.id, { styleRef: "t1" });

    const ir = buildIR(loaded);
    const irBtn = ir.screens[0].root.children.find((c) => c.id === btn.id)!;
    expect(irBtn.styleRef).toBe("t1");
    expect(styleProp(irBtn.style, "main", "default", "text_color")).toBe("#ffffffff");

    updateNodeProps(loaded, sid, btn.id, { styleRef: null });
    expect(btn.styleRef).toBeUndefined();
  });
});
