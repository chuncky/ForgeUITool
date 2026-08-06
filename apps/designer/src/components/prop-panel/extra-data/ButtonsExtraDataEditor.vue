<template>
  <ItemsExtraDataEditor :model="{ items: buttonsAsItems }" @change="onButtonsChange" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import ItemsExtraDataEditor from "./ItemsExtraDataEditor.vue";

const props = defineProps<{
  model: Record<string, unknown>;
}>();

const emit = defineEmits<{
  change: [patch: Record<string, unknown>];
}>();

const buttonsAsItems = computed(() => {
  const raw = props.model.buttons;
  if (!Array.isArray(raw)) return [];
  return raw.map((b) => {
    if (b && typeof b === "object" && "text" in b) return b;
    return { text: String(b ?? "") };
  });
});

function onButtonsChange(patch: Record<string, unknown>) {
  if ("items" in patch) {
    emit("change", { buttons: patch.items });
  } else {
    emit("change", patch);
  }
}
</script>
