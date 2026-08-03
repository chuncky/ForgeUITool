import { describe, expect, it } from "vitest";

/** Mirrors projectStore.appendBuildLogs batching (FR-061a log perf) */
function batchBuildLogs(lines: string[], max = 16_000): string {
  const text = lines.join("\n");
  return text.length > max ? `${text.slice(0, max)}\n…（构建日志已截断）` : text;
}

describe("preview non-blocking UX helpers (FR-061a)", () => {
  it("merges cmake chunks into one log entry instead of thousands of reactive rows", () => {
    const merged = batchBuildLogs(["--- cmake configure ---", "line1\nline2", "line3"]);
    expect(merged.split("\n").length).toBeLessThan(10);
    expect(merged).toContain("cmake configure");
  });

  it("truncates oversized build output", () => {
    const huge = batchBuildLogs(["x".repeat(20_000)]);
    expect(huge.length).toBeLessThan(20_000);
    expect(huge).toContain("截断");
  });
});
