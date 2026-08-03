<template>
  <div class="workspace-view">
    <WorkspaceGate v-if="!project.loaded" />
    <DesignerWorkbench v-else />
  </div>
</template>

<script setup lang="ts">
import WorkspaceGate from "../components/WorkspaceGate.vue";
import DesignerWorkbench from "../components/DesignerWorkbench.vue";
import { useProjectStore } from "../stores/project";

const project = useProjectStore();
</script>

<style scoped>
.workspace-view {
  height: 100%;
  min-height: 0;
}
</style>
