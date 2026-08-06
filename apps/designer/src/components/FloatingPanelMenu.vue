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
import { computed, nextTick, ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
  /** Anchor element (⋯ button). Ignored when `point` is set. */
  anchor?: HTMLElement | null;
  /** Client coordinates for context menu (FR-013c). */
  point?: { x: number; y: number } | null;
}>();

const emit = defineEmits<{
  "update:open": [boolean];
}>();

const menuEl = ref<HTMLElement | null>(null);
const adjusted = ref<{ top: number; left: number } | null>(null);

const menuStyle = computed(() => {
  if (props.point) {
    const pos = adjusted.value ?? { top: props.point.y, left: props.point.x };
    return {
      top: `${pos.top}px`,
      left: `${pos.left}px`,
      transform: "none",
    };
  }
  const el = props.anchor ?? null;
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

function clampToViewport() {
  adjusted.value = null;
  if (!props.open || !props.point || !menuEl.value) return;
  const rect = menuEl.value.getBoundingClientRect();
  const pad = 8;
  let left = props.point.x;
  let top = props.point.y;
  if (left + rect.width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - rect.width - pad);
  if (top + rect.height > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - rect.height - pad);
  adjusted.value = { top, left };
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      adjusted.value = null;
      return;
    }
    await nextTick();
    clampToViewport();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey, { once: true });
  },
);

watch(
  () => [props.point?.x, props.point?.y],
  async () => {
    if (!props.open || !props.point) return;
    await nextTick();
    clampToViewport();
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

.menu :deep(.menu-sep) {
  font-size: 10px;
  color: var(--muted);
  padding: 6px 12px 2px;
}
</style>
