import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  Diagnostic,
  ErrorCodes,
  IDENTIFIER_RE,
  SUPPORTED_LVGL_VERSIONS,
  ValidateResult,
} from "@forgeui/shared";
import type { Action, Node, ProjectDocument, ScreenDocument } from "./types.js";
import { getWidgetSpec, isKnownWidgetType } from "./widgets.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Ajv2020 = require("ajv/dist/2020.js") as new (opts?: object) => {
  compile: (schema: object) => ((data: unknown) => boolean) & { errors?: Array<{ instancePath?: string; message?: string }> | null };
  addSchema: (schema: object, key?: string) => unknown;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const addFormats = require("ajv-formats") as (ajv: unknown) => unknown;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveSchemasDir(): string {
  const resourcesPath =
    typeof process === "object" && process && "resourcesPath" in process
      ? String((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? "")
      : "";
  const candidates = [
    path.resolve(__dirname, "../../../schemas"),
    path.resolve(process.cwd(), "schemas"),
    resourcesPath ? path.join(resourcesPath, "forgeui-root", "schemas") : "",
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "project.schema.json"))) return c;
  }
  throw new Error("Cannot locate schemas/ directory");
}

function loadJsonObject(file: string): object {
  return JSON.parse(fs.readFileSync(file, "utf8")) as object;
}

function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function schemaDiagnostics(
  prefix: string,
  errors: Array<{ instancePath?: string; message?: string; schemaPath?: string }> | null | undefined,
): Diagnostic[] {
  if (!errors?.length) return [];
  return errors.map((e) => ({
    level: "error" as const,
    code: ErrorCodes.E_SCHEMA_001,
    message: e.message ?? "schema validation failed",
    path: `${prefix}${e.instancePath || ""}`,
  }));
}

function walkNodes(node: Node, visit: (n: Node, trail: string) => void, trail = ""): void {
  const here = trail ? `${trail}/${node.id}` : node.id;
  visit(node, here);
  for (const child of node.children ?? []) {
    walkNodes(child, visit, here);
  }
}

function validateActions(
  actions: Action[],
  screenIds: Set<string>,
  pathPrefix: string,
  diagnostics: Diagnostic[],
): void {
  for (const [i, action] of actions.entries()) {
    const p = `${pathPrefix}/actions/${i}`;
    if (action.type === "CHANGE_SCREEN") {
      if (!action.target || !screenIds.has(action.target)) {
        diagnostics.push({
          level: "error",
          code: ErrorCodes.E_SEM_001,
          message: `CHANGE_SCREEN target "${action.target}" not found`,
          path: `${p}/target`,
        });
      }
    } else if (action.type === "CALL_FUNCTION") {
      if (!action.handler || !IDENTIFIER_RE.test(action.handler)) {
        diagnostics.push({
          level: "error",
          code: ErrorCodes.E_SEM_001,
          message: `CALL_FUNCTION handler must be a C identifier`,
          path: `${p}/handler`,
        });
      }
    } else if (action.type === "SET_PROP") {
      if (!action.nodeId || !action.prop) {
        diagnostics.push({
          level: "error",
          code: ErrorCodes.E_SEM_001,
          message: `SET_PROP requires nodeId and prop`,
          path: p,
        });
      }
    }
  }
}

