<template>
  <Teleport to="body">
    <div v-if="ui.showCodeEditor" class="overlay">
      <div class="panel">
        <header class="head">
          <strong>代码编辑器</strong>
          <span class="hint">custom/ 可编辑 · 其余生成文件只读</span>
          <button @click="ui.showCodeEditor = false">关闭</button>
        </header>
        <div class="body">
          <aside class="files">
            <button
              v-for="f in files"
              :key="f.relPath"
              :class="{ active: f.relPath === activePath, ro: !f.editable }"
              @click="openFile(f.relPath)"
            >
              {{ f.relPath }}
            </button>
          </aside>
          <section class="editor">
            <div class="path">{{ activePath || "选择文件" }}</div>
            <textarea
              v-model="content"
              :readonly="!editable"
              spellcheck="false"
              @keydown.ctrl.s.prevent="save"
            />
            <div class="foot">
              <span v-if="message" class="msg">{{ message }}</span>
              <button v-if="editable && activePath" class="primary" @click="save">保存 (Ctrl+S)</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useUiStore } from "../stores/ui";

const ui = useUiStore();
const files = ref<Array<{ relPath: string; editable: boolean }>>([]);
const activePath = ref("");
const content = ref("");
const editable = ref(false);
const message = ref("");

async function refreshList() {
  if (!window.forgeuiDesktop) return;
  files.value = await window.forgeuiDesktop.listCodeFiles();
  if (!activePath.value && files.value.length) {
    const preferred = files.value.find((f) => f.relPath.endsWith("custom/ui_events.c")) ?? files.value[0];
    await openFile(preferred.relPath);
  }
}

async function openFile(relPath: string) {
  if (!window.forgeuiDesktop) return;
  const meta = files.value.find((f) => f.relPath === relPath);
  const result = await window.forgeuiDesktop.readProjectFile(relPath);
  if (!result.ok) {
    message.value = result.error ?? "读取失败";
    return;
  }
  activePath.value = relPath;
  content.value = result.content ?? "";
  editable.value = meta?.editable ?? false;
  message.value = "";
}

async function save() {
  if (!window.forgeuiDesktop || !activePath.value || !editable.value) return;
  await window.forgeuiDesktop.writeUserFile({ relPath: activePath.value, content: content.value });
  message.value = "已保存";
}

watch(
  () => ui.showCodeEditor,
  (open) => {
    if (open) refreshList();
  },
);

onMounted(() => {
  if (ui.showCodeEditor) refreshList();
});
</script>

<style scoped>
.overlay {
  position: fixed;
  top: 48px;
  right: 0;
  bottom: 32px;
  left: 0;
  z-index: 50;
  background: var(--panel);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto 1fr;
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.hint {
  flex: 1;
  font-size: 12px;
  color: var(--muted);
}

.body {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 0;
}

.files {
  border-right: 1px solid var(--border);
  overflow: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.files button {
  text-align: left;
  font-size: 12px;
  font-family: Consolas, "Courier New", monospace;
  border: none;
  background: transparent;
}

.files button.active {
  background: rgba(61, 156, 240, 0.18);
}

.files button.ro {
  color: var(--muted);
}

.editor {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 0;
}

.path {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  font-family: Consolas, "Courier New", monospace;
}

textarea {
  width: 100%;
  height: 100%;
  resize: none;
  border: none;
  background: #0b1015;
  color: #dbe8f5;
  padding: 10px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.45;
}

.foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-top: 1px solid var(--border);
}

.msg {
  flex: 1;
  font-size: 12px;
  color: var(--muted);
}
</style>

