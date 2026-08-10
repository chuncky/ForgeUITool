import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildMcpConfigSnippet, ensureForgeAiWorkspace, forgeAiWorkspacePath } from "./ai-workspace.mjs";

/** @typedef {"cursor" | "codex" | "trae" | "trae-cn"} AiHostId */

const HOSTS = /** @type {const} */ ([
  { id: "cursor", label: "Cursor", skillDir: "forgeui-lvgl-designer" },
  { id: "codex", label: "Codex", skillDir: "forgeui-lvgl-designer" },
  { id: "trae", label: "TRAE", skillDir: "forgeui-lvgl-designer" },
  { id: "trae-cn", label: "TRAE CN", skillDir: "forgeui-lvgl-designer" },
]);

/** @type {string | null} */
let userDataPathOverride = null;

/** Call from Electron main after ready: setAiToolsUserDataPath(app.getPath('userData')). */
export function setAiToolsUserDataPath(p) {
  userDataPathOverride = p ? String(p) : null;
}

function aiToolsJsonPath() {
  const base =
    userDataPathOverride ||
    process.env.FORGEUI_USER_DATA ||
    path.join(os.homedir(), ".forgeui-designer");
  return path.join(base, "ai-tools.json");
}

function exists(p) {
  try {
    return Boolean(p) && fs.existsSync(p);
  } catch {
    return false;
  }
}

function winLocalAppData() {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
}

function winRoamingAppData() {
  return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
}

function winProgramFiles() {
  return process.env.ProgramFiles || "C:\\Program Files";
}

function winProgramFilesX86() {
  return process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
}

