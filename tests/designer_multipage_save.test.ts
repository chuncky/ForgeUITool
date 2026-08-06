import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  openProject,
  saveProject,
  updateNodeProps,
} from "../packages/core/src/index.js";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("multi-page save persistence (FR-011d)", () => {
  it("edits on home then settings both persist after single save", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-multipage-save-"));
    fs.cpSync(path.join(repoRoot, "templates/hello-dual-screen"), tmp, { recursive: true });

    const current = openProject(tmp);
    expect(current.screens.has("home")).toBe(true);
    expect(current.screens.has("settings")).toBe(true);

    // Simulate: edit page A, switch to B (memory only), edit B, then save once
    updateNodeProps(current, "home", "lbl_title", { props: { text: "HomeEdited" } });
    updateNodeProps(current, "settings", "lbl_settings", {
      props: { text: "SettingsEdited" },
    });

    saveProject(current);

    const reopened = openProject(tmp);
    expect(reopened.screens.get("home")!.children.find((c) => c.id === "lbl_title")!.props.text).toBe(
      "HomeEdited",
    );
    expect(
      reopened.screens.get("settings")!.children.find((c) => c.id === "lbl_settings")!.props.text,
    ).toBe("SettingsEdited");
  });

  it("designer flushes pending editor before switchScreen/save", () => {
    const store = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/stores/project.ts"),
      "utf8",
    );
    expect(store).toContain("flushPendingEditor");
    expect(store).toContain("enqueueMutation");
    expect(store).toMatch(/async function switchScreen[\s\S]*await flushPendingEditor/);
    expect(store).toMatch(/async function save\(\)[\s\S]*await flushPendingEditor/);
    // Mutations must pin screen/node ids before await (no race with switchScreen)
    expect(store).toMatch(/const sid = screenId\.value;\s*\n\s*const nid = selectedId\.value/);
  });

  it("EventPanel reloads draft on selection change only (not deep node watch)", () => {
    const panel = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/EventPanel.vue"),
      "utf8",
    );
    expect(panel).toContain("store.screenId");
    expect(panel).toContain("store.selectedId");
    expect(panel).not.toMatch(/watch\(\s*\(\)\s*=>\s*node\.value[\s\S]*deep:\s*true/);
  });
});
