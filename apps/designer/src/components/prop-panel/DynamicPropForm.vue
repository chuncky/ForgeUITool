<template>
  <div class="form">
    <label
      v-for="spec in specs"
      :key="spec.name"
      class="field"
      :class="{ 'field-bool': spec.type === 'boolean' }"
    >
      <template v-if="spec.type !== 'boolean'">{{ label(spec) }}</template>

      <!-- Keep text + i18n in one v-if branch; a bare v-if on i18n used to break the
           chain and also render the trailing v-else <input> (duplicate text box). -->
      <template v-if="spec.type === 'text'">
        <textarea
          v-if="spec.multiline"
          rows="3"
          :value="textVal(spec.name)"
          @change="emitChange(spec, $event)"
        />
        <input
          v-else
          type="text"
          :value="textVal(spec.name)"
          @change="emitChange(spec, $event)"
        />
        <div v-if="i18nEnabled && isPrimaryText(spec.name)" class="i18n-row">
          <label class="i18n-label">
            i18n 键
            <select :value="String(nodeProps.i18nKey ?? '')" @change="onI18nKey">
              <option value="">— 无 —</option>
              <option v-for="s in i18nKeys" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
          <span v-if="previewHint" class="preview-hint" title="预览语言下的译文">预览: {{ previewHint }}</span>
        </div>
      </template>

      <input
        v-else-if="spec.type === 'number'"
        type="number"
        step="1"
        :value="numberPropDisplay(spec)"
        @change="emitChange(spec, $event)"
        @input="onOpaInput(spec, $event)"
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
        <select
          v-if="imageOptions.length"
          :value="String(nodeProps[spec.name] ?? spec.default ?? '')"
          @change="emitChange(spec, $event)"
        >
          <option value="">— 选择 —</option>
          <option v-for="opt in imageOptions" :key="opt.path" :value="opt.path">{{ opt.id }}</option>
        </select>
        <input
          v-else
          :value="String(nodeProps[spec.name] ?? spec.default ?? '')"
          placeholder="assets/images/..."
          @change="emitChange(spec, $event)"
        />
        <button type="button" class="mini" title="从资源管理选择" @click="pickImage(spec.name)">选择</button>
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
import { useProjectStore } from "../../stores/project";
import { computed } from "vue";
import { DEFAULT_STYLE_OPACITY, wrapOpacity255 } from "@forgeui/core/opacity";

/** Props that use LVGL 0–255 opacity/brightness scale (BK). */
const OPA_PROP_NAMES = new Set(["bright"]);

const props = defineProps<{
  specs: PropSpecMeta[];
  nodeProps: Record<string, unknown>;
}>();

const emit = defineEmits<{
  change: [name: string, value: unknown];
}>();

const ui = useUiStore();
const projectStore = useProjectStore();

const imageOptions = computed(() => projectStore.imageAssets);
const i18nEnabled = computed(() => !!projectStore.i18nConfig.enabled);
const i18nKeys = computed(() => projectStore.i18nConfig.strings.map((s) => s.id));
const previewHint = computed(() => {
  const key = typeof props.nodeProps.i18nKey === "string" ? props.nodeProps.i18nKey : "";
  if (!key || !i18nEnabled.value) return "";
  const entry = projectStore.i18nConfig.strings.find((s) => s.id === key);
  if (!entry) return "";
  const loc = projectStore.i18nConfig.previewLocale ?? projectStore.i18nConfig.defaultLocale;
  return entry.values[loc] ?? "";
});

function isOpaProp(name: string) {
  return OPA_PROP_NAMES.has(name);
}

function numberPropDisplay(spec: PropSpecMeta): number {
  const raw = props.nodeProps[spec.name] ?? spec.default;
  if (raw == null || raw === "") {
    return isOpaProp(spec.name) ? DEFAULT_STYLE_OPACITY : 0;
  }
  return Number(raw);
}

function onOpaInput(spec: PropSpecMeta, e: Event) {
  if (!isOpaProp(spec.name)) return;
  const el = e.target as HTMLInputElement;
  const value = wrapOpacity255(el.value);
  if (el.value !== String(value)) el.value = String(value);
  emit("change", spec.name, value);
}

function isPrimaryText(name: string) {
  return name === "text" || name === "label" || name === "title";
}

function onI18nKey(e: Event) {
  emit("change", "i18nKey", (e.target as HTMLSelectElement).value);
}

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
  if (spec.type === "number") {
    value = isOpaProp(spec.name) ? wrapOpacity255(el.value) : Number(el.value);
    if (isOpaProp(spec.name) && el instanceof HTMLInputElement && el.value !== String(value)) {
      el.value = String(value);
    }
  }
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

function pickImage(fieldName: string) {
  ui.openAssetsForImagePick((path) => emit("change", fieldName, path));
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

.image-src-row select {
  min-width: 0;
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

.i18n-row {
  display: grid;
  gap: 4px;
  margin-top: 4px;
}

.i18n-label {
  display: grid;
  gap: 4px;
  font-size: 11px;
}

.preview-hint {
  font-size: 11px;
  color: var(--accent, #3d9cf0);
  opacity: 0.9;
}
</style>
