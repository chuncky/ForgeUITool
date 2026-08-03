import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Preview / long-running toolchain state (FR-061a).
 * While busy, canvas editing is disabled so IPC mutations do not queue behind cmake.
 */
export const usePreviewStore = defineStore("preview", () => {
  const busy = ref(false);
  const phase = ref("");

  function begin(label: string) {
    busy.value = true;
    phase.value = label;
  }

  function end() {
    busy.value = false;
    phase.value = "";
  }

  return { busy, phase, begin, end };
});
