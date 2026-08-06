#!/usr/bin/env node
import path from "node:path";
import { generate } from "@forgeui/codegen";
import { createProject, openProject, validateProjectDir } from "@forgeui/core";
import { createPreviewHost } from "@forgeui/preview-host";
import { exportToSdk } from "@forgeui/platforms";
import { packProject } from "@forgeui/packer";
import { bundleProject, unbundleProject } from "@forgeui/importers";
import { ErrorCodes } from "@forgeui/shared";

function printHelp(): void {
  console.log(`ForgeUI CLI

Usage:
  forgeui validate   <projectDir>
  forgeui generate   <projectDir> [--clean-generated] [--prune-orphans]
  forgeui preview    <projectDir> [--prepare-only] [--backend sdl|wasm]
  forgeui pack       <projectDir> [-o outDir]
  forgeui export-sdk <projectDir> [--sdk <path>] [--force]
  forgeui bundle     <projectDir> -o file.forgeui [--with-generated]
  forgeui unbundle   <file.forgeui> -o projectDir
  forgeui create     <projectDir> --name <name> [--template hello-dual-screen|blank]

Exit codes: 0 ok, 1 error, 2 usage / stub-not-ready
`);
}

function printDiagnostics(
  diagnostics: Array<{ level: string; code: string; message: string; path?: string }>,
): void {
  for (const d of diagnostics) {
    const loc = d.path ? ` (${d.path})` : "";
    console.error(`[${d.level}] ${d.code}: ${d.message}${loc}`);
  }
}

function flagValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "-h" || cmd === "--help") {
    printHelp();
    return cmd ? 0 : 2;
  }

  if (cmd === "validate") {
    const projectDir = rest[0];
    if (!projectDir) {
      console.error("validate requires <projectDir>");
      return 2;
    }
    const result = validateProjectDir(path.resolve(projectDir));
    printDiagnostics(result.diagnostics);
    if (result.ok) console.log("OK");
    return result.ok ? 0 : 1;
  }

  if (cmd === "generate") {
    const projectDir = rest.find((a) => !a.startsWith("--"));
    if (!projectDir) {
      console.error("generate requires <projectDir>");
      return 2;
    }
    const root = path.resolve(projectDir);
    const v = validateProjectDir(root);
    if (!v.ok) {
      printDiagnostics(v.diagnostics);
      return 1;
    }
    const cleanGenerated = rest.includes("--clean-generated");
    const pruneOrphans = rest.includes("--prune-orphans");
    const result = await generate(root, { cleanGenerated, pruneOrphans });
    printDiagnostics(result.diagnostics);
    if (result.ok) {
      const pruned = result.filesPruned?.length ?? 0;
      console.log(
        `Generated ${result.filesWritten.length} file(s), skipped ${result.filesSkipped.length}` +
          (pruneOrphans ? `, pruned ${pruned}` : ""),
      );
      return 0;
    }
    return 1;
  }

  if (cmd === "preview") {
    const projectDir = rest.find((a) => !a.startsWith("--"));
    if (!projectDir) {
      console.error("preview requires <projectDir>");
      return 2;
    }
    const prepareOnly = rest.includes("--prepare-only");
    const backend = flagValue(rest, "--backend") ?? "sdl";
    const host = createPreviewHost();
    try {
      const result = await host.run(path.resolve(projectDir), { backend, prepareOnly });
      printDiagnostics(result.diagnostics);
      if (result.ok) {
        console.log(`Preview OK (${backend}) buildDir=${result.session?.buildDir ?? ""}`);
        return 0;
      }
      return 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      if (msg.includes(ErrorCodes.E_PREVIEW_WASM_NOT_IMPL)) return 2;
      return 1;
    }
  }

  if (cmd === "pack") {
    const projectDir = rest.find((a) => !a.startsWith("-"));
    if (!projectDir) {
      console.error("pack requires <projectDir>");
      return 2;
    }
    const outDir = flagValue(rest, "-o");
    const result = await packProject(path.resolve(projectDir), { outDir: outDir ? path.resolve(outDir) : undefined });
    printDiagnostics(result.diagnostics);
    if (result.ok) {
      console.log(`Pack OK → ${result.outDir}`);
      return 0;
    }
    return 1;
  }

  if (cmd === "export-sdk") {
    const projectDir = rest.find((a) => !a.startsWith("--"));
    if (!projectDir) {
      console.error("export-sdk requires <projectDir>");
      return 2;
    }
    const sdkPath = flagValue(rest, "--sdk");
    const force = rest.includes("--force");
    await generate(path.resolve(projectDir));
    const result = await exportToSdk(path.resolve(projectDir), { sdkPath, force });
    printDiagnostics(result.diagnostics);
    if (result.ok) {
      console.log(`Exported to ${result.targetDir} (${result.copiedFiles.length} files)`);
      return 0;
    }
    return 1;
  }

  if (cmd === "bundle") {
    const projectDir = rest.find((a) => !a.startsWith("-"));
    const outFile = flagValue(rest, "-o");
    if (!projectDir || !outFile) {
      console.error("bundle requires <projectDir> -o file.forgeui");
      return 2;
    }
    const result = bundleProject(path.resolve(projectDir), path.resolve(outFile), {
      includeGenerated: rest.includes("--with-generated"),
    });
    printDiagnostics(result.diagnostics);
    return result.ok ? 0 : 1;
  }

  if (cmd === "unbundle") {
    const file = rest.find((a) => !a.startsWith("-"));
    const outDir = flagValue(rest, "-o");
    if (!file || !outDir) {
      console.error("unbundle requires <file.forgeui> -o projectDir");
      return 2;
    }
    const result = unbundleProject(path.resolve(file), path.resolve(outDir));
    printDiagnostics(result.diagnostics);
    return result.ok ? 0 : 1;
  }

  if (cmd === "create") {
    const projectDir = rest.find((a) => !a.startsWith("--"));
    if (!projectDir) {
      console.error("create requires <projectDir>");
      return 2;
    }
    const name = flagValue(rest, "--name") ?? path.basename(path.resolve(projectDir));
    const fromTemplate = (flagValue(rest, "--template") ?? "blank") as "blank" | "hello-dual-screen";
    createProject({
      root: path.resolve(projectDir),
      name,
      fromTemplate,
    });
    openProject(path.resolve(projectDir));
    console.log(`Created project at ${path.resolve(projectDir)}`);
    return 0;
  }

  console.error(`Unknown command: ${cmd}`);
  printHelp();
  return 2;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
