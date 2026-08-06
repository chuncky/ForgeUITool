<template>
  <div v-if="ui.showSaveStyle" class="mask" @click.self="cancel">
    <div class="dialog" role="dialog" aria-labelledby="save-style-title">
      <header class="head">
        <h2 id="save-style-title">保存样式</h2>
        <button type="button" class="icon-x" title="关闭" @click="cancel">×</button>
      </header>

      <label class="field">
        <span class="req">样式名称</span>
        <div class="input-wrap">
          <input
            v-model="name"
            maxlength="50"
            placeholder="请输入样式名称"
            @keydown.enter.prevent="save"
          />
          <span class="counter">{{ name.length }} / 50</span>
        </div>
      </label>

      <label class="field">
        样式描述
        <div class="input-wrap">
          <textarea
            v-model="description"
            rows="3"
            maxlength="200"
            placeholder="可选，简要描述这个样式的特点"
          />
          <span class="counter">{{ description.length }} / 200</span>
        </div>
      </label>

      <div class="field">
        <span class="label">样式图标</span>
        <div class="preview-box">
          <span class="preview-chip" :style="previewStyle">Button</span>
        </div>
      </div>

      <footer class="actions">
        <button type="button" class="ghost" @click="cancel">取消</button>
        <button type="button" class="primary" :disabled="!name.trim()" @click="save">保存</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useProjectStore } from "../stores/project";
import { useUiStore } from "../stores/ui";
import { styleThemePreviewChrome } from "../utils/style-theme-preview";

const store = useProjectStore();
const ui = useUiStore();

const name = ref("");
const description = ref("");

watch(
  () => ui.showSaveStyle,
  (open) => {
    if (!open) return;
    const draft = ui.saveStyleDraft;
    name.value = draft ? `${draft.part}_${draft.state}` : "";
    description.value = "";
  },
);

const previewStyle = computed(() =>
  styleThemePreviewChrome(ui.saveStyleDraft?.props),
);

function cancel() {
  ui.closeSaveStyle();
}

async function save() {
  const draft = ui.saveStyleDraft;
  if (!draft || !name.value.trim()) return;
  await store.saveStyleTheme({
    name: name.value,
    description: description.value,
    part: draft.part,
    state: draft.state,
    props: draft.props,
    widgetType: draft.widgetType,
  });
  ui.closeSaveStyle();
}
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 80;
}

.dialog {
  width: min(420px, 92vw);
  background: var(--panel, #1a2332);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px 14px;
  display: grid;
  gap: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.icon-x {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.field {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}

.req::after {
  content: " *";
  color: #f87171;
}

.input-wrap {
  position: relative;
}

input,
textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg, #0f172a);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 8px 10px 22px;
  font-size: 13px;
  resize: vertical;
}

.counter {
  position: absolute;
  right: 8px;
  bottom: 6px;
  font-size: 10px;
  color: var(--muted);
  pointer-events: none;
}

.label {
  font-size: 12px;
  color: var(--muted);
}

.preview-box {
  background: #0b1220;
  border: 1px solid var(--border);
  border-radius: 8px;
  min-height: 88px;
  display: grid;
  place-items: center;
}

.preview-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  min-height: 36px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  box-sizing: border-box;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.ghost,
.primary {
  border-radius: 6px;
  padding: 7px 14px;
  font-size: 13px;
  cursor: pointer;
}

.ghost {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.primary {
  background: #3b82f6;
  border: 1px solid #3b82f6;
  color: #fff;
}

.primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
