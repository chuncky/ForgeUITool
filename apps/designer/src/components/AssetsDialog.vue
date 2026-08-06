<template>

  <div v-if="ui.showAssets" class="mask" @click.self="close">

    <div class="dialog">

      <h2>资源管理</h2>

      <p v-if="ui.fontPickHandler" class="pick-hint">选择字体以填入 text_font</p>
      <p v-else-if="ui.imagePickHandler" class="pick-hint">选择图片以填入属性字段</p>

      <p v-else class="hint">导入图片至工程 assets/images/；属性面板 imageSrc 字段可从此选择。</p>



      <div class="toolbar">
        <button type="button" class="primary" :disabled="importing" @click="importImages">
          {{ importing ? "导入中…" : "导入图片" }}
        </button>
        <button type="button" :disabled="importing" @click="importFonts">
          导入字体
        </button>
      </div>



      <h3>图片</h3>

      <ul v-if="images.length" class="asset-list">

        <li v-for="img in images" :key="img.path">

          <button type="button" class="asset-row" @click="onPick(img.path)">

            <span class="name">{{ img.id }}</span>

            <span class="path">{{ img.path }}</span>

          </button>

        </li>

      </ul>

      <p v-else class="empty">暂无图片资源</p>



      <h3>字体</h3>
      <ul v-if="fonts.length" class="asset-list">
        <li v-for="f in fonts" :key="f.path">
          <button type="button" class="asset-row" @click="onPickFont(f.id)">
            <span class="name">{{ f.id }}</span>
            <span class="path">{{ f.path }}{{ f.size ? ` · ${f.size}px` : "" }}</span>
          </button>
        </li>
      </ul>
      <p v-else class="empty">暂无字体；导入 TTF 后 generate 将按工程文案裁剪</p>



      <div class="actions">

        <button @click="close">关闭</button>

      </div>

    </div>

  </div>

</template>



<script setup lang="ts">

import { computed, ref } from "vue";

import { useProjectStore } from "../stores/project";

import { useUiStore } from "../stores/ui";



const store = useProjectStore();

const ui = useUiStore();

const importing = ref(false);



const images = computed(() => store.imageAssets);
const fonts = computed(() => store.fontAssets);

async function importImages() {

  importing.value = true;

  try {

    await store.importImages();

  } finally {

    importing.value = false;

  }

}



async function importFonts() {
  importing.value = true;
  try {
    await store.importFonts();
  } finally {
    importing.value = false;
  }
}

function onPickFont(id: string) {
  if (ui.fontPickHandler) {
    ui.pickFontAsset(id);
    return;
  }
}

function onPick(path: string) {

  if (ui.imagePickHandler) {

    ui.pickImageAsset(path);

    return;

  }

}



function close() {

  ui.clearImagePick();
  ui.clearFontPick();

  ui.showAssets = false;

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

  width: min(480px, 92vw);

  max-height: 80vh;

  overflow: auto;

  background: var(--panel);

  border: 1px solid var(--border);

  border-radius: 12px;

  padding: 16px;

}



h2 {

  margin: 0 0 8px;

}



h3 {

  margin: 12px 0 6px;

  font-size: 13px;

  color: var(--muted);

}



.hint,

.empty,

.pick-hint {

  color: var(--muted);

  font-size: 12px;

}



.pick-hint {

  color: var(--accent);

}



.toolbar {

  margin: 10px 0;

}



.asset-list {

  margin: 0;

  padding: 0;

  list-style: none;

}



.asset-row {

  width: 100%;

  display: grid;

  gap: 2px;

  padding: 8px;

  margin-bottom: 4px;

  border: 1px solid var(--border);

  border-radius: 6px;

  background: var(--panel-2);

  text-align: left;

  cursor: pointer;

}



.asset-row:hover {

  border-color: var(--accent);

}



.name {

  font-size: 13px;

  color: var(--text);

}



.path {

  font-size: 11px;

  color: var(--muted);

  word-break: break-all;

}



.actions {

  display: flex;

  justify-content: flex-end;

  margin-top: 16px;

}



button {

  padding: 8px 12px;

  border-radius: 6px;

  border: 1px solid var(--border);

  background: var(--bg);

  color: var(--text);

  cursor: pointer;

}



button.primary {

  background: var(--accent);

  border-color: var(--accent);

  color: #fff;

}



button:disabled {

  opacity: 0.6;

  cursor: not-allowed;

}

</style>

