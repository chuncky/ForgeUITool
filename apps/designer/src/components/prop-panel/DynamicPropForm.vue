<template>
  <div class="form">
    <label
      v-for="spec in specs"
      :key="spec.name"
      class="field"
      :class="{ 'field-bool': spec.type === 'boolean' }"
    >
      <template v-if="spec.type !== 'boolean'">{{ label(spec) }}</template>

      <textarea
        v-if="spec.type === 'text'"
        rows="3"
        :value="textVal(spec.name)"
        @change="emitChange(spec, $event)"
      />

      <input
        v-else-if="spec.type === 'number'"
        type="number"
        :value="Number(nodeProps[spec.name] ?? spec.default ?? 0)"
        @change="emitChange(spec, $event)"
      />

      <template v-else-if="spec.type === 'boolean'">
        <label class="check-row">
          <input
            type="checkbox"
            :checked="Boolean(nodeProps[spec.name] ?? spec.default)"
            @change="emitChange(spec, $event)"
          />
          <span>{{ label(spec) }}</span>
        </label>
      </template>

      <select
        v-else-if="spec.type === 'enum'"
        :value="String(nodeProps[spec.name] ?? spec.default ?? '')"
        @change="emitChange(spec, $event)"
      >
        <option v-for="opt in spec.enum ?? []" :key="opt" :value="opt">
          {{ spec.enumLabels?.[opt] ?? opt }}
        </option>
      </select>

      <div v-else-if="spec.type === 'color'" class="color-row">
        <input
          type="text"
          :value="String(nodeProps[spec.name] ?? spec.default ?? '')"
          placeholder="#RRGGBBAA"
          @change="emitChange(spec, $event)"
        />
        <input
          type="color"
          class="color-swatch"
          :value="colorSwatch(nodeProps[spec.name] ?? spec.default)"
          @input="onColorPick(spec, $event)"
        />
      </div>

      <div v-else-if="spec.type === 'imageSrc'" class="image-src-row">
        <input
          :value="String(nodeProps[spec.name] ?? spec.default ?? '')"
          placeholder="assets/..."
          @change="emitChange(spec, $event)"
        />
        <button type="button" class="mini" title="打开资源管理" @click="openAssets">资源</button>
      </div>

      <div v-else-if="spec.type === 'range'" class="range-row">
        <label>
          最小
          <input type="number" :value="rangeMin(spec.name)" @change="onRange(spec, 'min', $event)" />
        </label>
        <label>
          最大
          <input type="number" :value="rangeMax(spec.name)" @change="onRange(spec, 'max', $event)" />
        </label>
      </div>

      <input
        v-else
        :value="String(nodeProps[spec.name] ?? spec.default ?? '')"
        @change="emitChange(spec, $event)"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import type { PropSpecMeta } from "../../env";
import { colorSwatch, toRgbaHex } from "../../utils/color";
import { useUiStore } from "../../stores/ui";

const props = defineProps<{
  specs: PropSpecMeta[];
  nodeProps: Record<string, unknown>;
}>();

const emit = defineEmits<{
  change: [name: string, value: unknown];
}>();

const ui = useUiStore();

function label(spec: PropSpecMeta) {
  return spec.label ?? spec.name;
}

function textVal(name: string) {
  return String(props.nodeProps[name] ?? "");
}

function rangeObj(name: string): { min?: number; max?: number } {
  const v = props.nodeProps[name];
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as { min?: number; max?: number };
  }
  return {};
}

function rangeMin(name: string) {
  return rangeObj(name).min ?? 0;
}

function rangeMax(name: string) {
  return rangeObj(name).max ?? 100;
}

function emitChange(spec: PropSpecMeta, e: Event) {
  const el = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  let value: unknown = el.value;
  if (spec.type === "number") value = Number(el.value);
  if (spec.type === "boolean") value = (el as HTMLInputElement).checked;
  if (spec.type === "color") value = toRgbaHex(el.value);
  emit("change", spec.name, value);
}

function onColorPick(spec: PropSpecMeta, e: Event) {
  emit("change", spec.name, `${(e.target as HTMLInputElement).value}ff`);
}

function onRange(spec: PropSpecMeta, side: "min" | "max", e: Event) {
  const next = { ...rangeObj(spec.name), [side]: Number((e.target as HTMLInputElement).value) };
  emit("change", spec.name, next);
}

function openAssets() {
  ui.showAssets = true;
}
</script>

<style scoped>
.form {
  display: grid;
  gap: 8px;
}

.field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

.field-bool {
  color: var(--text);
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

input,
select,
textarea {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

textarea {
  resize: vertical;
  min-height: 56px;
}

.color-row {
  display: grid;
  grid-template-columns: 1fr 32px;
  gap: 6px;
  align-items: center;
}

.color-swatch {
  padding: 2px;
  height: 32px;
  cursor: pointer;
}

.image-src-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: center;
}

.range-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mini {
  padding: 6px 8px;
  font-size: 11px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
}
</style>
