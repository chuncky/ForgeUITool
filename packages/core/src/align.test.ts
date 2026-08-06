import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { alignNodes, openProject, updateNodeProps } from "@forgeui/core";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const templateRoot = path.join(repoRoot, "templates/hello-dual-screen");

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === ".forge") continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

describe("alignNodes FR-013b", () => {
  it("aligns multiple nodes to shared left edge", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-align-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "lbl_title", { frame: { x: 40, y: 10, w: 100, h: 20 } });
    updateNodeProps(loaded, "home", "btn_next", { frame: { x: 80, y: 50, w: 60, h: 30 } });
    alignNodes(loaded, "home", ["lbl_title", "btn_next"], "left");
    const screen = loaded.screens.get("home")!;
    const a = screen.children.find((c) => c.id === "lbl_title")!;
    const b = screen.children.find((c) => c.id === "btn_next")!;
    expect(a.frame.x).toBe(b.frame.x);
    expect(a.frame.x).toBe(40);
  });

  it("aligns single node to screen center-h", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-align-s-"));
    copyDir(templateRoot, tmp);
    const loaded = openProject(tmp);
    updateNodeProps(loaded, "home", "btn_next", { frame: { x: 0, y: 0, w: 100, h: 40 } });
    alignNodes(loaded, "home", ["btn_next"], "center-h");
    const btn = loaded.screens.get("home")!.children.find((c) => c.id === "btn_next")!;
    expect(btn!.frame.x).toBe(Math.round((480 - 100) / 2));
  });
});
