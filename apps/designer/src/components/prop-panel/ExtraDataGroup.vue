<template>
  <PropGroup v-if="editorKind">
    <template #title>{{ groupTitle }}</template>
    <ItemsExtraDataEditor
      v-if="editorKind === 'items'"
      :model="extraData"
      @change="emitPatch"
    />
    <TabsExtraDataEditor
      v-else-if="editorKind === 'tabs'"
      :model="extraData"
      @change="emitPatch"
    />
    <ButtonsExtraDataEditor
      v-else-if="editorKind === 'buttons'"
      :model="extraData"
      @change="emitPatch"
    />
    <SeriesExtraDataEditor
      v-else-if="editorKind === 'series'"
      :model="extraData"
      @change="emitPatch"
    />
    <CellsExtraDataEditor
      v-else-if="editorKind === 'cells'"
      :model="extraData"
      @change="emitPatch"
    />
    <KeymapExtraDataEditor
      v-else-if="editorKind === 'keymap'"
      :model="extraData"
      @change="emitPatch"
    />
    <FramesExtraDataEditor
      v-else-if="editorKind === 'frames'"
      :model="extraData"
      @change="emitPatch"
    />
  </PropGroup>
</template>

<script setup lang="ts">
import { computed } from "vue";
import PropGroup from "./PropGroup.vue";
import ItemsExtraDataEditor from "./extra-data/ItemsExtraDataEditor.vue";
import TabsExtraDataEditor from "./extra-data/TabsExtraDataEditor.vue";
import ButtonsExtraDataEditor from "./extra-data/ButtonsExtraDataEditor.vue";
import SeriesExtraDataEditor from "./extra-data/SeriesExtraDataEditor.vue";
import CellsExtraDataEditor from "./extra-data/CellsExtraDataEditor.vue";
import KeymapExtraDataEditor from "./extra-data/KeymapExtraDataEditor.vue";
import FramesExtraDataEditor from "./extra-data/FramesExtraDataEditor.vue";
import type { ExtraDataEditorKind } from "../../env";

const props = defineProps<{
  editorKind?: ExtraDataEditorKind;
  extraData: Record<string, unknown>;
}>();

const emit = defineEmits<{
  patch: [patch: Record<string, unknown>];
}>();

const editorKind = computed(() => props.editorKind);

/** BK 对照：tabview 子项区标题为「子项」，其它仍用扩展数据。 */
const groupTitle = computed(() => (props.editorKind === "tabs" ? "子项" : "扩展数据"));

function emitPatch(patch: Record<string, unknown>) {
  emit("patch", patch);
}
</script>
