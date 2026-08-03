<template>
  <div class="gate">
    <h1>工作区</h1>
    <p>尚未打开工程。权威格式为多文件目录（project.json + screens/），单文件仅作导出/分享。</p>
    <div class="cta">
      <button class="primary" @click="ui.showNewProject = true">新建工程</button>
      <button @click="openDir">打开工程</button>
      <button @click="openHello">打开 Hello 示例</button>
    </div>
    <p class="sub">导入 .forgeui：请使用 CLI <code>forgeui unbundle</code>（设计器导入 V1）。</p>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";

const project = useProjectStore();
const ui = useUiStore();
const router = useRouter();

async function openDir() {
  await project.openDir();
  if (project.loaded) await router.push("/workspace");
}

async function openHello() {
  await project.openHello();
}
</script>

<style scoped>
.gate {
  max-width: 520px;
  margin: 64px auto;
  padding: 24px;
  text-align: center;
}

h1 {
  margin: 0 0 12px;
}

p {
  color: var(--muted);
  line-height: 1.5;
}

.cta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin: 24px 0 16px;
}

.sub {
  font-size: 12px;
}

code {
  color: var(--accent);
}
</style>
