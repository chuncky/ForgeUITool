/**
 * Renderer must not import @forgeui/core barrel (pulls validate/createRequire → vite build fails).
 * Contract: docs/软件详细设计/02-仓库与包结构.md V1.27
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const designerSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/designer/src");

/** Matches bare `@forgeui/core` but not `@forgeui/core/widgets` etc. */
const BARREL_RE = /(?:from\s+|import\s*\(\s*)["']@forgeui\/core["']/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|vue|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe("designer renderer core imports (V1.27)", () => {
  it("forbids @forgeui/core barrel under apps/designer/src", () => {
    const hits: string[] = [];
    for (const file of walk(designerSrc)) {
      const text = fs.readFileSync(file, "utf8");
      if (BARREL_RE.test(text)) {
        hits.push(path.relative(designerSrc, file).replace(/\\/g, "/"));
      }
    }
    expect(hits, `forbidden barrel imports:\n${hits.join("\n")}`).toEqual([]);
  });
});
