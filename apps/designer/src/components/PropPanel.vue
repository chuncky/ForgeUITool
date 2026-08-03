<template>
  <section class="prop-panel">
    <template v-if="node">
      <PropIdentityHeader
        :type-label="typeLabel"
        :node-id="node.id"
        :name="node.name"
        @update:name="onName"
      />

      <div class="groups">
        <LayoutGroup
          :is-screen="isScreen"
          :frame="node.frame"
          :display-width="displayWidth"
          :display-height="displayHeight"
          @update:frame="onFrame"
          @update:display="onDisplay"
        />

        <PropGroup v-if="propSpecs.length">
          <template #title>属性</template>
          <DynamicPropForm :specs="propSpecs" :node-props="node.props" @change="onProp" />
        </PropGroup>

        <BehaviorGroup v-if="!isScreen" :node-props="node.props" @change="onBehavior" />

        <StyleGroup
          :widget-type="node.type"
          :style="node.style"
          :style-parts="styleParts"
          @patch="onStylePatch"
        />
      </div>

      <button v-if="!isScreen" class="danger" type="button" @click="store.removeSelected()">删除控件</button>
    </template>

    <p v-else class="hint">未选中控件</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PropSpecMeta } from "../env";
import { useProjectStore } from "../stores/project";
import PropIdentityHeader from "./prop-panel/PropIdentityHeader.vue";
import LayoutGroup from "./prop-panel/LayoutGroup.vue";
import PropGroup from "./prop-panel/PropGroup.vue";
import DynamicPropForm from "./prop-panel/DynamicPropForm.vue";
import BehaviorGroup from "./prop-panel/BehaviorGroup.vue";
import StyleGroup from "./prop-panel/StyleGroup.vue";

const store = useProjectStore();
const node = computed(() => store.selectedNode);
const isScreen = computed(() => node.value?.type === "screen");

const typeLabel = computed(() => {
  if (!node.value) return "";
  const spec = store.widgetSpec(node.value.type);
  return spec?.label["zh-CN"] ?? node.value.type;
});

const propSpecs = computed((): PropSpecMeta[] => {
  if (!node.value) return [];
  return store.widgetSpec(node.value.type)?.props ?? [];
});

const styleParts = computed(() => {
  if (!node.value) return ["main"];
  return store.widgetSpec(node.value.type)?.styleParts ?? ["main"];
});

const displayWidth = computed(() => store.loaded?.project.display.width ?? 480);
const displayHeight = computed(() => store.loaded?.project.display.height ?? 320);

function onName(value: string) {
  store.patchSelected({ name: value });
}

function onFrame(patch: Record<string, number>) {
  store.patchSelected({ frame: patch });
}

async function onDisplay(patch: { width?: number; height?: number }) {
  await store.patchDisplay(patch);
}

function onProp(name: string, value: unknown) {
  store.patchSelected({ props: { [name]: value } });
}

function onBehavior(patch: Record<string, unknown>) {
  store.patchSelected({ props: patch });
}

function onStylePatch(part: string, state: string, patch: Record<string, unknown>) {
  store.patchSelectedStyle(part, state, patch);
}
</script>

<style scoped>
.prop-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.groups {
  flex: 1;
  overflow: auto;
  padding: 0 10px 10px;
  display: grid;
  gap: 6px;
  align-content: start;
}

.danger {
  margin: 0 10px 10px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
  cursor: pointer;
  font-size: 12px;
}

.hint {
  padding: 10px;
  color: var(--muted);
  font-size: 12px;
}
</style>
