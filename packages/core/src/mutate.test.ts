import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addChildNode,
  alignNodeToNeighbors,
  duplicateNode,
  duplicateScreen,
  moveNodeOrder,
  openProject,
  reorderScreen,
  setDefaultScreen,
  setNodeFlags,
  updateNodeProps,
  updateProjectMeta,
} from "@forgeui/core";

const templateRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../templates/hello-dual-screen",
);

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

describe("core mutate", () => {
  it("updates props and adds widgets", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-mut-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "lbl_title", { props: { text: "Changed" } });
    const label = loaded.screens.get("home")!.children.find((c) => c.id === "lbl_title");
    expect(label?.props.text).toBe("Changed");
    const node = addChildNode(loaded, "home", "home", "slider");
    expect(node.type).toBe("slider");
    expect(loaded.screens.get("home")!.children.some((c) => c.id === node.id)).toBe(true);
  });

  it("snaps alignment to neighbor", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-align-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "btn_next", { frame: { x: 22, y: 248 } });
    alignNodeToNeighbors(loaded, "home", "btn_next", 8);
    const btn = loaded.screens.get("home")!.children.find((c) => c.id === "btn_next");
    expect(btn?.frame.x).toBe(20);
  });

  it("updates project meta", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-meta-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    updateProjectMeta(loaded, {
      name: "renamed_ui",
      deliveryMode: "static_c",
      display: { width: 800 },
      sdk: { path: "C:/sdk/qm10xd" },
    });
    expect(loaded.project.name).toBe("renamed_ui");
    expect(loaded.project.deliveryMode).toBe("static_c");
    expect(loaded.project.display.width).toBe(800);
    expect(loaded.project.display.height).toBe(320);
    expect(loaded.screens.get("home")?.frame.w).toBe(800);
    expect(loaded.project.sdk?.path).toBe("C:/sdk/qm10xd");
  });

  it("merges style via styleKeys without clobbering other keys", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-style-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    const label = loaded.screens.get("home")!.children.find((c) => c.type === "label");
    expect(label).toBeTruthy();
    label!.style = { main: { default: { text_color: "#ffffffff", bg_color: "#000000ff" } } };
    updateNodeProps(loaded, "home", label!.id, {
      styleKeys: { part: "main", state: "default", props: { text_color: "#aabbccff" } },
    });
    const style = label!.style as { main: { default: { text_color: string; bg_color: string } } };
    expect(style.main.default.text_color).toBe("#aabbccff");
    expect(style.main.default.bg_color).toBe("#000000ff");
  });

  it("duplicates and reorders screens", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-page-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    const copy = duplicateScreen(loaded, "home");
    expect(copy.id).toBe("home_copy");
    expect(loaded.project.screens.map((s) => s.id)).toContain("home_copy");
    reorderScreen(loaded, "home_copy", "top");
    expect(loaded.project.screens[0]?.id).toBe("home_copy");
    setDefaultScreen(loaded, "home_copy");
    expect(loaded.project.defaultScreen).toBe("home_copy");
  });

  it("duplicates node, reorders and toggles flags", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-node-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    const dup = duplicateNode(loaded, "home", "lbl_title");
    expect(dup.id).not.toBe("lbl_title");
    const home = loaded.screens.get("home")!;
    const idx = home.children.findIndex((c) => c.id === dup.id);
    expect(idx).toBeGreaterThan(0);
    moveNodeOrder(loaded, "home", dup.id, "top");
    expect(home.children[0]?.id).toBe(dup.id);
    setNodeFlags(loaded, "home", "lbl_title", { hidden: true, locked: true });
    const label = home.children.find((c) => c.id === "lbl_title");
    expect(label?.hidden).toBe(true);
    expect(label?.locked).toBe(true);
  });
});
