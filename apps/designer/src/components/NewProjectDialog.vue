<template>
  <div v-if="open" class="mask" @click.self="emit('close')">
    <div class="dialog">
      <h2>新建工程</h2>
      <p class="hint">对应需求 FR-001/002：自有 JSON 工程，默认平台 qm10xd、LVGL 9.10、deliveryMode=both</p>
      <label>
        工程名称
        <input v-model="name" placeholder="my_ui" />
      </label>
      <label>
        目标平台
        <select v-model="platform">
          <option value="qm10xd">qm10xd（MVP 首发）</option>
          <option value="qm10xv">qm10xv（V1）</option>
          <option value="qm10xh">qm10xh（V1）</option>
        </select>
      </label>
      <label>
        模板
        <select v-model="template">
          <option value="blank">空白单页</option>
          <option value="hello-dual-screen">Hello 双页示例</option>
        </select>
      </label>
      <label>
        交付模式 deliveryMode
        <select v-model="deliveryMode">
          <option value="both">both（默认启用 A2 骨架）</option>
          <option value="static_c">static_c（仅静态 C）</option>
          <option value="dynamic_ui">dynamic_ui</option>
        </select>
      </label>
      <label>
        分辨率
        <div class="row">
          <input v-model.number="width" type="number" min="1" />
          <span>×</span>
          <input v-model.number="height" type="number" min="1" />
        </div>
      </label>
      <div class="actions">
        <button @click="emit('close')">取消</button>
        <button class="primary" :disabled="!name.trim()" @click="submit">选择目录并创建</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  create: [
    opts: {
      name: string;
      platform: "qm10xd" | "qm10xv" | "qm10xh";
      template: "blank" | "hello-dual-screen";
      width: number;
      height: number;
      deliveryMode: "both" | "static_c" | "dynamic_ui";
    },
  ];
}>();

const name = ref("my_ui");
const platform = ref<"qm10xd" | "qm10xv" | "qm10xh">("qm10xd");
const template = ref<"blank" | "hello-dual-screen">("hello-dual-screen");
const width = ref(480);
const height = ref(320);
const deliveryMode = ref<"both" | "static_c" | "dynamic_ui">("both");

watch(
  () => props.open,
  (v) => {
    if (v) {
      name.value = "my_ui";
      platform.value = "qm10xd";
      template.value = "hello-dual-screen";
      width.value = 480;
      height.value = 320;
      deliveryMode.value = "both";
    }
  },
);

function submit() {
  emit("create", {
    name: name.value.trim(),
    platform: platform.value,
    template: template.value,
    width: width.value,
    height: height.value,
    deliveryMode: deliveryMode.value,
  });
}
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
  width: min(420px, 92vw);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: grid;
  gap: 10px;
}

h2 {
  margin: 0;
  font-size: 18px;
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

input,
select {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
</style>
