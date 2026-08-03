import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addChildNode,
  openProject,
  saveProject,
  updateNodeProps,
} from "../packages/core/src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..");

/** Mirrors apps/designer/electron/main.mjs project:save handler */
function mainSave(current: ReturnType<typeof openProject>) {
  if (!current) throw new Error("No project open");
  try {
    saveProject(current);
    return {
      ok: true as const,
      loaded: {
        root: current.root,
        project: current.project,
        screens: Object.fromEntries(current.screens.entries()),
      },
      canUndo: false,
      canRedo: false,
    };
  } catch (err) {
    return {
      ok: false as const,
      diagnostics: [
        {
          level: "error",
          code: "E_SAVE_001",
          message: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }
}

describe("designer save flow (Main-authoritative, FR-010)", () => {
  it("save after addChildNode persists widget; reopen matches disk", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-save-flow-"));
    fs.cpSync(path.join(repoRoot, "templates/hello-dual-screen"), tmp, { recursive: true });

    let current = openProject(tmp);
    const node = addChildNode(current, "home", "home", "button");
    updateNodeProps(current, "home", node.id, {
      frame: { x: 88, y: 120, w: 140, h: 44 },
      props: { text: "VerifySave" },
    });

    const result = mainSave(current);
    expect(result.ok).toBe(true);
    expect(result.loaded?.screens.home.children.some((c) => c.id === node.id)).toBe(true);

    const reopened = openProject(tmp);
    const btn = reopened.screens.get("home")!.children.find((c) => c.id === node.id);
    expect(btn).toBeTruthy();
    expect(btn!.frame).toMatchObject({ x: 88, y: 120, w: 140, h: 44 });
    expect(btn!.props.text).toBe("VerifySave");

    const homeRaw = JSON.parse(fs.readFileSync(path.join(tmp, "screens/home.json"), "utf8"));
    const rawBtn = homeRaw.children.find((c: { id: string }) => c.id === node.id);
    expect(rawBtn.props.text).toBe("VerifySave");
  });

  it("save does not require renderer payload (no hydrate overwrite)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-save-no-payload-"));
    fs.cpSync(path.join(repoRoot, "templates/hello-dual-screen"), tmp, { recursive: true });

    const current = openProject(tmp);
    const node = addChildNode(current, "home", "home", "label");
    node.props.text = "MainOnly";

    // Stale renderer snapshot without the new label
    const staleRenderer = {
      root: current.root,
      project: structuredClone(current.project),
      screens: Object.fromEntries(
        [...current.screens.entries()].map(([id, s]) => [id, structuredClone(s)]),
      ),
    };
    staleRenderer.screens.home.children = staleRenderer.screens.home.children.filter(
      (c) => c.id !== node.id,
    );

    // New save path: ignore stale payload, save Main current
    const result = mainSave(current);
    expect(result.ok).toBe(true);

    const reopened = openProject(tmp);
    expect(reopened.screens.get("home")!.children.some((c) => c.id === node.id)).toBe(true);
    expect(
      reopened.screens.get("home")!.children.find((c) => c.id === node.id)!.props.text,
    ).toBe("MainOnly");
  });
});
