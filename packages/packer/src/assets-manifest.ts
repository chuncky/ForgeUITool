import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export interface AssetManifestEntry {
  path: string;
  size: number;
  sha256: string;
}

export interface AssetsManifest {
  schemaVersion: "1.0.0";
  files: AssetManifestEntry[];
}

function walkFilesCollect(dir: string, base: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFilesCollect(abs, base, out);
    else if (entry.name !== "manifest.json") {
      out.push(path.relative(base, abs).replace(/\\/g, "/"));
    }
  }
}

export function buildAssetsManifest(assetsDir: string): AssetsManifest {
  const relPaths: string[] = [];
  walkFilesCollect(assetsDir, assetsDir, relPaths);
  const files: AssetManifestEntry[] = [];
  for (const rel of relPaths.sort()) {
    const abs = path.join(assetsDir, rel);
    const buf = fs.readFileSync(abs);
    files.push({
      path: rel,
      size: buf.length,
      sha256: createHash("sha256").update(buf).digest("hex"),
    });
  }
  return { schemaVersion: "1.0.0", files };
}

export function sha256File(absPath: string): string {
  return createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}
