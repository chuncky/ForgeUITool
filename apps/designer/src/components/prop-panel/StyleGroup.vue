<template>
  <PropGroup :hint="partStateHint">
    <template #title>样式</template>

    <div v-if="showPartState" class="selectors">
      <label class="sel">
        PART *
        <select v-model="part">
          <option v-for="p in styleParts" :key="p" :value="p">{{ partLabel(p) }}</option>
        </select>
      </label>
      <label class="sel">
        STATE *
        <select v-model="state">
          <option v-for="s in STYLE_STATES" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
    </div>

    <label v-for="sf in fields" :key="sf.key" class="field">
      {{ sf.label }}
      <input
        v-if="sf.type === 'number'"
        type="number"
        min="0"
        :value="Number(fieldValue(sf.key) ?? '')"
        @change="onField(sf.key, $event, 'number')"
      />
      <div v-else class="color-row">
        <input
          type="text"
          :value="String(fieldValue(sf.key) ?? '')"
          placeholder="#RRGGBBAA"
          @change="onField(sf.key, $event, 'text')"
        />
        <input
          type="color"
          class="color-swatch"
          :value="colorSwatch(fieldValue(sf.key))"
          @input="onColorField(sf.key, $event)"
        />
      </div>
    </label>
  </PropGroup>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import PropGroup from "./PropGroup.vue";
import { partLabel, STYLE_STATES } from "./constants";
import { colorSwatch, toRgbaHex } from "../../utils/color";
import { readStyleProp, styleFieldsForWidget } from "../../utils/style";

const props = defineProps<{
  widgetType: string;
  style: Record<string, unknown>;
  styleParts: string[];
}>();

const emit = defineEmits<{
  patch: [part: string, state: string, patch: Record<string, unknown>];
}>();

const part = ref("main");
const state = ref("default");

watch(
  () => [props.widgetType, props.styleParts] as const,
  () => {
    part.value = props.styleParts[0] ?? "main";
    state.value = "default";
  },
  { immediate: true },
);

const showPartState = computed(() => props.styleParts.length > 1);

const partStateHint = computed(() => {
  if (showPartState.value) return "";
  return `${partLabel(part.value)} · ${state.value.toUpperCase()}`;
});

const fields = computed(() => styleFieldsForWidget(props.widgetType));

function fieldValue(key: string) {
  return readStyleProp(props.style, part.value, state.value, key);
}

function onField(key: string, e: Event, kind: "number" | "text") {
  const raw = (e.target as HTMLInputElement).value;
  const value = kind === "number" ? Number(raw) : toRgbaHex(raw);
  emit("patch", part.value, state.value, { [key]: value });
}

function onColorField(key: string, e: Event) {
  emit("patch", part.value, state.value, { [key]: `${(e.target as HTMLInputElement).value}ff` });
}
</script>

<style scoped>
.selectors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sel {
  display: grid;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
}

.field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

select,
input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
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
</style>
