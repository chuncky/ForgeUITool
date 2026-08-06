import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProject } from "../packages/core/src/workspace";

const roots: string[] = [];
afterEach(() => { for (const r of roots) fs.rmSync(r, { recursive: true, force: true }); roots.length = 0; });

describe("createProject gitignore", () => {
  it("writes .gitignore for blank project", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-gi-"));
    roots.push(root);
    createProject({ root, name: "gi", fromTemplate: "blank" });
    const gi = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(gi).toContain(".forge/");
    expect(gi).toContain("preview-build/out");
  });
});
