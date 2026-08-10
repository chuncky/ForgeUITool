import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildMcpConfigSnippet,
  ensureForgeAiWorkspace,
  isForgeAiWorkspaceReady,
} from "../apps/designer/electron/ai-workspace.mjs";
import {
  detectAiHosts,
  getCursorEnvStatus,
  getHostEnvStatus,
  installCursorMcp,
  installCursorSkill,
  installHostEnv,
  resolveCursorExecutable,
  resolveHostExecutable,
  setAiToolsUserDataPath,
  setCustomAiToolPath,
  skillSourcePath,
  uninstallCursorEnv,
  uninstallHostEnv,
} from "../apps/designer/electron/ai-hosts.mjs";
import { sameAiWorkspacePath } from "../apps/designer/electron/bridge.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("AI design panel (V1.31/V1.32/detect-fix)", () => {
  const tmpDirs: string[] = [];
  afterEach(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
    tmpDirs.length = 0;
    setAiToolsUserDataPath("");
  });

  it("ensureForgeAiWorkspace writes workspace.json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-aiws-"));
    tmpDirs.push(tmp);
    const aiDir = ensureForgeAiWorkspace(tmp, { bridgePort: 39201 });
    expect(aiDir).toContain(".forge-ai");
    expect(isForgeAiWorkspaceReady(tmp)).toBe(true);
  });

  it("buildMcpConfigSnippet references server-main.js", () => {
    const cfg = buildMcpConfigSnippet(repoRoot);
    expect(cfg.mcpServers.forgeui_designer.args[0]).toContain("server-main.js");
    // Absolute node path so TRAE/Cursor GUI can spawn without PATH
    expect(cfg.mcpServers.forgeui_designer.command).not.toBe("node");
    expect(String(cfg.mcpServers.forgeui_designer.command).toLowerCase()).toMatch(/node/);
  });

  it("SettingsAiPanel matches BK layout (MCP status + editor tabs)", () => {
    const vue = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/SettingsAiPanel.vue"),
      "utf8",
    );
    expect(vue).toContain("MCP服务状态");
    expect(vue).toContain("AI 编辑器");
    expect(vue).toContain("手动配置 MCP");
    expect(vue).toContain("安装/更新 MCP + Skill");
    expect(vue).toContain("卸载 MCP + Skill");
    expect(vue).toContain("自定义");
    expect(vue).toContain("pickAiCustomPath");
    expect(vue).toContain("refreshService");
    expect(vue).toContain("刷新中");
    expect(vue).toContain("上次刷新");
    expect(vue).toContain("mcpServiceLabel");
    expect(vue).toContain("installVersionHint");
    expect(vue).not.toContain("aiDesignEnabled");
    expect(vue).not.toContain("启用 AI");
  });

  it("mcpServiceLabel only treats READY as running", async () => {
    const { mcpServiceLabel } = await import("../apps/designer/src/utils/mcp-service-status.ts");
    expect(mcpServiceLabel({ status: "READY", ok: true }).kind).toBe("running");
    expect(mcpServiceLabel({ status: "NOT_IN_WORKSPACE", ok: true }).kind).toBe("not_ready");
    expect(mcpServiceLabel({ ok: false, error: "down" }).kind).toBe("offline");
    expect(mcpServiceLabel(null).kind).toBe("offline");
    // Must not treat projectOpen-style heuristics — no status means offline
    expect(mcpServiceLabel({}).kind).toBe("offline");
  });

  it("toolbar AI menu always seeds four hosts (never empty before detect)", async () => {
    const toolbar = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/WorkspaceToolbar.vue"),
      "utf8",
    );
    expect(toolbar).toContain("toggleAiMenu");
    expect(toolbar).toContain("launchAiHost");
    expect(toolbar).toContain("mergeAiHostDetection");
    expect(toolbar).not.toContain("aiDesignEnabled");
    const { mergeAiHostDetection, STATIC_AI_HOSTS } = await import(
      "../apps/designer/src/utils/ai-hosts-menu.ts"
    );
    expect(STATIC_AI_HOSTS.map((h) => h.id)).toEqual(["cursor", "codex", "trae", "trae-cn"]);
    const empty = mergeAiHostDetection(null);
    expect(empty).toHaveLength(4);
    expect(empty.every((h) => h.installed === false)).toBe(true);
    const merged = mergeAiHostDetection([
      { id: "cursor", installed: true, exePath: "C:\\Cursor.exe" },
    ]);
    expect(merged).toHaveLength(4);
    expect(merged[0].installed).toBe(true);
    expect(merged[0].exePath).toBe("C:\\Cursor.exe");
    expect(merged[1].installed).toBe(false);
  });

  it("SettingsAiPanel keeps editor shell visible while detecting", () => {
    const vue = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/SettingsAiPanel.vue"),
      "utf8",
    );
    expect(vue).toContain("Always show shell");
    expect(vue).not.toMatch(/v-if="loading && !state"/);
    expect(vue).toContain("检测中");
  });

  it("electron exposes ai host IPC without setEnabled gate", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const preload = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/preload.cjs"), "utf8");
    expect(main).toContain('"ai:launchHost"');
    expect(main).toContain('"ai:installEnv"');
    expect(main).toContain('"ai:uninstallEnv"');
    expect(main).toContain('"ai:setCustomPath"');
    expect(main).toContain('"ai:pickCustomPath"');
    expect(main).not.toContain("AI_DISABLED");
    expect(main).not.toContain('"ai:setEnabled"');
    expect(preload).toContain("launchAiHost");
    expect(preload).toContain("pickAiCustomPath");
    expect(preload).not.toContain("setAiDesignEnabled");
  });

  it("ships forgeui skill package", () => {
    const skill = path.join(repoRoot, "resources/ai-skill/forgeui-lvgl-designer/SKILL.md");
    expect(fs.existsSync(skill)).toBe(true);
  });

  it("pack-release stages AI skill into forgeui-root", () => {
    const pack = fs.readFileSync(path.join(repoRoot, "scripts/pack-release.mjs"), "utf8");
    expect(pack).toContain('path.join(root, "resources", "ai-skill")');
    expect(pack).toContain("stage AI skill");
  });

  it("installCursorMcp merges without wiping other servers", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-home-"));
    tmpDirs.push(home);
    const prevHome = process.env.USERPROFILE;
    const prevHomeUnix = process.env.HOME;
    process.env.USERPROFILE = home;
    process.env.HOME = home;
    try {
      const cursorDir = path.join(home, ".cursor");
      fs.mkdirSync(cursorDir, { recursive: true });
      fs.writeFileSync(
        path.join(cursorDir, "mcp.json"),
        JSON.stringify({ mcpServers: { other: { command: "x" } } }, null, 2),
      );
      const r = installCursorMcp(repoRoot, 39201, { appVersion: "9.9.9" });
      expect(r.ok).toBe(true);
      const cfg = JSON.parse(fs.readFileSync(path.join(cursorDir, "mcp.json"), "utf8"));
      expect(cfg.mcpServers.other.command).toBe("x");
      expect(cfg.mcpServers.forgeui_designer).toBeTruthy();
      expect(cfg.mcpServers.forgeui_designer.appVersion).toBe("9.9.9");
      const envOk = getHostEnvStatus("cursor", { appVersion: "9.9.9" });
      expect(envOk.mcpStatus).toBe("ok");
      expect(envOk.mcpAppVersion).toBe("9.9.9");
      const envOld = getHostEnvStatus("cursor", { appVersion: "1.0.0" });
      expect(envOld.mcpStatus).toBe("outdated");
    } finally {
      if (prevHome !== undefined) process.env.USERPROFILE = prevHome;
      else delete process.env.USERPROFILE;
      if (prevHomeUnix !== undefined) process.env.HOME = prevHomeUnix;
      else delete process.env.HOME;
    }
  });

  it("installCursorSkill copies SKILL.md and uninstall removes it", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-skill-"));
    tmpDirs.push(home);
    const prevHome = process.env.USERPROFILE;
    const prevHomeUnix = process.env.HOME;
    process.env.USERPROFILE = home;
    process.env.HOME = home;
    try {
      expect(fs.existsSync(path.join(skillSourcePath(repoRoot), "SKILL.md"))).toBe(true);
      const r = installCursorSkill(repoRoot, { appVersion: "2.0.3" });
      expect(r.ok).toBe(true);
      const env = getCursorEnvStatus(repoRoot, { appVersion: "2.0.3" });
      expect(env.skillInstalled).toBe(true);
      expect(env.skillStatus).toBe("ok");
      expect(env.skillAppVersion).toBe("2.0.3");
      expect(fs.existsSync(path.join(path.dirname(env.skillPath), "manifest.json"))).toBe(true);
      expect(getCursorEnvStatus(repoRoot, { appVersion: "9.0.0" }).skillStatus).toBe("outdated");
      const u = uninstallCursorEnv();
      expect(u.ok).toBe(true);
      expect(getCursorEnvStatus(repoRoot).skillInstalled).toBe(false);
    } finally {
      if (prevHome !== undefined) process.env.USERPROFILE = prevHome;
      else delete process.env.USERPROFILE;
      if (prevHomeUnix !== undefined) process.env.HOME = prevHomeUnix;
      else delete process.env.HOME;
    }
  });

  it("detectAiHosts returns four entries with launchSupported", async () => {
    const hosts = await detectAiHosts();
    expect(hosts.map((h) => h.id)).toEqual(["cursor", "codex", "trae", "trae-cn"]);
    expect(hosts.every((h) => h.launchSupported === true)).toBe(true);
  });

  it("custom Cursor path marks installed even outside known dirs", async () => {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-ud-"));
    const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-cursor-"));
    tmpDirs.push(ud, fakeRoot);
    const fakeExe = path.join(fakeRoot, "Cursor.exe");
    fs.writeFileSync(fakeExe, "");
    setAiToolsUserDataPath(ud);
    const set = setCustomAiToolPath("cursor", fakeExe);
    expect(set.ok).toBe(true);
    const resolved = await resolveCursorExecutable();
    expect(resolved.installed).toBe(true);
    expect(resolved.method).toBe("custom");
    expect(path.normalize(resolved.exe!)).toBe(path.normalize(fakeExe));
    const hosts = await detectAiHosts();
    const cursor = hosts.find((h) => h.id === "cursor");
    expect(cursor?.installed).toBe(true);
  });

  it("custom Codex/TRAE paths mark installed via resolveHostExecutable", async () => {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-ud2-"));
    const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-hosts-"));
    tmpDirs.push(ud, fakeRoot);
    setAiToolsUserDataPath(ud);
    for (const [id, name] of [
      ["codex", "Codex.exe"],
      ["trae", "Trae.exe"],
      ["trae-cn", "Trae CN.exe"],
    ] as const) {
      const exe = path.join(fakeRoot, name);
      fs.writeFileSync(exe, "");
      expect(setCustomAiToolPath(id, exe).ok).toBe(true);
      const resolved = await resolveHostExecutable(id);
      expect(resolved.installed, id).toBe(true);
      expect(resolved.method, id).toBe("custom");
    }
    const hosts = await detectAiHosts();
    expect(hosts.filter((h) => h.id !== "cursor").every((h) => h.installed)).toBe(true);
  });

  it("bare AppData Trae CN folder without exe is not a launchable path", async () => {
    const { resolveExistingHostPath, clearAiHostDetectCaches } = await import(
      "../apps/designer/electron/ai-hosts.mjs"
    );
    clearAiHostDetectCaches();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-home-trae-"));
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-ud-trae-"));
    tmpDirs.push(home, ud);
    setAiToolsUserDataPath(ud);
    const prevAppData = process.env.APPDATA;
    const prevLocal = process.env.LOCALAPPDATA;
    const prevPath = process.env.PATH;
    try {
      process.env.APPDATA = path.join(home, "AppData", "Roaming");
      process.env.LOCALAPPDATA = path.join(home, "AppData", "Local");
      process.env.PATH = path.join(home, "empty-bin");
      fs.mkdirSync(path.join(home, "empty-bin"), { recursive: true });
      const roamingTrae = path.join(process.env.APPDATA, "Trae CN");
      fs.mkdirSync(path.join(roamingTrae, "Cache"), { recursive: true });
      fs.mkdirSync(path.join(roamingTrae, "User"), { recursive: true });
      expect(resolveExistingHostPath(roamingTrae, "trae-cn")).toBeNull();

      const exe = path.join(process.env.LOCALAPPDATA, "Programs", "Trae CN", "Trae CN.exe");
      fs.mkdirSync(path.dirname(exe), { recursive: true });
      fs.writeFileSync(exe, "");
      expect(resolveExistingHostPath(path.dirname(exe), "trae-cn")).toBe(exe);
      // known-path hit (may still also resolve via real Uninstall on developer machines)
      const hit = await resolveHostExecutable("trae-cn");
      expect(hit.installed).toBe(true);
      expect(hit.exe).toBeTruthy();
    } finally {
      if (prevAppData !== undefined) process.env.APPDATA = prevAppData;
      else delete process.env.APPDATA;
      if (prevLocal !== undefined) process.env.LOCALAPPDATA = prevLocal;
      else delete process.env.LOCALAPPDATA;
      if (prevPath !== undefined) process.env.PATH = prevPath;
      else delete process.env.PATH;
      clearAiHostDetectCaches();
    }
  });

  it("Uninstall DisplayName matching distinguishes Trae CN from Solo/Work", async () => {
    const { matchUninstallDisplayName, expandRegRoot } = await import(
      "../apps/designer/electron/ai-hosts.mjs"
    );
    expect(matchUninstallDisplayName("trae-cn", "Trae CN (User)")).toBe(true);
    expect(matchUninstallDisplayName("trae-cn", "TRAE SOLO CN")).toBe(false);
    expect(matchUninstallDisplayName("trae-cn", "TRAE Work CN (User)")).toBe(false);
    expect(matchUninstallDisplayName("trae", "Trae")).toBe(true);
    expect(matchUninstallDisplayName("trae", "Trae CN (User)")).toBe(false);
    expect(matchUninstallDisplayName("trae", "TRAE Work CN (User)")).toBe(false);
    expect(matchUninstallDisplayName("trae", "TRAE SOLO CN")).toBe(false);
    expect(matchUninstallDisplayName("cursor", "Cursor")).toBe(true);
    expect(matchUninstallDisplayName("cursor", "Cursor Updater")).toBe(false);
    expect(expandRegRoot("HKCU\\Software\\x")).toBe("HKEY_CURRENT_USER\\Software\\x");
    expect(expandRegRoot("HKLM\\Software\\x")).toBe("HKEY_LOCAL_MACHINE\\Software\\x");
  });

  it("installHostEnv writes Codex toml and TRAE mcp.json", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "forgeui-multi-env-"));
    tmpDirs.push(home);
    const prevHome = process.env.USERPROFILE;
    const prevHomeUnix = process.env.HOME;
    const prevAppData = process.env.APPDATA;
    process.env.USERPROFILE = home;
    process.env.HOME = home;
    process.env.APPDATA = path.join(home, "AppData", "Roaming");
    try {
      const codex = installHostEnv("codex", repoRoot, 39201, { appVersion: "0.1.0" });
      expect(codex.ok).toBe(true);
      const toml = fs.readFileSync(path.join(home, ".codex", "config.toml"), "utf8");
      expect(toml).toContain("[mcp_servers.forgeui_designer]");
      expect(toml).toContain('app_version = "0.1.0"');
      expect(getHostEnvStatus("codex", { appVersion: "0.1.0" }).mcpInstalled).toBe(true);
      expect(getHostEnvStatus("codex", { appVersion: "0.1.0" }).mcpStatus).toBe("ok");
      expect(getHostEnvStatus("codex", { appVersion: "0.1.0" }).skillInstalled).toBe(true);

      const trae = installHostEnv("trae", repoRoot, 39201);
      expect(trae.ok).toBe(true);
      const mcp = JSON.parse(
        fs.readFileSync(path.join(home, "AppData", "Roaming", "Trae", "User", "mcp.json"), "utf8"),
      );
      expect(mcp.mcpServers.forgeui_designer).toBeTruthy();
      expect(fs.existsSync(path.join(home, ".trae", "skills", "forgeui-lvgl-designer", "SKILL.md"))).toBe(
        true,
      );

      const u = uninstallHostEnv("codex");
      expect(u.ok).toBe(true);
      expect(getHostEnvStatus("codex").mcpInstalled).toBe(false);
    } finally {
      if (prevHome !== undefined) process.env.USERPROFILE = prevHome;
      else delete process.env.USERPROFILE;
      if (prevHomeUnix !== undefined) process.env.HOME = prevHomeUnix;
      else delete process.env.HOME;
      if (prevAppData !== undefined) process.env.APPDATA = prevAppData;
      else delete process.env.APPDATA;
    }
  });

  it("main/settings no longer gate non-Cursor install or launch", () => {
    const main = fs.readFileSync(path.join(repoRoot, "apps/designer/electron/main.mjs"), "utf8");
    const settings = fs.readFileSync(
      path.join(repoRoot, "apps/designer/src/components/SettingsAiPanel.vue"),
      "utf8",
    );
    expect(main).not.toContain("本轮仅支持自动安装 Cursor");
    expect(main).not.toContain("Codex/TRAE 本轮请在设置中");
    expect(settings).not.toContain("本轮仅支持 Cursor");
    expect(settings).toContain("用当前编辑器打开工作区");
  });

  it("sameAiWorkspacePath normalizes slash and case on win32", () => {
    const a = "E:\\project\\demo\\.forge-ai";
    const b = "e:/project/demo/.forge-ai";
    if (process.platform === "win32") {
      expect(sameAiWorkspacePath(a, b)).toBe(true);
    } else {
      expect(sameAiWorkspacePath(path.resolve(a), path.resolve(a))).toBe(true);
    }
  });
});