export function validateProjectDir(projectRoot: string): ValidateResult {
  const diagnostics: Diagnostic[] = [];
  const root = path.resolve(projectRoot);
  const projectPath = path.join(root, "project.json");

  if (!fs.existsSync(projectPath)) {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_IO_001,
          message: `project.json not found in ${root}`,
          path: projectPath,
        },
      ],
    };
  }

  let projectRaw: unknown;
  try {
    projectRaw = JSON.parse(fs.readFileSync(projectPath, "utf8"));
  } catch (e) {
    return {
      ok: false,
      diagnostics: [
        {
          level: "error",
          code: ErrorCodes.E_IO_001,
          message: `Failed to parse project.json: ${(e as Error).message}`,
          path: projectPath,
        },
      ],
    };
  }

  const schemasDir = resolveSchemasDir();
  const ajv = createAjv();
  const projectSchema = loadJsonObject(path.join(schemasDir, "project.schema.json"));
  const screenSchema = loadJsonObject(path.join(schemasDir, "screen.schema.json"));
  ajv.addSchema(screenSchema);
  const validateProject = ajv.compile(projectSchema);
  const validateScreen = ajv.compile(screenSchema);

  if (!validateProject(projectRaw)) {
    diagnostics.push(...schemaDiagnostics("project.json", validateProject.errors));
  }

  const project = projectRaw as ProjectDocument;

  if (project.lvglVersion && !SUPPORTED_LVGL_VERSIONS.includes(project.lvglVersion as "9.10")) {
    diagnostics.push({
      level: "error",
      code: ErrorCodes.E_VER_001,
      message: `lvglVersion "${project.lvglVersion}" is not in supported whitelist [${SUPPORTED_LVGL_VERSIONS.join(", ")}]`,
      path: "project.json/lvglVersion",
    });
  }

  const screenIds = new Set((project.screens ?? []).map((s) => s.id));
  if (project.defaultScreen && !screenIds.has(project.defaultScreen)) {
    diagnostics.push({
      level: "error",
      code: ErrorCodes.E_SEM_001,
      message: `defaultScreen "${project.defaultScreen}" not listed in screens`,
      path: "project.json/defaultScreen",
    });
  }

  const seenScreenIds = new Set<string>();
  for (const ref of project.screens ?? []) {
    if (seenScreenIds.has(ref.id)) {
      diagnostics.push({
        level: "error",
        code: ErrorCodes.E_SEM_001,
        message: `Duplicate screen id "${ref.id}"`,
        path: `project.json/screens`,
      });
    }
    seenScreenIds.add(ref.id);

    const screenFile = path.join(root, ref.file);
    if (!fs.existsSync(screenFile)) {
      diagnostics.push({
        level: "error",
        code: ErrorCodes.E_IO_001,
        message: `Screen file missing: ${ref.file}`,
        path: ref.file,
      });
      continue;
    }

    let screenRaw: unknown;
    try {
      screenRaw = JSON.parse(fs.readFileSync(screenFile, "utf8"));
    } catch (e) {
      diagnostics.push({
        level: "error",
        code: ErrorCodes.E_IO_001,
        message: `Failed to parse ${ref.file}: ${(e as Error).message}`,
        path: ref.file,
      });
      continue;
    }

    if (!validateScreen(screenRaw)) {
      diagnostics.push(...schemaDiagnostics(ref.file, validateScreen.errors));
      continue;
    }

    const screen = screenRaw as ScreenDocument;
    if (screen.id !== ref.id) {
      diagnostics.push({
        level: "error",
        code: ErrorCodes.E_SEM_001,
        message: `Screen file id "${screen.id}" does not match project ref "${ref.id}"`,
        path: ref.file,
      });
    }

    const nodeIds = new Set<string>();
    walkNodes(screen, (node, trail) => {
      if (node.type !== "screen" && !isKnownWidgetType(node.type)) {
        diagnostics.push({
          level: "error",
          code: ErrorCodes.E_SEM_001,
          message: `Unknown widget type "${node.type}"`,
          path: `${ref.file}#${trail}`,
        });
      }

      if (nodeIds.has(node.id)) {
        diagnostics.push({
          level: "error",
          code: ErrorCodes.E_SEM_001,
          message: `Duplicate node id "${node.id}" in screen ${ref.id}`,
          path: `${ref.file}#${trail}`,
        });
      }
      nodeIds.add(node.id);

      const spec = getWidgetSpec(node.type);
      if (spec && !spec.isContainer && (node.children?.length ?? 0) > 0) {
        diagnostics.push({
          level: "error",
          code: ErrorCodes.E_SEM_001,
          message: `Widget type "${node.type}" cannot have children`,
          path: `${ref.file}#${trail}`,
        });
      }

      for (const [ei, ev] of (node.events ?? []).entries()) {
        if (spec && spec.events.length && !spec.events.includes(ev.trigger) && node.type !== "screen") {
          diagnostics.push({
            level: "warning",
            code: ErrorCodes.E_SEM_001,
            message: `Trigger ${ev.trigger} is unusual for ${node.type}`,
            path: `${ref.file}#${trail}/events/${ei}`,
          });
        }
        validateActions(ev.actions, screenIds, `${ref.file}#${trail}/events/${ei}`, diagnostics);
      }
    });
  }

  const ok = !diagnostics.some((d) => d.level === "error");
  return { ok, diagnostics };
}
