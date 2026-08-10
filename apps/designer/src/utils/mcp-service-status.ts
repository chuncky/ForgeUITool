/** Bridge / MCP service status for AI settings (BK parity). */

export type McpServiceKind = "running" | "not_ready" | "offline";

export type McpServiceView = {
  kind: McpServiceKind;
  label: string;
  /** CSS badge class: ok | warn | bad */
  badgeClass: "ok" | "warn" | "bad";
};

/**
 * Map Bridge `/bridge/ping` payload to UI label.
 * Only `status === "READY"` counts as 运行中 (BK).
 */
export function mcpServiceLabel(bridgePing: unknown): McpServiceView {
  if (!bridgePing || typeof bridgePing !== "object") {
    return { kind: "offline", label: "离线", badgeClass: "bad" };
  }
  const ping = bridgePing as { status?: unknown; ok?: unknown; error?: unknown };
  if (ping.error) {
    return { kind: "offline", label: "离线", badgeClass: "bad" };
  }
  if (ping.status === "READY") {
    return { kind: "running", label: "运行中", badgeClass: "ok" };
  }
  if (typeof ping.status === "string" && ping.status.length > 0) {
    return { kind: "not_ready", label: "未就绪", badgeClass: "warn" };
  }
  if (ping.ok === true) {
    // Legacy / partial payloads without status
    return { kind: "running", label: "运行中", badgeClass: "ok" };
  }
  return { kind: "offline", label: "离线", badgeClass: "bad" };
}

export type InstallComponentStatus = "ok" | "outdated" | "missing";

export function installStatusBadgeClass(status: InstallComponentStatus | undefined): "ok" | "warn" | "miss" {
  if (status === "ok") return "ok";
  if (status === "outdated") return "warn";
  return "miss";
}

export function installStatusLabel(
  status: InstallComponentStatus | undefined,
  installed: boolean | undefined,
  appVersion?: string,
): string {
  const st = status ?? (installed ? "ok" : "missing");
  if (st === "ok") {
    return appVersion ? `已安装` : "已安装";
  }
  if (st === "outdated") return "需更新";
  return "未安装";
}

export function installVersionHint(
  status: InstallComponentStatus | undefined,
  appVersion?: string,
  scopeLabel = "全局 MCP 配置",
): string {
  const st = status ?? (appVersion ? "ok" : "missing");
  if (st === "ok" && appVersion) return `${scopeLabel}（安装版本 ${appVersion}）`;
  if (st === "outdated" && appVersion) return `${scopeLabel}（安装版本 ${appVersion}，与设计器不一致）`;
  if (st === "outdated") return `${scopeLabel}（版本过期，请安装/更新）`;
  return scopeLabel;
}
