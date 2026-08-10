#!/usr/bin/env node
/**
 * Smoke-test a packed ForgeUI release (win-unpacked).
 * Verifies: layout, runtime imports, MCP server boot, GUI process stays alive.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unpacked = path.join(root, "release", "win-unpacked");
const exe = path.join(unpacked, "ForgeUI.exe");
const forgeRoot = path.join(unpacked, "resources", "forgeui-root");
const asar = path.join(unpacked, "resources", "app.asar");

const results = [];
function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

function mustExist(label, p) {
  if (fs.existsSync(p)) ok(label, p);
  else fail(label, `missing: ${p}`);
}

async function testRuntimeImports() {
  const pkgs = [
    "packages/shared/dist/index.js",
    "packages/core/dist/index.js",
    "packages/codegen/dist/index.js",
    "packages/preview-host/dist/index.js",
    "packages/platforms/dist/index.js",
    "packages/packer/dist/index.js",
    "packages/loader/dist/index.js",
    "packages/importers/dist/index.js",
    "packages/mcp/dist/index.js",
  ];
  for (const rel of pkgs) {
    const full = path.join(forgeRoot, rel);
    try {
      const mod = await import(pathToFileURL(full).href);
      const keys = Object.keys(mod).slice(0, 5).join(",");
      ok(`import ${rel}`, keys || "(ok)");
    } catch (e) {
      fail(`import ${rel}`, e.message ?? String(e));
    }
  }

  try {
    const core = await import(pathToFileURL(path.join(forgeRoot, "packages/core/dist/index.js")).href);
    const specs = core.listWidgetSpecs?.() ?? [];
    if (specs.length > 10) ok("core.listWidgetSpecs", `${specs.length} widgets`);
    else fail("core.listWidgetSpecs", `only ${specs.length}`);
  } catch (e) {
    fail("core.listWidgetSpecs", e.message ?? String(e));
  }

  try {
    const codegen = await import(
      pathToFileURL(path.join(forgeRoot, "packages/codegen/dist/index.js")).href
    );
    if (typeof codegen.generate === "function") ok("codegen.generate export");
    else fail("codegen.generate export", "missing");
  } catch (e) {
    fail("codegen.generate export", e.message ?? String(e));
  }
}

function testMcpViaElectronAsNode() {
  const server = path.join(forgeRoot, "packages/mcp/dist/server-main.js");
  const child = spawn(exe, [server], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  return new Promise((resolve) => {
    let stderr = "";
    let settled = false;
    const done = (fn) => {
      if (settled) return;
      settled = true;
      fn();
      try {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } catch {
        /* ignore */
      }
      resolve();
    };

    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (e) => done(() => fail("mcp ELECTRON_RUN_AS_NODE", e.message)));

    // Give the server a moment to boot; silence is expected for stdio MCP.
    setTimeout(() => {
      if (child.exitCode != null && child.exitCode !== 0) {
        done(() =>
          fail("mcp ELECTRON_RUN_AS_NODE", `exit=${child.exitCode} ${stderr.slice(0, 400)}`),
        );
        return;
      }
      done(() => ok("mcp ELECTRON_RUN_AS_NODE", `pid=${child.pid} running`));
    }, 1200);
  });
}

function testRuntimeProbeViaElectronAsNode() {
  const probe = path.join(root, "scripts", "_release_runtime_probe.mjs");
  const r = spawnSync(exe, [probe, forgeRoot], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
  });
  const combined = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  if (r.status === 0 && combined.includes("RUNTIME_PROBE_OK")) {
    const summary = (r.stdout ?? "")
      .split("\n")
      .filter((l) => l && !l.startsWith("forgeRoot"))
      .slice(0, 6)
      .join("; ");
    ok("runtime probe (open/generate/pack)", summary);
  } else {
    fail(
      "runtime probe (open/generate/pack)",
      `status=${r.status}\n${combined.slice(0, 1000)}`,
    );
  }
}

