import { describe, expect, it } from "vitest";
import { runProcessAsync } from "./process.js";

describe("runProcessAsync (FR-061a non-blocking preview build)", () => {
  it("runs a subprocess without blocking the event loop", async () => {
    const cmd = process.platform === "win32" ? "cmd" : "echo";
    const args = process.platform === "win32" ? ["/c", "echo", "forgeui-preview-ok"] : ["forgeui-preview-ok"];
    const result = await runProcessAsync(cmd, args);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("forgeui-preview-ok");
  });

  it("streams stdout lines via onLine as they arrive", async () => {
    const lines: string[] = [];
    const cmd = process.platform === "win32" ? "cmd" : "printf";
    const args =
      process.platform === "win32" ? ["/c", "echo line1& echo line2"] : ["line1\\nline2\\n"];
    await runProcessAsync(cmd, args, {
      onLine: (line) => lines.push(line),
    });
    expect(lines.some((l) => l.includes("line1"))).toBe(true);
    expect(lines.some((l) => l.includes("line2"))).toBe(true);
  });
});
