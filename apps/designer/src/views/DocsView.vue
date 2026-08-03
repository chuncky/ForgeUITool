<template>
  <div class="page">
    <h1>文档</h1>
    <p class="lead">上板与闭环说明（NFR-007）。权威需求见仓库 docs/。</p>
    <div class="actions">
      <button
        v-for="d in docs"
        :key="d.id"
        :class="{ on: active === d.id }"
        @click="load(d.id)"
      >
        {{ d.label }}
      </button>
    </div>
    <pre class="md">{{ content || "选择左侧文档…" }}</pre>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

const docs = [
  { id: "hello-qm10xd", label: "qm10xd 上板 HELLO" },
  { id: "readme", label: "产品 README" },
];

const active = ref("hello-qm10xd");
const content = ref("");

async function load(id: string) {
  active.value = id;
  if (!window.forgeuiDesktop?.readDoc) {
    content.value = "请通过 Electron 启动设计器以加载文档。";
    return;
  }
  content.value = await window.forgeuiDesktop.readDoc(id);
}

onMounted(() => load(active.value));
</script>

<style scoped>
.page {
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 24px 40px;
  display: grid;
  gap: 12px;
  height: 100%;
  grid-template-rows: auto auto auto 1fr;
}

h1 {
  margin: 0;
  font-size: 24px;
}

.lead {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.actions .on {
  border-color: var(--accent);
  background: var(--accent-2);
}

.md {
  margin: 0;
  padding: 16px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
}
</style>