function testGuiLaunch() {
  const logFile = path.join(root, ".tmp", "release-smoke-gui.log");
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  const child = spawn(exe, [], {
    cwd: unpacked,
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: "1",
      FORGEUI_DESIGNER_DEV: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
    detached: false,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => {
    stdout += d.toString();
  });
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      fn();
      try {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } catch {
        /* ignore */
      }
      fs.writeFileSync(logFile, `stdout:\n${stdout}\n\nstderr:\n${stderr}\n`, "utf8");
      resolve();
    };

    child.on("error", (e) => finish(() => fail("gui launch", e.message)));
    child.on("exit", (code, signal) => {
      if (settled) return;
      finish(() =>
        fail(
          "gui launch",
          `exited early code=${code} signal=${signal}\n${(stdout + stderr).slice(0, 800)}`,
        ),
      );
    });

    setTimeout(() => {
      if (child.exitCode != null || child.signalCode) return;
      // Detect main window via PowerShell
      let windowOk = false;
      let title = "";
      try {
        const ps = spawnSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            `$p = Get-Process -Id ${child.pid} -ErrorAction SilentlyContinue; if ($p -and $p.MainWindowHandle -ne 0) { $p.MainWindowTitle }`,
          ],
          { encoding: "utf8", windowsHide: true, timeout: 5000 },
        );
        title = (ps.stdout ?? "").trim();
        if (title && !/^Error$/i.test(title)) {
          windowOk = true;
          ok("gui main window", `title="${title}"`);
        } else {
          fail("gui main window", `title="${title || "(empty)"}"`);
        }
      } catch (e) {
        fail("gui main window", e.message ?? String(e));
      }

      const bootLog = path.join(unpacked, "forgeui-boot.log");
      if (fs.existsSync(bootLog)) {
        const boot = fs.readFileSync(bootLog, "utf8");
        if (/import FAILED|FAILED/i.test(boot)) fail("gui boot log", boot.slice(0, 500));
        else if (/main\.mjs imported OK/.test(boot)) ok("gui boot log", "main.mjs imported OK");
        else ok("gui boot log", "present");
      }

      const startupLog = path.join(unpacked, "resources", "startup.log");
      if (fs.existsSync(startupLog)) {
        const start = fs.readFileSync(startupLog, "utf8");
        if (/did-fail-load/.test(start)) fail("gui startup log", start.slice(0, 500));
        else if (/loadFile .* exists=true/.test(start) && /did-finish-load/.test(start)) {
          ok("gui production page", "loadFile + did-finish-load");
        } else if (/localhost:5173/.test(start)) {
          fail("gui production page", "loaded Vite dev URL in packaged build");
        } else {
          ok("gui startup log", "present");
        }
      }

      const fatal =
        /Cannot find module|ENOENT.*forgeui|UnhandledPromiseRejection|FATAL/i.test(
          `${stdout}\n${stderr}`,
        );
      if (fatal) {
        finish(() =>
          fail("gui launch", `alive but errors:\n${(stdout + stderr).slice(0, 800)}`),
        );
      } else if (windowOk || child.exitCode == null) {
        finish(() =>
          ok("gui launch", `alive 8s pid=${child.pid}${windowOk ? ` +window("${title}")` : ""}`),
        );
      }
    }, 8000);
  });
}

async function main() {
  console.log("=== ForgeUI release smoke test ===\n");
  mustExist("ForgeUI.exe", exe);
  mustExist("app.asar", asar);
  mustExist("forgeui-root", forgeRoot);
  mustExist("templates/sdl-sim", path.join(forgeRoot, "templates", "sdl-sim", "CMakeLists.txt"));
  mustExist("codegen templates", path.join(forgeRoot, "packages", "codegen", "templates", "c", "ui.c.hbs"));
  mustExist(
    "AI skill",
    path.join(forgeRoot, "resources", "ai-skill", "forgeui-lvgl-designer", "SKILL.md"),
  );

  await testRuntimeImports();
  testRuntimeProbeViaElectronAsNode();
  await testMcpViaElectronAsNode();
  await testGuiLaunch();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    console.error("Failed:");
    for (const f of failed) console.error(` - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
