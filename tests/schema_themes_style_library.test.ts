/**
 * Guardrail: project.themes schema must stay in sync with NamedStyleTheme,
 * and projects that use the style library must validate + generate.
 *
 * Regression for E_SCHEMA_001 after adding description/createdAt/widgetType
 * without updating schemas/project.schema.json.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "@forgeui/codegen";
import {
  addChildNode,
  createProject,
  openProject,
  saveProject,
  updateNodeProps,
  updateProjectMeta,
  validateProjectDir,
} from "@forgeui/core";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Must match `NamedStyleTheme` in packages/core/src/types.ts.
 * When adding a field to the type + saveStyleTheme, update this list AND
 * schemas/project.schema.json — this test will fail until both are aligned.
 */
const NAMED_STYLE_THEME_SCHEMA_KEYS = [
  "id",
  "name",
  "description",
  "createdAt",
  "widgetType",
  "part",
  "state",
  "props",
] as const;

const tmpRoots: string[] = [];

afterEach(() => {
  for (const r of tmpRoots) {
    fs.rmSync(r, { recursive: true, force: true });
  }
  tmpRoots.length = 0;
});

function freshProject(name: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `forgeui-${name}-`));
  tmpRoots.push(root);
  createProject({ root, name, fromTemplate: "blank" });
  return openProject(root);
}

function themesSchemaProperties(): Record<string, unknown> {
  const schema = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "schemas/project.schema.json"), "utf8"),
  ) as {
    properties: {
      themes: { items: { properties: Record<string, unknown>; additionalProperties?: boolean } };
    };
  };
  return schema.properties.themes.items.properties;
}

describe("schema ↔ NamedStyleTheme contract (style library)", () => {
  it("project.schema.json themes properties cover every NamedStyleTheme field", () => {
    const props = themesSchemaProperties();
    for (const key of NAMED_STYLE_THEME_SCHEMA_KEYS) {
      expect(props, `missing themes.items.properties.${key} — update schemas/project.schema.json`).toHaveProperty(
        key,
      );
    }
    // Keep closed object so typos still fail validation
    const schema = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "schemas/project.schema.json"), "utf8"),
    ) as { properties: { themes: { items: { additionalProperties?: boolean } } } };
    expect(schema.properties.themes.items.additionalProperties).toBe(false);
  });

  it("saveStyleTheme-shaped themes pass validateProjectDir (E_SCHEMA_001 regression)", () => {
    const loaded = freshProject("theme-schema");
    updateProjectMeta(loaded, {
      themes: [
        {
          id: "main_default",
          name: "main_default",
          description: "按钮测试",
          createdAt: "2026-08-05T09:45:20.804Z",
          widgetType: "button",
          part: "main",
          state: "default",
          props: { bg_color: "#2d75b9ff", radius: 5 },
        },
        {
          id: "pressed_only",
          name: "pressed",
          // optional fields omitted — still valid
          part: "main",
          state: "pressed",
          props: { bg_color: "#102a43ff" },
        },
      ],
    });
    saveProject(loaded);

    const result = validateProjectDir(loaded.root);
    const schemaErrors = result.diagnostics.filter((d) => d.code === "E_SCHEMA_001");
    expect(schemaErrors, schemaErrors.map((d) => `${d.path}: ${d.message}`).join("\n")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("validate + generate succeed with style library themes and styleRef", async () => {
    const loaded = freshProject("theme-gen");
    const sid = loaded.project.defaultScreen;
    const btn = addChildNode(loaded, sid, sid, "button");

    updateProjectMeta(loaded, {
      themes: [
        {
          id: "primary_btn",
          name: "Primary",
          description: "primary button",
          createdAt: new Date().toISOString(),
          widgetType: "button",
          part: "main",
          state: "default",
          props: { bg_color: "#aabb11ff", text_color: "#ffffffff", radius: 8 },
        },
      ],
    });
    updateNodeProps(loaded, sid, btn.id, {
      props: { text: "ThemeLibBtn" },
      styleKeys: {
        part: "main",
        state: "default",
        props: { bg_color: "#aabb11ff", text_color: "#ffffffff", radius: 8 },
      },
      styleRef: "primary_btn",
    });
    saveProject(loaded);

    const validation = validateProjectDir(loaded.root);
    expect(validation.ok, validation.diagnostics.map((d) => d.message).join("; ")).toBe(true);

    const gen = await generate(loaded.root);
    expect(gen.ok, (gen as { error?: string }).error ?? "generate failed").toBe(true);
    const screenC = fs.readFileSync(
      path.join(loaded.root, "forgeui_generated/screens/screen_home.c"),
      "utf8",
    );
    expect(screenC).toContain("ThemeLibBtn");
    expect(screenC).toContain("lv_button_create");
    expect(screenC).toContain("lv_obj_set_style_bg_color");
    expect(screenC).toContain("0xAABB11");
    expect(screenC).toContain("lv_obj_set_style_radius");
  });
});
