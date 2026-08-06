import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_DELIVERY_MODE,
  DEFAULT_ENTRY_SYMBOL,
  DEFAULT_LVGL_VERSION,
  ForgeError,
  ErrorCodes,
} from "@forgeui/shared";
import type { LoadedProject, ProjectDocument, ScreenDocument } from "./types.js";
import { validateProjectDir } from "./validate.js";

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export interface CreateProjectOptions {
  root: string;
  name: string;
  platform?: ProjectDocument["platform"];
  display?: ProjectDocument["display"];
  fromTemplate?: "blank" | "hello-dual-screen";
  deliveryMode?: ProjectDocument["deliveryMode"];
}

export function openProject(projectRoot: string): LoadedProject {
  const root = path.resolve(projectRoot);
  const result = validateProjectDir(root);
  if (!result.ok) {
    const msg = result.diagnostics
      .filter((d) => d.level === "error")
      .map((d) => `${d.code}: ${d.message}`)
      .join("; ");
    throw new ForgeError(ErrorCodes.E_SCHEMA_001, msg || "Project validation failed");
  }

  const project = readJson<ProjectDocument>(path.join(root, "project.json"));
  const screens = new Map<string, ScreenDocument>();
  for (const ref of project.screens) {
    screens.set(ref.id, readJson<ScreenDocument>(path.join(root, ref.file)));
  }
  return { root, project, screens };
}

export function saveProject(loaded: LoadedProject): void {
  writeJson(path.join(loaded.root, "project.json"), loaded.project);
  for (const ref of loaded.project.screens) {
    const screen = loaded.screens.get(ref.id);
    if (!screen) {
      throw new ForgeError(ErrorCodes.E_SEM_001, `Missing screen data for ${ref.id}`);
    }
    writeJson(path.join(loaded.root, ref.file), screen);
  }
}

function resolveProjectGitignore(): string {
  const candidates = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../templates/project.gitignore"),
    path.resolve(process.cwd(), "templates/project.gitignore"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c, "utf8");
  }
  return [
    ".forge/",
    "**/preview-build/out/",
    "**/CMakeFiles/",
    "**/CMakeCache.txt",
    "build/",
    "out/",
    "*.obj",
    "*.pdb",
    "*.log",
    "",
  ].join("\n");
}

function writeProjectGitignore(root: string): void {
  const dest = path.join(root, ".gitignore");
  if (fs.existsSync(dest)) return;
  fs.writeFileSync(dest, resolveProjectGitignore(), "utf8");
}

function blankScreen(id: string, name: string, w: number, h: number): ScreenDocument {
  return {
    schemaVersion: "1.0.0",
    id,
    type: "screen",
    name,
    frame: { x: 0, y: 0, w, h },
    props: {},
    style: { main: { default: { bg_color: "#101820" } } },
    events: [],
    children: [],
  };
}

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

function resolveHelloTemplate(): string {
  const candidates = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../templates/hello-dual-screen"),
    path.resolve(process.cwd(), "templates/hello-dual-screen"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "project.json"))) return c;
  }
  throw new ForgeError(ErrorCodes.E_IO_001, "hello-dual-screen template not found");
}

export function createProject(opts: CreateProjectOptions): LoadedProject {
  const root = path.resolve(opts.root);
  if (fs.existsSync(path.join(root, "project.json"))) {
    throw new ForgeError(ErrorCodes.E_IO_001, `Project already exists at ${root}`);
  }

  const display = opts.display ?? { width: 480, height: 320, colorDepth: 16, rotation: 0 };

  fs.mkdirSync(path.join(root, "screens"), { recursive: true });
  fs.mkdirSync(path.join(root, "assets", "images"), { recursive: true });
  fs.mkdirSync(path.join(root, "assets", "fonts"), { recursive: true });
  fs.mkdirSync(path.join(root, "forgeui_generated", "custom"), { recursive: true });

  if (opts.fromTemplate === "hello-dual-screen") {
    const templateRoot = resolveHelloTemplate();
    copyDir(templateRoot, root);
    const project = readJson<ProjectDocument>(path.join(root, "project.json"));
    project.name = opts.name;
    // D-08: do not stamp a chip platform; strip legacy template field unless caller opts in
    if (opts.platform) project.platform = opts.platform;
    else delete project.platform;
    if (opts.display) project.display = opts.display;
    if (opts.deliveryMode) project.deliveryMode = opts.deliveryMode;
    writeJson(path.join(root, "project.json"), project);
    writeProjectGitignore(root);
    return openProject(root);
  }

  const home = blankScreen("home", "Home", display.width, display.height);
  const project: ProjectDocument = {
    schemaVersion: "1.0.0",
    name: opts.name,
    display,
    lvglVersion: DEFAULT_LVGL_VERSION,
    previewBackend: "sdl",
    deliveryMode: opts.deliveryMode ?? DEFAULT_DELIVERY_MODE,
    entrySymbol: DEFAULT_ENTRY_SYMBOL,
    defaultScreen: "home",
    screens: [{ id: "home", file: "screens/home.json" }],
    assets: { images: [], fonts: [] },
    export: {
      imageMode: "c_array",
      lvglInclude: "lvgl/lvgl.h",
      codegenDir: "forgeui_generated",
      customSubdir: "custom",
      packageDir: "packages/latest",
    },
    sdk: { path: "", copyTargetRel: "ui" },
    naming: { cPrefix: "ui_", screenPrefix: "screen_" },
  };
  if (opts.platform) project.platform = opts.platform;

  const loaded: LoadedProject = {
    root,
    project,
    screens: new Map([["home", home]]),
  };
  saveProject(loaded);
  writeProjectGitignore(root);
  return loaded;
}