export function loadAiToolCustomPaths() {
  const cfgPath = aiToolsJsonPath();
  if (!exists(cfgPath)) return {};
  try {
    const j = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

export function saveAiToolCustomPaths(pathsMap) {
  const cfgPath = aiToolsJsonPath();
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
  fs.writeFileSync(cfgPath, `${JSON.stringify(pathsMap ?? {}, null, 2)}\n`, "utf8");
  return cfgPath;
}

/**
 * @param {AiHostId} hostId
 * @param {string} exePath
 */
export function setCustomAiToolPath(hostId, exePath) {
  const resolved = resolveCustomPath(hostId, exePath);
  if (!resolved) {
    return { ok: false, error: `请选择有效的可执行文件路径（${hostId}）` };
  }
  const pathsMap = loadAiToolCustomPaths();
  pathsMap[hostId] = resolved;
  saveAiToolCustomPaths(pathsMap);
  return { ok: true, path: resolved };
}

/**
 * @param {AiHostId} hostId
 */
export function clearCustomAiToolPath(hostId) {
  const pathsMap = loadAiToolCustomPaths();
  delete pathsMap[hostId];
  saveAiToolCustomPaths(pathsMap);
  return { ok: true };
}

/**
 * @param {AiHostId} hostId
 * @param {string | undefined} exePath
 */
function resolveCustomPath(hostId, exePath) {
  if (!exePath || typeof exePath !== "string") return null;
  const p = path.resolve(exePath.trim().replace(/^["']|["']$/g, ""));
  if (!exists(p)) return null;
  const base = path.basename(p).toLowerCase();
  if (hostId === "cursor") {
    if (base === "cursor.exe" || base === "cursor.cmd" || base === "cursor") return p;
    if (/\.(exe|cmd|bat)$/i.test(base) && /cursor/i.test(p)) return p;
    return null;
  }
  if (/\.(exe|cmd|bat)$/i.test(base)) return p;
  return null;
}

function cursorKnownPaths() {
  const local = winLocalAppData();
  const home = os.homedir();
  const pf = winProgramFiles();
  const pf86 = winProgramFilesX86();
  return [
    path.join(local, "Programs", "Cursor", "Cursor.exe"),
    path.join(local, "Programs", "cursor", "Cursor.exe"),
    path.join(local, "cursor", "Cursor.exe"),
    path.join(home, "AppData", "Local", "Programs", "cursor", "Cursor.exe"),
    path.join(home, "AppData", "Local", "Programs", "Cursor", "Cursor.exe"),
    path.join(pf, "Cursor", "Cursor.exe"),
    path.join(pf86, "Cursor", "Cursor.exe"),
  ];
}

function codexKnownPaths() {
  const local = winLocalAppData();
  const roaming = winRoamingAppData();
  const home = os.homedir();
  const pf = winProgramFiles();
  const envInstall = process.env.CODEX_INSTALL_DIR;
  const out = [];
  if (envInstall) {
    out.push(path.join(envInstall, "Codex.exe"), path.join(envInstall, "codex.exe"), envInstall);
  }
  out.push(
    path.join(local, "Programs", "Codex", "Codex.exe"),
    path.join(local, "Programs", "codex", "Codex.exe"),
    path.join(local, "OpenAI Codex", "Codex.exe"),
    path.join(local, "Programs", "OpenAI", "Codex", "Codex.exe"),
    path.join(roaming, "Codex", "Codex.exe"),
    path.join(roaming, "Codex"),
    path.join(pf, "Codex", "Codex.exe"),
    path.join(pf, "OpenAI", "Codex", "Codex.exe"),
    path.join(local, "Microsoft", "WindowsApps", "Codex.exe"),
    path.join(home, "AppData", "Local", "Microsoft", "WindowsApps", "Codex.exe"),
    path.join(home, "AppData", "Roaming", "npm", "codex.cmd"),
    path.join(home, "AppData", "Roaming", "npm", "codex.exe"),
    path.join(home, "AppData", "Local", "pnpm", "codex.cmd"),
    path.join(home, "AppData", "Local", "pnpm", "codex.exe"),
    path.join(home, ".volta", "bin", "codex.cmd"),
    path.join(home, ".volta", "bin", "codex.exe"),
    path.join(home, "scoop", "shims", "codex.exe"),
    path.join(home, "scoop", "shims", "codex.cmd"),
  );
  return out;
}

function traeKnownPaths() {
  const local = winLocalAppData();
  const roaming = winRoamingAppData();
  const pf = winProgramFiles();
  return [
    path.join(local, "Programs", "Trae", "Trae.exe"),
    path.join(local, "Programs", "trae", "Trae.exe"),
    path.join(roaming, "Trae", "Trae.exe"),
    path.join(roaming, "Trae"),
    path.join(pf, "Trae", "Trae.exe"),
  ];
}

function traeCnKnownPaths() {
  const local = winLocalAppData();
  const roaming = winRoamingAppData();
  const pf = winProgramFiles();
  return [
    path.join(local, "Programs", "Trae CN", "Trae CN.exe"),
    path.join(local, "Programs", "TraeCN", "Trae CN.exe"),
    path.join(local, "Programs", "Trae CN", "TraeCN.exe"),
    path.join(roaming, "Trae CN", "Trae CN.exe"),
    path.join(roaming, "Trae CN"),
    path.join(pf, "Trae CN", "Trae CN.exe"),
  ];
}

/** @param {AiHostId} hostId */
function knownPathsForHost(hostId) {
  if (hostId === "codex") return codexKnownPaths();
  if (hostId === "trae") return traeKnownPaths();
  if (hostId === "trae-cn") return traeCnKnownPaths();
  return cursorKnownPaths();
}

/** @param {AiHostId} hostId */
function appPathExeNames(hostId) {
  if (hostId === "codex") return ["Codex.exe", "codex.exe"];
  if (hostId === "trae") return ["Trae.exe", "trae.exe"];
  if (hostId === "trae-cn") return ["Trae CN.exe", "TraeCN.exe"];
  return ["Cursor.exe", "cursor.exe"];
}

/** @param {AiHostId} hostId */
function whereCommandNames(hostId) {
  if (hostId === "codex") return ["codex", "codex.cmd"];
  if (hostId === "trae") return ["trae", "trae.cmd"];
  if (hostId === "trae-cn") return ["trae-cn", "trae-cn.cmd"];
  return ["cursor", "cursor.cmd"];
}

/** Prefer Cursor.exe next to resources/app/bin/cursor.cmd. */
function preferCursorExeBesideCmd(cmdPath) {
  if (!cmdPath || !/\.cmd$/i.test(cmdPath)) return cmdPath;
  // cmd lives at <root>/resources/app/bin/cursor.cmd → root/Cursor.exe
  const binDir = path.dirname(cmdPath);
  const candidates = [
    path.resolve(binDir, "..", "..", "..", "Cursor.exe"),
    path.resolve(binDir, "..", "..", "..", "cursor.exe"),
  ];
  for (const c of candidates) {
    if (exists(c)) return c;
  }
  return cmdPath;
}

function resolveWindowsCommandExecutable(commandPath) {
  if (process.platform !== "win32" || path.extname(commandPath)) return commandPath;
  for (const ext of [".cmd", ".exe", ".bat", ".com"]) {
    const candidate = `${commandPath}${ext}`;
    if (exists(candidate)) return candidate;
  }
  return commandPath;
}

function spawnCapture(cmd, args) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
        shell: false,
      });
      let output = "";
      child.stdout?.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.on("error", () => resolve({ code: -1, output: "" }));
      child.on("close", (code) => resolve({ code: code ?? -1, output }));
    } catch {
      resolve({ code: -1, output: "" });
    }
  });
}

