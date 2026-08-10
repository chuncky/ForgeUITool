<template>
  <div class="ai-panel">
    <!-- Always show shell (BK): refresh only updates values, never hides tabs/fields. -->
    <section class="card">
      <h3>AI 设置</h3>
      <div class="field-row mcp-service-row">
        <div class="field-label">MCP服务状态</div>
        <div class="field-main service-main">
          <span class="badge" :class="mcpService.badgeClass">{{ mcpService.label }}</span>
          <span v-if="state?.previewBusy" class="hint">预览/编译进行中，写入已暂停</span>
          <span v-if="lastRefreshedLabel" class="hint refresh-time">上次刷新 {{ lastRefreshedLabel }}</span>
          <span v-if="refreshing" class="hint">检测中…</span>
          <button
            type="button"
            class="mini refresh-btn"
            :disabled="refreshing"
            @click="refreshService"
          >
            {{ refreshing ? "刷新中…" : "刷新" }}
          </button>
        </div>
      </div>
      <p v-if="state?.aiWorkspacePath" class="mono muted ws-path">{{ state.aiWorkspacePath }}</p>
    </section>

    <section class="card">
      <h3>AI 编辑器</h3>
      <div class="host-tabs" role="tablist">
        <button
          v-for="tab in editorTabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="host-tab"
          :class="{ on: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="activeTab === 'manual'" class="tab-body">
        <p class="help">
          将下列配置合并到对应 AI 工具的 MCP 配置文件中，并确保 Bridge 端口与下方一致。
        </p>
        <pre class="code-block">{{ state?.mcpConfigJson || "（加载中…）" }}</pre>
        <div class="btn-row">
          <button type="button" :disabled="!state?.mcpConfigJson" @click="copyMcp">复制 MCP 配置</button>
          <button type="button" @click="ping">测试 Bridge 连通</button>
        </div>
      </div>

      <div v-else class="tab-body">
        <div class="field-row">
          <div class="field-label">exe 路径</div>
          <div class="field-main">
            <div class="path-line">
              <span class="mono">{{ activeHost?.exePath || (refreshing ? "（检测中…）" : "（未检测到）") }}</span>
              <button type="button" class="mini" @click="pickCustom">自定义</button>
              <button
                v-if="activeHost?.customExePath"
                type="button"
                class="mini"
                @click="clearCustom"
              >
                清除自定义
              </button>
            </div>
            <p class="help">
              用于安装检测与从工作台启动。
              <template v-if="activeHost?.exePath">
                当前检测到的路径：<span class="mono">{{ activeHost.exePath }}</span>
              </template>
            </p>
          </div>
        </div>

        <div class="field-row">
          <div class="field-label">MCP 状态</div>
          <div class="field-main">
            <span class="badge" :class="installStatusBadgeClass(activeEnv?.mcpStatus)">
              {{
                installStatusLabel(
                  activeEnv?.mcpStatus,
                  activeEnv?.mcpInstalled,
                  activeEnv?.mcpAppVersion,
                )
              }}
            </span>
            <span class="help inline">{{
              installVersionHint(activeEnv?.mcpStatus, activeEnv?.mcpAppVersion, "全局 MCP 配置")
            }}</span>
          </div>
        </div>

        <div class="field-row">
          <div class="field-label">MCP 配置</div>
          <div class="field-main">
            <span class="mono">{{ activeEnv?.mcpPath || activeHost?.mcpPath || "—" }}</span>
          </div>
        </div>

        <div class="field-row">
          <div class="field-label">Skill 状态</div>
          <div class="field-main">
            <span class="badge" :class="installStatusBadgeClass(activeEnv?.skillStatus)">
              {{
                installStatusLabel(
                  activeEnv?.skillStatus,
                  activeEnv?.skillInstalled,
                  activeEnv?.skillAppVersion,
                )
              }}
            </span>
            <span class="help inline">{{
              installVersionHint(activeEnv?.skillStatus, activeEnv?.skillAppVersion, "全局 Skill")
            }}</span>
          </div>
        </div>

        <div class="field-row">
          <div class="field-label">Skill 路径</div>
          <div class="field-main">
            <span class="mono">{{ activeEnv?.skillPath || activeHost?.skillPath || "—" }}</span>
          </div>
        </div>

        <div class="field-row">
          <div class="field-label">操作</div>
          <div class="field-main btn-row">
            <button type="button" class="primary" @click="installEnv">安装/更新 MCP + Skill</button>
            <button type="button" class="danger" @click="uninstallEnv">卸载 MCP + Skill</button>
            <button type="button" :disabled="refreshing" @click="refreshHosts">
              {{ refreshing ? "刷新中…" : "刷新" }}
            </button>
            <button type="button" :disabled="!canLaunch" @click="launchHost">
              用当前编辑器打开工作区
            </button>
          </div>
        </div>

        <p class="hint-block">
          安装/更新后请<strong>完全退出</strong>对应 AI 工具，再从顶栏「AI设计」重开，以便重新加载 MCP。
          刷新会重 ping Bridge 并重读 MCP/Skill 落盘状态；路径未变表示与上次检测结果相同。
        </p>
      </div>

      <p v-if="message" class="flash" :class="{ err: messageErr }">{{ message }}</p>
    </section>

    <section v-if="state?.transaction?.pending" class="card tx">
      待确认 AI 变更（{{ state.transaction.changeCount }} 项）— 请在工作台底栏保存或撤销。
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useProjectStore } from "../stores/project";
import {
  installStatusBadgeClass,
  installStatusLabel,
  installVersionHint,
  mcpServiceLabel,
} from "../utils/mcp-service-status";

