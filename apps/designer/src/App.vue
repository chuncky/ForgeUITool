<template>
  <div class="app-shell">
    <header class="topnav">
      <div class="brand">ForgeUI Kit</div>
      <nav class="tabs">
        <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab" active-class="on">
          {{ t.label }}
        </RouterLink>
      </nav>
      <div class="hint" v-if="project.loaded">
        {{ project.loaded.project.name }}{{ project.dirty ? " *" : "" }}
      </div>
    </header>
    <main class="main">
      <RouterView />
    </main>
    <footer class="foot">
      <span class="msg" :title="statusText">{{ statusText }}</span>
      <span class="ver">LVGL 9.10 · qm10x</span>
    </footer>
    <NewProjectDialog
      :open="ui.showNewProject"
      @close="ui.showNewProject = false"
      @create="onCreate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRouter } from "vue-router";
import NewProjectDialog from "./components/NewProjectDialog.vue";
import { usePreviewStore } from "./stores/preview";
import { useProjectStore } from "./stores/project";
import { useUiStore } from "./stores/ui";

const project = useProjectStore();
const preview = usePreviewStore();
const ui = useUiStore();
const router = useRouter();

const statusText = computed(() =>
  preview.busy ? `${preview.phase}…` : project.statusLine || "就绪",
);

const tabs = [
  { to: "/home", label: "主页" },
  { to: "/workspace", label: "工作区" },
  { to: "/settings", label: "设置" },
  { to: "/docs", label: "文档" },
  { to: "/about", label: "关于" },
];

async function onCreate(opts: {
  name: string;
  platform: "qm10xd" | "qm10xv" | "qm10xh";
  template: "blank" | "hello-dual-screen";
  width: number;
  height: number;
  deliveryMode: "both" | "static_c" | "dynamic_ui";
}) {
  try {
    const ok = await project.createNew(opts);
    if (ok) {
      ui.showNewProject = false;
      await router.push("/workspace");
    }
  } catch (e) {
    project.log = String(e);
  }
}
</script>

<style scoped>
.app-shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
}

.topnav {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 14px;
  height: 48px;
  background: linear-gradient(180deg, #1c2632 0%, var(--panel) 100%);
  border-bottom: 1px solid var(--border);
}

.brand {
  font-weight: 700;
  letter-spacing: 0.04em;
  font-size: 15px;
}

.tabs {
  display: flex;
  gap: 4px;
}

.tab {
  color: var(--muted);
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 6px 6px 0 0;
  font-size: 13px;
}

.tab:hover {
  color: var(--text);
  background: rgba(61, 156, 240, 0.08);
}

.tab.on {
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-bottom-color: var(--bg);
}

.hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

.main {
  min-height: 0;
  overflow: auto;
}

.foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 14px;
  font-size: 12px;
  color: var(--muted);
  border-top: 1px solid var(--border);
  background: var(--panel);
}

.msg {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ver {
  flex-shrink: 0;
  opacity: 0.7;
}
</style>