async function queryRegistryDefaultValue(key) {
  if (process.platform !== "win32") return null;
  const { code, output } = await spawnCapture("reg", ["query", key, "/ve"]);
  if (code !== 0) return null;
  const line = output.split(/\r?\n/).find((item) => /\sREG_(?:SZ|EXPAND_SZ)\s/i.test(item));
  const match = line?.match(/\sREG_(?:SZ|EXPAND_SZ)\s+(.+)\s*$/i);
  return match?.[1]?.trim() || null;
}

async function resolveFromAppPaths(exeNames) {
  if (process.platform !== "win32") return null;
  const names = Array.isArray(exeNames) ? exeNames : [exeNames];
  const hives = [
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths",
    "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths",
    "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths",
  ];
  for (const name of names) {
    for (const hive of hives) {
      const exePath = await queryRegistryDefaultValue(`${hive}\\${name}`);
      if (exePath && exists(exePath)) return exePath;
    }
  }
  return null;
}

/**
 * Match Windows Uninstall DisplayName to an AI host.
 * Trae CN must not match TRAE SOLO CN / TRAE Work CN.
 * @param {AiHostId} hostId
 * @param {string} displayName
 */
export function matchUninstallDisplayName(hostId, displayName) {
  const n = String(displayName ?? "").trim();
  if (!n) return false;
  if (hostId === "cursor") {
    return /cursor/i.test(n) && !/cursor\s*updater/i.test(n);
  }
  if (hostId === "codex") {
    return /\bcodex\b/i.test(n);
  }
  if (hostId === "trae-cn") {
    return /trae\s*cn/i.test(n) && !/solo/i.test(n) && !/\bwork\b/i.test(n);
  }
  if (hostId === "trae") {
    // International Trae only — exclude CN / Solo / Work variants
    return /\btrae\b/i.test(n) && !/\bcn\b/i.test(n) && !/solo/i.test(n) && !/\bwork\b/i.test(n);
  }
  return false;
}

/**
 * `reg query HKCU\...` prints `HKEY_CURRENT_USER\...` — expand before matching lines.
 * @param {string} root
 */
export function expandRegRoot(root) {
  return String(root)
    .replace(/^HKCU\\/i, "HKEY_CURRENT_USER\\")
    .replace(/^HKLM\\/i, "HKEY_LOCAL_MACHINE\\")
    .replace(/^HKCR\\/i, "HKEY_CLASSES_ROOT\\")
    .replace(/^HKU\\/i, "HKEY_USERS\\");
}

/** @type {{ at: number, entries: Array<{ displayName: string, installLocation: string, displayIcon: string }> } | null} */
let uninstallInventoryCache = null;
const UNINSTALL_CACHE_MS = 60_000;

/** Test helper: drop Uninstall inventory cache. */
export function clearAiHostDetectCaches() {
  uninstallInventoryCache = null;
}

function looksLikeAiUninstallName(displayName) {
  return /cursor|codex|\btrae\b/i.test(String(displayName ?? ""));
}

/**
 * One-shot Uninstall inventory (shared by all hosts). PowerShell is far faster than
 * spawning `reg query` per subkey × 4 hosts (~20s → ~1s).
 */
