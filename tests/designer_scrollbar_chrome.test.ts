/**
 * Designer scrollbar chrome (详设 §9.7.4 / Beken ocean-blue theme-scrollbar-*).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../apps/designer/src/styles.css",
);

describe("designer scrollbar chrome (V1.28)", () => {
  it("defines Beken-aligned thin scrollbar tokens and webkit rules", () => {
    const css = fs.readFileSync(stylesPath, "utf8");
    expect(css).toContain("--scrollbar-size: 6px");
    expect(css).toContain("--scrollbar-track");
    expect(css).toContain("--scrollbar-thumb: #7a8a9e");
    expect(css).toContain("--scrollbar-thumb-hover: #94a3b8");
    expect(css).toContain("::-webkit-scrollbar");
    expect(css).toContain("scrollbar-width: thin");
    expect(css).toContain("scrollbar-color:");
    expect(css).toMatch(/::-webkit-scrollbar-button\s*\{[^}]*display:\s*none/s);
  });
});
