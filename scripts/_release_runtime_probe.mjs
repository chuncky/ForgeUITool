#!/usr/bin/env node
/**
 * Deeper smoke: packaged-path imports + open hello template + generate dry check.
 * Invoked as: ForgeUI.exe scripts/_release_runtime_probe.mjs  (ELECTRON_RUN_AS_NODE=1)
 * Or: node scripts/_release_runtime_probe.mjs <forgeui-root>
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const forgeRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd());

async function distImport(rel) {
  return import(pathToFileURL(path.join(forgeRoot, rel)).href);
}

const out = [];
function log(msg) {
  out.push(msg);
  console.log(msg);
}

try {
  log(`forgeRoot=${forgeRoot}`);
  if (!fs.existsSync(path.join(forgeRoot, "packages/core/dist/index.js"))) {
    throw new Error("core dist missing under forgeRoot");
  }

  const core = await distImport("packages/core/dist/index.js");
  const codegen = await distImport("packages/codegen/dist/index.js");
  const platforms = await distImport("packages/platforms/dist/index.js");
  const packer = await distImport("packages/packer/dist/index.js");
  const mcp = await distImport("packages/mcp/dist/index.js");

  log(`widgets=${core.listWidgetSpecs().length}`);
  log(`platforms=${platforms.listPlatformPlugins().map((p) => p.id).join(",")}`);
  log(`mcpTools=${mcp.MCP_TOOL_NAMES.length}`);

  const hello = path.join(forgeRoot, "templates/hello-dual-screen");
  if (!fs.existsSync(path.join(hello, "project.json"))) {
    throw new Error(`hello template missing: ${hello}`);
  }

  const tmp = path.join(forgeRoot, ".tmp-smoke-project");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.cpSync(hello, tmp, { recursive: true });

  const loaded = core.openProject(tmp);
  log(`openProject screens=${loaded.screens.size}`);

  const gen = await codegen.generate(tmp, { clean: true });
  if (!gen.ok) throw new Error(`generate failed: ${JSON.stringify(gen.diagnostics)}`);
  log(`generate filesWritten=${gen.filesWritten.length}`);

  const pack = await packer.packProject(tmp);
  log(`pack outDir=${pack?.outDir ?? "ok"}`);

  fs.rmSync(tmp, { recursive: true, force: true });
  log("RUNTIME_PROBE_OK");
  process.exit(0);
} catch (e) {
  console.error("RUNTIME_PROBE_FAIL", e);
  process.exit(1);
}