async function loadUninstallInventory() {
  if (
    uninstallInventoryCache &&
    Date.now() - uninstallInventoryCache.at < UNINSTALL_CACHE_MS
  ) {
    return uninstallInventoryCache.entries;
  }
  if (process.platform !== "win32") {
    uninstallInventoryCache = { at: Date.now(), entries: [] };
    return [];
  }

  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$paths = @(
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
Get-ItemProperty $paths |
  Where-Object { $_.DisplayName -and ($_.DisplayName -match 'Cursor|Codex|Trae') } |
  ForEach-Object {
    [PSCustomObject]@{
      DisplayName = [string]$_.DisplayName
      InstallLocation = [string]$_.InstallLocation
      DisplayIcon = [string]$_.DisplayIcon
    }
  } | ConvertTo-Json -Compress
`;
  const { code, output } = await spawnCapture("powershell", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    ps,
  ]);
  /** @type {Array<{ displayName: string, installLocation: string, displayIcon: string }>} */
  const entries = [];
  if (code === 0 && output.trim()) {
    try {
      const parsed = JSON.parse(output.trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const row of list) {
        const displayName = String(row.DisplayName ?? "").trim();
        if (!looksLikeAiUninstallName(displayName)) continue;
        entries.push({
          displayName,
          installLocation: String(row.InstallLocation ?? "")
            .trim()
            .replace(/^"|"$/g, ""),
          displayIcon: String(row.DisplayIcon ?? "")
            .trim()
            .replace(/^"|"$/g, ""),
        });
      }
    } catch {
      /* fall through empty */
    }
  }

  uninstallInventoryCache = { at: Date.now(), entries };
  return entries;
}

/**
 * Probe Uninstall registry for host InstallLocation / DisplayIcon (non-default drives).
 * @param {AiHostId} hostId
 */
async function resolveFromUninstall(hostId) {
  if (process.platform !== "win32") return null;
  const entries = await loadUninstallInventory();
  const exeNames = appPathExeNames(hostId);
  for (const item of entries) {
    if (!matchUninstallDisplayName(hostId, item.displayName)) continue;
    const candidates = [];
    if (item.installLocation) {
      for (const name of exeNames) {
        candidates.push(path.join(item.installLocation, name));
      }
    }
    if (item.displayIcon) {
      const iconPath = item.displayIcon.split(",")[0].trim().replace(/^"|"$/g, "");
      if (/\.exe$/i.test(iconPath)) candidates.push(iconPath);
    }
    for (const c of candidates) {
      const hit = resolveExistingHostPath(c, hostId);
      if (hit) return hit;
      if (exists(c) && /\.exe$/i.test(c)) return c;
    }
  }
  return null;
}

/**
 * @param {string[]} commandNames
 * @param {(p: string) => string} [normalize]
 */
async function resolveFromWhere(commandNames, normalize = (p) => p) {
  if (process.platform !== "win32") {
    for (const name of commandNames) {
      const { code, output } = await spawnCapture("which", [name]);
      if (code !== 0) continue;
      const first = output
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)[0];
      if (first && exists(first)) return normalize(first);
    }
    return null;
  }
  for (const name of commandNames) {
    const { code, output } = await spawnCapture("where", [name]);
    if (code !== 0) continue;
    const lines = output
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => resolveWindowsCommandExecutable(l));
    for (const candidate of lines) {
      if (!exists(candidate)) continue;
      return normalize(candidate);
    }
  }
  return null;
}

/** Codex Windows Store / Start Apps (BK parity). */
async function resolveCodexFromStore() {
  if (process.platform !== "win32") return null;
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
Get-StartApps | Where-Object { $_.AppID -like 'OpenAI.Codex*' -or $_.Name -match 'Codex' } |
  Select-Object -First 1 -ExpandProperty AppID
`;
  const { code, output } = await spawnCapture("powershell", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    ps,
  ]);
  if (code !== 0) return null;
  const appId = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)[0];
  if (!appId) return null;
  return `appx:${appId}`;
}

/**
 * Resolve a known-path candidate to a launchable executable.
 * Bare AppData folders (e.g. %APPDATA%\\Trae CN with only Cache/User) must NOT
 * count as installed — that was a false "已安装" in the AI menu.
 * @param {string} p
 * @param {AiHostId} hostId
 */