type PanelState = Awaited<ReturnType<NonNullable<typeof window.forgeuiDesktop>["getAiPanelState"]>>;
type HostId = "cursor" | "codex" | "trae" | "trae-cn";

const store = useProjectStore();
const refreshing = ref(false);
const state = ref<PanelState | null>(null);
const message = ref("");
const messageErr = ref(false);
const activeTab = ref<HostId | "manual">("cursor");
const lastRefreshedAt = ref<number | null>(null);

const editorTabs = [
  { id: "cursor" as const, label: "Cursor" },
  { id: "codex" as const, label: "Codex" },
  { id: "trae" as const, label: "TRAE" },
  { id: "trae-cn" as const, label: "TRAE CN" },
  { id: "manual" as const, label: "手动配置 MCP" },
];

const mcpService = computed(() => mcpServiceLabel(state.value?.bridgePing));

const lastRefreshedLabel = computed(() => {
  if (lastRefreshedAt.value == null) return "";
  const d = new Date(lastRefreshedAt.value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
});

const activeHost = computed(() => {
  if (activeTab.value === "manual") return null;
  const fromState = (state.value?.hosts ?? []).find((h) => h.id === activeTab.value);
  if (fromState) return fromState;
  // Seed row while detection still running
  const seed = editorTabs.find((t) => t.id === activeTab.value);
  return seed
    ? { id: seed.id, label: seed.label, installed: false, launchSupported: true, exePath: "" }
    : null;
});

const activeEnv = computed(() => {
  if (activeTab.value === "manual" || !state.value) return null;
  const envs = state.value.hostEnvs;
  if (envs && activeTab.value in envs) return envs[activeTab.value as HostId];
  if (activeTab.value === "cursor") return state.value.cursorEnv ?? null;
  return null;
});

const canLaunch = computed(() => {
  if (activeTab.value === "manual") return false;
  if (!store.loaded || state.value?.previewBusy) return false;
  return (state.value?.hosts ?? []).some((h) => h.id === activeTab.value && h.installed);
});

function desktop() {
  const d = window.forgeuiDesktop;
  if (!d) throw new Error("Not in Electron shell");
  return d;
}

async function refresh(opts?: { silent?: boolean; hint?: string }) {
  refreshing.value = true;
  if (!opts?.silent) message.value = "";
  try {
    state.value = await desktop().getAiPanelState();
    await store.refreshAiTransactionState();
    lastRefreshedAt.value = Date.now();
    if (opts?.hint) {
      messageErr.value = false;
      message.value = opts.hint;
    }
  } catch (e) {
    messageErr.value = true;
    message.value = e instanceof Error ? e.message : String(e);
  } finally {
    refreshing.value = false;
  }
}

async function refreshService() {
  await refresh({ hint: "已刷新 MCP 服务状态" });
}

async function refreshHosts() {
  await refresh({ hint: "已刷新编辑器检测（exe / MCP / Skill）" });
}

async function pickCustom() {
  if (activeTab.value === "manual") return;
  const r = await desktop().pickAiCustomPath({ host: activeTab.value });
  if (r.canceled) return;
  messageErr.value = !r.ok;
  message.value = r.ok ? `已设置自定义路径：${r.path}` : (r.error ?? "设置失败");
  await refresh({ silent: true });
}

async function clearCustom() {
  if (activeTab.value === "manual") return;
  const r = await desktop().setAiCustomPath({ host: activeTab.value, path: "" });
  messageErr.value = !r.ok;
  message.value = r.ok ? "已清除自定义路径" : (r.error ?? "失败");
  await refresh({ silent: true });
}

async function ping() {
  const r = await desktop().pingAiBridge();
  messageErr.value = !r.ok;
  message.value = r.ok ? "Bridge OK" : (r.error ?? "ping 失败");
  await refresh({ silent: true });
}

async function copyMcp() {
  if (!state.value?.mcpConfigJson) return;
  await navigator.clipboard.writeText(state.value.mcpConfigJson);
  messageErr.value = false;
  message.value = "MCP 配置已复制";
}

async function installEnv() {
  if (activeTab.value === "manual") return;
  const host = activeTab.value;
  const r = await desktop().installAiEnv({ host });
  messageErr.value = !r.ok;
  message.value = r.ok
    ? `已安装/更新 MCP 与 Skill。请完全退出对应 AI 工具后再从「AI设计」重开。`
    : (r.error ?? "安装失败");
  await refresh({ silent: true });
}

async function uninstallEnv() {
  if (activeTab.value === "manual") return;
  const host = activeTab.value;
  const label = editorTabs.find((t) => t.id === host)?.label ?? host;
  if (!confirm(`确定卸载 ${label} 的 ForgeUI MCP 与 Skill？`)) return;
  const r = await desktop().uninstallAiEnv({ host });
  messageErr.value = !r.ok;
  message.value = r.ok ? "已卸载 MCP 与 Skill" : (r.error ?? "卸载失败");
  await refresh({ silent: true });
}

async function launchHost() {
  if (activeTab.value === "manual") return;
  const r = await desktop().launchAiHost({ host: activeTab.value });
  messageErr.value = !r.ok;
  message.value = r.ok ? (r.hint ?? "已启动") : (r.error ?? "启动失败");
  await refresh({ silent: true });
}

onMounted(() => {
  void refresh();
});

defineExpose({ refresh });
</script>

<style scoped>
.ai-panel {
  display: grid;
  gap: 14px;
}
.muted {
  color: var(--muted);
  font-size: 12px;
}
.card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--panel-2);
}
.card h3 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
}
.mcp-service-row .service-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.refresh-btn {
  margin-left: auto;
}
.ws-path {
  margin: 8px 0 0;
}
.badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
}
.badge.ok {
  color: #3b9b6e;
  border-color: #3b9b6e55;
  background: #3b9b6e18;
}
.badge.warn {
  color: #b8860b;
  border-color: #b8860b55;
  background: #b8860b18;
}
.badge.miss,
.badge.bad {
  color: var(--muted);
}
.badge.bad {
  color: #c05050;
  border-color: #c0505055;
}
.host-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}
.host-tab {
  font-size: 12px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.host-tab.on {
  color: var(--text);
  border-color: var(--border);
  background: var(--panel);
  font-weight: 600;
}
.tab-body {
  display: grid;
  gap: 12px;
}
.field-row {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 10px;
  align-items: start;
}
.field-label {
  font-size: 12px;
  color: var(--muted);
  padding-top: 4px;
}
.field-main {
  min-width: 0;
}
.path-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.help {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.45;
}
.help.inline {
  margin: 0 0 0 8px;
  display: inline;
}
.hint,
.hint-block {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
}
.refresh-time {
  font-variant-numeric: tabular-nums;
}
.hint-block {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--panel);
  border: 1px dashed var(--border);
}
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mono {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}
.code-block {
  margin: 0;
  padding: 10px;
  font-size: 11px;
  font-family: ui-monospace, Consolas, monospace;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: auto;
  max-height: 240px;
  white-space: pre-wrap;
  word-break: break-all;
}
.flash {
  margin: 10px 0 0;
  font-size: 12px;
  color: #3b9b6e;
}
.flash.err {
  color: #c05050;
}
.tx {
  border-color: var(--accent);
}
.mini {
  font-size: 12px;
  padding: 4px 8px;
}
button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
button.danger {
  color: #c05050;
  border-color: #c0505088;
  background: transparent;
}
button:disabled {
  opacity: 0.5;
}
</style>
