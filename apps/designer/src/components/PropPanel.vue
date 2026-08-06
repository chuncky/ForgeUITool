<template>
  <section class="prop-panel">
    <template v-if="node">
      <PropIdentityHeader
        :type-label="typeLabel"
        :widget-type="node.type"
        :node-id="node.id"
        :name="node.name"
        @update:name="onName"
      />

      <div class="groups">
        <LayoutGroup
          :is-screen="isScreen"
          :frame="node.frame"
          :parent-width="parentWidth"
          :parent-height="parentHeight"
          :display-width="displayWidth"
          :display-height="displayHeight"
          :show-layout-type="isContainer"
          :layout-type="String(node.props.layout_type ?? 'none')"
          :grid-columns="Number(node.props.grid_columns ?? 2)"
          :grid-rows="Number(node.props.grid_rows ?? 2)"
          @update:frame="onFrame"
          @update:display="onDisplay"
          @update:layout="onLayoutType"
          @update:grid="onGridTracks"
        />

        <PropGroup v-if="propSpecs.length">
          <template #title>属性</template>
          <DynamicPropForm :specs="propSpecs" :node-props="node.props" @change="onProp" />
        </PropGroup>

        <ExtraDataGroup
          v-if="extraDataEditor"
          :editor-kind="extraDataEditor"
          :extra-data="extraDataModel"
          @patch="onExtraData"
        />

        <BehaviorGroup v-if="!isScreen" :node-props="node.props" @change="onBehavior" />

        <StyleGroup
          :widget-type="node.type"
          :style="node.style"
          :style-parts="styleParts"
          :style-ref="node.styleRef"
          @patch="onStylePatch"
          @update-disabled-subgroups="onDisabledSubgroups"
          @clear-style-ref="onClearStyleRef"
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
import ExtraDataGroup from "./prop-panel/ExtraDataGroup.vue";
import StyleGroup from "./prop-panel/StyleGroup.vue";
import type { ExtraDataEditorKind } from "../env";
import { withDisabledSubgroups } from "../utils/style";

/** Stable empty object — avoid `?? {}` creating a new ref every render (resets tab editor). */
const EMPTY_EXTRA: Record<string, unknown> = Object.freeze({});

const store = useProjectStore();
const node = computed(() => store.selectedNode);
const isScreen = computed(() => node.value?.type === "screen");
const isContainer = computed(() => {
  if (!node.value || isScreen.value) return false;
  return store.widgetSpec(node.value.type)?.isContainer === true;
});

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

const extraDataEditor = computed((): ExtraDataEditorKind | undefined => {
  if (!node.value) return undefined;
  return store.widgetSpec(node.value.type)?.extraDataEditor;
});

const extraDataModel = computed(
  (): Record<string, unknown> =>
    (node.value?.extraData as Record<string, unknown> | undefined) ?? EMPTY_EXTRA,
);

const displayWidth = computed(() => store.loaded?.project.display.width ?? 480);
const displayHeight = computed(() => store.loaded?.project.display.height ?? 320);
const parentWidth = computed(() => store.selectedParentSize.w);
const parentHeight = computed(() => store.selectedParentSize.h);

function onName(value: string) {
  store.patchSelected({ name: value });
}

function onFrame(patch: Record<string, number>) {
  store.patchSelected({ frame: patch });
}

function onLayoutType(layoutType: string) {
  store.patchSelected({ props: { layout_type: layoutType } });
}

function onGridTracks(patch: { grid_columns?: number; grid_rows?: number }) {
  store.patchSelected({ props: patch });
}

async function onDisplay(patch: { width?: number; height?: number }) {
  await store.patchDisplay(patch);
}

function onProp(name: string, value: unknown) {
  store.patchSelected({ props: { [name]: value } });
}

function onExtraData(patch: Record<string, unknown>) {
  // Merge into existing extraData object identity path via store optimistic patch.
  store.patchSelected({ extraData: patch });
}

function onBehavior(patch: Record<string, unknown>) {
  store.patchSelected({ props: patch });
}

function onStylePatch(part: string, state: string, patch: Record<string, unknown>) {
  store.patchSelectedStyle(part, state, patch);
}

function onClearStyleRef() {
  store.patchSelected({ styleRef: null });
}

function onDisabledSubgroups(ids: string[]) {
  if (!node.value) return;
  store.patchSelected({ style: withDisabledSubgroups(node.value.style as Record<string, unknown>, ids) });
}
</script>

<style scoped>
.prop-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.groups {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
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
