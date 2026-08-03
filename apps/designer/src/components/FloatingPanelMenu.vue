<template>
  <Teleport to="body">
    <template v-if="open">
      <div class="backdrop" @mousedown="close" />
      <div ref="menuEl" class="menu" :style="menuStyle" @mousedown.stop>
        <slot />
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
  anchor: HTMLElement | null;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
}>();

const menuEl = ref<HTMLElement | null>(null);

const menuStyle = computed(() => {
  const el = props.anchor;
  if (!el) return { display: "none" };
  const r = el.getBoundingClientRect();
  return {
    top: `${r.bottom + 4}px`,
    left: `${r.right}px`,
    transform: "translateX(-100%)",
  };
});

function close() {
  emit("update:open", false);
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey, { once: true });
  },
);
</script>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2999;
  background: transparent;
}

.menu {
  position: fixed;
  z-index: 3000;
  min-width: 130px;
  display: grid;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.45);
}

.menu :deep(button) {
  text-align: left;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.menu :deep(button:hover) {
  background: rgba(61, 156, 240, 0.15);
}

.menu :deep(button.danger) {
  color: #ffb4b4;
}
</style>