/** @param {string} p @param {AiHostId} hostId */
export function resolveExistingHostPath(p, hostId) {
  if (!exists(p)) return null;
  try {
    const st = fs.statSync(p);
    if (st.isFile()) {
      if (/\.(exe|cmd|bat)$/i.test(p)) return p;
      // Unix / PATH binaries without extension
      if (process.platform !== "win32") return p;
      return null;
    }
    if (st.isDirectory()) {
      for (const name of appPathExeNames(hostId)) {
        const candidate = path.join(p, name);
        if (!exists(candidate)) continue;
        try {
          if (fs.statSync(candidate).isFile()) return candidate;
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** @param {string[]} cands @param {AiHostId} hostId */
function findFirstExisting(cands, hostId) {
  for (const p of cands) {
    const hit = resolveExistingHostPath(p, hostId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Unified host resolve (BK resolveAiToolExecutable order + Cursor Uninstall).
 * @param {AiHostId} hostId
 * @returns {Promise<{ installed: boolean, exe: string | null, method: string | null, customExePath: string }>}
 */
export async function resolveHostExecutable(hostId) {
  const customPaths = loadAiToolCustomPaths();
  const customRaw = typeof customPaths[hostId] === "string" ? customPaths[hostId] : "";
  const custom = resolveCustomPath(hostId, customRaw);
  if (custom) {
    const exe = hostId === "cursor" ? preferCursorExeBesideCmd(custom) : custom;
    return { installed: true, exe, method: "custom", customExePath: customRaw };
  }

  const knownHit = findFirstExisting(knownPathsForHost(hostId), hostId);
  if (knownHit) {
    return { installed: true, exe: knownHit, method: "known", customExePath: customRaw };
  }

  const fromUninstall = await resolveFromUninstall(hostId);
  if (fromUninstall) {
    return {
      installed: true,
      exe: fromUninstall,
      method: "uninstall",
      customExePath: customRaw,
    };
  }

  const fromAppPaths = await resolveFromAppPaths(appPathExeNames(hostId));
  if (fromAppPaths) {
    return {
      installed: true,
      exe: fromAppPaths,
      method: "appPaths",
      customExePath: customRaw,
    };
  }

  if (hostId === "codex") {
    const store = await resolveCodexFromStore();
    if (store) {
      return { installed: true, exe: store, method: "store", customExePath: customRaw };
    }
  }

  const normalize =
    hostId === "cursor" ? preferCursorExeBesideCmd : (p) => p;
  const fromWhere = await resolveFromWhere(whereCommandNames(hostId), normalize);
  if (fromWhere) {
    return { installed: true, exe: fromWhere, method: "where", customExePath: customRaw };
  }

  return { installed: false, exe: null, method: null, customExePath: customRaw };
}

/** @deprecated Prefer resolveHostExecutable('cursor') */
export async function resolveCursorExecutable() {
  return resolveHostExecutable("cursor");
}

/**
 * Detect AI hosts (Windows-first). Async due to registry / where probes.
 */
export async function detectAiHosts() {
  const results = await Promise.all(HOSTS.map((h) => resolveHostExecutable(h.id)));
  return HOSTS.map((h, i) => {
    const resolved = results[i];
    const env = getHostEnvStatus(h.id);
    return {
      id: h.id,
      label: h.label,
      installed: resolved.installed,
      exe: resolved.exe,
      exePath: resolved.exe ?? "",
      customExePath: resolved.customExePath || "",
      method: resolved.method,
      launchSupported: true,
      mcpPath: env.mcpPath,
      skillPath: env.skillPath,
    };
  });
}

export function cursorMcpConfigPath() {
  return path.join(os.homedir(), ".cursor", "mcp.json");
}

export function cursorSkillInstallPath() {
  return path.join(os.homedir(), ".cursor", "skills", "forgeui-lvgl-designer");
}

/**
 * Resolve Skill template directory (dev monorepo or packaged forgeui-root).
 * @param {string} repoRoot
 */
export function skillSourcePath(repoRoot) {
  const candidates = [
    path.join(repoRoot, "resources", "ai-skill", "forgeui-lvgl-designer"),
    // ExtraResources fallback if staged beside forgeui-root in a future layout
    path.join(path.dirname(repoRoot), "ai-skill", "forgeui-lvgl-designer"),
  ];
  for (const c of candidates) {
    if (exists(path.join(c, "SKILL.md"))) return c;
  }
  return candidates[0];
}

function hostMcpConfigPath(hostId) {
  const home = os.homedir();
  const roaming = winRoamingAppData();
  if (hostId === "codex") return path.join(home, ".codex", "config.toml");
  if (hostId === "trae") return path.join(roaming, "Trae", "User", "mcp.json");
  if (hostId === "trae-cn") return path.join(roaming, "Trae CN", "User", "mcp.json");
  return cursorMcpConfigPath();
}

function hostSkillDir(hostId) {
  const home = os.homedir();
  const name = "forgeui-lvgl-designer";
  if (hostId === "codex") return path.join(home, ".codex", "skills", name);
  // BK: ~/.trae/skills and ~/.trae-cn/skills
  if (hostId === "trae") return path.join(home, ".trae", "skills", name);
  if (hostId === "trae-cn") return path.join(home, ".trae-cn", "skills", name);
  return cursorSkillInstallPath();
}

function hostSkillMdPath(hostId) {
  return path.join(hostSkillDir(hostId), "SKILL.md");
}

export function getHostEnvStatus(hostId, opts = {}) {
  const appVersion =
    typeof opts.appVersion === "string" && opts.appVersion.trim()
      ? opts.appVersion.trim()
      : readDesignerAppVersion();
  const mcpPath = hostMcpConfigPath(hostId);
  const skillPath = hostSkillMdPath(hostId);
  let mcpInstalled = false;
  let mcpAppVersion = "";
  if (hostId === "codex") {
    if (exists(mcpPath)) {
      try {
        const t = fs.readFileSync(mcpPath, "utf8");
        mcpInstalled = /mcp_servers\.forgeui_designer\b/.test(t) || /forgeui_designer/.test(t);
        const m = t.match(
          /\[mcp_servers\.forgeui_designer\][\s\S]*?app_version\s*=\s*["']([^"']+)["']/i,
        );
        if (m) mcpAppVersion = m[1];
      } catch {
        mcpInstalled = false;
      }
    }
  } else if (exists(mcpPath)) {
    try {
      const j = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
      const entry = j?.mcpServers?.forgeui_designer;
      mcpInstalled = !!entry;
      if (entry && typeof entry.appVersion === "string") mcpAppVersion = entry.appVersion;
    } catch {
      mcpInstalled = false;
    }
  }

  const skillInstalled = exists(skillPath);
  let skillAppVersion = "";
  if (skillInstalled) {
    const manifestPath = path.join(path.dirname(skillPath), "manifest.json");
    if (exists(manifestPath)) {
      try {
        const man = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        if (man && typeof man.appVersion === "string") skillAppVersion = man.appVersion;
      } catch {
        /* ignore */
      }
    }
  }

  const mcpStatus = !mcpInstalled
    ? "missing"
    : mcpAppVersion && mcpAppVersion === appVersion
      ? "ok"
      : mcpAppVersion
        ? "outdated"
        : "outdated";
  const skillStatus = !skillInstalled
    ? "missing"
    : skillAppVersion && skillAppVersion === appVersion
      ? "ok"
      : skillAppVersion
        ? "outdated"
        : "outdated";

  return {
    mcpInstalled,
    mcpPath,
    mcpStatus,
    mcpAppVersion,
    skillInstalled,
    skillPath,
    skillStatus,
    skillAppVersion,
    appVersion,
    needsUpdate: mcpStatus !== "ok" || skillStatus !== "ok",
  };
}

/** Read designer package version (tests / non-Electron). */
export function readDesignerAppVersion() {
  try {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const j = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    if (typeof j.version === "string" && j.version.trim()) return j.version.trim();
  } catch {
    /* ignore */
  }
  return "0.1.0";
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

/**
 * Merge forgeui_designer into a Cursor/TRAE-style mcp.json.
 * @param {AiHostId} hostId
 */
export function installJsonMcp(hostId, repoRoot, bridgePort = 39201, opts = {}) {
  const snippet = buildMcpConfigSnippet(repoRoot, bridgePort, opts);
  const entry = snippet.mcpServers.forgeui_designer;
  const cfgPath = hostMcpConfigPath(hostId);
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
  let existing = { mcpServers: {} };
  if (exists(cfgPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    } catch {
      existing = { mcpServers: {} };
    }
  }
  if (!existing.mcpServers || typeof existing.mcpServers !== "object") {
    existing.mcpServers = {};
  }
  existing.mcpServers.forgeui_designer = entry;
  fs.writeFileSync(cfgPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
  return { ok: true, path: cfgPath };
}

/** Merge forgeui_designer into ~/.codex/config.toml (BK [mcp_servers.*]). */
export function installCodexMcp(repoRoot, bridgePort = 39201, opts = {}) {
  const snippet = buildMcpConfigSnippet(repoRoot, bridgePort, opts);
  const entry = snippet.mcpServers.forgeui_designer;
  const cfgPath = hostMcpConfigPath("codex");
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
  let text = exists(cfgPath) ? fs.readFileSync(cfgPath, "utf8") : "";
  // Drop previous forgeui_designer table and nested env table
  text = text.replace(
    /\n?\[mcp_servers\.forgeui_designer(?:\.env)?\][\s\S]*?(?=\n\[|\s*$)/g,
    "",
  );
  text = text.replace(/\n{3,}/g, "\n\n").trimEnd();
  const argsToml = (entry.args ?? [])
    .map((a) => JSON.stringify(String(a)))
    .join(", ");
  const envLines = Object.entries(entry.env ?? {})
    .map(([k, v]) => `${k} = ${JSON.stringify(String(v))}`)
    .join("\n");
  const appVersion = entry.appVersion || opts.appVersion || readDesignerAppVersion();
  const block = `
[mcp_servers.forgeui_designer]
command = ${JSON.stringify(String(entry.command))}
args = [${argsToml}]
app_version = ${JSON.stringify(String(appVersion))}

[mcp_servers.forgeui_designer.env]
${envLines}
`.trimStart();
  const next = text ? `${text}\n\n${block}` : block;
  fs.writeFileSync(cfgPath, `${next}\n`, "utf8");
  return { ok: true, path: cfgPath };
}

export function installCursorMcp(repoRoot, bridgePort = 39201, opts = {}) {
  return installJsonMcp("cursor", repoRoot, bridgePort, opts);
}

export function installHostSkill(hostId, repoRoot, opts = {}) {
  const src = skillSourcePath(repoRoot);
  if (!exists(src)) {
    return { ok: false, error: `Skill source missing: ${src}` };
  }
  const dest = hostSkillDir(hostId);
  if (exists(dest)) fs.rmSync(dest, { recursive: true, force: true });
  copyDirRecursive(src, dest);
  const appVersion =
    typeof opts.appVersion === "string" && opts.appVersion.trim()
      ? opts.appVersion.trim()
      : readDesignerAppVersion();
  const manifestPath = path.join(dest, "manifest.json");
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ name: "forgeui-lvgl-designer", appVersion }, null, 2)}\n`,
    "utf8",
  );
  return { ok: true, path: dest };
}

export function installCursorSkill(repoRoot, opts = {}) {
  return installHostSkill("cursor", repoRoot, opts);
}

/**
 * @param {AiHostId} hostId
 */
export function installHostEnv(hostId, repoRoot, bridgePort = 39201, opts = {}) {
  const withVer = {
    ...opts,
    appVersion: opts.appVersion || readDesignerAppVersion(),
  };
  const mcp =
    hostId === "codex"
      ? installCodexMcp(repoRoot, bridgePort, withVer)
      : installJsonMcp(hostId, repoRoot, bridgePort, withVer);
  const skill = installHostSkill(hostId, repoRoot, withVer);
  return {
    ok: mcp.ok && skill.ok,
    mcp,
    skill,
    error: mcp.ok ? (skill.ok ? undefined : skill.error) : mcp.error,
  };
}

function uninstallJsonMcp(hostId) {
  const mcpPath = hostMcpConfigPath(hostId);
  let mcp = { ok: true, path: mcpPath, removed: false };
  if (exists(mcpPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
      if (existing?.mcpServers?.forgeui_designer) {
        delete existing.mcpServers.forgeui_designer;
        fs.writeFileSync(mcpPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
        mcp.removed = true;
      }
    } catch (e) {
      mcp = { ok: false, path: mcpPath, error: e.message ?? String(e) };
    }
  }
  return mcp;
}

function uninstallCodexMcp() {
  const mcpPath = hostMcpConfigPath("codex");
  let mcp = { ok: true, path: mcpPath, removed: false };
  if (exists(mcpPath)) {
    try {
      let text = fs.readFileSync(mcpPath, "utf8");
      const before = text;
      text = text.replace(
        /\n?\[mcp_servers\.forgeui_designer(?:\.env)?\][\s\S]*?(?=\n\[|\s*$)/g,
        "",
      );
      text = text.replace(/\n{3,}/g, "\n\n").trimEnd() + (text.trim() ? "\n" : "");
      if (text !== before) {
        fs.writeFileSync(mcpPath, text, "utf8");
        mcp.removed = true;
      }
    } catch (e) {
      mcp = { ok: false, path: mcpPath, error: e.message ?? String(e) };
    }
  }
  return mcp;
}

/**
 * @param {AiHostId} hostId
 */
export function uninstallHostEnv(hostId) {
  const mcp = hostId === "codex" ? uninstallCodexMcp() : uninstallJsonMcp(hostId);
  const skillDir = hostSkillDir(hostId);
  let skill = { ok: true, path: skillDir, removed: false };
  try {
    if (exists(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
      skill.removed = true;
    }
  } catch (e) {
    skill = { ok: false, path: skillDir, error: e.message ?? String(e) };
  }
  return { ok: mcp.ok && skill.ok, mcp, skill, error: mcp.ok ? skill.error : mcp.error };
}

export function uninstallCursorEnv() {
  return uninstallHostEnv("cursor");
}

export function getCursorEnvStatus(repoRoot, opts = {}) {
  const env = getHostEnvStatus("cursor", opts);
  const skillSrc = skillSourcePath(repoRoot);
  return {
    ...env,
    skillSourceReady: exists(path.join(skillSrc, "SKILL.md")),
  };
}

/**
 * Open folder (+ optional README) in an AI host via spawn (BK parity).
 * @param {AiHostId} hostId
 * @param {string} folderAbs
 * @param {string | null} hostExe
 * @param {string | null} [readmeAbs]
 */
export function launchHostAt(hostId, folderAbs, hostExe, readmeAbs = null) {
  const target = path.resolve(folderAbs);
  const readme = readmeAbs ? path.resolve(readmeAbs) : null;
  const argsFor = (baseArgs) => (readme ? [...baseArgs, readme] : baseArgs);
  const fallbackCmds = whereCommandNames(hostId);

  /** @type {Array<{ cmd: string, args: string[], shell: boolean }>} */
  const attempts = [];
  if (hostExe) {
    if (String(hostExe).startsWith("appx:")) {
      const appId = String(hostExe).slice("appx:".length);
      attempts.push({
        cmd: "explorer.exe",
        args: argsFor([`shell:AppsFolder\\${appId}`]),
        shell: false,
      });
    } else {
      const useShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(hostExe);
      attempts.push({ cmd: hostExe, args: argsFor([target]), shell: useShell });
    }
  }
  for (const name of fallbackCmds) {
    attempts.push({
      cmd: name,
      args: argsFor([target]),
      shell: process.platform === "win32",
    });
  }

  return (async () => {
    for (const a of attempts) {
      const r = await new Promise((resolve) => {
        try {
          const child = spawn(a.cmd, a.args, {
            detached: true,
            stdio: "ignore",
            shell: a.shell,
            windowsHide: true,
          });
          let settled = false;
          child.on("error", (e) => {
            if (!settled) {
              settled = true;
              resolve({ ok: false, error: e.message ?? String(e) });
            }
          });
          child.once("spawn", () => {
            if (!settled) {
              settled = true;
              child.unref();
              resolve({ ok: true, method: a.cmd, path: target });
            }
          });
          setTimeout(() => {
            if (!settled) {
              settled = true;
              try {
                child.unref();
              } catch {
                /* ignore */
              }
              resolve({ ok: true, method: a.cmd, path: target });
            }
          }, 400);
        } catch (e) {
          resolve({ ok: false, error: e.message ?? String(e) });
        }
      });
      if (r.ok) return r;
    }
    return { ok: false, error: `Could not launch ${hostId}` };
  })();
}

export function launchCursorAt(folderAbs, hostExe, readmeAbs = null) {
  return launchHostAt("cursor", folderAbs, hostExe, readmeAbs);
}

/**
 * Full AI-design launch pipeline for any supported host.
 * @param {{ host?: AiHostId, projectRoot: string, repoRoot: string, bridgePort?: number, packaged?: boolean, execPath?: string, openPathFallback?: (p: string) => Promise<unknown> }} opts
 */
export async function launchAiDesign(opts) {
  const {
    host = "cursor",
    projectRoot,
    repoRoot,
    bridgePort = 39201,
    packaged = false,
    execPath,
    openPathFallback,
  } = opts;
  const hostId = /** @type {AiHostId} */ (host || "cursor");
  if (!projectRoot) return { ok: false, error: "No project open" };

  const resolved = await resolveHostExecutable(hostId);
  const hosts = await detectAiHosts();
  const label = HOSTS.find((h) => h.id === hostId)?.label ?? hostId;
  if (!resolved.installed || !resolved.exe) {
    return {
      ok: false,
      error: `未检测到 ${label}。请在「设置 → AI」中自定义 exe 路径，或确认已安装并加入 PATH。`,
      hosts,
      resolved,
    };
  }

  const aiDir = ensureForgeAiWorkspace(projectRoot, { bridgePort });
  const readmePath = path.join(aiDir, "README.md");
  const installOpts = {
    packaged,
    execPath,
    preferElectronAsNode: process.env.FORGEUI_MCP_ELECTRON_AS_NODE === "1",
    appVersion: opts.appVersion || readDesignerAppVersion(),
  };
  const installed = installHostEnv(hostId, repoRoot, bridgePort, installOpts);
  const skillWarn = installed.skill?.ok ? null : installed.skill?.error;

  let launch = await launchHostAt(hostId, aiDir, resolved.exe, readmePath);
  if (!launch.ok && typeof openPathFallback === "function") {
    await openPathFallback(aiDir);
    launch = {
      ok: true,
      method: "shell.openPath",
      path: aiDir,
      fallbackHint: `已在资源管理器打开，请用 ${label} 打开该文件夹（.forge-ai）。`,
    };
  }

  const hints = [];
  if (launch.ok) {
    hints.push(
      launch.fallbackHint ||
        `已启动 ${label}。若 MCP 未显示，请完全退出后再从「AI设计」重开。`,
    );
  } else {
    hints.push(launch.error || `启动 ${label} 失败`);
  }
  if (skillWarn) {
    hints.push(`Skill 未安装：${skillWarn}（请使用含 resources/ai-skill 的完整 release 包）`);
  }

  return {
    ok: launch.ok,
    aiWorkspacePath: aiDir,
    mcp: installed.mcp,
    skill: installed.skill,
    launch,
    hosts,
    hint: hints.join(" "),
    error: launch.ok ? undefined : launch.error,
  };
}

/** @deprecated Prefer launchAiDesign({ host: 'cursor', ... }) */
export async function launchCursorAiDesign(opts) {
  return launchAiDesign({ ...opts, host: "cursor" });
}

export { HOSTS, forgeAiWorkspacePath };
