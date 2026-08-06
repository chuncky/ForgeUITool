<template>
  <div class="frames-editor">
    <div v-for="(frame, idx) in frames" :key="idx" class="row">
      <input
        :value="frameSrc(frame)"
        placeholder="assets/images/frame.png"
        @change="onSrc(idx, $event)"
      />
      <button type="button" class="icon" title="删除帧" @click="remove(idx)">×</button>
    </div>
    <button type="button" class="add" @click="add">+ 添加帧</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  model: Record<string, unknown>;
}>();

const emit = defineEmits<{
  change: [patch: Record<string, unknown>];
}>();

const frames = computed(() => {
  const raw = props.model.frames;
  if (!Array.isArray(raw)) return [];
  return raw as unknown[];
});

function frameSrc(frame: unknown) {
  if (frame && typeof frame === "object" && "src" in frame) return String((frame as { src: string }).src);
  if (typeof frame === "string") return frame;
  return "";
}

function emitFrames(next: unknown[]) {
  emit("change", { frames: next });
}

function onSrc(idx: number, e: Event) {
  const src = (e.target as HTMLInputElement).value;
  emitFrames(frames.value.map((f, i) => (i === idx ? { src } : asObj(f))));
}

function asObj(f: unknown): { src: string } {
  if (f && typeof f === "object" && !Array.isArray(f) && "src" in f) {
    return { src: String((f as { src: string }).src) };
  }
  if (typeof f === "string") return { src: f };
  return { src: "" };
}

function add() {
  emitFrames([...frames.value, { src: `assets/images/frame_${frames.value.length + 1}.png` }]);
}

function remove(idx: number) {
  emitFrames(frames.value.filter((_, i) => i !== idx));
}
</script>

<style scoped>
.frames-editor {
  display: grid;
  gap: 6px;
}

.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: center;
}

input {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

.icon,
.add {
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.icon {
  width: 28px;
  height: 28px;
  padding: 0;
}

.add {
  padding: 6px 8px;
  justify-self: start;
}
</style>
