<template>
  <div v-if="ui.showAiAssist" class="mask" @click.self="close">
    <div class="dialog" role="dialog" aria-labelledby="ai-panel-title">
      <header class="head">
        <h2 id="ai-panel-title">AI 设计</h2>
        <button type="button" class="icon-btn" aria-label="关闭" @click="close">×</button>
      </header>

      <section v-if="loading" class="section muted">加载中…</section>
      <template v-else-if="state">
        <section class="section status-row">
          <span class="badge" :class="bridgeStatusClass">{{ bridgeStatusLabel }}</span>
          <span v-if="state.previewBusy" class="hint-inline">预览/编译进行中，Bridge 写入已暂停</span>
        </section>

        <section class="section">
          <h3>Bridge</h3>
          <p class="mono">{{ bridgeUrl }}</p>
          <p v-if="state.aiWorkspacePath" class="mono path">{{ state.aiWorkspacePath }}</p>
          <div class="btn-row">
            <button type="button" @click="setupWorkspace">初始化 .forge-ai</button>
            <button type="button" @click="openFolder">打开工作区文件夹</button>
            <button type="button" @click="ping">测试连通</button>
            <button type="button" @click="copyMcp">复制 MCP 配置</button>
          </div>
          <p v-if="message" class="flash" :class="{ err: messageErr }">{{ message }}</p>
        </section>

        <section v-if="state.transaction.pending" class="section tx">
          <strong>待确认 AI 变更（{{ state.transaction.changeCount }} 项）</strong>
          <p class="hint">请在底部栏「保存 / 撤销 AI 变更」确认后再落盘。</p>
        </section>

        <section class="section">
          <h3>MCP 工具</h3>
          <table class="tools">
            <thead>
              <tr>
                <th>工具</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in state.tools" :key="t.name">
                <td>
                  <code>{{ t.name }}</code>
                  <span class="desc">{{ t.description }}</span>
                </td>
                <td>
                  <span class="pill" :class="t.implemented ? 'ok' : 'stub'">{{
                    t.implemented ? "可用" : "stub"
                  }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="section hint-block">
          <p>
            在 Cursor 中打开 <code>.forge-ai</code> 目录，配置 MCP 后调用工具。每次请求须带
            <code>aiWorkspacePath</code>。不会直接改写 <code>user/</code> 区（D-02）。
          </p>
        </section>
      </template>

      <footer class="foot">
        <button type="button" class="primary" @click="close">关闭</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useUiStore } from "../stores/ui";
import { useProjectStore } from "../stores/project";

const ui = useUiStore();
const store = useProjectStore();

type PanelState = Awaited<ReturnType<NonNullable<typeof window.forgeuiDesktop>["getAiPanelState"]>>;

const loading = ref(false);
const state = ref<PanelState | null>(null);
const message = ref("");
const messageErr = ref(false);

const bridgeUrl = computed(() =>
  state.value ? `http://127.0.0.1:${state.value.bridgePort}` : "",
);

const bridgeStatusLabel = computed(() => {
  if (!state.value) return "—";
  if (state.value.previewBusy) return "PREVIEW_BUSY";
  const ping = state.value.bridgePing;
  if (ping && typeof ping === "object" && "status" in ping && ping.status) return String(ping.status);
  if (ping && "error" in ping && ping.error) return "OFFLINE";
  return state.value.projectOpen ? "READY" : "NOT_IN_WORKSPACE";
});

const bridgeStatusClass = computed(() => {
  const s = bridgeStatusLabel.value;
  if (s === "READY") return "ok";
  if (s === "PREVIEW_BUSY") return "warn";
  return "bad";
});

function desktop() {
  const d = window.forgeuiDesktop;
  if (!d) throw new Error("Not in Electron shell");
  return d;
}

async function refresh() {
  loading.value = true;
  message.value = "";
  try {
    state.value = await desktop().getAiPanelState();
    await store.refreshAiTransactionState();
  } finally {
    loading.value = false;
  }
}

function close() {
  ui.showAiAssist = false;
}

async function setupWorkspace() {
  const r = await desktop().setupAiWorkspace();
  if (!r.ok) {
    messageErr.value = true;
    message.value = r.error ?? "初始化失败";
    return;
  }
  messageErr.value = false;
  message.value = `已创建 ${r.aiWorkspacePath}`;
  await refresh();
}

async function openFolder() {
  await desktop().openAiWorkspaceFolder();
}

async function ping() {
  const r = await desktop().pingAiBridge();
  messageErr.value = !r.ok;
  message.value = r.ok
    ? `Bridge OK · ${JSON.stringify(r.data)}`
    : (r.error ?? "ping 失败");
  await refresh();
}

async function copyMcp() {
  if (!state.value?.mcpConfigJson) return;
  await navigator.clipboard.writeText(state.value.mcpConfigJson);
  messageErr.value = false;
  message.value = "MCP 配置已复制到剪贴板";
}

watch(
  () => ui.showAiAssist,
  (open) => {
    if (open) void refresh();
  },
);
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 50;
}

.dialog {
  width: min(560px, 94vw);
  max-height: 88vh;
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 8px;
  border-bottom: 1px solid var(--border);
}

.head h2 {
  margin: 0;
  font-size: 16px;
}

.icon-btn {
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: var(--muted);
}

.section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.section h3 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.muted {
  color: var(--muted);
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  word-break: break-all;
}

.path {
  color: var(--muted);
  margin-top: 4px;
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.btn-row button {
  font-size: 12px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  text-transform: uppercase;
}

.badge.ok {
  background: rgba(46, 125, 50, 0.2);
  color: #81c784;
}

.badge.warn {
  background: rgba(255, 152, 0, 0.2);
  color: #ffb74d;
}

.badge.bad {
  background: rgba(198, 40, 40, 0.2);
  color: #e57373;
}

.hint-inline {
  font-size: 12px;
  color: var(--muted);
}

.flash {
  margin: 8px 0 0;
  font-size: 12px;
  color: #81c784;
}

.flash.err {
  color: #e57373;
}

.tx {
  background: rgba(61, 90, 254, 0.08);
}

.tools {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.tools th,
.tools td {
  text-align: left;
  padding: 6px 4px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.desc {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin-top: 2px;
}

.pill {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}

.pill.ok {
  background: rgba(46, 125, 50, 0.25);
  color: #a5d6a7;
}

.pill.stub {
  background: rgba(128, 128, 128, 0.2);
  color: var(--muted);
}

.hint-block p {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.foot {
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
