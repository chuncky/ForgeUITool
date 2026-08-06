<template>
  <div v-if="ui.showMemoryEstimate" class="mask" @click.self="ui.showMemoryEstimate = false">
    <div class="dlg" role="dialog" aria-label="内存估算">
      <h2>内存估算 / Target（FR-076）</h2>
      <div v-if="estimate" class="stats">
        <p>图片 ≈ {{ fmt(estimate.imagesBytes) }}</p>
        <p>字体 ≈ {{ fmt(estimate.fontsEstimateBytes) }}</p>
        <p>控件元数据 ≈ {{ fmt(estimate.screensBytes) }}</p>
        <p>动画 ≈ {{ fmt(estimate.animEstimateBytes) }}</p>
        <p class="total"><strong>合计 ≈ {{ fmt(estimate.totalBytes) }}</strong></p>
        <ul>
          <li v-for="(n, i) in estimate.notes" :key="i">{{ n }}</li>
        </ul>
      </div>
      <h3>显示 Target</h3>
      <ul class="targets">
        <li v-for="t in targets" :key="t.id">
          {{ t.name }} — {{ t.width }}×{{ t.height }} @{{ t.colorDepth }}bpp
        </li>
      </ul>
      <div class="footer">
        <button type="button" class="primary" @click="ui.showMemoryEstimate = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useUiStore } from "../stores/ui";
import { useProjectStore } from "../stores/project";

const ui = useUiStore();
const store = useProjectStore();

type Est = {
  imagesBytes: number;
  fontsEstimateBytes: number;
  screensBytes: number;
  animEstimateBytes: number;
  totalBytes: number;
  notes: string[];
};

const estimate = ref<Est | null>(null);
const targets = computed(() => {
  const p = store.loaded?.project;
  if (!p) return [];
  if (Array.isArray(p.targets) && p.targets.length) return p.targets;
  return [
    {
      id: "default",
      name: "Default",
      width: p.display.width,
      height: p.display.height,
      colorDepth: p.display.colorDepth,
    },
  ];
});

function fmt(n: number) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

watch(
  () => ui.showMemoryEstimate,
  async (open) => {
    if (!open || !store.loaded) {
      estimate.value = null;
      return;
    }
    estimate.value = await store.estimateMemory();
  },
);
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 80;
}
.dlg {
  width: min(560px, 92vw);
  background: #1e2430;
  color: #e8ecf4;
  border-radius: 10px;
  padding: 16px;
  border: 1px solid #3a4558;
}
.stats p {
  margin: 4px 0;
  font-size: 13px;
}
.total {
  margin-top: 10px !important;
}
.targets {
  font-size: 12px;
}
.footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.primary {
  background: #3b6ea5;
  border: 1px solid #4d82bd;
  color: inherit;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
}
</style>
