import fs from "node:fs";
import path from "node:path";
import { openProject, summarizeScreenTree, type Node, type ScreenDocument } from "@forgeui/core";

export interface WasmPreviewIr {
  schemaVersion: 1;
  backend: "wasm-ir";
  display: { width: number; height: number; colorDepth: number };
  lvglVersion: string;
  defaultScreen: string;
  screens: Array<{ id: string; name: string; tree: object }>;
  generatedAt: string;
}

/** IR snapshot consumed by preview-shell.js (same semantic source as CodeGen). */
export function writePreviewIr(projectRoot: string, buildDir: string): WasmPreviewIr {
  const loaded = openProject(projectRoot);
  const screens = loaded.project.screens.map((ref) => {
    const screen = loaded.screens.get(ref.id)!;
    return { id: screen.id, name: screen.name, tree: summarizeScreenTree(screen) };
  });
  const ir: WasmPreviewIr = {
    schemaVersion: 1,
    backend: "wasm-ir",
    display: loaded.project.display,
    lvglVersion: loaded.project.lvglVersion,
    defaultScreen: loaded.project.defaultScreen,
    screens,
    generatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, "preview-ir.json"), `${JSON.stringify(ir, null, 2)}\n`, "utf8");
  return ir;
}

/**
 * FR-063: refresh preview-ir.json in an existing Wasm/IR session without full prepare.
 * Writes `hot-reload.stamp` so preview-shell.js can poll and re-render.
 */
export function hotReloadPreviewIr(projectRoot: string, buildDir?: string): {
  ok: boolean;
  buildDir: string;
  ir?: WasmPreviewIr;
  message: string;
} {
  const root = path.resolve(projectRoot);
  const dir = buildDir ? path.resolve(buildDir) : path.join(root, ".forge", "preview-wasm");
  if (!fs.existsSync(path.join(dir, "preview-shell.js")) && !fs.existsSync(path.join(dir, "index.html"))) {
    return {
      ok: false,
      buildDir: dir,
      message: "无常驻 Wasm IR 会话（请先「Wasm IR 预览」或 prepare）",
    };
  }
  const ir = writePreviewIr(root, dir);
  const stamp = { at: ir.generatedAt, screens: ir.screens.length };
  fs.writeFileSync(path.join(dir, "hot-reload.stamp"), `${JSON.stringify(stamp)}\n`, "utf8");
  return {
    ok: true,
    buildDir: dir,
    ir,
    message: `热替换 preview-ir.json（${ir.screens.length} 屏 · ${ir.generatedAt}）`,
  };
}

function countTreeNodes(tree: { childCount?: number; children?: unknown[] } | null | undefined): number {
  if (!tree) return 0;
  let n = 1;
  const kids = Array.isArray(tree.children) ? tree.children : [];
  for (const c of kids) n += countTreeNodes(c as { childCount?: number; children?: unknown[] });
  return n;
}

function countScreenNodes(screen: ScreenDocument): number {
  let n = 0;
  const walk = (node: Node) => {
    n += 1;
    for (const c of node.children) walk(c);
  };
  walk(screen);
  return n;
}

export interface DualRunReport {
  ok: boolean;
  irScreenIds: string[];
  projectScreenIds: string[];
  codegenScreenIds: string[];
  nodeCounts: Array<{ id: string; ir: number; project: number }>;
  mismatches: string[];
}

/** FR-065 / AC-008: compare Wasm IR preview screens with project model + CodeGen screen files. */
export function compareSdlWasmDualRun(projectRoot: string, irBuildDir: string): DualRunReport {
  const loaded = openProject(projectRoot);
  const irPath = path.join(irBuildDir, "preview-ir.json");
  const mismatches: string[] = [];
  if (!fs.existsSync(irPath)) {
    return {
      ok: false,
      irScreenIds: [],
      projectScreenIds: loaded.project.screens.map((s) => s.id),
      codegenScreenIds: [],
      nodeCounts: [],
      mismatches: [`missing preview-ir.json at ${irPath}`],
    };
  }
  const ir = JSON.parse(fs.readFileSync(irPath, "utf8")) as WasmPreviewIr;
  const irScreenIds = ir.screens.map((s) => s.id).sort();
  const projectScreenIds = loaded.project.screens.map((s) => s.id).sort();
  if (irScreenIds.join(",") !== projectScreenIds.join(",")) {
    mismatches.push(`screen ids IR≠project: ${irScreenIds.join("|")} vs ${projectScreenIds.join("|")}`);
  }
  if (ir.defaultScreen !== loaded.project.defaultScreen) {
    mismatches.push(`defaultScreen IR≠project: ${ir.defaultScreen} vs ${loaded.project.defaultScreen}`);
  }

  const screensDir = path.join(projectRoot, "forgeui_generated", "screens");
  const codegenScreenIds = fs.existsSync(screensDir)
    ? fs
        .readdirSync(screensDir)
        .filter((f) => /^screen_.+\.c$/.test(f))
        .map((f) => f.replace(/^screen_/, "").replace(/\.c$/, ""))
        .sort()
    : [];
  if (codegenScreenIds.length && codegenScreenIds.join(",") !== projectScreenIds.join(",")) {
    mismatches.push(
      `screen ids codegen≠project: ${codegenScreenIds.join("|")} vs ${projectScreenIds.join("|")}`,
    );
  }

  const nodeCounts: DualRunReport["nodeCounts"] = [];
  for (const ref of loaded.project.screens) {
    const screen = loaded.screens.get(ref.id);
    const irScreen = ir.screens.find((s) => s.id === ref.id);
    const projectCount = screen ? countScreenNodes(screen) : -1;
    const irCount = irScreen ? countTreeNodes(irScreen.tree as { children?: unknown[] }) : -1;
    nodeCounts.push({ id: ref.id, ir: irCount, project: projectCount });
    if (projectCount !== irCount) {
      mismatches.push(`node count ${ref.id}: ir=${irCount} project=${projectCount}`);
    }
  }

  return {
    ok: mismatches.length === 0,
    irScreenIds,
    projectScreenIds,
    codegenScreenIds,
    nodeCounts,
    mismatches,
  };
}
