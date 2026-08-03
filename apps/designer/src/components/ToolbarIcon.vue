<template>
  <svg
    class="toolbar-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { TOOLBAR_ICONS, type ToolbarIconId } from "../icons/toolbar";

const props = defineProps<{
  icon: ToolbarIconId;
}>();

const paths = computed(() => TOOLBAR_ICONS[props.icon]);
</script>

<style scoped>
.toolbar-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
</style>
