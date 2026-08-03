<template>
  <div class="home">
    <section class="hero">
      <h1>ForgeUI Kit</h1>
      <p>
        面向 qm10xd / qm10xv / qm10xh 的 LVGL 可视化工具：拖拽多页 → 生成标准 LVGL C → SDL 真预览 →
        接入平台 SDK。
      </p>
    </section>

    <section class="quick">
      <h2>快速开始</h2>
      <div class="cards">
        <button class="card" @click="ui.showNewProject = true">
          <strong>新建工程</strong>
          <span>自有 JSON · 默认 qm10xd · deliveryMode=both</span>
        </button>
        <button class="card" @click="openProject">
          <strong>打开工程</strong>
          <span>选择含 project.json 的目录</span>
        </button>
        <button class="card" @click="router.push('/docs')">
          <strong>文档</strong>
          <span>上板 HELLO 与使用说明</span>
        </button>
        <button class="card" @click="openHello">
          <strong>示例模板</strong>
          <span>Hello 双页（非他厂云资源）</span>
        </button>
      </div>
    </section>

    <section class="recent">
      <h2>最近项目</h2>
      <ul v-if="settings.settings.recentProjects.length">
        <li v-for="r in settings.settings.recentProjects" :key="r.root">
          <button class="row" @click="openRecent(r.root)">
            <div>
              <strong>{{ r.name }}</strong>
              <span class="meta"
                >{{ r.platform }} · {{ r.width }}×{{ r.height }} · {{ formatTime(r.openedAt) }}</span
              >
              <span class="path">{{ r.root }}</span>
            </div>
          </button>
          <button class="rm" title="从列表移除" @click="settings.removeRecent(r.root)">×</button>
        </li>
      </ul>
      <p v-else class="empty">暂无最近工程。新建或打开后会出现在此。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useProjectStore } from "../stores/project";
import { useSettingsStore } from "../stores/settings";
import { useUiStore } from "../stores/ui";

const router = useRouter();
const project = useProjectStore();
const settings = useSettingsStore();
const ui = useUiStore();

async function openProject() {
  await project.openDir();
  if (project.loaded) await router.push("/workspace");
}

async function openHello() {
  await project.openHello();
  if (project.loaded) await router.push("/workspace");
}

async function openRecent(root: string) {
  await project.openPath(root);
  if (project.loaded) await router.push("/workspace");
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
</script>

<style scoped>
.home {
  max-width: 960px;
  margin: 0 auto;
  padding: 36px 24px 48px;
}

.hero {
  padding: 28px 0 36px;
  background: radial-gradient(ellipse at 20% 0%, rgba(61, 156, 240, 0.18), transparent 55%);
}

.hero h1 {
  margin: 0 0 10px;
  font-size: 36px;
  letter-spacing: 0.02em;
}

.hero p {
  margin: 0;
  max-width: 560px;
  color: var(--muted);
  line-height: 1.55;
  font-size: 15px;
}

.quick h2,
.recent h2 {
  margin: 0 0 14px;
  font-size: 14px;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 40px;
}

.card {
  display: grid;
  gap: 8px;
  text-align: left;
  padding: 16px;
  min-height: 110px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.card strong {
  font-size: 15px;
}

.card span {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.card:hover {
  border-color: var(--accent);
  background: var(--panel-2);
}

.recent ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.recent li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: stretch;
}

.row {
  text-align: left;
  padding: 12px 14px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.row:hover {
  border-color: var(--accent);
}

.row strong {
  display: block;
  margin-bottom: 4px;
}

.meta,
.path {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.path {
  margin-top: 4px;
  opacity: 0.8;
  word-break: break-all;
}

.rm {
  padding: 0 12px;
}

.empty {
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 900px) {
  .cards {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
