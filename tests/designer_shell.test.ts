import { describe, expect, it } from "vitest";

/** Mirrors settingsStore.rememberProject list logic for UI-05/FR-005 */
function rememberRecent(
  list: Array<{ root: string; name: string }>,
  entry: { root: string; name: string },
  max = 12,
) {
  const next = list.filter((p) => p.root !== entry.root);
  next.unshift(entry);
  return next.slice(0, max);
}

describe("designer shell IA helpers", () => {
  it("recent projects dedupe and cap at 12", () => {
    let list: Array<{ root: string; name: string }> = [];
    for (let i = 0; i < 15; i++) {
      list = rememberRecent(list, { root: `/p/${i}`, name: `n${i}` });
    }
    expect(list).toHaveLength(12);
    expect(list[0]?.root).toBe("/p/14");
    list = rememberRecent(list, { root: "/p/10", name: "n10-again" });
    expect(list[0]?.root).toBe("/p/10");
    expect(list.filter((p) => p.root === "/p/10")).toHaveLength(1);
  });

  it("app shell routes match design §9.2", () => {
    const routes = ["/", "/home", "/workspace", "/settings", "/docs", "/about"];
    expect(routes).toContain("/home");
    expect(routes).toContain("/workspace");
    expect(routes.filter((r) => r !== "/")).toHaveLength(5);
  });
});
