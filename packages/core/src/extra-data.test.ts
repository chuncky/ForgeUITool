import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addChildNode, createProject, openProject, updateNodeProps } from "./index.js";

describe("extraData (FR-016b)", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const r of roots) {
      fs.rmSync(r, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  it("initializes default extraData for list widget", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-ed-"));
    roots.push(root);
    createProject({ root, name: "ed", platform: "qm10xd" });
    const loaded = openProject(root);
    const sid = loaded.project.defaultScreen;
    const node = addChildNode(loaded, sid, sid, "list");
    expect(node.extraData?.items).toBeDefined();
    expect(Array.isArray(node.extraData?.items)).toBe(true);
  });

  it("merges extraData patches on updateNodeProps", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-ed2-"));
    roots.push(root);
    createProject({ root, name: "ed2", platform: "qm10xd" });
    const loaded = openProject(root);
    const sid = loaded.project.defaultScreen;
    const node = addChildNode(loaded, sid, sid, "list");
    updateNodeProps(loaded, sid, node.id, {
      extraData: { items: [{ text: "A" }, { text: "B" }] },
    });
    expect((node.extraData?.items as unknown[])?.length).toBe(2);
  });

  it("initializes chart series extraData", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-ed3-"));
    roots.push(root);
    createProject({ root, name: "ed3", platform: "qm10xd" });
    const loaded = openProject(root);
    const sid = loaded.project.defaultScreen;
    const node = addChildNode(loaded, sid, sid, "linechart");
    const series = node.extraData?.series as Array<{ name: string; values: number[] }>;
    expect(Array.isArray(series)).toBe(true);
    expect(series.length).toBeGreaterThan(0);
    expect(series[0]?.values.length).toBeGreaterThan(0);
  });

  it("initializes table cells extraData", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-ed4-"));
    roots.push(root);
    createProject({ root, name: "ed4", platform: "qm10xd" });
    const loaded = openProject(root);
    const sid = loaded.project.defaultScreen;
    const node = addChildNode(loaded, sid, sid, "table");
    const cells = node.extraData?.cells as string[][];
    expect(Array.isArray(cells)).toBe(true);
    expect(cells.length).toBe(3);
    expect(cells[0]?.length).toBe(2);
  });

  it("initializes keyboard keymap extraData", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-ed5-"));
    roots.push(root);
    createProject({ root, name: "ed5", platform: "qm10xd" });
    const loaded = openProject(root);
    const sid = loaded.project.defaultScreen;
    const node = addChildNode(loaded, sid, sid, "keyboard");
    const rows = node.extraData?.rows as string[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("initializes animimg frames extraData", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-ed6-"));
    roots.push(root);
    createProject({ root, name: "ed6", platform: "qm10xd" });
    const loaded = openProject(root);
    const sid = loaded.project.defaultScreen;
    const node = addChildNode(loaded, sid, sid, "animimg");
    const frames = node.extraData?.frames as Array<{ src: string }>;
    expect(Array.isArray(frames)).toBe(true);
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[0]?.src).toContain("assets/");
  });
});
